
import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';

export async function createContract(context, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const supplier = await client.query(
      'SELECT 1 FROM suppliers WHERE tenant_id = $1 AND id = $2',
      [context.tenantId, input.supplierId]
    );

    if (!supplier.rowCount) {
      throw new AppError(
        422,
        'INVALID_SUPPLIER',
        'Supplier does not belong to this tenant'
      );
    }

    try {
      const result = await client.query(
        `INSERT INTO contracts
           (tenant_id, supplier_id, contract_number, title, description, currency,
            contract_value, starts_on, ends_on, terms, document_storage_key, created_by)
         VALUES ($1, $2, $3, $4, $5, upper($6), $7, $8, $9, $10::jsonb, $11, $12)
         RETURNING *`,
        [
          context.tenantId,
          input.supplierId,
          input.contractNumber,
          input.title,
          input.description ?? null,
          input.currency,
          input.contractValue ?? null,
          input.startsOn ?? null,
          input.endsOn ?? null,
          JSON.stringify(input.terms ?? {}),
          input.documentStorageKey ?? null,
          context.userId,
        ]
      );

      await audit(client, context, 'contract.created', result.rows[0].id, {
        fiscalYear: input.fiscalYear,
        currency: input.currency,
      });

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'CONTRACT_NUMBER_EXISTS',
          'A contract with this number already exists'
        );
      }

      throw error;
    }
  });
}

export async function listContracts(context, options) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const values = [
      context.tenantId,
      options.status ?? null,
      options.supplierId ?? null,
      options.search ? `%${options.search}%` : null,
    ];

    const result = await client.query(
      `SELECT * FROM contracts
       WHERE tenant_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND ($3::uuid IS NULL OR supplier_id = $3)
         AND ($4::text IS NULL OR title ILIKE $4 OR contract_number ILIKE $4)
       ORDER BY created_at DESC, id DESC
       LIMIT $5 OFFSET $6`,
      [...values, options.limit, options.offset]
    );

    const count = await client.query(
      `SELECT count(*)::text AS total FROM contracts
       WHERE tenant_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND ($3::uuid IS NULL OR supplier_id = $3)
         AND ($4::text IS NULL OR title ILIKE $4 OR contract_number ILIKE $4)`,
      values
    );

    return {
      data: result.rows,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: count.rows[0].total,
      },
    };
  });
}

export async function getContract(context, id) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      'SELECT * FROM contracts WHERE tenant_id = $1 AND id = $2',
      [context.tenantId, id]
    );

    if (!result.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Contract not found');
    }

    return result.rows[0];
  });
}

export async function updateContract(context, id, input) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT status, starts_on, ends_on
       FROM contracts
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!current.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Contract not found');
    }

    if (current.rows[0].status !== 'DRAFT') {
      throw new AppError(
        409,
        'CONTRACT_LOCKED',
        'Only draft contracts can be edited'
      );
    }

    const startsOn =
      input.startsOn === undefined
        ? current.rows[0].starts_on
        : input.startsOn;

    const endsOn =
      input.endsOn === undefined
        ? current.rows[0].ends_on
        : input.endsOn;

    if (startsOn && endsOn && endsOn < startsOn) {
      throw new AppError(
        400,
        'INVALID_DATES',
        'endsOn must be on or after startsOn'
      );
    }

    if (input.supplierId !== undefined) {
      const supplier = await client.query(
        'SELECT 1 FROM suppliers WHERE tenant_id = $1 AND id = $2',
        [context.tenantId, input.supplierId]
      );

      if (!supplier.rowCount) {
        throw new AppError(
          422,
          'INVALID_SUPPLIER',
          'Supplier does not belong to this tenant'
        );
      }
    }

    const columns = {
      contractNumber: 'contract_number',
      supplierId: 'supplier_id',
      title: 'title',
      description: 'description',
      currency: 'currency',
      contractValue: 'contract_value',
      startsOn: 'starts_on',
      endsOn: 'ends_on',
      terms: 'terms',
      documentStorageKey: 'document_storage_key',
    };

    const assignments = [];
    const values = [context.tenantId, id];

    for (const key of Object.keys(input)) {
      const column = columns[key];

      // Ignore keys that do not map to a database column.
      if (!column) continue;

      values.push(
        key === 'terms' ? JSON.stringify(input[key]) : input[key]
      );

      const placeholder = `$${values.length}`;

      if (key === 'terms') {
        assignments.push(`${column} = ${placeholder}::jsonb`);
      } else if (key === 'currency') {
        assignments.push(`${column} = upper(${placeholder})`);
      } else {
        assignments.push(`${column} = ${placeholder}`);
      }
    }

    assignments.push('updated_at = now()');

    try {
      const result = await client.query(
        `UPDATE contracts
         SET ${assignments.join(', ')}
         WHERE tenant_id = $1 AND id = $2
         RETURNING *`,
        values
      );

      await audit(client, context, 'contract.updated', id, {
        fields: Object.keys(input),
      });

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'CONTRACT_NUMBER_EXISTS',
          'A contract with this number already exists'
        );
      }

      if (isForeignKeyViolation(error)) {
        throw new AppError(
          422,
          'INVALID_SUPPLIER',
          'Supplier does not belong to this tenant'
        );
      }

      throw error;
    }
  });
}

const transitions = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['ACTIVE'],
  ACTIVE: ['EXPIRED', 'TERMINATED', 'CLOSED'],
  EXPIRED: [],
  TERMINATED: [],
  CLOSED: [],
};

export async function changeContractStatus(context, id, status) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT status, starts_on, ends_on
       FROM contracts
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!current.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Contract not found');
    }

    const oldStatus = current.rows[0].status;

    if (!transitions[oldStatus]?.includes(status)) {
      throw new AppError(
        409,
        'INVALID_STATE',
        `Contract cannot transition from ${oldStatus} to ${status}`
      );
    }

    if (status === 'ACTIVE') {
      const today = new Date().toISOString().slice(0, 10);

      if (current.rows[0].starts_on && current.rows[0].starts_on > today) {
        throw new AppError(
          409,
          'CONTRACT_NOT_STARTED',
          'A contract cannot be activated before its start date'
        );
      }

      if (current.rows[0].ends_on && current.rows[0].ends_on < today) {
        throw new AppError(
          409,
          'CONTRACT_EXPIRED',
          'An expired contract cannot be activated'
        );
      }
    }

    const result = await client.query(
      `UPDATE contracts
       SET status = $3, updated_at = now()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [context.tenantId, id, status]
    );

    await audit(client, context, 'contract.status_changed', id, {
      from: oldStatus,
      to: status,
    });

    return result.rows[0];
  });
}

export async function deleteContract(context, id) {
  await withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT status FROM contracts
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!current.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Contract not found');
    }

    if (current.rows[0].status === 'ACTIVE') {
      throw new AppError(
        409,
        'ACTIVE_CONTRACT',
        'Active contracts cannot be deleted'
      );
    }

    await audit(client, context, 'contract.deleted', id, {
      status: current.rows[0].status,
    });

    await client.query(
      'DELETE FROM contracts WHERE tenant_id = $1 AND id = $2',
      [context.tenantId, id]
    );
  });
}

async function audit(client, context, action, id, metadata) {
  await client.query(
    `INSERT INTO audit_events
       (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, 'contract', $4, $5::jsonb)`,
    [
      context.tenantId,
      context.userId,
      action,
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

function isForeignKeyViolation(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23503'
  );
}
