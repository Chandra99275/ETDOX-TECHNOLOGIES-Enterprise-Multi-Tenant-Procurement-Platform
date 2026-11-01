
import "dotenv/config";

<<<<<<< HEAD
const ROLES = [
  { name: 'organization_admin', description: 'Tenant organization administrator', permissions: ['*'] },
  { name: 'admin', description: 'Organization administrator', permissions: ['*'] },
  { name: 'requester', description: 'Creates procurement requests', permissions: ['purchase_requests:read', 'purchase_requests:create', 'purchase_requests:submit', 'budgets:read', 'suppliers:read', 'invoices:read', 'receipts:read', 'notifications:read'] },
  { name: 'employee', description: 'Creates procurement requests', permissions: ['purchase_requests:read', 'purchase_requests:create', 'purchase_requests:submit', 'budgets:read', 'suppliers:read', 'invoices:read', 'receipts:read', 'notifications:read'] },
  { name: 'department_manager', description: 'Approves department requests', permissions: ['purchase_requests:read', 'purchase_requests:read_all', 'purchase_requests:manage', 'purchase_requests:approve', 'budgets:read', 'invoices:read', 'invoices:approve', 'purchase_orders:read', 'receipts:read', 'suppliers:read', 'notifications:read'] },
  { name: 'manager', description: 'Manager approver', permissions: ['purchase_requests:read', 'purchase_requests:read_all', 'purchase_requests:manage', 'purchase_requests:approve', 'budgets:read', 'invoices:read', 'invoices:approve', 'purchase_orders:read', 'receipts:read', 'suppliers:read', 'notifications:read'] },
  { name: 'procurement_manager', description: 'Procurement manager', permissions: ['purchase_requests:*', 'purchase_orders:*', 'suppliers:*', 'contracts:*', 'receipts:*', 'invoices:read', 'notifications:read'] },
  { name: 'procurement_specialist', description: 'Procurement specialist', permissions: ['purchase_requests:read', 'purchase_orders:read', 'purchase_orders:create', 'suppliers:*', 'notifications:read'] },
  { name: 'finance_manager', description: 'Reviews invoices and payments', permissions: ['budgets:*', 'invoices:*', 'billing:*', 'purchase_orders:read', 'receipts:read', 'notifications:read'] },
  { name: 'finance', description: 'Finance user', permissions: ['budgets:read', 'budgets:manage', 'invoices:read', 'invoices:manage', 'invoices:approve', 'billing:read', 'billing:manage', 'purchase_orders:read', 'receipts:read', 'notifications:read'] },
  { name: 'auditor', description: 'Read-only compliance auditor', permissions: ['*:read'] },
  { name: 'supplier_user', description: 'Supplier portal user', permissions: ['purchase_orders:read', 'invoices:create'] },
];

// ----------------------------------------------------------------------
// ETDOX Database Seed — Schema, Roles, Departments, Suppliers, Budgets
// No hardcoded credentials or demo accounts are stored in this seed script.
// ----------------------------------------------------------------------

