
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { pool, closeDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

const TENANT_ID = env.demoTenantId;

const ROLES = [
  { name: "organization_admin", permissions: ["*"] },
  { name: "admin", permissions: ["*"] },
  { name: "employee", permissions: ["procurement:create", "procurement:read", "budgets:read"] },
  { name: "requester", permissions: ["procurement:create", "procurement:read", "budgets:read"] },
  { name: "manager", permissions: ["procurement:read", "approvals:read", "approvals:act", "budgets:read"] },
  { name: "department_manager", permissions: ["procurement:read", "approvals:read", "approvals:act", "budgets:read"] },
  { name: "finance", permissions: ["procurement:read", "budgets:read", "budgets:manage", "invoices:read", "invoices:manage"] },
  { name: "finance_manager", permissions: ["procurement:read", "budgets:read", "budgets:manage", "invoices:read", "invoices:manage"] },
  { name: "procurement_manager", permissions: ["procurement:read", "procurement:manage", "approvals:read", "approvals:act"] },
  { name: "procurement_specialist", permissions: ["procurement:read", "procurement:create", "procurement:manage"] },
  { name: "auditor", permissions: ["procurement:read", "budgets:read", "analytics:read"] },
  { name: "supplier_user", permissions: ["procurement:read"] },
];

const DEMO_USERS = [
  { firstName: "ETDOX Demo", lastName: "Admin", email: "admin@etdox.com", password: "admin123", role: "admin" },
  { firstName: "ETDOX Demo", lastName: "Employee", email: "employee@etdox.com", password: "employee123", role: "employee" },
  { firstName: "ETDOX Demo", lastName: "Manager", email: "manager@etdox.com", password: "manager123", role: "manager" },
  { firstName: "ETDOX Demo", lastName: "Finance", email: "finance@etdox.com", password: "finance123", role: "finance" },
];

async function main() {
  if (env.nodeEnv !== "development") {
    throw new Error("Demo seeding is only allowed in development.");
  }

  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Set ALLOW_DEMO_SEED=true to explicitly allow seeding.");
  }

  if (!TENANT_ID) {
    throw new Error("Demo tenant ID is missing.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_ID]);

    await client.query(
      `INSERT INTO public.tenants (id, name, slug, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID, "ETDOX Demo", "etdox-demo"]
    );

    const roleIds = new Map();

    for (const role of ROLES) {
      const result = await client.query(
        `INSERT INTO public.roles
           (id, tenant_id, name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4, $5::text[], true)
         ON CONFLICT (tenant_id, name) DO UPDATE
         SET permissions = EXCLUDED.permissions
         RETURNING id`,
        [
          randomUUID(),
          TENANT_ID,
          role.name,
          `${role.name.replaceAll("_", " ")} role`,
          role.permissions,
        ]
      );

      roleIds.set(role.name, result.rows[0].id);
    }

    for (const user of DEMO_USERS) {
      const roleId = roleIds.get(user.role);

      const existing = await client.query(
        `SELECT id FROM public.users
         WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)
         LIMIT 1`,
        [TENANT_ID, user.email]
      );

      let userId;

      if (existing.rowCount > 0) {
        userId = existing.rows[0].id;
      } else {
        const passwordHash = await bcrypt.hash(user.password, 12);

        const inserted = await client.query(
          `INSERT INTO public.users
             (id, tenant_id, email, password_hash, first_name, last_name,
              is_active, email_verified_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), 'ACTIVE')
           RETURNING id`,
          [
            randomUUID(),
            TENANT_ID,
            user.email,
            passwordHash,
            user.firstName,
            user.lastName,
          ]
        );

        userId = inserted.rows[0].id;
      }

      await client.query(
        `INSERT INTO public.user_roles
           (tenant_id, user_id, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING`,
        [TENANT_ID, userId, roleId]
      );

      logger.info(
        { email: user.email, role: user.role },
        "Demo user verified"
      );
    }

    await client.query("COMMIT");
    logger.info("Tenant roles and demo users seeded successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ err: error }, "Demo seeding failed");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Seed process failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
