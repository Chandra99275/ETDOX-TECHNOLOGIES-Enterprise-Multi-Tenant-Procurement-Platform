// backend/src/modules/employees/employees.repository.js

import { pool } from "../../config/database.js";

const quote = (identifier) =>
  `"${String(identifier).replaceAll('"', '""')}"`;

const USER_FIELDS = {
  id: ["id", "user_id"],
  tenantId: ["tenant_id"],
  firstName: ["first_name", "firstname", "given_name"],
  lastName: ["last_name", "lastname", "surname"],
  name: ["name", "full_name", "display_name"],
  email: ["email", "email_address"],
  phone: ["phone", "phone_number", "mobile"],
  department: ["department", "department_name"],
  jobTitle: ["job_title", "position", "designation", "title"],
  employeeCode: ["employee_code", "employee_id", "staff_code"],
  status: ["status", "account_status"],
  passwordHash: ["password_hash", "password", "hashed_password"],
  createdAt: ["created_at", "created_on"],
  updatedAt: ["updated_at", "updated_on"],
};

async function getTableColumns(client, tableName) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [tableName],
  );

  return result.rows.map((row) => row.column_name);
}

async function getSchema(client) {
  const userColumnNames = await getTableColumns(client, "users");

  if (userColumnNames.length === 0) {
    throw new Error('The "users" table was not found in the current schema.');
  }

  const actual = new Set(userColumnNames);
  const user = {};

  for (const [field, candidates] of Object.entries(USER_FIELDS)) {
    user[field] = candidates.find((candidate) => actual.has(candidate)) ?? null;
  }

  if (!user.id || !user.tenantId || !user.email) {
    throw new Error(
      'The "users" table must have an ID, tenant_id, and email column.',
    );
  }

  const userRolesColumns = await getTableColumns(client, "user_roles");
  const rolesColumns = await getTableColumns(client, "roles");

  const userRoles = new Set(userRolesColumns);
  const roles = new Set(rolesColumns);

  const roleMapping = {
    userId: ["user_id"].find((column) => userRoles.has(column)) ?? null,
    roleId: ["role_id"].find((column) => userRoles.has(column)) ?? null,
    tenantId: ["tenant_id"].find((column) => userRoles.has(column)) ?? null,
    rolesId: ["id", "role_id"].find((column) => roles.has(column)) ?? null,
    roleName: ["name", "role_name", "slug"].find((column) =>
      roles.has(column),
    ) ?? null,
  };

  const hasRoleRelation = Boolean(
    roleMapping.userId &&
    roleMapping.roleId &&
    roleMapping.rolesId &&
    roleMapping.roleName,
  );

  return {
    user,
    roleMapping,
    hasRoleRelation,
    userRolesColumns: userRoles,
  };
}

