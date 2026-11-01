// backend/src/modules/notifications/notifications.repository.js

import { pool } from "../../config/database.js";

const TABLE = "notifications";

const CANDIDATES = {
  id: ["id", "notification_id"],
  tenantId: ["tenant_id"],
  recipientId: ["user_id", "recipient_id", "recipient_user_id"],
  title: ["title", "subject"],
  message: ["message", "body", "content", "description"],
  type: ["type", "notification_type", "category"],
  status: ["status"],
  isRead: ["is_read", "read"],
  readAt: ["read_at"],
  link: ["link", "action_url", "url"],
  metadata: ["metadata", "data", "payload"],
  createdAt: ["created_at", "created_on"],
  updatedAt: ["updated_at", "updated_on"],
};

const quote = (name) =>
  `"${String(name).replaceAll('"', '""')}"`;

async function getColumns(client) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [TABLE],
  );

  if (result.rows.length === 0) {
    throw new Error(
      'Table "notifications" was not found in the current database schema.',
    );
  }

  const actual = new Set(result.rows.map((row) => row.column_name));
  const columns = {};

  for (const [field, candidates] of Object.entries(CANDIDATES)) {
    columns[field] =
      candidates.find((candidate) => actual.has(candidate)) ?? null;
  }

  if (!columns.id || !columns.tenantId || !columns.recipientId) {
    throw new Error(
      'The notifications table must contain an ID, tenant_id, and recipient/user ID column.',
    );
  }

  if (!columns.title || !columns.message) {
    throw new Error(
      'The notifications table must contain a title and message/body column.',
    );
  }

  if (!columns.isRead && !columns.status) {
    throw new Error(
      'The notifications table must have an is_read or status column.',
    );
  }

  return columns;
}

async function withTenant(tenantId, callback) {
  if (!tenantId) {
    throw new Error("Tenant ID is required for notification operations.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [String(tenantId)],
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

function normalizeRow(row, columns) {
  if (!row) return null;

  const output = { ...row };

  for (const [field, column] of Object.entries(columns)) {
    if (column && Object.hasOwn(row, column)) {
      output[field] = row[column];
    }
  }

  if (columns.isRead && output.isRead !== undefined) {
    output.isRead =
      output.isRead === true ||
      output.isRead === "true" ||
      output.isRead === 1;
  } else if (columns.status && output.status !== undefined) {
    output.isRead = String(output.status).toLowerCase() === "read";
  }

  return output;
}

function recipientCondition(columns, userId, values) {
  values.push(userId);
  return `${quote(columns.recipientId)} = $${values.length}`;
}

export async function listNotifications(
  tenantId,
  userId,
  { page = 1, limit = 20, unreadOnly = false } = {},
) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);
    const values = [String(tenantId)];
    const conditions = [
      `${quote(columns.tenantId)} = $1`,
      recipientCondition(columns, userId, values),
    ];

    if (unreadOnly) {
      if (columns.isRead) {
        conditions.push(`${quote(columns.isRead)} = FALSE`);
      } else {
        conditions.push(
          `LOWER(${quote(columns.status)}::text) <> 'read'`,
        );
      }
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(
      100,
      Math.max(1, Number.parseInt(limit, 10) || 20),
    );
    const offset = (safePage - 1) * safeLimit;

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total
         FROM ${quote(TABLE)}
         ${where}`,
      values,
    );

    const orderColumn = columns.createdAt ?? columns.id;

    const result = await client.query(
      `SELECT *
         FROM ${quote(TABLE)}
         ${where}
        ORDER BY ${quote(orderColumn)} DESC
        LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, safeLimit, offset],
    );

    const total = countResult.rows[0]?.total ?? 0;

    return {
      data: result.rows.map((row) => normalizeRow(row, columns)),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  });
}

export async function getNotificationById(tenantId, userId, id) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);

    const result = await client.query(
      `SELECT *
         FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)} = $1
          AND ${quote(columns.tenantId)} = $2
          AND ${quote(columns.recipientId)} = $3
        LIMIT 1`,
      [id, String(tenantId), userId],
    );

    return normalizeRow(result.rows[0], columns);
  });
}

