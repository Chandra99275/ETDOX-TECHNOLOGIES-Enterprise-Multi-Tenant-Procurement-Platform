import { pool } from "../../config/database.js";

const AUDIT_TABLE_CANDIDATES = [
  "audit_logs",
  "audit_log",
  "audit_events",
];

const COLUMN_CANDIDATES = {
  id: ["id", "audit_id", "event_id"],
  tenantId: ["tenant_id", "organization_id", "company_id"],
  actorId: ["actor_id", "user_id", "performed_by", "created_by"],
  action: ["action", "event_action", "operation"],
  entityType: ["entity_type", "resource_type", "table_name", "module"],
  entityId: ["entity_id", "resource_id", "record_id"],
  description: ["description", "message", "details"],
  oldValues: ["old_values", "before_data", "old_data"],
  newValues: ["new_values", "after_data", "new_data"],
  metadata: ["metadata", "context", "additional_data"],
  ipAddress: ["ip_address", "client_ip"],
  userAgent: ["user_agent", "client_user_agent"],
  createdAt: ["created_at", "event_time", "timestamp", "logged_at"],
};

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function firstColumn(availableColumns, candidates) {
  return candidates.find((column) => availableColumns.has(column)) ?? null;
}

function toSafeInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(maximum, Math.max(minimum, parsed));
}

