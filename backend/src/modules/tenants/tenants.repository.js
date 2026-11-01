import { pool } from "../../config/database.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COLUMN_CACHE_TTL = 60_000;

let cachedColumns = null;
let cachedColumnsAt = 0;

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getTenantColumns() {
  if (
    cachedColumns &&
    Date.now() - cachedColumnsAt < COLUMN_CACHE_TTL
  ) {
    return cachedColumns;
  }

  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'tenants'
  `);

  if (result.rows.length === 0) {
    throw new Error(
      "The tenants table was not found in the current PostgreSQL schema"
    );
  }

  cachedColumns = new Set(
    result.rows.map((row) => row.column_name)
  );

  cachedColumnsAt = Date.now();

  for (const required of ["id", "name", "slug"]) {
    if (!cachedColumns.has(required)) {
      throw new Error(
        `The tenants table is missing the required '${required}' column`
      );
    }
  }

  return cachedColumns;
}

function selectColumns(columns) {
  const select = [
    `${quoteIdentifier("id")} AS id`,
    `${quoteIdentifier("name")} AS name`,
    `${quoteIdentifier("slug")} AS slug`,
  ];

  for (const [column, alias, fallback] of [
    ["status", "status", "'active'"],
    ["created_at", "created_at", "NULL"],
    ["updated_at", "updated_at", "NULL"],
  ]) {
    select.push(
      columns.has(column)
        ? `${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}`
        : `${fallback} AS ${quoteIdentifier(alias)}`
    );
  }

  return select.join(", ");
}

function validateUuid(id) {
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    throw httpError("Invalid tenant ID", 400);
  }
}

function validateTenantData(input) {
  const name = input.name?.trim();
  const slug = input.slug?.trim().toLowerCase();

  if (!name || name.length > 150) {
    throw httpError(
      "Tenant name is required and must not exceed 150 characters",
      400
    );
  }

  if (
    !slug ||
    slug.length > 100 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    throw httpError(
      "Tenant slug must contain lowercase letters, numbers, and single hyphens",
      400
    );
  }

  return { name, slug };
}

/**
 * List tenants.
 *
 * This is a cross-tenant operation. The calling user must be
 * authorized as a platform administrator, and the database's RLS
 * policies must permit this operation for that trusted identity.
 */
export async function listTenants({ page = 1, limit = 10, search = "" } = {}) {
  const columns = await getTenantColumns();
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(name ILIKE $${params.length} OR slug ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM tenants ${whereClause}`,
    params
  );

  const result = await pool.query(
    `
      SELECT ${selectColumns(columns)}
      FROM tenants
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  const total = countResult.rows[0]?.total ?? 0;

  return {
    tenants: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Find a tenant by UUID.
 */
export async function findTenantById(tenantId) {
  validateUuid(tenantId);

  const columns = await getTenantColumns();

  const result = await pool.query(
    `
      SELECT ${selectColumns(columns)}
      FROM tenants
      WHERE id::text = $1::text
      LIMIT 1
    `,
    [tenantId]
  );

  return result.rows[0] ?? null;
}

/**
 * Find a tenant by slug.
 */
export async function findTenantBySlug(slug) {
  const columns = await getTenantColumns();

  const result = await pool.query(
    `
      SELECT ${selectColumns(columns)}
      FROM tenants
      WHERE LOWER(slug) = LOWER($1)
      LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] ?? null;
}

/**
 * Create a tenant.
 *
 * The database must generate the tenant ID automatically, or its
 * existing ID-generation strategy must be added here.
 */
export async function createTenant(input) {
  const columns = await getTenantColumns();
  const { name, slug } = validateTenantData(input);

  const statusColumn = columns.has("status") ? "status" : null;
  const createdAtColumn = columns.has("created_at") ? "created_at" : null;
  const updatedAtColumn = columns.has("updated_at") ? "updated_at" : null;

  const entries = [
    ["name", name],
    ["slug", slug],
  ];

  if (statusColumn) entries.push([statusColumn, "active"]);
  if (createdAtColumn) entries.push([createdAtColumn, new Date()]);
  if (updatedAtColumn) entries.push([updatedAtColumn, new Date()]);

  const result = await pool.query(
    `
      INSERT INTO tenants (${entries
        .map(([column]) => quoteIdentifier(column))
        .join(", ")})
      VALUES (${entries.map((_, index) => `$${index + 1}`).join(", ")})
      RETURNING ${selectColumns(columns)}
    `,
    entries.map(([, value]) => value)
  );

  return result.rows[0];
}

/**
 * Update tenant metadata.
 */
export async function updateTenant(tenantId, input) {
  validateUuid(tenantId);

  const columns = await getTenantColumns();
  const updates = [];

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name || name.length > 150) {
      throw httpError("Invalid tenant name", 400);
    }

    updates.push(["name", name]);
  }

  if (input.slug !== undefined) {
    const slug = input.slug.trim().toLowerCase();

    if (
      !slug ||
      slug.length > 100 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
      throw httpError("Invalid tenant slug", 400);
    }

    updates.push(["slug", slug]);
  }

  if (input.status !== undefined && columns.has("status")) {
    if (!["active", "inactive", "suspended"].includes(input.status)) {
      throw httpError("Invalid tenant status", 400);
    }

    updates.push(["status", input.status]);
  }

  if (updates.length === 0) {
    throw httpError(
      "No supported tenant fields were provided",
      400
    );
  }

  if (columns.has("updated_at")) {
    updates.push(["updated_at", new Date()]);
  }

  const values = updates.map(([, value]) => value);
  const setClause = updates
    .map(
      ([column], index) =>
        `${quoteIdentifier(column)} = $${index + 1}`
    )
    .join(", ");

  values.push(tenantId);

  const result = await pool.query(
    `
      UPDATE tenants
      SET ${setClause}
      WHERE id::text = $${values.length}::text
      RETURNING ${selectColumns(columns)}
    `,
    values
  );

  return result.rows[0] ?? null;
}