async function seed() {
=======
import bcrypt from "bcryptjs";
import { pool, closeDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

const DEMO_USERS = [
  {
    firstName: "ETDOX Demo",
    lastName: "Admin",
    email: "admin@etdox.com",
    password: "admin123",
    role: "admin",
  },
  {
    firstName: "ETDOX Demo",
    lastName: "Employee",
    email: "employee@etdox.com",
    password: "employee123",
    role: "employee",
  },
  {
    firstName: "ETDOX Demo",
    lastName: "Manager",
    email: "manager@etdox.com",
    password: "manager123",
    role: "manager",
  },
  {
    firstName: "ETDOX Demo",
    lastName: "Finance",
    email: "finance@etdox.com",
    password: "finance123",
    role: "finance",
  },
];

const TENANT_ID = env.demoTenantId;

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

async function getColumns(client, tableName) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

function chooseColumn(columns, candidates, description) {
  const column = candidates.find((candidate) => columns.has(candidate));

  if (!column) {
    throw new Error(
      `Could not identify the ${description} column. ` +
        `Checked: ${candidates.join(", ")}`
    );
  }

  return column;
}

function optionalColumn(columns, candidates) {
  return candidates.find((candidate) => columns.has(candidate)) ?? null;
}

async function setTenantContext(client) {
  await client.query(
    "SELECT set_config('app.tenant_id', $1, true)",
    [TENANT_ID]
  );
}

async function seedUser(client, schema, demoUser) {
  const userColumns = schema.users;

  const emailColumn = chooseColumn(
    userColumns,
    ["email", "email_address"],
    "user email"
  );

  const tenantColumn = chooseColumn(
    userColumns,
    ["tenant_id"],
    "user tenant ID"
  );

  const passwordColumn = chooseColumn(
    userColumns,
    ["password_hash", "passwordHash", "hashed_password"],
    "user password hash"
  );

  const userIdColumn = chooseColumn(
    userColumns,
    ["id", "user_id"],
    "user ID"
  );

  // Support either a single display-name column or first_name/last_name.
  const nameColumn = optionalColumn(userColumns, [
    "name",
    "full_name",
    "display_name",
    "username",
  ]);

  const firstNameColumn = optionalColumn(userColumns, [
    "first_name",
    "firstname",
    "given_name",
  ]);

  const lastNameColumn = optionalColumn(userColumns, [
    "last_name",
    "lastname",
    "surname",
  ]);

  if (!nameColumn && !firstNameColumn && !lastNameColumn) {
    throw new Error(
      "No supported user name columns were found in the users table."
    );
  }

  const roleNameColumn = chooseColumn(
    schema.roles,
    ["name", "role_name", "slug"],
    "role name"
  );

  const roleIdColumn = chooseColumn(
    schema.roles,
    ["id", "role_id"],
    "role ID"
  );

  const linkUserColumn = chooseColumn(
    schema.userRoles,
    ["user_id"],
    "user_roles user ID"
  );

  const linkRoleColumn = chooseColumn(
    schema.userRoles,
    ["role_id"],
    "user_roles role ID"
  );

  // Find the existing role. Do not create or change role definitions.
  const roleResult = await client.query(
    `SELECT ${quoteIdentifier(roleIdColumn)} AS id
     FROM public.roles
     WHERE LOWER(${quoteIdentifier(roleNameColumn)}::text) = LOWER($1)
     LIMIT 1`,
    [demoUser.role]
  );

  if (roleResult.rowCount === 0) {
    throw new Error(
      `Role "${demoUser.role}" does not exist. ` +
        "No user password was changed for this account."
    );
  }

  const roleId = roleResult.rows[0].id;
  const passwordHash = await bcrypt.hash(demoUser.password, 12);

  // Look up the account within the configured tenant.
  const existingResult = await client.query(
    `SELECT ${quoteIdentifier(userIdColumn)} AS id
     FROM public.users
     WHERE ${quoteIdentifier(tenantColumn)} = $1
       AND LOWER(${quoteIdentifier(emailColumn)}::text) = LOWER($2)
     LIMIT 1`,
    [TENANT_ID, demoUser.email]
  );

  let userId;

  if (existingResult.rowCount > 0) {
    // Preserve the existing user's ID and tenant assignment.
    userId = existingResult.rows[0].id;

    const updates = [[passwordColumn, passwordHash]];

    // Do not overwrite existing names when updating passwords.
    if (userColumns.has("is_active")) {
      updates.push(["is_active", true]);
    } else if (userColumns.has("active")) {
      updates.push(["active", true]);
    }

    if (userColumns.has("updated_at")) {
      updates.push(["updated_at", new Date()]);
    }

    const setClause = updates
      .map(
        ([column], index) =>
          `${quoteIdentifier(column)} = $${index + 1}`
      )
      .join(", ");

    await client.query(
      `UPDATE public.users
       SET ${setClause}
       WHERE ${quoteIdentifier(userIdColumn)} = $${updates.length + 1}
         AND ${quoteIdentifier(tenantColumn)} = $${updates.length + 2}`,
      [
        ...updates.map(([, value]) => value),
        userId,
        TENANT_ID,
      ]
    );
  } else {
    // Insert only if the account does not already exist.
    const valuesByColumn = new Map([
      [tenantColumn, TENANT_ID],
      [emailColumn, demoUser.email],
      [passwordColumn, passwordHash],
    ]);

    if (nameColumn) {
      const displayName = `${demoUser.firstName} ${demoUser.lastName}`;
      valuesByColumn.set(nameColumn, displayName);
    }

    if (firstNameColumn) {
      valuesByColumn.set(firstNameColumn, demoUser.firstName);
    }

    if (lastNameColumn) {
      valuesByColumn.set(lastNameColumn, demoUser.lastName);
    }

    if (userColumns.has("is_active")) {
      valuesByColumn.set("is_active", true);
    } else if (userColumns.has("active")) {
      valuesByColumn.set("active", true);
    }

    if (userColumns.has("email_verified_at")) {
      valuesByColumn.set("email_verified_at", new Date());
    }

    if (userColumns.has("created_at")) {
      valuesByColumn.set("created_at", new Date());
    }

    if (userColumns.has("updated_at")) {
      valuesByColumn.set("updated_at", new Date());
    }

    const columns = [...valuesByColumn.keys()];
    const values = [...valuesByColumn.values()];

    const insertResult = await client.query(
      `INSERT INTO public.users (${columns
        .map(quoteIdentifier)
        .join(", ")})
       VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")})
       RETURNING ${quoteIdentifier(userIdColumn)} AS id`,
      values
    );

    userId = insertResult.rows[0].id;
  }

  // Preserve existing role relationships and add the expected role if absent.
  const existingLink = await client.query(
    `SELECT 1
     FROM public.user_roles
     WHERE ${quoteIdentifier(linkUserColumn)} = $1
       AND ${quoteIdentifier(linkRoleColumn)} = $2
     LIMIT 1`,
    [userId, roleId]
  );

  if (existingLink.rowCount === 0) {
    await client.query(
      `INSERT INTO public.user_roles (
         ${quoteIdentifier(linkUserColumn)},
         ${quoteIdentifier(linkRoleColumn)}
       )
       VALUES ($1, $2)`,
      [userId, roleId]
    );
  }

  logger.info(
    { email: demoUser.email, role: demoUser.role },
    "Demo user seeded successfully"
  );
}

async function main() {
  if (env.nodeEnv !== "development") {
    throw new Error(
      "Demo user seeding is only permitted when NODE_ENV=development."
    );
  }

  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error(
      "Seeding is disabled. Set ALLOW_DEMO_SEED=true explicitly to continue."
    );
  }

  if (!TENANT_ID) {
    throw new Error("ETDOX_DEMO_TENANT_ID is not configured.");
  }

>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

<<<<<<< HEAD
    // Set tenant context for RLS first so that app_current_tenant_id() matches
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_ID]);

    // 1. Ensure Tenant exists
    await client.query(
      `INSERT INTO tenants (id, name, slug, base_currency, status)
       VALUES ($1, 'ETDOX Global Technologies', 'etdox-global', 'USD', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE'`,
      [TENANT_ID]
    );

    // Also mirror to organizations table for foreign key compatibility
    await client.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, 'ETDOX Global Technologies', 'etdox-global')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [TENANT_ID]
    );

    // 2. Seed Roles
    const roleMap = new Map();
    for (const r of ROLES) {
      const res = await client.query(
        `INSERT INTO roles (tenant_id, name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (tenant_id, name)
         DO UPDATE SET description = EXCLUDED.description, permissions = EXCLUDED.permissions
         RETURNING id`,
        [TENANT_ID, r.name, r.description, r.permissions]
      );
      roleMap.set(r.name, res.rows[0].id);
    }
    console.log(`Seeded ${roleMap.size} roles.`);

    // 3. User verification: Fetch existing active users without storing fake credentials
    const userRes = await client.query(
      `SELECT id, email FROM users WHERE tenant_id = $1 LIMIT 1`,
      [TENANT_ID]
    );
    const existingUserId = userRes.rows[0]?.id || null;

    // 4. Seed Departments
    const departments = [
      { name: 'Engineering', code: 'ENG' },
      { name: 'Procurement', code: 'PROC' },
      { name: 'Finance', code: 'FIN' },
      { name: 'Operations', code: 'OPS' },
    ];
    const deptMap = new Map();
    for (const d of departments) {
      const res = await client.query(
        `INSERT INTO departments (tenant_id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [TENANT_ID, d.name, d.code]
      );
      deptMap.set(d.code, res.rows[0].id);
    }
    console.log(`Seeded ${departments.length} departments.`);

    // 5. Seed Cost Centers
    for (const [code, deptId] of deptMap.entries()) {
      await client.query(
        `INSERT INTO cost_centers (tenant_id, department_id, code, name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, code) DO NOTHING`,
        [TENANT_ID, deptId, `CC-${code}`, `${code} Center`]
      );
    }

    // 6. Seed Suppliers
    const suppliers = [
      { code: 'SUP-DELL', name: 'Dell Technologies', email: 'sales@dell.com', phone: '+1-800-456-3355' },
      { code: 'SUP-AWS', name: 'Amazon Web Services', email: 'billing@aws.com', phone: '+1-800-555-0199' },
      { code: 'SUP-ODS', name: 'Office Depot Supplies', email: 'orders@officedepot.com', phone: '+1-800-555-0144' },
      { code: 'SUP-APPLE', name: 'Apple Enterprise', email: 'b2b@apple.com', phone: '+1-800-692-7753' },
    ];
    const supplierMap = new Map();
    for (const s of suppliers) {
      const res = await client.query(
        `INSERT INTO suppliers (tenant_id, supplier_code, legal_name, currency, contact_name, contact_email, contact_phone, status, onboarding_status)
         VALUES ($1, $2, $3, 'USD', $3, $4, $5, 'ACTIVE', 'APPROVED')
         ON CONFLICT (tenant_id, supplier_code) DO UPDATE SET legal_name = EXCLUDED.legal_name, status = 'ACTIVE'
         RETURNING id`,
        [TENANT_ID, s.code, s.name, s.email, s.phone]
      );
      supplierMap.set(s.code, res.rows[0].id);
    }
    console.log(`Seeded ${suppliers.length} suppliers.`);

    // 7. Seed Budgets
    const budgets = [
      { code: 'ENG', allocated: 250000, spent: 45000, reserved: 12000 },
      { code: 'PROC', allocated: 150000, spent: 20000, reserved: 5000 },
      { code: 'FIN', allocated: 100000, spent: 10000, reserved: 2000 },
      { code: 'OPS', allocated: 180000, spent: 30000, reserved: 8000 },
    ];
    for (const b of budgets) {
      const deptId = deptMap.get(b.code);
      const existing = await client.query(
        `SELECT id FROM budgets WHERE tenant_id = $1 AND department_id = $2 AND fiscal_year = 2026`,
        [TENANT_ID, deptId]
      );
      if (existing.rowCount === 0) {
        await client.query(
          `INSERT INTO budgets (tenant_id, department_id, fiscal_year, currency, allocated, spent, reserved, status, name, department)
           VALUES ($1, $2, 2026, 'USD', $3, $4, $5, 'active', $6, $6)`,
          [TENANT_ID, deptId, b.allocated, b.spent, b.reserved, b.code]
        );
      }
    }
    console.log(`Seeded ${budgets.length} budgets.`);

    // 8. Seed Sample Purchase Request if none exist and an active user exists
    const prCheck = await client.query(`SELECT count(*)::int as count FROM purchase_requests WHERE tenant_id = $1`, [TENANT_ID]);
    if (prCheck.rows[0].count === 0 && existingUserId) {
      const dellId = supplierMap.get('SUP-DELL');
      const engDeptId = deptMap.get('ENG');

      const prRes = await client.query(
        `INSERT INTO purchase_requests
           (tenant_id, request_number, requester_id, department_id, preferred_supplier_id, justification, currency, subtotal, tax_total, total_amount, status)
         VALUES ($1, 'PR-2026-0001', $2, $3, $4, 'High-performance engineering laptops for new developers', 'USD', 4500, 450, 4950, 'SUBMITTED')
         RETURNING id`,
        [TENANT_ID, existingUserId, engDeptId, dellId]
      );

      const prId = prRes.rows[0].id;
      await client.query(
        `INSERT INTO purchase_request_items
           (tenant_id, purchase_request_id, line_number, description, quantity, unit_price, tax_rate, line_total)
         VALUES ($1, $2, 1, 'Dell XPS 15 Developer Edition', 3, 1500, 10, 4950)`,
        [TENANT_ID, prId]
      );

      // Also create an approval entry
      await client.query(
        `INSERT INTO approvals (tenant_id, purchase_request_id, approver_id, status, comment)
         VALUES ($1, $2, $3, 'pending', 'Awaiting managerial sign-off')`,
        [TENANT_ID, prId, existingUserId]
      );
      console.log('Seeded sample purchase request PR-2026-0001 with approval task.');
    }

    await client.query('COMMIT');
    console.log('\nPostgreSQL database seeded successfully!');
    console.log(`Tenant ID: ${TENANT_ID}`);
    console.log('PostgreSQL is the verified single source of truth.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    process.exitCode = 1;
=======
    // Use transaction-local tenant context for PostgreSQL RLS.
    await setTenantContext(client);

    const schema = {
      users: await getColumns(client, "users"),
      roles: await getColumns(client, "roles"),
      userRoles: await getColumns(client, "user_roles"),
    };

    if (
      schema.users.size === 0 ||
      schema.roles.size === 0 ||
      schema.userRoles.size === 0
    ) {
      throw new Error(
        "Required tables users, roles, or user_roles are missing."
      );
    }

    for (const demoUser of DEMO_USERS) {
      await seedUser(client, schema, demoUser);
    }

    await client.query("COMMIT");

    logger.info("Demo user seeding completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => {
      logger.error({ err: rollbackError }, "Seed rollback failed");
    });

    throw error;
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
  } finally {
    client.release();
  }
}

<<<<<<< HEAD
seed();
=======
main()
  .catch((error) => {
    logger.error({ err: error }, "Demo user seeding failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch((error) => {
      logger.error({ err: error }, "Failed to close database pool");
    });
  });
>>>>>>> 0c27d73 (Fix tenant-aware current user authentication)
