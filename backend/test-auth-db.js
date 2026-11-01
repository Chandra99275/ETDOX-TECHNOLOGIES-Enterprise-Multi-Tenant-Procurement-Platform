import { pool } from "./src/config/database.js";

async function testAuthDatabase() {
  try {
    console.log("\n========== ETDOX AUTH DATABASE TEST ==========\n");

    // 1. Identify the actual database connection.
    const connection = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        current_schema() AS current_schema,
        current_setting('search_path') AS search_path
    `);

    console.log("DATABASE CONNECTION:");
    console.table(connection.rows);

    // 2. Check whether the application can see demo accounts.
    const users = await pool.query(`
      SELECT
        id,
        email,
        is_active,
        tenant_id
      FROM public.users
      WHERE LOWER(email) IN (
        'admin@etdox.com',
        'employee@etdox.com',
        'manager@etdox.com',
        'finance@etdox.com'
      )
      ORDER BY email
    `);

    console.log("\nVISIBLE DEMO USERS:");
    console.table(users.rows);

    // 3. Test the exact manager lookup used by login.
    const manager = await pool.query(
      `
        SELECT id, email
        FROM public.users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      ["manager@etdox.com"]
    );

    console.log("\nMANAGER LOOKUP:");
    console.log("User found:", manager.rows.length > 0);
    console.log("Rows returned:", manager.rows.length);

    // 4. Check whether the application can inspect the users table.
    const permissions = await pool.query(`
      SELECT
        has_schema_privilege(current_user, 'public', 'USAGE')
          AS can_use_public_schema,
        has_table_privilege(current_user, 'public.users', 'SELECT')
          AS can_select_users
    `);

    console.log("\nDATABASE PERMISSIONS:");
    console.table(permissions.rows);

    console.log("\n========== TEST COMPLETED ==========\n");
  } catch (error) {
    console.error("\nDATABASE TEST FAILED:");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
  } finally {
    await pool.end();
  }
}

testAuthDatabase();