async function getSchema(client) {
  const result = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = ANY(current_schemas(false))`
  );

  const tables = new Map();

  for (const row of result.rows) {
    if (!tables.has(row.table_name)) {
      tables.set(row.table_name, new Set());
    }

    tables.get(row.table_name).add(row.column_name);
  }

  return tables;
}

function findAuditTable(schema) {
  for (const name of AUDIT_TABLE_CANDIDATES) {
    const columns = schema.get(name);

    if (columns) {
      const resolved = {};

      for (const [field, candidates] of Object.entries(COLUMN_CANDIDATES)) {
        resolved[field] = firstColumn(columns, candidates);
      }

      if (!resolved.tenantId || !resolved.action) {
        throw new Error(
          `The ${name} table exists, but it is missing a tenant or action column. ` +
          "Update the audit repository to match the actual schema."
        );
      }

      return { name, columns, resolved };
    }
  }

  throw new Error(
    "No audit table was found. Expected audit_logs, audit_log, or audit_events. " +
    "Inspect the existing database schema before adding or changing a table."
  );
}

async function withTenantClient(tenantId, callback, readOnly = false) {
  if (!tenantId) {
    const error = new Error("A tenant ID is required for audit operations.");
    error.statusCode = 403;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query(readOnly ? "BEGIN READ ONLY" : "BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [String(tenantId)]
    );

    const schema = await getSchema(client);
    const table = findAuditTable(schema);

    const result = await callback(client, table);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original exception.
    }

    throw error;
  } finally {
    client.release();
  }
}

function normalizeAuditRow(row, columns) {
  return {
    id: columns.id ? row[columns.id] : null,
    tenantId: row[columns.tenantId],
    actorId: columns.actorId ? row[columns.actorId] : null,
    action: row[columns.action],
    entityType: columns.entityType ? row[columns.entityType] : null,
    entityId: columns.entityId ? row[columns.entityId] : null,
    description: columns.description ? row[columns.description] : null,
    oldValues: columns.oldValues ? row[columns.oldValues] : null,
    newValues: columns.newValues ? row[columns.newValues] : null,
    metadata: columns.metadata ? row[columns.metadata] : null,
    ipAddress: columns.ipAddress ? row[columns.ipAddress] : null,
    userAgent: columns.userAgent ? row[columns.userAgent] : null,
    createdAt: columns.createdAt ? row[columns.createdAt] : null,
  };
}

function addInsertField(fields, columns, fieldName, value) {
  const column = columns[fieldName];

  if (!column || value === undefined) return;

  fields.push({ column, value, fieldName });
}

function buildInsertQuery(tableName, fields) {
  const columnNames = fields.map((field) => quoteIdentifier(field.column));

  const placeholders = fields.map((field, index) => {
    const placeholder = `$${index + 1}`;

    if (
      ["oldValues", "newValues", "metadata"].includes(field.fieldName) &&
      field.value !== null
    ) {
      return `${placeholder}::jsonb`;
    }

    return placeholder;
  });

  return {
    sql: `INSERT INTO ${quoteIdentifier(tableName)}
      (${columnNames.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *`,
    values: fields.map((field) => {
      if (
        ["oldValues", "newValues", "metadata"].includes(field.fieldName) &&
        field.value !== null &&
        typeof field.value !== "string"
      ) {
        return JSON.stringify(field.value);
      }

      return field.value;
    }),
  };
}

/**
 * Record an audit event.
 *
 * Expected event fields:
 * tenantId, actorId, action, entityType, entityId, description,
 * oldValues, newValues, metadata, ipAddress, userAgent.
 */
export async function createAuditEvent(event) {
  return withTenantClient(event.tenantId, async (client, table) => {
    const columns = table.resolved;
    const fields = [];

    addInsertField(fields, columns, "tenantId", event.tenantId);
    addInsertField(fields, columns, "actorId", event.actorId ?? null);
    addInsertField(fields, columns, "action", event.action);
    addInsertField(fields, columns, "entityType", event.entityType ?? null);
    addInsertField(fields, columns, "entityId", event.entityId ?? null);
    addInsertField(fields, columns, "description", event.description ?? null);
    addInsertField(fields, columns, "oldValues", event.oldValues ?? null);
    addInsertField(fields, columns, "newValues", event.newValues ?? null);
    addInsertField(fields, columns, "metadata", event.metadata ?? null);
    addInsertField(fields, columns, "ipAddress", event.ipAddress ?? null);
    addInsertField(fields, columns, "userAgent", event.userAgent ?? null);

    if (!fields.some((field) => field.fieldName === "tenantId")) {
      throw new Error("The audit table has no supported tenant column.");
    }

    if (!fields.some((field) => field.fieldName === "action")) {
      throw new Error("The audit table has no supported action column.");
    }

    const { sql, values } = buildInsertQuery(table.name, fields);
    const result = await client.query(sql, values);

    return normalizeAuditRow(result.rows[0], columns);
  });
}

/**
 * List audit events for the current tenant.
 *
 * Filters:
 * action, entityType, entityId, actorId, from, to, page, limit.
 */
export async function listAuditEvents(tenantId, filters = {}) {
  return withTenantClient(
    tenantId,
    async (client, table) => {
      const columns = table.resolved;
      const conditions = [];
      const values = [];

      function addCondition(sql, value) {
        values.push(value);
        conditions.push(sql.replace("?", `$${values.length}`));
      }

      if (filters.action && columns.action) {
        addCondition(
          `${quoteIdentifier(columns.action)}::text = ?`,
          filters.action
        );
      }

      if (filters.entityType && columns.entityType) {
        addCondition(
          `${quoteIdentifier(columns.entityType)}::text = ?`,
          filters.entityType
        );
      }

      if (filters.entityId && columns.entityId) {
        addCondition(
          `${quoteIdentifier(columns.entityId)}::text = ?`,
          String(filters.entityId)
        );
      }

      if (filters.actorId && columns.actorId) {
        addCondition(
          `${quoteIdentifier(columns.actorId)}::text = ?`,
          String(filters.actorId)
        );
      }

      if (filters.from && columns.createdAt) {
        addCondition(
          `${quoteIdentifier(columns.createdAt)} >= ?::timestamptz`,
          filters.from
        );
      }

      if (filters.to && columns.createdAt) {
        addCondition(
          `${quoteIdentifier(columns.createdAt)} <= ?::timestamptz`,
          filters.to
        );
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const page = toSafeInteger(filters.page, 1, 1, 1000000);
      const limit = toSafeInteger(filters.limit, 25, 1, 100);
      const offset = (page - 1) * limit;

      const countResult = await client.query(
        `SELECT COUNT(*)::bigint AS total
         FROM ${quoteIdentifier(table.name)}
         ${whereClause}`,
        values
      );

      const orderBy = columns.createdAt
        ? `ORDER BY ${quoteIdentifier(columns.createdAt)} DESC NULLS LAST`
        : columns.id
          ? `ORDER BY ${quoteIdentifier(columns.id)} DESC`
          : "";

      const dataValues = [...values, limit, offset];

      const dataResult = await client.query(
        `SELECT *
         FROM ${quoteIdentifier(table.name)}
         ${whereClause}
         ${orderBy}
         LIMIT $${dataValues.length - 1}
         OFFSET $${dataValues.length}`,
        dataValues
      );

      return {
        items: dataResult.rows.map((row) =>
          normalizeAuditRow(row, columns)
        ),
        pagination: {
          page,
          limit,
          total: Number(countResult.rows[0]?.total ?? 0),
          totalPages: Math.ceil(
            Number(countResult.rows[0]?.total ?? 0) / limit
          ),
        },
      };
    },
    true
  );
}

/**
 * Retrieve one audit event by ID within the authenticated tenant.
 */
export async function getAuditEventById(tenantId, auditId) {
  return withTenantClient(
    tenantId,
    async (client, table) => {
      const columns = table.resolved;

      if (!columns.id) {
        throw new Error(
          "The audit table has no supported ID column; individual lookup is unavailable."
        );
      }

      const result = await client.query(
        `SELECT *
         FROM ${quoteIdentifier(table.name)}
         WHERE ${quoteIdentifier(columns.id)}::text = $1
         LIMIT 1`,
        [String(auditId)]
      );

      if (!result.rows[0]) return null;

      return normalizeAuditRow(result.rows[0], columns);
    },
    true
  );
}