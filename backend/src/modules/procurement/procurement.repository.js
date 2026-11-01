<<<<<<< HEAD
import { pool } from '../../config/database.js';
=======

import { pool } from "../../config/database.js";
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

const COLUMN_CACHE_TTL = 60_000;

<<<<<<< HEAD
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
=======
let cachedColumns = null;
let cachedColumnsAt = 0;

const CANDIDATES = {
  id: ["id", "request_id"],
  tenant: ["tenant_id"],
  title: ["title", "request_title", "name"],
  description: ["description", "details"],
  amount: ["amount", "total_amount", "estimated_amount"],
  currency: ["currency", "currency_code"],
  status: ["status", "request_status"],
  category: ["category", "item_category"],
  supplier: ["supplier_name", "vendor_name"],
  justification: ["justification", "business_justification"],
  requester: ["requester_id", "requested_by", "created_by", "user_id"],
  createdAt: ["created_at"],
  updatedAt: ["updated_at"],
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

<<<<<<< HEAD
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
=======
function findColumn(columns, candidates) {
  return candidates.find((column) => columns.has(column)) ?? null;
}
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

// Declared once and reused throughout this file.
function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateUuid(value, label) {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw httpError(`A valid ${label} UUID is required`, 400);
  }
}

<<<<<<< HEAD
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
=======
async function getColumns() {
  if (
    cachedColumns &&
    Date.now() - cachedColumnsAt < COLUMN_CACHE_TTL
  ) {
    return cachedColumns;
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
  }

  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'purchase_requests'
  `);

  if (result.rows.length === 0) {
    throw new Error(
      "The purchase_requests table was not found in the current PostgreSQL schema"
    );
  }

<<<<<<< HEAD
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
=======
  cachedColumns = new Set(
    result.rows.map((row) => row.column_name)
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
  );

  cachedColumnsAt = Date.now();

<<<<<<< HEAD
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
=======
  for (const required of ["id", "tenant", "title"]) {
    if (!findColumn(cachedColumns, CANDIDATES[required])) {
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
      throw new Error(
        `The purchase_requests table is missing a required ${required} column`
      );
    }
  }

<<<<<<< HEAD
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
=======
  return cachedColumns;
}

/**
 * Runs a transaction with tenant context set on the same
 * PostgreSQL client used for tenant-scoped queries.
 */
async function withTenantTransaction(tenantId, callback) {
  validateUuid(tenantId, "tenant");
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

  const client = await pool.connect();

  try {
<<<<<<< HEAD
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
=======
    await client.query("BEGIN");
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    const result = await callback(client);

    await client.query("COMMIT");

<<<<<<< HEAD
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
=======
    return result;
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function selectColumns(columns) {
  const definitions = [
    ["id", CANDIDATES.id, "id", "NULL"],
    ["tenant_id", CANDIDATES.tenant, "tenant_id", "NULL"],
    ["title", CANDIDATES.title, "title", "NULL"],
    ["description", CANDIDATES.description, "description", "NULL"],
    ["amount", CANDIDATES.amount, "amount", "NULL"],
    ["currency", CANDIDATES.currency, "currency", "'INR'"],
    ["status", CANDIDATES.status, "status", "'draft'"],
    ["category", CANDIDATES.category, "category", "NULL"],
    ["supplier_name", CANDIDATES.supplier, "supplier_name", "NULL"],
    ["justification", CANDIDATES.justification, "justification", "NULL"],
    ["requester_id", CANDIDATES.requester, "requester_id", "NULL"],
    ["created_at", CANDIDATES.createdAt, "created_at", "NULL"],
    ["updated_at", CANDIDATES.updatedAt, "updated_at", "NULL"],
  ];

  return definitions
    .map(([, candidates, alias, fallback]) => {
      const column = findColumn(columns, candidates);

      return column
        ? `${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}`
        : `${fallback} AS ${quoteIdentifier(alias)}`;
    })
    .join(", ");
}

function toPublicRequest(row) {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    amount: row.amount === null ? null : Number(row.amount),
    currency: row.currency,
    status: row.status,
    category: row.category,
    supplierName: row.supplier_name,
    justification: row.justification,
    requesterId: row.requester_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function addEqualityFilter(conditions, params, column, value) {
  if (!column || value === undefined || value === "") {
    return;
  }

  params.push(value);
  conditions.push(
    `${quoteIdentifier(column)} = $${params.length}`
  );
}

/**
 * List purchase requests with pagination, optional search and status filters.
 */
export async function listRequests(tenantId, query = {}) {
  const columns = await getColumns();

  const tenantColumn = findColumn(columns, CANDIDATES.tenant);
  const titleColumn = findColumn(columns, CANDIDATES.title);
  const descriptionColumn = findColumn(columns, CANDIDATES.description);
  const statusColumn = findColumn(columns, CANDIDATES.status);
  const createdAtColumn = findColumn(columns, CANDIDATES.createdAt);
  const idColumn = findColumn(columns, CANDIDATES.id);

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const offset = (page - 1) * limit;

  return withTenantTransaction(tenantId, async (client) => {
    const conditions = [
      `${quoteIdentifier(tenantColumn)}::text = $1::text`,
    ];

    const params = [tenantId];

    if (query.search) {
      const searchColumns = [
        titleColumn,
        descriptionColumn,
      ].filter(Boolean);

      if (searchColumns.length > 0) {
        params.push(`%${query.search}%`);

        conditions.push(
          `(${searchColumns
            .map(
              (column) =>
                `${quoteIdentifier(column)} ILIKE $${params.length}`
            )
            .join(" OR ")})`
        );
      }
    }

    addEqualityFilter(
      conditions,
      params,
      statusColumn,
      query.status
    );

    // Employees can be restricted to their own requests by the service
    // passing requesterId. The tenant filter always remains mandatory.
    const requesterColumn = findColumn(
      columns,
      CANDIDATES.requester
    );

    addEqualityFilter(
      conditions,
      params,
      requesterColumn,
      query.requesterId
    );

    const whereClause = conditions.join(" AND ");

    const countResult = await client.query(
      `
        SELECT COUNT(*)::int AS total
        FROM purchase_requests
        WHERE ${whereClause}
      `,
      params
    );

    const listParams = [...params, limit, offset];

    const orderColumn = createdAtColumn || idColumn;

    const result = await client.query(
      `
        SELECT ${selectColumns(columns)}
        FROM purchase_requests
        WHERE ${whereClause}
        ORDER BY ${quoteIdentifier(orderColumn)} DESC
        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
      `,
      listParams
    );

    const total = countResult.rows[0]?.total ?? 0;

    return {
      requests: result.rows.map(toPublicRequest),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

/**
 * Find one purchase request belonging to the specified tenant.
 */
export async function findRequestById(tenantId, requestId) {
  validateUuid(requestId, "request");

  const columns = await getColumns();

  const idColumn = findColumn(columns, CANDIDATES.id);
  const tenantColumn = findColumn(columns, CANDIDATES.tenant);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        SELECT ${selectColumns(columns)}
        FROM purchase_requests
        WHERE ${quoteIdentifier(idColumn)}::text = $1::text
          AND ${quoteIdentifier(tenantColumn)}::text = $2::text
        LIMIT 1
      `,
      [requestId, tenantId]
    );

    return toPublicRequest(result.rows[0] ?? null);
  });
}