export async function createNotification(tenantId, input) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);

    const inputMap = {
      recipientId: input.recipientId,
      title: input.title,
      message: input.message,
      type: input.type,
      link: input.link,
      metadata: input.metadata,
    };

    const names = [quote(columns.tenantId)];
    const values = [String(tenantId)];
    const placeholders = ["$1"];

    for (const [field, value] of Object.entries(inputMap)) {
      const column = columns[field];

      if (!column || value === undefined) continue;

      names.push(quote(column));
      values.push(
        field === "metadata" && typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : value,
      );
      placeholders.push(`$${values.length}`);
    }

    if (columns.isRead) {
      names.push(quote(columns.isRead));
      placeholders.push("FALSE");
    } else if (columns.status) {
      names.push(quote(columns.status));
      values.push("unread");
      placeholders.push(`$${values.length}`);
    }

    if (columns.createdAt) {
      names.push(quote(columns.createdAt));
      placeholders.push("CURRENT_TIMESTAMP");
    }

    if (columns.updatedAt) {
      names.push(quote(columns.updatedAt));
      placeholders.push("CURRENT_TIMESTAMP");
    }

    const result = await client.query(
      `INSERT INTO ${quote(TABLE)} (${names.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING *`,
      values,
    );

    return normalizeRow(result.rows[0], columns);
  });
}

export async function markNotificationRead(tenantId, userId, id) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);
    const values = [];
    const sets = [];

    if (columns.isRead) {
      sets.push(`${quote(columns.isRead)} = TRUE`);
    }

    if (columns.status) {
      values.push("read");
      sets.push(`${quote(columns.status)} = $${values.length}`);
    }

    if (columns.readAt) {
      sets.push(`${quote(columns.readAt)} = CURRENT_TIMESTAMP`);
    }

    if (columns.updatedAt) {
      sets.push(`${quote(columns.updatedAt)} = CURRENT_TIMESTAMP`);
    }

    if (sets.length === 0) {
      throw new Error("No supported read-status column was found.");
    }

    values.push(id);
    const idParam = `$${values.length}`;

    values.push(String(tenantId));
    const tenantParam = `$${values.length}`;

    values.push(userId);
    const recipientParam = `$${values.length}`;

    const result = await client.query(
      `UPDATE ${quote(TABLE)}
          SET ${sets.join(", ")}
        WHERE ${quote(columns.id)} = ${idParam}
          AND ${quote(columns.tenantId)} = ${tenantParam}
          AND ${quote(columns.recipientId)} = ${recipientParam}
      RETURNING *`,
      values,
    );

    return normalizeRow(result.rows[0], columns);
  });
}

export async function markAllNotificationsRead(tenantId, userId) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);
    const values = [];
    const sets = [];

    if (columns.isRead) {
      sets.push(`${quote(columns.isRead)} = TRUE`);
    }

    if (columns.status) {
      values.push("read");
      sets.push(`${quote(columns.status)} = $${values.length}`);
    }

    if (columns.readAt) {
      sets.push(`${quote(columns.readAt)} = CURRENT_TIMESTAMP`);
    }

    if (columns.updatedAt) {
      sets.push(`${quote(columns.updatedAt)} = CURRENT_TIMESTAMP`);
    }

    if (sets.length === 0) {
      throw new Error("No supported read-status column was found.");
    }

    values.push(String(tenantId));
    const tenantParam = `$${values.length}`;

    values.push(userId);
    const recipientParam = `$${values.length}`;

    const result = await client.query(
      `UPDATE ${quote(TABLE)}
          SET ${sets.join(", ")}
        WHERE ${quote(columns.tenantId)} = ${tenantParam}
          AND ${quote(columns.recipientId)} = ${recipientParam}
          ${
            columns.isRead
              ? `AND ${quote(columns.isRead)} = FALSE`
              : `AND LOWER(${quote(columns.status)}::text) <> 'read'`
          }`,
      values,
    );

    return { updatedCount: result.rowCount };
  });
}

export async function deleteNotification(tenantId, userId, id) {
  return withTenant(tenantId, async (client) => {
    const columns = await getColumns(client);

    const result = await client.query(
      `DELETE FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)} = $1
          AND ${quote(columns.tenantId)} = $2
          AND ${quote(columns.recipientId)} = $3
      RETURNING ${quote(columns.id)}`,
      [id, String(tenantId), userId],
    );

    return result.rowCount > 0;
  });
}