import { pool } from "../../config/database.js";

const COLUMN_CACHE_TTL = 60_000;

let columnCache;
let columnCacheTime = 0;

const COLUMN_CANDIDATES = {
  id: ["id", "user_id"],
  email: ["email"],
  password: ["password_hash", "passwordHash", "hashed_password"],
  tenant: ["tenant_id", "tenantId"],
  firstName: ["first_name", "firstname"],
  lastName: ["last_name", "lastname"],
  fullName: ["full_name", "name", "display_name"],
  role: ["role", "role_name"],
  active: ["is_active", "active", "enabled"],
  createdAt: ["created_at", "createdAt"],
  updatedAt: ["updated_at", "updatedAt"],
};

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function findColumn(columns, candidates) {
  return candidates.find((name) => columns.has(name)) ?? null;
}

async function getColumns() {
  if (
    columnCache &&
    Date.now() - columnCacheTime < COLUMN_CACHE_TTL
  ) {
    return columnCache;
  }

  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users'
  `);

  if (result.rows.length === 0) {
    throw new Error(
      "The users table does not exist in the current PostgreSQL schema"
    );
  }

  columnCache = new Set(result.rows.map((row) => row.column_name));
  columnCacheTime = Date.now();

  for (const required of ["id", "email", "tenant"]) {
    if (
      !findColumn(
        columnCache,
        COLUMN_CANDIDATES[required]
      )
    ) {
      throw new Error(
        `The users table is missing a required ${required} column`
      );
    }
  }

  return columnCache;
}

/**
 * Execute tenant-scoped queries using one transaction and one client.
 */
async function withTenantClient(tenantId, callback) {
  if (
    typeof tenantId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      tenantId
    )
  ) {
    const error = new Error("A valid tenant ID is required");
    error.statusCode = 401;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
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

function buildUserSelect(columns) {
  const select = [];

  const add = (candidates, alias, fallback = "NULL") => {
    const column = findColumn(columns, candidates);

    select.push(
      column
        ? `${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}`
        : `${fallback} AS ${quoteIdentifier(alias)}`
    );
  };

  add(COLUMN_CANDIDATES.id, "id");
  add(COLUMN_CANDIDATES.email, "email");
  add(COLUMN_CANDIDATES.tenant, "tenant_id");
  add(COLUMN_CANDIDATES.firstName, "first_name");
  add(COLUMN_CANDIDATES.lastName, "last_name");
  add(COLUMN_CANDIDATES.fullName, "full_name");
  add(COLUMN_CANDIDATES.role, "role");
  add(COLUMN_CANDIDATES.active, "is_active", "TRUE");
  add(COLUMN_CANDIDATES.createdAt, "created_at");

  return select.join(", ");
}

function toPublicUser(row) {
  if (!row) return null;

  const name =
    row.full_name ||
    [row.first_name, row.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    row.email;

  return {
    id: row.id,
    email: row.email,
    name,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    tenantId: row.tenant_id,
    role: row.role ?? null,
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? null,
  };
}

function getError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function listUsers(
  tenantId,
  { page = 1, limit = 10, search = "", role = "" } = {}
) {
  const columns = await getColumns();

  const idColumn = findColumn(columns, COLUMN_CANDIDATES.id);
  const emailColumn = findColumn(columns, COLUMN_CANDIDATES.email);
  const tenantColumn = findColumn(columns, COLUMN_CANDIDATES.tenant);
  const roleColumn = findColumn(columns, COLUMN_CANDIDATES.role);

  const offset = (page - 1) * limit;

  return withTenantClient(tenantId, async (client) => {
    const conditions = [
      `${quoteIdentifier(tenantColumn)}::text = $1::text`,
    ];

    const params = [tenantId];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(${quoteIdentifier(emailColumn)} ILIKE $${params.length}` +
          (findColumn(columns, COLUMN_CANDIDATES.fullName)
            ? ` OR ${quoteIdentifier(
                findColumn(columns, COLUMN_CANDIDATES.fullName)
              )} ILIKE $${params.length}`
            : "") +
          ")"
      );
    }

    if (role && roleColumn) {
      params.push(role);
      conditions.push(
        `${quoteIdentifier(roleColumn)} = $${params.length}`
      );
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await client.query(
      `
        SELECT COUNT(*)::int AS total
        FROM users
        WHERE ${whereClause}
      `,
      params
    );

    const listParams = [...params, limit, offset];

    const result = await client.query(
      `
        SELECT ${buildUserSelect(columns)}
        FROM users
        WHERE ${whereClause}
        ORDER BY ${quoteIdentifier(idColumn)}
        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
      `,
      listParams
    );

    const total = countResult.rows[0]?.total ?? 0;

    return {
      users: result.rows.map(toPublicUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

export async function findUserById(tenantId, userId) {
  const columns = await getColumns();

  const idColumn = findColumn(columns, COLUMN_CANDIDATES.id);
  const tenantColumn = findColumn(columns, COLUMN_CANDIDATES.tenant);

  return withTenantClient(tenantId, async (client) => {
    const result = await client.query(
      `
        SELECT ${buildUserSelect(columns)}
        FROM users
        WHERE ${quoteIdentifier(idColumn)}::text = $1::text
          AND ${quoteIdentifier(tenantColumn)}::text = $2::text
        LIMIT 1
      `,
      [userId, tenantId]
    );

    return toPublicUser(result.rows[0] ?? null);
  });
}

export async function createUser(tenantId, input) {
  const columns = await getColumns();

  const emailColumn = findColumn(columns, COLUMN_CANDIDATES.email);
  const passwordColumn = findColumn(columns, COLUMN_CANDIDATES.password);
  const tenantColumn = findColumn(columns, COLUMN_CANDIDATES.tenant);
  const roleColumn = findColumn(columns, COLUMN_CANDIDATES.role);
  const activeColumn = findColumn(columns, COLUMN_CANDIDATES.active);
  const firstNameColumn = findColumn(columns, COLUMN_CANDIDATES.firstName);
  const lastNameColumn = findColumn(columns, COLUMN_CANDIDATES.lastName);
  const fullNameColumn = findColumn(columns, COLUMN_CANDIDATES.fullName);
  const createdAtColumn = findColumn(columns, COLUMN_CANDIDATES.createdAt);
  const updatedAtColumn = findColumn(columns, COLUMN_CANDIDATES.updatedAt);

  if (!passwordColumn) {
    throw new Error(
      "Cannot create users: a password hash column was not found"
    );
  }

  if (!roleColumn) {
    throw new Error(
      "This schema does not have a direct role column. Configure role assignment using your existing roles/user_roles tables."
    );
  }

  const entries = [
    [emailColumn, input.email],
    [passwordColumn, input.passwordHash],
    [tenantColumn, tenantId],
    [roleColumn, input.role],
    [activeColumn, input.isActive],
    [firstNameColumn, input.firstName],
    [lastNameColumn, input.lastName],
    [
      fullNameColumn,
      [input.firstName, input.lastName].filter(Boolean).join(" "),
    ],
    [createdAtColumn, new Date()],
    [updatedAtColumn, new Date()],
  ].filter(([column, value]) => column && value !== undefined);

  const uniqueEntries = [
    ...new Map(entries.map(([column, value]) => [column, value])).entries(),
  ];

  return withTenantClient(tenantId, async (client) => {
    const existing = await client.query(
      `
        SELECT 1
        FROM users
        WHERE LOWER(${quoteIdentifier(emailColumn)}) = LOWER($1)
          AND ${quoteIdentifier(tenantColumn)}::text = $2::text
        LIMIT 1
      `,
      [input.email, tenantId]
    );

    if (existing.rowCount > 0) {
      throw getError(
        "A user with this email already exists in your tenant",
        409
      );
    }

    const values = uniqueEntries.map(([, value]) => value);
    const names = uniqueEntries.map(([column]) => quoteIdentifier(column));
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await client.query(
      `
        INSERT INTO users (${names.join(", ")})
        VALUES (${placeholders.join(", ")})
        RETURNING ${buildUserSelect(columns)}
      `,
      values
    );

    return toPublicUser(result.rows[0]);
  });
}

export async function updateUser(tenantId, userId, input) {
  const columns = await getColumns();

  const idColumn = findColumn(columns, COLUMN_CANDIDATES.id);
  const tenantColumn = findColumn(columns, COLUMN_CANDIDATES.tenant);
  const emailColumn = findColumn(columns, COLUMN_CANDIDATES.email);
  const firstNameColumn = findColumn(columns, COLUMN_CANDIDATES.firstName);
  const lastNameColumn = findColumn(columns, COLUMN_CANDIDATES.lastName);
  const fullNameColumn = findColumn(columns, COLUMN_CANDIDATES.fullName);
  const roleColumn = findColumn(columns, COLUMN_CANDIDATES.role);
  const activeColumn = findColumn(columns, COLUMN_CANDIDATES.active);
  const updatedAtColumn = findColumn(columns, COLUMN_CANDIDATES.updatedAt);

  const updates = [];

  if (input.email !== undefined && emailColumn) {
    updates.push([emailColumn, input.email]);
  }

  if (input.firstName !== undefined && firstNameColumn) {
    updates.push([firstNameColumn, input.firstName]);
  }

  if (input.lastName !== undefined && lastNameColumn) {
    updates.push([lastNameColumn, input.lastName]);
  }

  if (input.role !== undefined && roleColumn) {
    updates.push([roleColumn, input.role]);
  }

  if (input.isActive !== undefined && activeColumn) {
    updates.push([activeColumn, input.isActive]);
  }

  if (fullNameColumn && (
    input.firstName !== undefined ||
    input.lastName !== undefined
  )) {
    const existing = await findUserById(tenantId, userId);

    if (!existing) {
      throw getError("User not found", 404);
    }

    updates.push([
      fullNameColumn,
      [
        input.firstName ?? existing.firstName,
        input.lastName ?? existing.lastName,
      ]
        .filter(Boolean)
        .join(" "),
    ]);
  }

  if (updatedAtColumn) {
    updates.push([updatedAtColumn, new Date()]);
  }

  if (updates.length === 0) {
    throw getError(
      "None of the supplied fields can be updated in the current schema",
      400
    );
  }

  return withTenantClient(tenantId, async (client) => {
    const values = updates.map(([, value]) => value);

    const setClause = updates
      .map(
        ([column], index) =>
          `${quoteIdentifier(column)} = $${index + 1}`
      )
      .join(", ");

    values.push(userId, tenantId);

    const result = await client.query(
      `
        UPDATE users
        SET ${setClause}
        WHERE ${quoteIdentifier(idColumn)}::text = $${values.length - 1}::text
          AND ${quoteIdentifier(tenantColumn)}::text = $${values.length}::text
        RETURNING ${buildUserSelect(columns)}
      `,
      values
    );

    if (result.rowCount === 0) {
      throw getError("User not found", 404);
    }

    return toPublicUser(result.rows[0]);
  });
}

export async function deactivateUser(tenantId, userId) {
  const columns = await getColumns();

  const idColumn = findColumn(columns, COLUMN_CANDIDATES.id);
  const tenantColumn = findColumn(columns, COLUMN_CANDIDATES.tenant);
  const activeColumn = findColumn(columns, COLUMN_CANDIDATES.active);
  const updatedAtColumn = findColumn(columns, COLUMN_CANDIDATES.updatedAt);

  if (!activeColumn) {
    throw new Error(
      "Cannot deactivate users: no active-status column exists"
    );
  }

  return withTenantClient(tenantId, async (client) => {
    const values = [false];

    let setClause = `${quoteIdentifier(activeColumn)} = $1`;

    if (updatedAtColumn) {
      values.push(new Date());
      setClause += `, ${quoteIdentifier(updatedAtColumn)} = $2`;
    }

    values.push(userId, tenantId);

    const result = await client.query(
      `
        UPDATE users
        SET ${setClause}
        WHERE ${quoteIdentifier(idColumn)}::text = $${values.length - 1}::text
          AND ${quoteIdentifier(tenantColumn)}::text = $${values.length}::text
        RETURNING ${quoteIdentifier(idColumn)} AS id
      `,
      values
    );

    if (result.rowCount === 0) {
      throw getError("User not found", 404);
    }

    return { id: result.rows[0].id, isActive: false };
  });
}