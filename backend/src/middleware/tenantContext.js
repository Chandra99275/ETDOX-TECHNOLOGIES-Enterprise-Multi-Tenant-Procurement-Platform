
import { pool } from '../config/database.js';

export function tenantContext(req, res, next) {
  if (!req.user?.id || !req.user?.tenantId) {
    return res.status(401).json({
      success: false,
      message: 'Authenticated tenant context is required.',
    });
  }

  // Never accept tenant identity from an arbitrary request header or body.
  req.tenantId = req.user.tenantId;

  /**
   * Run tenant-scoped SQL in a transaction.
   * SET LOCAL is automatically cleared when the transaction ends.
   */
  req.withTenantDb = async (callback) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        "SELECT set_config('app.tenant_id', $1, true)",
        [req.tenantId]
      );

      const result = await callback(client);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original error.
      }

      throw error;
    } finally {
      client.release();
    }
  };

  return next();
}

export default tenantContext;