/**
 * Create a purchase request.
 */
export async function createRequest(tenantId, actorId, input) {
  validateUuid(actorId, "user");

  const columns = await getColumns();

  const tenantColumn = findColumn(columns, CANDIDATES.tenant);
  const titleColumn = findColumn(columns, CANDIDATES.title);
  const descriptionColumn = findColumn(columns, CANDIDATES.description);
  const amountColumn = findColumn(columns, CANDIDATES.amount);
  const currencyColumn = findColumn(columns, CANDIDATES.currency);
  const statusColumn = findColumn(columns, CANDIDATES.status);
  const categoryColumn = findColumn(columns, CANDIDATES.category);
  const supplierColumn = findColumn(columns, CANDIDATES.supplier);
  const justificationColumn = findColumn(columns, CANDIDATES.justification);
  const requesterColumn = findColumn(columns, CANDIDATES.requester);
  const createdAtColumn = findColumn(columns, CANDIDATES.createdAt);
  const updatedAtColumn = findColumn(columns, CANDIDATES.updatedAt);

  if (!requesterColumn) {
    throw new Error(
      "The purchase_requests table has no recognized requester/user column"
    );
  }

  const entries = [
    [tenantColumn, tenantId],
    [titleColumn, input.title],
    [descriptionColumn, input.description],
    [amountColumn, input.amount],
    [currencyColumn, input.currency],
    [statusColumn, "draft"],
    [categoryColumn, input.category],
    [supplierColumn, input.supplierName],
    [justificationColumn, input.justification],
    [requesterColumn, actorId],
    [createdAtColumn, new Date()],
    [updatedAtColumn, new Date()],
  ].filter(([column, value]) => column && value !== undefined);

  return withTenantTransaction(tenantId, async (client) => {
    const names = entries.map(([column]) =>
      quoteIdentifier(column)
    );

    const values = entries.map(([, value]) => value);

    const placeholders = values.map(
      (_, index) => `$${index + 1}`
    );

    const result = await client.query(
      `
        INSERT INTO purchase_requests (${names.join(", ")})
        VALUES (${placeholders.join(", ")})
        RETURNING ${selectColumns(columns)}
      `,
      values
    );

    return toPublicRequest(result.rows[0]);
  });
}

/**
 * Update a request.
 * Non-admin users can only update their own editable requests.
 */
