import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';

export async function createSupplier(context, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    try {
      const result = await client.query(
        `INSERT INTO suppliers
           (tenant_id, supplier_code, legal_name, tax_identifier, currency, payment_terms, contact_email)
         VALUES ($1, upper($2), $3, $4, upper($5), $6, lower($7))
         RETURNING *`,
        [
          context.tenantId,
          input.supplierCode,
          input.legalName,
          input.taxIdentifier ?? null,
          input.currency,
          input.paymentTerms ?? null,
          input.contactEmail ?? null,
        ]
      );

      await client.query(
        `INSERT INTO audit_events
           (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
         VALUES ($1, 'USER', $2, 'supplier.created', 'supplier', $3, '{}'::jsonb)`,
        [context.tenantId, context.userId, result.rows[0].id]
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'SUPPLIER_CODE_EXISTS',
          'A supplier with this code already exists'
        );
      }

      throw error;
    }
  });
}

function isUniqueViolation(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

export async function listSuppliers(context, options) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const values = [
      context.tenantId,
      options.status ?? null,
      options.search ? `%${options.search}%` : null,
    ];

    const result = await client.query(
      `SELECT * FROM suppliers
       WHERE tenant_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND (
           $3::text IS NULL
           OR legal_name ILIKE $3
           OR supplier_code ILIKE $3
           OR contact_email ILIKE $3
         )
       ORDER BY created_at DESC, id DESC
       LIMIT $4 OFFSET $5`,
      [...values, options.limit, options.offset]
    );

    const count = await client.query(
      `SELECT count(*)::text AS total FROM suppliers
       WHERE tenant_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND (
           $3::text IS NULL
           OR legal_name ILIKE $3
           OR supplier_code ILIKE $3
           OR contact_email ILIKE $3
         )`,
      values
    );

    return {
      data: result.rows,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: Number(count.rows[0].total),
      },
    };
  });
}

export async function getSupplier(context, id) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      'SELECT * FROM suppliers WHERE tenant_id = $1 AND id = $2',
      [context.tenantId, id]
    );

    if (!result.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
    }

    return result.rows[0];
  });
}

export async function updateSupplier(context, id, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `UPDATE suppliers SET
         legal_name = COALESCE($3, legal_name),
         tax_identifier = COALESCE($4, tax_identifier),
         currency = COALESCE(upper($5), currency),
         payment_terms = COALESCE($6, payment_terms),
         contact_email = COALESCE(lower($7), contact_email),
         updated_at = now()
       WHERE tenant_id = $1
         AND id = $2
         AND status IN ('DRAFT', 'PENDING_REVIEW')
       RETURNING *`,
      [
        context.tenantId,
        id,
        input.legalName ?? null,
        input.taxIdentifier ?? null,
        input.currency ?? null,
        input.paymentTerms ?? null,
        input.contactEmail ?? null,
      ]
    );

    if (!result.rowCount) {
      throw new AppError(
        404,
        'NOT_FOUND_OR_LOCKED',
        'Supplier was not found or can no longer be edited'
      );
    }

    await client.query(
      `INSERT INTO audit_events
         (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'USER', $2, 'supplier.updated', 'supplier', $3, $4::jsonb)`,
      [
        context.tenantId,
        context.userId,
        id,
        JSON.stringify({ fields: Object.keys(input) }),
      ]
    );

    return result.rows[0];
  });
}

const allowedTransitions = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['ACTIVE', 'REJECTED', 'SUSPENDED'],
  ACTIVE: ['SUSPENDED', 'ARCHIVED'],
  SUSPENDED: ['ACTIVE', 'ARCHIVED'],
  REJECTED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: [],
};

export async function changeSupplierStatus(context, id, status) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT status FROM suppliers
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!current.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
    }

    if (!allowedTransitions[current.rows[0].status]?.includes(status)) {
      throw new AppError(
        409,
        'INVALID_STATE',
        `Supplier cannot transition from ${current.rows[0].status} to ${status}`
      );
    }

    const result = await client.query(
      `UPDATE suppliers
       SET status = $3, updated_at = now()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [context.tenantId, id, status]
    );

    await client.query(
      `INSERT INTO audit_events
         (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'USER', $2, 'supplier.status_changed', 'supplier', $3, $4::jsonb)`,
      [
        context.tenantId,
        context.userId,
        id,
        JSON.stringify({
          from: current.rows[0].status,
          to: status,
        }),
      ]
    );

    return result.rows[0];
  });
}