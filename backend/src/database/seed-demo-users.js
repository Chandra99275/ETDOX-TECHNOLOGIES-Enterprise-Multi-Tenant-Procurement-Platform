import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';

const TENANT_ID =
  process.env.ETDOX_DEMO_TENANT_ID ||
  'b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e';

const ROLE_DEFINITIONS = [
  {
    name: 'admin',
    description: 'ETDOX demo administrator',
    permissions: ['*'],
  },
  {
    name: 'employee',
    description: 'ETDOX demo employee',
    permissions: [
      'purchase_requests:read',
      'purchase_requests:create',
      'purchase_requests:submit',
      'budgets:read',
      'suppliers:read',
      'purchase_orders:read',
      'invoices:read',
      'receipts:read',
      'notifications:read',
    ],
  },
  {
    name: 'manager',
    description: 'ETDOX demo manager',
    permissions: [
      'purchase_requests:read',
      'purchase_requests:read_all',
      'purchase_requests:manage',
      'purchase_requests:approve',
      'budgets:read',
      'invoices:read',
      'invoices:approve',
      'purchase_orders:read',
      'purchase_orders:approve',
      'receipts:read',
      'suppliers:read',
      'notifications:read',
    ],
  },
  {
    name: 'finance',
    description: 'ETDOX demo finance user',
    permissions: [
      'budgets:read',
      'budgets:manage',
      'invoices:read',
      'invoices:manage',
      'invoices:approve',
      'billing:read',
      'billing:manage',
      'purchase_orders:read',
      'receipts:read',
      'notifications:read',
    ],
  },
];

const DEMO_USERS = [
  {
    email: 'admin@etdox.com',
    password: 'admin123',
    firstName: 'ETDOX',
    lastName: 'Admin',
    role: 'admin',
  },
  {
    email: 'employee@etdox.com',
    password: 'employee123',
    firstName: 'ETDOX',
    lastName: 'Employee',
    role: 'employee',
  },
  {
    email: 'manager@etdox.com',
    password: 'manager123',
    firstName: 'ETDOX',
    lastName: 'Manager',
    role: 'manager',
  },
  {
    email: 'finance@etdox.com',
    password: 'finance123',
    firstName: 'ETDOX',
    lastName: 'Finance',
    role: 'finance',
  },
];

async function seedDemoUsers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Set the tenant context for RLS-protected database operations.
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [TENANT_ID]
    );

    const tenantResult = await client.query(
      `SELECT id, status
       FROM tenants
       WHERE id = $1`,
      [TENANT_ID]
    );

    if (tenantResult.rowCount === 0) {
      throw new Error(
        `Tenant ${TENANT_ID} was not found or is not visible under RLS.`
      );
    }

    if (tenantResult.rows[0].status !== 'ACTIVE') {
      throw new Error(`Tenant ${TENANT_ID} is not ACTIVE.`);
    }

    const roleIds = new Map();

    // Create or update the four demo roles.
    for (const role of ROLE_DEFINITIONS) {
      const existingRole = await client.query(
        `SELECT id
         FROM roles
         WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)
         LIMIT 1`,
        [TENANT_ID, role.name]
      );

      let roleId;

      if (existingRole.rowCount > 0) {
        roleId = existingRole.rows[0].id;

        await client.query(
          `UPDATE roles
           SET description = $1,
               permissions = $2,
               updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [role.description, role.permissions, roleId, TENANT_ID]
        );
      } else {
        const insertedRole = await client.query(
          `INSERT INTO roles
             (tenant_id, name, description, permissions, is_system)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            TENANT_ID,
            role.name,
            role.description,
            role.permissions,
            true,
          ]
        );

        roleId = insertedRole.rows[0].id;
      }

      roleIds.set(role.name, roleId);
    }

    // Create or update demo users and their role assignments.
    for (const demoUser of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(demoUser.password, 12);

      const existingUser = await client.query(
        `SELECT id
         FROM users
         WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)
         LIMIT 1`,
        [TENANT_ID, demoUser.email]
      );

      let userId;

      if (existingUser.rowCount > 0) {
        userId = existingUser.rows[0].id;

        await client.query(
          `UPDATE users
           SET password_hash = $1,
               first_name = $2,
               last_name = $3,
               is_active = TRUE,
               updated_at = NOW()
           WHERE id = $4 AND tenant_id = $5`,
          [
            passwordHash,
            demoUser.firstName,
            demoUser.lastName,
            userId,
            TENANT_ID,
          ]
        );
      } else {
        const insertedUser = await client.query(
          `INSERT INTO users
             (tenant_id, email, password_hash, first_name, last_name,
              is_active, email_verified_at)
           VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
           RETURNING id`,
          [
            TENANT_ID,
            demoUser.email,
            passwordHash,
            demoUser.firstName,
            demoUser.lastName,
          ]
        );

        userId = insertedUser.rows[0].id;
      }

      const roleId = roleIds.get(demoUser.role);

      const existingAssignment = await client.query(
        `SELECT 1
         FROM user_roles
         WHERE tenant_id = $1
           AND user_id = $2
           AND role_id = $3
         LIMIT 1`,
        [TENANT_ID, userId, roleId]
      );

      if (existingAssignment.rowCount === 0) {
        await client.query(
          `INSERT INTO user_roles (tenant_id, user_id, role_id)
           VALUES ($1, $2, $3)`,
          [TENANT_ID, userId, roleId]
        );
      }

      console.log(
        `Prepared ${demoUser.email} with role ${demoUser.role}`
      );
    }

    await client.query('COMMIT');

    console.log('\nDemo users and roles seeded successfully.');
    console.log(`Tenant: ${TENANT_ID}`);
    console.log('Use these accounts for local development only.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Demo-user seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoUsers();