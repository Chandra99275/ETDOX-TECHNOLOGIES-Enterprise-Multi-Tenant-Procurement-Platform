// backend/src/modules/approvals/approvals.repository.js

import { pool } from "../../config/database.js";

const REQUEST_TABLE = "purchase_requests";
const HISTORY_TABLE = "approval_history";

const COLUMN_CANDIDATES = {
  tenant: ["tenant_id", "tenantId"],
  id: ["id", "request_id", "purchase_request_id"],
  title: ["title", "name", "request_title"],
  status: ["status", "request_status", "approval_status"],
  amount: ["amount", "total_amount", "estimated_amount"],
  currency: ["currency", "currency_code"],
  requester: ["requester_id", "requested_by", "created_by", "user_id"],
  description: ["description", "purpose", "justification"],
  createdAt: ["created_at", "createdAt"],
  updatedAt: ["updated_at", "updatedAt"],
};

const quote = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;

async function getColumns(client, tableName) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [tableName],
  );

  return result.rows.map((row) => row.column_name);
}

function findColumn(columns, candidates, required = true) {
  const column = candidates.find((candidate) => columns.includes(candidate));

  if (!column && required) {
    throw new Error(
      `Required column not found. Expected one of: ${candidates.join(", ")}`,
    );
  }

  return column ?? null;
}

function tenantIdFrom(user) {
  const tenantId = user?.tenantId ?? user?.tenant_id;

  if (!tenantId) {
    const error = new Error("Authenticated user has no tenant ID.");
    error.statusCode = 403;
    throw error;
  }

  return String(tenantId);
}

function userIdFrom(user) {
  const userId = user?.id ?? user?.userId ?? user?.user_id;

  if (!userId) {
    const error = new Error("Authenticated user ID is missing.");
    error.statusCode = 401;
    throw error;
  }

  return String(userId);
}

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function withTenantTransaction(user, callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantIdFrom(user)],
    );

    const result = await callback(client);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function mapRequest(row) {
  if (!row) return null;

  return {
    id: row.id,
    title: row.title ?? row.name ?? row.request_title ?? null,
    description:
      row.description ?? row.purpose ?? row.justification ?? null,
    amount:
      row.amount ?? row.total_amount ?? row.estimated_amount ?? null,
    currency: row.currency ?? row.currency_code ?? null,
    status:
      row.status ?? row.request_status ?? row.approval_status ?? null,
    requesterId:
      row.requester_id ??
      row.requested_by ??
      row.created_by ??
      row.user_id ??
      null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    raw: row,
  };
}

async function getRequestColumns(client) {
  const columns = await getColumns(client, REQUEST_TABLE);

  if (columns.length === 0) {
    throw httpError(`Table "${REQUEST_TABLE}" was not found.`, 500);
  }

  return {
    all: columns,
    tenant: findColumn(columns, COLUMN_CANDIDATES.tenant),
    id: findColumn(columns, COLUMN_CANDIDATES.id),
    title: findColumn(columns, COLUMN_CANDIDATES.title, false),
    status: findColumn(columns, COLUMN_CANDIDATES.status),
    amount: findColumn(columns, COLUMN_CANDIDATES.amount, false),
    currency: findColumn(columns, COLUMN_CANDIDATES.currency, false),
    requester: findColumn(columns, COLUMN_CANDIDATES.requester, false),
    description: findColumn(
      columns,
      COLUMN_CANDIDATES.description,
      false,
    ),
    createdAt: findColumn(
      columns,
      COLUMN_CANDIDATES.createdAt,
      false,
    ),
    updatedAt: findColumn(
      columns,
      COLUMN_CANDIDATES.updatedAt,
      false,
    ),
  };
}

function selectList(columns) {
  return columns.all.map((column) => quote(column)).join(", ");
}