async function withTenant(tenantId, callback) {
  if (!tenantId) {
    throw new Error("Tenant ID is required.");
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

function selectUserFields(user) {
  return Object.entries(user)
    .filter(([field, column]) => column && field !== "passwordHash")
    .map(([field, column]) => `${quote(column)} AS ${quote(field)}`);
}

function buildRoleJoin(schema, userAlias = "u") {
  if (!schema.hasRoleRelation) return "";

  const { roleMapping: r } = schema;

  const userRolesTenantJoin = r.tenantId
    ? ` AND ur.${quote(r.tenantId)} = ${userAlias}.${quote(schema.user.tenantId)}`
    : "";

  return `
    LEFT JOIN user_roles ur
      ON ur.${quote(r.userId)} = ${userAlias}.${quote(schema.user.id)}
      ${userRolesTenantJoin}
    LEFT JOIN roles ro
      ON ro.${quote(r.rolesId)} = ur.${quote(r.roleId)}
  `;
}

function roleSelect(schema) {
  if (!schema.hasRoleRelation) {
    return "'employee'::text AS role";
  }

  return `COALESCE(
    STRING_AGG(DISTINCT ro.${quote(schema.roleMapping.roleName)}::text, ','),
    'employee'
  ) AS role`;
}

export async function listEmployees(tenantId, filters = {}) {
  return withTenant(tenantId, async (client) => {
    const schema = await getSchema(client);
    const { user } = schema;

    const conditions = [
      `u.${quote(user.tenantId)} = $1`,
    ];
    const values = [String(tenantId)];

    if (user.status && filters.status) {
      values.push(filters.status);
      conditions.push(`u.${quote(user.status)} = $${values.length}`);
    }

    if (filters.search) {
      const searchable = [
        user.firstName,
        user.lastName,
        user.name,
        user.email,
        user.employeeCode,
      ].filter(Boolean);

      if (searchable.length) {
        values.push(`%${filters.search}%`);
        const parameter = `$${values.length}`;

        conditions.push(
          `(${searchable
            .map((column) => `u.${quote(column)} ILIKE ${parameter}`)
            .join(" OR ")})`,
        );
      }
    }

    const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(filters.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;
    const join = buildRoleJoin(schema);
    const where = conditions.join(" AND ");

    const countQuery = schema.hasRoleRelation
      ? `SELECT COUNT(DISTINCT u.${quote(user.id)})::int AS total
           FROM users u ${join}
          WHERE ${where}`
      : `SELECT COUNT(*)::int AS total
           FROM users u
          WHERE ${where}`;

    const countResult = await client.query(countQuery, values);

    const selectedFields = selectUserFields(user).map((field) => `u.${field}`);

    const result = await client.query(
      `SELECT
          ${selectedFields.join(", ")},
          ${roleSelect(schema)}
         FROM users u
         ${join}
        WHERE ${where}
        GROUP BY u.${quote(user.id)}
        ORDER BY ${
          user.createdAt
            ? `u.${quote(user.createdAt)}`
            : `u.${quote(user.id)}`
        } DESC
        LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    const total = countResult.rows[0]?.total ?? 0;

    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

export async function getEmployeeById(tenantId, employeeId) {
  return withTenant(tenantId, async (client) => {
    const schema = await getSchema(client);
    const { user } = schema;
    const join = buildRoleJoin(schema);

    const result = await client.query(
      `SELECT
          ${selectUserFields(user).map((field) => `u.${field}`).join(", ")},
          ${roleSelect(schema)}
         FROM users u
         ${join}
        WHERE u.${quote(user.id)} = $1
          AND u.${quote(user.tenantId)} = $2
        GROUP BY u.${quote(user.id)}
        LIMIT 1`,
      [employeeId, String(tenantId)],
    );

    return result.rows[0] ?? null;
  });
}

export async function findEmployeeByEmail(tenantId, email) {
  return withTenant(tenantId, async (client) => {
    const schema = await getSchema(client);
    const { user } = schema;

    const result = await client.query(
      `SELECT ${quote(user.id)} AS id
         FROM users
        WHERE ${quote(user.tenantId)} = $1
          AND LOWER(${quote(user.email)}) = LOWER($2)
        LIMIT 1`,
      [String(tenantId), email],
    );

    return result.rows[0] ?? null;
  });
}

export async function createEmployee(tenantId, input) {
  return withTenant(tenantId, async (client) => {
    const schema = await getSchema(client);
    const { user } = schema;

    const inputMap = {
      firstName: input.firstName,
      lastName: input.lastName,
      name: input.name,
      email: input.email,
      phone: input.phone,
      department: input.department,
      jobTitle: input.jobTitle,
      employeeCode: input.employeeCode,
      status: input.status,
      passwordHash: input.passwordHash,
    };

    const columns = [quote(user.tenantId)];
    const values = [String(tenantId)];
    const placeholders = ["$1"];

    for (const [field, value] of Object.entries(inputMap)) {
      const column = user[field];

      if (!column || value === undefined) continue;

      columns.push(quote(column));
      values.push(value);
      placeholders.push(`$${values.length}`);
    }

    if (user.createdAt) {
      columns.push(quote(user.createdAt));
      placeholders.push("CURRENT_TIMESTAMP");
    }

    if (user.updatedAt) {
      columns.push(quote(user.updatedAt));
      placeholders.push("CURRENT_TIMESTAMP");
    }

    const result = await client.query(
      `INSERT INTO users (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING ${selectUserFields(user).join(", ")}`,
      values,
    );

    const createdUser = result.rows[0];

    if (schema.hasRoleRelation) {
      const { roleMapping: r } = schema;

      const roleResult = await client.query(
        `SELECT ${quote(r.rolesId)} AS id
           FROM roles
          WHERE LOWER(${quote(r.roleName)}::text) = 'employee'
          LIMIT 1`,
      );

      if (roleResult.rows[0]) {
        const userRoleColumns = [quote(r.userId), quote(r.roleId)];
        const userRoleValues = [createdUser[user.id], roleResult.rows[0].id];
        const userRolePlaceholders = ["$1", "$2"];

        if (r.tenantId) {
          userRoleColumns.push(quote(r.tenantId));
          userRoleValues.push(String(tenantId));
          userRolePlaceholders.push("$3");
        }

        await client.query(
          `INSERT INTO user_roles (${userRoleColumns.join(", ")})
           VALUES (${userRolePlaceholders.join(", ")})`,
          userRoleValues,
        );
      } else {
        throw new Error('The "employee" role was not found in the roles table.');
      }
    }

    return createdUser;
  });
}

export async function updateEmployee(tenantId, employeeId, input) {
  return withTenant(tenantId, async (client) => {
    const schema = await getSchema(client);
    const { user } = schema;

    const inputMap = {
      firstName: input.firstName,
      lastName: input.lastName,
      name: input.name,
      email: input.email,
      phone: input.phone,
      department: input.department,
      jobTitle: input.jobTitle,
      employeeCode: input.employeeCode,
      status: input.status,
      passwordHash: input.passwordHash,
    };

    const sets = [];
    const values = [];

    for (const [field, value] of Object.entries(inputMap)) {
      const column = user[field];

      if (!column || value === undefined) continue;

      values.push(value);
      sets.push(`${quote(column)} = $${values.length}`);
    }

    if (sets.length === 0) {
      throw new Error("No compatible employee fields were supplied.");
    }

    if (user.updatedAt) {
      sets.push(`${quote(user.updatedAt)} = CURRENT_TIMESTAMP`);
    }

    values.push(employeeId);
    const idParameter = `$${values.length}`;

    values.push(String(tenantId));
    const tenantParameter = `$${values.length}`;

    const result = await client.query(
      `UPDATE users
          SET ${sets.join(", ")}
        WHERE ${quote(user.id)} = ${idParameter}
          AND ${quote(user.tenantId)} = ${tenantParameter}
      RETURNING ${selectUserFields(user).join(", ")}`,
      values,
    );

    return result.rows[0] ?? null;
  });
}

export async function deleteEmployee(tenantId, employeeId) {
  return withTenant(tenantId, async (client) => {
    const schema = await getSchema(client);
    const { user } = schema;

    // Remove role assignments first, if this schema has a user_roles relation.
    if (schema.hasRoleRelation) {
      const { roleMapping: r } = schema;
      const values = [employeeId];

      let tenantCondition = "";

      if (r.tenantId) {
        values.push(String(tenantId));
        tenantCondition = ` AND ${quote(r.tenantId)} = $2`;
      }

      await client.query(
        `DELETE FROM user_roles
          WHERE ${quote(r.userId)} = $1${tenantCondition}`,
        values,
      );
    }

    const result = await client.query(
      `DELETE FROM users
        WHERE ${quote(user.id)} = $1
          AND ${quote(user.tenantId)} = $2
      RETURNING ${quote(user.id)}`,
      [employeeId, String(tenantId)],
    );

    return result.rowCount > 0;
  });
}