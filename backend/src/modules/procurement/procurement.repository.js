
import { pool } from '../../config/database.js';

function mapRequest(row) {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    requesterId: row.requester_id,

    // Map API fields to the actual database schema.
    title: row.request_number,
    description: row.justification ?? '',
    amount: Number(row.total_amount),
    currency: row.currency,
    status: String(row.status).toLowerCase(),

    // These fields do not exist in the current database schema.
    financeComment: null,
    financeDecidedBy: null,
    financeDecidedAt: row.approved_at ?? null,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REQUEST_COLUMNS = `
  id,
  tenant_id,
  request_number,
  requester_id,
  justification,
  currency,
  subtotal,
  tax_total,
  total_amount,
  status,
  approved_at,
  created_at,
  updated_at
`;

function normalizeStatus(status) {
  if (status == null || status === '') return null;

  const normalized = String(status).toUpperCase();

  const allowedStatuses = new Set([
    'DRAFT',
    'SUBMITTED',
    'IN_APPROVAL',
    'APPROVED',
    'REJECTED',
    'CHANGES_REQUESTED',
    'CANCELLED',
    'CONVERTED_TO_PO',
  ]);

  if (!allowedStatuses.has(normalized)) {
    throw new Error(`Invalid purchase request status: ${status}`);
  }

  return normalized;
}

function makeRequestNumber() {
  return `PR-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

export async function listRequests({
  tenantId,
  page = 1,
  limit = 10,
  status,
  search = '',
  userId,
  canViewAll = false,
}) {
  const offset = (page - 1) * limit;
  const normalizedStatus = normalizeStatus(status);
  const searchPattern = `%${search}%`;

  const params = [
    tenantId,
    normalizedStatus,
    searchPattern,
    userId,
    canViewAll,
    limit,
    offset,
  ];

  const whereClause = `
    WHERE tenant_id = $1
      AND ($2::text IS NULL OR status = $2)
      AND (
        $3 = '%%'
        OR request_number ILIKE $3
        OR COALESCE(justification, '') ILIKE $3
      )
      AND ($5::boolean = TRUE OR requester_id = $4)
  `;

  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `
        SELECT ${REQUEST_COLUMNS}
        FROM purchase_requests
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $6 OFFSET $7
      `,
      params
    ),

    pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM purchase_requests
        ${whereClause}
      `,
      params.slice(0, 5)
    ),
  ]);

  return {
    requests: rowsResult.rows.map(mapRequest),
    total: countResult.rows[0].total,
  };
}

export async function findById({
  tenantId,
  requestId,
  userId,
  canViewAll,
}) {
  const result = await pool.query(
    `
      SELECT ${REQUEST_COLUMNS}
      FROM purchase_requests
      WHERE tenant_id = $1
        AND id = $2
        AND ($4::boolean = TRUE OR requester_id = $3)
      LIMIT 1
    `,
    [tenantId, requestId, userId, canViewAll]
  );

  return mapRequest(result.rows[0]);
}

export async function createRequest({
  tenantId,
  requesterId,
  title,
  description,
  amount,
  currency,
}) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error('Amount must be a valid non-negative number');
  }

  if (!currency || !/^[A-Za-z]{3}$/.test(currency)) {
    throw new Error('Currency must be a valid three-letter currency code');
  }

  const requestNumber = makeRequestNumber();

  // The schema has no separate title column.
  // Store the supplied description in justification.
  const justification = [title, description]
    .filter((value) => value != null && String(value).trim() !== '')
    .join('\n\n');

  const result = await pool.query(
    `
      INSERT INTO purchase_requests (
        tenant_id,
        request_number,
        requester_id,
        justification,
        currency,
        subtotal,
        tax_total,
        total_amount,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 0, $6, 'DRAFT'
      )
      RETURNING ${REQUEST_COLUMNS}
    `,
    [
      tenantId,
      requestNumber,
      requesterId,
      justification || null,
      currency.toUpperCase(),
      numericAmount,
    ]
  );

  return mapRequest(result.rows[0]);
}

export async function updateDraft({
  tenantId,
  requestId,
  userId,
  canManageAll,
  updates,
}) {
  const columnMap = {
    description: 'justification',
    currency: 'currency',
  };

  const entries = Object.entries(updates ?? {});

  if (entries.length === 0) {
    return findById({
      tenantId,
      requestId,
      userId,
      canViewAll: canManageAll,
    });
  }

  const values = [tenantId, requestId, userId, canManageAll];
  const setClauses = [];

  for (const [key, value] of entries) {
    if (key === 'title') {
      throw new Error(
        'Title cannot be updated separately because purchase_requests has no title column'
      );
    }

    if (key === 'amount') {
      const numericAmount = Number(value);

      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw new Error('Amount must be a valid non-negative number');
      }

      values.push(numericAmount);
      const index = values.length;

      setClauses.push(`subtotal = $${index}`);
      setClauses.push(`total_amount = $${index}`);
      continue;
    }

    const column = columnMap[key];

    if (!column) {
      throw new Error(`Unsupported purchase request field: ${key}`);
    }

    if (key === 'currency') {
      if (!/^[A-Za-z]{3}$/.test(String(value))) {
        throw new Error('Currency must be a valid three-letter currency code');
      }

      values.push(String(value).toUpperCase());
    } else {
      values.push(value);
    }

    setClauses.push(`${column} = $${values.length}`);
  }

  values.push('DRAFT');

  const result = await pool.query(
    `
      UPDATE purchase_requests
      SET ${setClauses.join(', ')},
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND ($4::boolean = TRUE OR requester_id = $3)
        AND status = $${values.length}
      RETURNING ${REQUEST_COLUMNS}
    `,
    values
  );

  return mapRequest(result.rows[0]);
}

export async function submitDraft({
  tenantId,
  requestId,
  userId,
}) {
  const result = await pool.query(
    `
      UPDATE purchase_requests
      SET status = 'SUBMITTED',
          submitted_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND requester_id = $3
        AND status = 'DRAFT'
      RETURNING ${REQUEST_COLUMNS}
    `,
    [tenantId, requestId, userId]
  );

  return mapRequest(result.rows[0]);
}

export async function recordFinanceDecision({
  tenantId,
  requestId,
  actorId,
  decision,
  comment,
}) {
  // The current schema has no finance_comment or
  // finance_decided_by columns. Do not query nonexistent columns.
  const normalizedDecision = String(decision).toLowerCase();

  if (!['approved', 'rejected'].includes(normalizedDecision)) {
    throw new Error('Decision must be approved or rejected');
  }

  const nextStatus =
    normalizedDecision === 'approved' ? 'APPROVED' : 'REJECTED';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
        SELECT id, status
        FROM purchase_requests
        WHERE tenant_id = $1
          AND id = $2
        FOR UPDATE
      `,
      [tenantId, requestId]
    );

    if (existing.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const currentStatus = existing.rows[0].status;

    if (!['SUBMITTED', 'IN_APPROVAL'].includes(currentStatus)) {
      await client.query('ROLLBACK');
      return null;
    }

    const result = await client.query(
      `
        UPDATE purchase_requests
        SET status = $3,
            approved_at = CASE
              WHEN $3 = 'APPROVED' THEN NOW()
              ELSE NULL
            END,
            updated_at = NOW()
        WHERE tenant_id = $1
          AND id = $2
        RETURNING ${REQUEST_COLUMNS}
      `,
      [tenantId, requestId, nextStatus]
    );

    await client.query('COMMIT');

    return mapRequest(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
