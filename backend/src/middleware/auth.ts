import { RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { withTenantTransaction } from '../database/db';
import { AppError } from '../utils/errors';
import { Request } from 'express';

export interface RequestContext {
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
}

export function getRequestContext(req: Request): RequestContext {
  if (!req.context) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
  return req.context;
}

interface AccessToken extends JwtPayload {
  tenantId: string;
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const authorization = req.header('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    next(new AppError(401, 'UNAUTHENTICATED', 'A bearer access token is required'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      issuer: 'etdox-procurement-api',
      audience: 'etdox-api',
    });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      typeof (payload as AccessToken).tenantId !== 'string'
    ) {
      throw new AppError(401, 'INVALID_TOKEN', 'The access token is invalid');
    }

    const userId = payload.sub;
    const tenantId = (payload as AccessToken).tenantId;
    void withTenantTransaction(tenantId, async client => {
      const result = await client.query<{
        roles: string[];
        permissions: string[];
        email: string;
        first_name: string | null;
        last_name: string | null;
      }>(
        `SELECT u.email, u.first_name, u.last_name,
           COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles,
           COALESCE(array_agg(DISTINCT p.permission) FILTER (WHERE p.permission IS NOT NULL), ARRAY[]::text[]) AS permissions
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id AND r.tenant_id = u.tenant_id
         LEFT JOIN LATERAL unnest(r.permissions) AS p(permission) ON true
         JOIN tenants t ON t.id = u.tenant_id AND t.status = 'ACTIVE'
         WHERE u.id = $1 AND u.tenant_id = $2 AND u.is_active = true
         GROUP BY u.id`,
        [userId, tenantId],
      );
      if (!result.rowCount) throw new AppError(401, 'INVALID_TOKEN', 'The user is no longer active');
      req.context = {
        tenantId,
        userId,
        roles: result.rows[0].roles,
        permissions: result.rows[0].permissions,
        email: result.rows[0].email,
        firstName: result.rows[0].first_name,
        lastName: result.rows[0].last_name,
      };
    }).then(() => next()).catch(next);
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'INVALID_TOKEN', 'The access token is invalid or expired'));
  }
};
