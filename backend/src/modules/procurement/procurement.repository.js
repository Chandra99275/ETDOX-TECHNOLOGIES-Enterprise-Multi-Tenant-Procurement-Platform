import { pool } from '../../config/database.js';

function mapRequest(row) {
  if (!row) return null;

  const titlePart = row.product_name || (row.justification ? row.justification.split('\n')[0] : row.request_number);

  return {
    id: row.id,
    requestId: row.id,
    tenantId: row.tenant_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name || 'Employee',
    requesterEmail: row.requester_email || '',
    requestNumber: row.request_number,
    title: row.request_number,
    productName: titlePart || row.request_number,
    description: row.justification ?? '',
    justification: row.justification ?? '',
    amount: Number(row.total_amount),
    total: Number(row.total_amount),
    totalAmount: Number(row.total_amount),
    quantity: Number(row.quantity ?? 1),
    unitPrice: Number(row.unit_price ?? row.total_amount),
    currency: row.currency,
    department: row.department_name || '',
    supplier: row.supplier_name || '',
    status: row.status,

    financeComment: row.finance_comment ?? null,
    financeDecidedBy: row.finance_decided_by ?? null,
    financeDecidedAt: row.approved_at ?? null,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REQUEST_SELECT = `
  pr.id,
  pr.tenant_id,
  pr.request_number,
  pr.requester_id,
  pr.department_id,
  pr.cost_center_id,
  pr.preferred_supplier_id,
  pr.justification,
  pr.currency,
  pr.subtotal,
  pr.tax_total,
  pr.total_amount,
  pr.status,
  pr.approved_at,
  pr.created_at,
  pr.updated_at,
  TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS requester_name,
  u.email AS requester_email,
  d.name AS department_name,
  s.legal_name AS supplier_name,
  pri.description AS product_name,
  pri.quantity,
  pri.unit_price
`;

const FROM_CLAUSE = `
  FROM purchase_requests pr
  LEFT JOIN users u ON u.tenant_id = pr.tenant_id AND u.id = pr.requester_id
  LEFT JOIN departments d ON d.tenant_id = pr.tenant_id AND d.id = pr.department_id
  LEFT JOIN suppliers s ON s.tenant_id = pr.tenant_id AND s.id = pr.preferred_supplier_id
  LEFT JOIN LATERAL (
    SELECT description, quantity, unit_price
    FROM purchase_request_items
    WHERE tenant_id = pr.tenant_id AND purchase_request_id = pr.id
    ORDER BY line_number ASC
    LIMIT 1
  ) pri ON true
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
    return null;
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
  limit = 20,
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
    WHERE pr.tenant_id = $1
      AND ($2::text IS NULL OR pr.status = $2)
      AND (
        $3 = '%%'
        OR pr.request_number ILIKE $3
        OR COALESCE(pr.justification, '') ILIKE $3
        OR COALESCE(u.email, '') ILIKE $3
        OR COALESCE(u.first_name, '') ILIKE $3
        OR COALESCE(u.last_name, '') ILIKE $3
      )
      AND ($5::boolean = TRUE OR pr.requester_id = $4)
  `;

  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `
        SELECT ${REQUEST_SELECT}
        ${FROM_CLAUSE}
        ${whereClause}
        ORDER BY pr.created_at DESC
        LIMIT $6 OFFSET $7
      `,
      params
    ),

    pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM purchase_requests pr
        LEFT JOIN users u ON u.tenant_id = pr.tenant_id AND u.id = pr.requester_id
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
      SELECT ${REQUEST_SELECT}
      ${FROM_CLAUSE}
      WHERE pr.tenant_id = $1
        AND pr.id = $2
        AND ($4::boolean = TRUE OR pr.requester_id = $3)
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
  quantity = 1,
  unitPrice,
  department,
  budgetId,
  supplier,
}) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error('Amount must be a valid non-negative number');
  }

  if (!currency || !/^[A-Za-z]{3}$/.test(currency)) {
    throw new Error('Currency must be a valid three-letter currency code');
  }

  const requestNumber = makeRequestNumber();
  const justification = [title, description]
    .filter((value) => value != null && String(value).trim() !== '')
    .join('\n\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

    // Find department ID if department name or ID passed
    let departmentId = null;
    if (department) {
      const deptRes = await client.query(
        `SELECT id FROM departments WHERE tenant_id = $1 AND (name ILIKE $2 OR code ILIKE $2 OR id::text = $2) LIMIT 1`,
        [tenantId, department]
      );
      if (deptRes.rows.length > 0) {
        departmentId = deptRes.rows[0].id;
      }
    }

    // Find supplier ID if supplier name or ID passed
    let supplierId = null;
    if (supplier) {
      const suppRes = await client.query(
        `SELECT id FROM suppliers WHERE tenant_id = $1 AND (legal_name ILIKE $2 OR trading_name ILIKE $2 OR supplier_code ILIKE $2 OR id::text = $2) LIMIT 1`,
        [tenantId, supplier]
      );
      if (suppRes.rows.length > 0) {
        supplierId = suppRes.rows[0].id;
      }
    }

    // Insert purchase request with status SUBMITTED so manager can approve
    const prResult = await client.query(
      `
        INSERT INTO purchase_requests (
          tenant_id,
          request_number,
          requester_id,
          department_id,
          preferred_supplier_id,
          justification,
          currency,
          subtotal,
          tax_total,
          total_amount,
          status,
          submitted_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 0, $8, 'SUBMITTED', NOW()
        )
        RETURNING id
      `,
      [
        tenantId,
        requestNumber,
        requesterId,
        departmentId,
        supplierId,
        justification || null,
        currency.toUpperCase(),
        numericAmount,
      ]
    );

    const newRequestId = prResult.rows[0].id;

    // Insert item line
    const numQty = Number(quantity) || 1;
    const numUnitPrice = Number(unitPrice) || (numericAmount / numQty);

    await client.query(
      `
        INSERT INTO purchase_request_items (
          tenant_id,
          purchase_request_id,
          line_number,
          description,
          quantity,
          unit_price,
          line_total
        )
        VALUES (
          $1, $2, 1, $3, $4, $5, $6
        )
      `,
      [
        tenantId,
        newRequestId,
        title || 'General Item',
        numQty,
        numUnitPrice,
        numericAmount,
      ]
    );

    // Create initial approval task for managers
    const approverRes = await client.query(
      `
        SELECT u.id
        FROM users u
        JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.id
        JOIN roles r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
        WHERE u.tenant_id = $1 AND r.name IN ('manager', 'department_manager', 'admin', 'organization_admin')
        LIMIT 1
      `,
      [tenantId]
    );

    const approverId = approverRes.rows[0]?.id || requesterId;

    await client.query(
      `
        INSERT INTO approvals (
          tenant_id,
          purchase_request_id,
          approver_id,
          status,
          comment
        )
        VALUES ($1, $2, $3, 'pending', 'Submitted for manager review')
        ON CONFLICT DO NOTHING
      `,
      [tenantId, newRequestId, approverId]
    );

    await client.query('COMMIT');

    return findById({
      tenantId,
      requestId: newRequestId,
      userId: requesterId,
      canViewAll: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

  await pool.query(
    `
      UPDATE purchase_requests
      SET ${setClauses.join(', ')},
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND ($4::boolean = TRUE OR requester_id = $3)
        AND status = $${values.length}
    `,
    values
  );

  return findById({
    tenantId,
    requestId,
    userId,
    canViewAll: canManageAll,
  });
}

export async function submitDraft({
  tenantId,
  requestId,
  userId,
}) {
  await pool.query(
    `
      UPDATE purchase_requests
      SET status = 'SUBMITTED',
          submitted_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND requester_id = $3
        AND status = 'DRAFT'
    `,
    [tenantId, requestId, userId]
  );

  return findById({
    tenantId,
    requestId,
    userId,
    canViewAll: true,
  });
}

export async function recordManagerDecision({
  tenantId,
  requestId,
  actorId,
  decision,
  comment,
}) {
  const normalizedDecision = String(decision).toLowerCase();

  if (!['approved', 'rejected'].includes(normalizedDecision)) {
    throw new Error('Decision must be approved or rejected');
  }

  const nextStatus = normalizedDecision === 'approved' ? 'IN_APPROVAL' : 'REJECTED';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

    const existing = await client.query(
      `
        SELECT id, status
        FROM purchase_requests
        WHERE tenant_id = $1 AND id = $2
        FOR UPDATE
      `,
      [tenantId, requestId]
    );

    if (existing.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const currentStatus = existing.rows[0].status;

    if (!['SUBMITTED', 'DRAFT', 'IN_APPROVAL'].includes(currentStatus)) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `
        UPDATE purchase_requests
        SET status = $3,
            updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, requestId, nextStatus]
    );

    // Update approvals table
    await client.query(
      `
        UPDATE approvals
        SET status = $3,
            approver_id = $4,
            comment = COALESCE($5, comment),
            decided_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $1 AND purchase_request_id = $2
      `,
      [tenantId, requestId, normalizedDecision, actorId, comment || null]
    );

    await client.query('COMMIT');

    return findById({
      tenantId,
      requestId,
      userId: actorId,
      canViewAll: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordFinanceDecision({
  tenantId,
  requestId,
  actorId,
  decision,
  comment,
}) {
  const normalizedDecision = String(decision).toLowerCase();

  if (!['approved', 'rejected'].includes(normalizedDecision)) {
    throw new Error('Decision must be approved or rejected');
  }

  const nextStatus =
    normalizedDecision === 'approved' ? 'APPROVED' : 'REJECTED';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

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

    await client.query(
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
      `,
      [tenantId, requestId, nextStatus]
    );

    // Update approvals table record
    await client.query(
      `
        UPDATE approvals
        SET status = $3,
            comment = COALESCE($4, comment),
            decided_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $1 AND purchase_request_id = $2
      `,
      [tenantId, requestId, normalizedDecision, comment || null]
    );

    await client.query('COMMIT');

    return findById({
      tenantId,
      requestId,
      userId: actorId,
      canViewAll: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
