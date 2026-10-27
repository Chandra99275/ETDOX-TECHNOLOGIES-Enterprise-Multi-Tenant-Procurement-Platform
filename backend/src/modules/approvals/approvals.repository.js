import { pool } from '../../config/database.js';

function mapApproval(row) {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    requestId: row.purchase_request_id,
    approverId: row.approver_id,
    status: row.status,
    comment: row.comment,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const APPROVAL_COLUMNS = `
  id,
  tenant_id,
  purchase_request_id,
  approver_id,
  status,
  comment,
  decided_at,
  created_at,
  updated_at
`;

export async function listByTenant({
  tenantId,
  userId,
  canViewAll,
  page,
  limit,
  status,
}) {
  const offset = (page - 1) * limit;

  const params = [
    tenantId,
    userId,
    canViewAll,
    status,
  ];

  const whereClause = `
    WHERE tenant_id = $1
      AND ($3::boolean = TRUE OR approver_id = $2)
      AND ($4::text IS NULL OR status = $4)
  `;

  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `
        SELECT ${APPROVAL_COLUMNS}
        FROM approvals
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $5 OFFSET $6
      `,
      [...params, limit, offset]
    ),

    pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM approvals
        ${whereClause}
      `,
      params
    ),
  ]);

  return {
    approvals: rowsResult.rows.map(mapApproval),
    total: countResult.rows[0].total,
  };
}

export async function findById({
  tenantId,
  userId,
  approvalId,
  canViewAll,
}) {
  const result = await pool.query(
    `
      SELECT ${APPROVAL_COLUMNS}
      FROM approvals
      WHERE tenant_id = $1
        AND id = $2
        AND ($4::boolean = TRUE OR approver_id = $3)
      LIMIT 1
    `,
    [tenantId, approvalId, userId, canViewAll]
  );

  return mapApproval(result.rows[0]);
}

export async function recordDecision({
  tenantId,
  userId,
  approvalId,
  decision,
  comment,
}) {
  const result = await pool.query(
    `
      UPDATE approvals
      SET status = $4,
          comment = $5,
          decided_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND approver_id = $3
        AND status = 'pending'
      RETURNING ${APPROVAL_COLUMNS}
    `,
    [tenantId, approvalId, userId, decision, comment]
  );

  return mapApproval(result.rows[0]);
}