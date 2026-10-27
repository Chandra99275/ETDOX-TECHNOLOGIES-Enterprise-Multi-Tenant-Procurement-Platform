
import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';

export async function getBillingAccount(context) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      'SELECT * FROM billing_accounts WHERE tenant_id = $1',
      [context.tenantId]
    );

    if (!result.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Billing account not found');
    }

    return result.rows[0];
  });
}

export async function upsertBillingAccount(context, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const columns = {
      provider: 'provider',
      providerCustomerId: 'provider_customer_id',
      billingEmail: 'billing_email',
      billingDetails: 'billing_details',
      status: 'status',
    };

    const keys = Object.keys(input);
    const values = [context.tenantId];
    const insertColumns = ['tenant_id'];
    const placeholders = ['$1'];
    const updates = [];

    for (const key of keys) {
      values.push(
        key === 'billingDetails'
          ? JSON.stringify(input.billingDetails)
          : input[key]
      );

      const placeholder = `$${values.length}${
        key === 'billingDetails' ? '::jsonb' : ''
      }`;

      insertColumns.push(columns[key]);
      placeholders.push(placeholder);
      updates.push(`${columns[key]} = EXCLUDED.${columns[key]}`);
    }

    updates.push('updated_at = now()');

    try {
      const result = await client.query(
        `INSERT INTO billing_accounts (${insertColumns.join(', ')})
         VALUES (${placeholders.join(', ')})
         ON CONFLICT (tenant_id)
         DO UPDATE SET ${updates.join(', ')}
         RETURNING *`,
        values
      );

      await audit(
        client,
        context,
        'billing_account.upserted',
        'billing_account',
        result.rows[0].id,
        { fields: keys }
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'BILLING_PROVIDER_EXISTS',
          'Provider customer is already linked to another billing account'
        );
      }

      throw error;
    }
  });
}

export async function changeBillingAccountStatus(context, status) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT id, status
       FROM billing_accounts
       WHERE tenant_id = $1
       FOR UPDATE`,
      [context.tenantId]
    );

    if (!current.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Billing account not found');
    }

    if (current.rows[0].status === status) {
      const existing = await client.query(
        'SELECT * FROM billing_accounts WHERE tenant_id = $1',
        [context.tenantId]
      );

      return existing.rows[0];
    }

    const result = await client.query(
      `UPDATE billing_accounts
       SET status = $2, updated_at = now()
       WHERE tenant_id = $1
       RETURNING *`,
      [context.tenantId, status]
    );

    await audit(
      client,
      context,
      'billing_account.status_changed',
      'billing_account',
      current.rows[0].id,
      {
        from: current.rows[0].status,
        to: status,
      }
    );

    return result.rows[0];
  });
}

export async function listEntitlements(context, options) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT *
       FROM entitlements
       WHERE tenant_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [context.tenantId, options.limit, options.offset]
    );

    const count = await client.query(
      `SELECT count(*)::text AS total
       FROM entitlements
       WHERE tenant_id = $1`,
      [context.tenantId]
    );

    return {
      data: result.rows,
      pagination: {
        ...options,
        total: count.rows[0].total,
      },
    };
  });
}

export async function createEntitlement(context, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    if (
      input.endsAt &&
      Date.parse(input.endsAt) <= Date.now() &&
      !input.startsAt
    ) {
      throw new AppError(
        400,
        'INVALID_DATE_RANGE',
        'endsAt must be in the future'
      );
    }

    try {
      const result = await client.query(
        `INSERT INTO entitlements
           (tenant_id, entitlement_key, value, starts_at, ends_at)
         VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, now()), $5::timestamptz)
         RETURNING *`,
        [
          context.tenantId,
          input.entitlementKey,
          JSON.stringify(input.value),
          input.startsAt ?? null,
          input.endsAt ?? null,
        ]
      );

      await audit(
        client,
        context,
        'entitlement.created',
        'entitlement',
        result.rows[0].id,
        { entitlementKey: input.entitlementKey }
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'ENTITLEMENT_EXISTS',
          'An entitlement with this key already exists'
        );
      }

      if (isCheckViolation(error)) {
        throw new AppError(
          400,
          'INVALID_DATE_RANGE',
          'endsAt must be after startsAt'
        );
      }

      throw error;
    }
  });
}

export async function updateEntitlement(context, id, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT starts_at, ends_at
       FROM entitlements
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!current.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Entitlement not found');
    }

    const startsAt = input.startsAt ?? current.rows[0].starts_at;
    const endsAt =
      input.endsAt === undefined
        ? current.rows[0].ends_at
        : input.endsAt;

    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
      throw new AppError(
        400,
        'INVALID_DATE_RANGE',
        'endsAt must be after startsAt'
      );
    }

    const columns = {
      entitlementKey: 'entitlement_key',
      value: 'value',
      startsAt: 'starts_at',
      endsAt: 'ends_at',
    };

    const values = [context.tenantId, id];
    const assignments = [];

    for (const key of Object.keys(input)) {
      values.push(
        key === 'value'
          ? JSON.stringify(input.value)
          : input[key]
      );

      assignments.push(
        `${columns[key]} = $${values.length}${
          key === 'value'
            ? '::jsonb'
            : key === 'startsAt' || key === 'endsAt'
              ? '::timestamptz'
              : ''
        }`
      );
    }

    try {
      const result = await client.query(
        `UPDATE entitlements
         SET ${assignments.join(', ')}
         WHERE tenant_id = $1 AND id = $2
         RETURNING *`,
        values
      );

      await audit(
        client,
        context,
        'entitlement.updated',
        'entitlement',
        id,
        { fields: Object.keys(input) }
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'ENTITLEMENT_EXISTS',
          'An entitlement with this key already exists'
        );
      }

      if (isCheckViolation(error)) {
        throw new AppError(
          400,
          'INVALID_DATE_RANGE',
          'endsAt must be after startsAt'
        );
      }

      throw error;
    }
  });
}

export async function deleteEntitlement(context, id) {
  await withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT entitlement_key
       FROM entitlements
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!result.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Entitlement not found');
    }

    await audit(
      client,
      context,
      'entitlement.deleted',
      'entitlement',
      id,
      { entitlementKey: result.rows[0].entitlement_key }
    );

    await client.query(
      'DELETE FROM entitlements WHERE tenant_id = $1 AND id = $2',
      [context.tenantId, id]
    );
  });
}

async function audit(
  client,
  context,
  action,
  resourceType,
  id,
  metadata
) {
  await client.query(
    `INSERT INTO audit_events
       (tenant_id, actor_type, actor_id, action, resource_type,
        resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, $4, $5, $6::jsonb)`,
    [
      context.tenantId,
      context.userId,
      action,
      resourceType,
      id,
      JSON.stringify(metadata),
    ]
  );
}

function isUniqueViolation(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

function isCheckViolation(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23514'
  );
}
