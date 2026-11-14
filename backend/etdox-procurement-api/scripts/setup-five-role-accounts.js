
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { pool } from "../src/config/database.js";

const TENANT_ID = "b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e";

const ACCOUNTS = [
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

    // Confirm the tenant exists.
    const tenant = await client.query(
      `SELECT id FROM public.tenants WHERE id = $1`,
      [TENANT_ID]
    );

    if (tenant.rowCount !== 1) {
      throw new Error("The configured tenant was not found.");
    }

    for (const account of ACCOUNTS) {
      const email = account.email.toLowerCase();

      // Confirm the role exists in this tenant.
      const roleResult = await client.query(
        `SELECT id
         FROM public.roles
         WHERE tenant_id = $1
           AND name = $2`,
        [TENANT_ID, account.role]
      );

      if (roleResult.rowCount !== 1) {
        throw new Error(`Missing or duplicate role: ${account.role}`);
      }

      const roleId = roleResult.rows[0].id;

      // Find this email without accidentally using another tenant's user.
      const existing = await client.query(
        `SELECT id, tenant_id
         FROM public.users
         WHERE LOWER(TRIM(email)) = $1
         FOR UPDATE`,
        [email]
      );

      if (existing.rows.some(
        row => row.tenant_id !== TENANT_ID
      )) {
        throw new Error(
          `Email already belongs to another tenant: ${email}`
        );
      }

      const userId =
        existing.rowCount > 0
          ? existing.rows[0].id
          : randomUUID();

      // Generate a fresh bcrypt hash for the supplied password.
      const passwordHash = await bcrypt.hash(
        account.password,
        12
      );

      if (existing.rowCount === 0) {
        await client.query(
          `INSERT INTO public.users (
            id,
            tenant_id,
            email,
            password_hash,
            first_name,
            last_name,
            title,
            phone,
            department_id,
            is_active,
            email_verified_at,
            last_login_at,
            created_at,
            updated_at,
            status,
            requested_role
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            NULL, NULL, NULL, TRUE, NOW(),
            NULL, NOW(), NOW(), 'ACTIVE', $7
          )`,
          [
            userId,
            TENANT_ID,
            email,
            passwordHash,
            account.firstName,
            account.lastName,
            account.role,
          ]
        );
      } else {
        await client.query(
          `UPDATE public.users
           SET password_hash = $1,
               first_name = $2,
               last_name = $3,
               is_active = TRUE,
               email_verified_at = COALESCE(email_verified_at, NOW()),
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
      }

      // Replace role assignments for these five dedicated accounts.
      await client.query(
        `DELETE FROM public.user_roles
         WHERE tenant_id = $1
           AND user_id = $2`,
        [TENANT_ID, userId]
      );

      await client.query(
        `INSERT INTO public.user_roles (
          tenant_id,
          user_id,
          role_id,
          assigned_by,
          assigned_at
        )
        VALUES ($1, $2, $3, NULL, NOW())`,
        [TENANT_ID, userId, roleId]
      );

      console.log(`READY: ${email} -> ${account.role}`);
    }

    await client.query("COMMIT");

    console.log("\nSUCCESS: All five accounts are ready.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\nFAILED:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

setupAccounts();