export async function listApprovals(user, filters = {}) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getRequestColumns(client);
    const conditions = [];
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`${quote(columns.status)}::text = $${params.length}`);
    } else {
      // Show requests awaiting an approval decision by default.
      conditions.push(
        `LOWER(${quote(columns.status)}::text) IN ('submitted', 'pending', 'pending_approval', 'in_review')`,
      );
    }

    if (filters.search && columns.title) {
      params.push(`%${filters.search}%`);
      conditions.push(
        `${quote(columns.title)}::text ILIKE $${params.length}`,
      );
    }

    const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(filters.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total
         FROM ${quote(REQUEST_TABLE)}
         ${where}`,
      params,
    );

    const dataParams = [...params, limit, offset];

    const result = await client.query(
      `SELECT ${selectList(columns)}
         FROM ${quote(REQUEST_TABLE)}
         ${where}
        ORDER BY ${
          columns.createdAt
            ? `${quote(columns.createdAt)} DESC NULLS LAST`
            : `${quote(columns.id)} DESC`
        }
        LIMIT $${dataParams.length - 1}
       OFFSET $${dataParams.length}`,
      dataParams,
    );

    return {
      items: result.rows.map(mapRequest),
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    };
  });
}

export async function findApprovalById(user, requestId) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getRequestColumns(client);

    const result = await client.query(
      `SELECT ${selectList(columns)}
         FROM ${quote(REQUEST_TABLE)}
        WHERE ${quote(columns.id)}::text = $1
        LIMIT 1`,
      [String(requestId)],
    );

    return mapRequest(result.rows[0] ?? null);
  });
}

export async function decideApproval(
  user,
  requestId,
  decision,
  comments = "",
) {
  const tenantId = tenantIdFrom(user);
  const actorId = userIdFrom(user);

  return withTenantTransaction(user, async (client) => {
    const columns = await getRequestColumns(client);

    // Lock the request to prevent two reviewers deciding simultaneously.
    const locked = await client.query(
      `SELECT ${selectList(columns)}
         FROM ${quote(REQUEST_TABLE)}
        WHERE ${quote(columns.id)}::text = $1
        FOR UPDATE`,
      [String(requestId)],
    );

    if (locked.rowCount === 0) {
      throw httpError("Procurement request not found.", 404);
    }

    const current = locked.rows[0];
    const currentStatus = String(
      current[columns.status] ?? "",
    ).toLowerCase();

    const allowedStatuses = [
      "submitted",
      "pending",
      "pending_approval",
      "in_review",
    ];

    if (!allowedStatuses.includes(currentStatus)) {
      throw httpError(
        `This request cannot be decided from its current status: ${currentStatus || "unknown"}.`,
        409,
      );
    }

    const nextStatus = decision === "approve" ? "approved" : "rejected";
    const setParts = [`${quote(columns.status)} = $1`];
    const params = [nextStatus];

    if (columns.updatedAt) {
      setParts.push(`${quote(columns.updatedAt)} = CURRENT_TIMESTAMP`);
    }

    params.push(String(requestId));

    const updated = await client.query(
      `UPDATE ${quote(REQUEST_TABLE)}
          SET ${setParts.join(", ")}
        WHERE ${quote(columns.id)}::text = $${params.length}
        RETURNING ${selectList(columns)}`,
      params,
    );

    // Record the decision. The history table is deliberately not created
    // automatically; use the SQL provided below to install it safely.
    const historyColumns = await getColumns(client, HISTORY_TABLE);

    if (historyColumns.length === 0) {
      throw httpError(
        `The "${HISTORY_TABLE}" table is missing. Create the approval history table before processing decisions.`,
        500,
      );
    }

    const historyData = {
      tenant_id: tenantId,
      purchase_request_id: String(requestId),
      action: nextStatus,
      comments: comments || null,
      acted_by: actorId,
      created_at: new Date(),
    };

    const insertColumns = Object.keys(historyData).filter((column) =>
      historyColumns.includes(column),
    );

    for (const requiredColumn of [
      "tenant_id",
      "purchase_request_id",
      "action",
      "acted_by",
    ]) {
      if (!insertColumns.includes(requiredColumn)) {
        throw httpError(
          `The "${HISTORY_TABLE}" table is missing required column "${requiredColumn}".`,
          500,
        );
      }
    }

    const values = insertColumns.map((column) => historyData[column]);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    await client.query(
      `INSERT INTO ${quote(HISTORY_TABLE)}
        (${insertColumns.map(quote).join(", ")})
       VALUES (${placeholders.join(", ")})`,
      values,
    );

    return mapRequest(updated.rows[0]);
  });
}

export async function getApprovalHistory(user, requestId) {
  return withTenantTransaction(user, async (client) => {
    const requestColumns = await getRequestColumns(client);

    const requestResult = await client.query(
      `SELECT ${quote(requestColumns.id)}
         FROM ${quote(REQUEST_TABLE)}
        WHERE ${quote(requestColumns.id)}::text = $1
        LIMIT 1`,
      [String(requestId)],
    );

    if (requestResult.rowCount === 0) {
      throw httpError("Procurement request not found.", 404);
    }

    const historyColumns = await getColumns(client, HISTORY_TABLE);

    if (historyColumns.length === 0) {
      throw httpError(
        `The "${HISTORY_TABLE}" table does not exist. Create the approval history table first.`,
        500,
      );
    }

    const result = await client.query(
      `SELECT *
         FROM ${quote(HISTORY_TABLE)}
        WHERE purchase_request_id::text = $1
        ORDER BY created_at DESC NULLS LAST`,
      [String(requestId)],
    );

    return result.rows;
  });
}