export async function updateRequest(
  tenantId,
  requestId,
  actorId,
  isAdmin,
  input
) {
  validateUuid(requestId, "request");
  validateUuid(actorId, "user");

  const columns = await getColumns();

  const idColumn = findColumn(columns, CANDIDATES.id);
  const tenantColumn = findColumn(columns, CANDIDATES.tenant);
  const requesterColumn = findColumn(columns, CANDIDATES.requester);
  const statusColumn = findColumn(columns, CANDIDATES.status);
  const updatedAtColumn = findColumn(columns, CANDIDATES.updatedAt);

  const mapping = [
    ["title", CANDIDATES.title, input.title],
    ["description", CANDIDATES.description, input.description],
    ["amount", CANDIDATES.amount, input.amount],
    ["currency", CANDIDATES.currency, input.currency],
    ["category", CANDIDATES.category, input.category],
    ["supplierName", CANDIDATES.supplier, input.supplierName],
    ["justification", CANDIDATES.justification, input.justification],
  ];

  const updates = mapping
    .filter(
      ([, candidates, value]) =>
        value !== undefined &&
        findColumn(columns, candidates)
    )
    .map(([, candidates, value]) => [
      findColumn(columns, candidates),
      value,
    ]);

  if (updates.length === 0) {
    throw httpError(
      "No supported fields were provided for update",
      400
    );
  }

  if (updatedAtColumn) {
    updates.push([updatedAtColumn, new Date()]);
  }

  return withTenantTransaction(tenantId, async (client) => {
    const values = updates.map(([, value]) => value);

    const setClause = updates
      .map(
        ([column], index) =>
          `${quoteIdentifier(column)} = $${index + 1}`
      )
      .join(", ");

    values.push(requestId, tenantId);

    const conditions = [
      `${quoteIdentifier(idColumn)}::text = $${values.length - 1}::text`,
      `${quoteIdentifier(tenantColumn)}::text = $${values.length}::text`,
    ];

    if (!isAdmin) {
      if (!requesterColumn) {
        throw new Error(
          "Cannot verify request ownership because the requester column is missing"
        );
      }

      values.push(actorId);

      conditions.push(
        `${quoteIdentifier(requesterColumn)}::text = $${values.length}::text`
      );

      if (statusColumn) {
        conditions.push(
          `${quoteIdentifier(statusColumn)} IN ('draft', 'pending')`
        );
      }
    }

    const result = await client.query(
      `
        UPDATE purchase_requests
        SET ${setClause}
        WHERE ${conditions.join(" AND ")}
        RETURNING ${selectColumns(columns)}
      `,
      values
    );

    if (result.rowCount === 0) {
      throw httpError(
        "Request not found, not owned by you, or no longer editable",
        404
      );
    }

    return toPublicRequest(result.rows[0]);
  });
}

/**
 * Submit a draft or pending request.
 */
export async function submitRequest(
  tenantId,
  requestId,
  actorId,
  isAdmin
) {
  validateUuid(requestId, "request");
  validateUuid(actorId, "user");

  const columns = await getColumns();

  const idColumn = findColumn(columns, CANDIDATES.id);
  const tenantColumn = findColumn(columns, CANDIDATES.tenant);
  const requesterColumn = findColumn(columns, CANDIDATES.requester);
  const statusColumn = findColumn(columns, CANDIDATES.status);
  const updatedAtColumn = findColumn(columns, CANDIDATES.updatedAt);

  if (!statusColumn) {
    throw new Error(
      "The purchase_requests table does not have a recognized status column"
    );
  }

  return withTenantTransaction(tenantId, async (client) => {
    const values = ["submitted"];

    let setClause = `${quoteIdentifier(statusColumn)} = $1`;

    if (updatedAtColumn) {
      values.push(new Date());

      setClause +=
        `, ${quoteIdentifier(updatedAtColumn)} = $2`;
    }

    values.push(requestId, tenantId);

    const conditions = [
      `${quoteIdentifier(idColumn)}::text = $${values.length - 1}::text`,
      `${quoteIdentifier(tenantColumn)}::text = $${values.length}::text`,
      `${quoteIdentifier(statusColumn)} IN ('draft', 'pending')`,
    ];

    if (!isAdmin) {
      if (!requesterColumn) {
        throw new Error(
          "Cannot verify request ownership because the requester column is missing"
        );
      }

      values.push(actorId);

      conditions.push(
        `${quoteIdentifier(requesterColumn)}::text = $${values.length}::text`
      );
    }

    const result = await client.query(
      `
        UPDATE purchase_requests
        SET ${setClause}
        WHERE ${conditions.join(" AND ")}
        RETURNING ${selectColumns(columns)}
      `,
      values
    );

    if (result.rowCount === 0) {
      throw httpError(
        "Request not found, not owned by you, or not eligible for submission",
        404
      );
    }

    return toPublicRequest(result.rows[0]);
  });
}
