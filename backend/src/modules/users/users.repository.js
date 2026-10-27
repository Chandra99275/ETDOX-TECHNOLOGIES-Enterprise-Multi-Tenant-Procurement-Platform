import { pool } from '../../config/database.js';

function toPublicUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    email: row.email,
    tenantId: row.tenant_id,
    isActive: row.is_active,
  };
}

const PUBLIC_COLUMNS = `
  id,
  first_name,
  last_name,
  email,
  tenant_id,
  is_active
`;

export async function listByTenant({
  tenantId,
  page,
  limit,
  search,
}) {
  const offset = (page - 1) * limit;
  const searchPattern = `%${search}%`;

  const [usersResult, countResult] = await Promise.all([
    pool.query(
      `
        SELECT ${PUBLIC_COLUMNS}
        FROM users
        WHERE tenant_id = $1
          AND (
            $2 = ''
            OR email ILIKE $3
            OR first_name ILIKE $3
            OR last_name ILIKE $3
          )
        ORDER BY email ASC
        LIMIT $4 OFFSET $5
      `,
      [tenantId, search, searchPattern, limit, offset]
    ),

    pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM users
        WHERE tenant_id = $1
          AND (
            $2 = ''
            OR email ILIKE $3
            OR first_name ILIKE $3
            OR last_name ILIKE $3
          )
      `,
      [tenantId, search, searchPattern]
    ),
  ]);

  return {
    users: usersResult.rows.map(toPublicUser),
    total: countResult.rows[0].total,
  };
}

export async function findById(tenantId, userId) {
  const result = await pool.query(
    `
      SELECT ${PUBLIC_COLUMNS}
      FROM users
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
    `,
    [tenantId, userId]
  );

  return toPublicUser(result.rows[0]);
}

export async function findByEmail(tenantId, email) {
  const result = await pool.query(
    `
      SELECT id
      FROM users
      WHERE tenant_id = $1
        AND LOWER(email) = LOWER($2)
      LIMIT 1
    `,
    [tenantId, email]
  );

  return result.rows[0] ?? null;
}

export async function create({
  tenantId,
  firstName,
  lastName,
  email,
  passwordHash,
}) {
  const result = await pool.query(
    `
      INSERT INTO users (
        tenant_id,
        first_name,
        last_name,
        email,
        password_hash,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING ${PUBLIC_COLUMNS}
    `,
    [tenantId, firstName, lastName, email, passwordHash]
  );

  return toPublicUser(result.rows[0]);
}

export async function update(tenantId, userId, updates) {
  const columnMap = {
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    passwordHash: 'password_hash',
    isActive: 'is_active',
  };

  const entries = Object.entries(updates);

  if (entries.length === 0) return findById(tenantId, userId);

  const values = [tenantId, userId];

  const setClauses = entries.map(([key, value], index) => {
    const column = columnMap[key];

    if (!column) {
      throw new Error(`Unsupported user update field: ${key}`);
    }

    values.push(value);
    return `${column} = $${index + 3}`;
  });

  const result = await pool.query(
    `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE tenant_id = $1 AND id = $2
      RETURNING ${PUBLIC_COLUMNS}
    `,
    values
  );

  return toPublicUser(result.rows[0]);
}

export async function deactivate(tenantId, userId) {
  const result = await pool.query(
    `
      UPDATE users
      SET is_active = FALSE
      WHERE tenant_id = $1 AND id = $2
      RETURNING ${PUBLIC_COLUMNS}
    `,
    [tenantId, userId]
  );

  return toPublicUser(result.rows[0]);
}