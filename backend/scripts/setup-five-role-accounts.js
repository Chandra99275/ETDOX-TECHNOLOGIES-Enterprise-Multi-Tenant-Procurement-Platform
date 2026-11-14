
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { pool } from "../src/config/database.js";

const TENANT_ID = "b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e";

const accounts = [
  {
    email: "auditor@etdox.com",
    password: "Auditor@123",
    firstName: "Auditor",
    lastName: "ETDOX",
    role: "auditor",
  },
  {
    email: "procurementmanager@etdox.com",
    password: "ProcureManager@123",
    firstName: "Procurement",
    lastName: "Manager",
    role: "procurement_manager",
  },
  {
    email: "procurementspecialist@etdox.com",
    password: "ProcureSpecialist@123",
    firstName: "Procurement",
    lastName: "Specialist",
    role: "procurement_specialist",
  },
  {
    email: "supplier@etdox.com",
    password: "Supplier@123",
    firstName: "Supplier",
    lastName: "User",
    role: "supplier_user",
  },
  {
    email: "platformadmin@etdox.com",
    password: "PlatformAdmin@123",
    firstName: "Platform",
    lastName: "Admin",
    role: "platform_admin",
  },
];

async function setupAccounts() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tenant = await client.query(
      `SELECT id FROM public.tenants WHERE id = $1`,
      [TENANT_ID]
    );

    if (tenant.rowCount === 0) {
      throw new Error(`Tenant not found: ${TENANT_ID}`);
    }

    for (const account of accounts) {
      console.log(`Setting up ${account.email}...`);

      const roleResult = await client.query(
        `SELECT id
         FROM public.roles
         WHERE tenant_id = $1
           AND name = $2
         LIMIT 1`,
        [TENANT_ID, account.role]
      );

      if (roleResult.rowCount === 0) {
        throw new Error(`Role not found: ${account.role}`);
      }

      const roleId = roleResult.rows[0].id;
      const passwordHash = await bcrypt.hash(account.password, 12);

      const existing = await client.query(
        `SELECT id, tenant_id
         FROM public.users
         WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
         FOR UPDATE`,
        [account.email]
      );

      let userId;

      if (existing.rowCount > 0) {
        const user = existing.rows[0];

        if (user.tenant_id !== TENANT_ID) {
          throw new Error(
            `${account.email} already belongs to another tenant.`
          );
        }

        userId = user.id;

        await client.query(
          `UPDATE public.users
           SET password_hash = $1,
               first_name = $2,
               last_name = $3,
               is_active = TRUE,
               email_verified_at = NOW(),
               status = 'ACTIVE',
               requested_role = $4,
               updated_at = NOW()
           WHERE id = $5
             AND tenant_id = $6`,
          [
            passwordHash,
            account.firstName,
            account.lastName,
            account.role,
            userId,
            TENANT_ID,
          ]
        );
      } else {
        userId = randomUUID();

        await client.query(
          `INSERT INTO public.users (
             id,
             tenant_id,
             email,
             password_hash,
             first_name,
             last_name,
             is_active,
             email_verified_at,
             created_at,
             updated_at,
             status,
             requested_role
           )
           VALUES (
             $1, $2, $3, $4, $5, $6,
             TRUE, NOW(), NOW(), NOW(), 'ACTIVE', $7
           )`,
          [
            userId,
            TENANT_ID,
            account.email,
            passwordHash,
            account.firstName,
            account.lastName,
            account.role,
          ]
        );
      }

      // Assign only the intended role to this dedicated account.
      await client.query(
        `DELETE FROM public.user_roles
         WHERE tenant_id = $1 AND user_id = $2`,
        [TENANT_ID, userId]
      );

      await client.query(
        `INSERT INTO public.user_roles (
           tenant_id,
           user_id,
           role_id,
           assigned_at
         )
         VALUES ($1, $2, $3, NOW())`,
        [TENANT_ID, userId, roleId]
      );

      console.log(`Prepared ${account.email} with role ${account.role}`);
    }

    await client.query("COMMIT");

    console.log("\nAll five role accounts were created or updated.");
    console.log("Use the credentials below for development login:\n");

    for (const account of accounts) {
      console.log(`${account.role}: ${account.email} / ${account.password}`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\nAccount setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

setupAccounts();
