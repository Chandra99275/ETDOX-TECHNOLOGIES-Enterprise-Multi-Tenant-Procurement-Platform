import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { LoginInput, RegisterInput } from './auth.schema';
import { createTenantAdmin, findUserForLogin, recordLogin } from './auth.repository';

export interface AuthResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string | number;
  user: { id: string; tenantId: string; email: string; firstName: string | null; lastName: string | null };
}

function issueAccessToken(userId: string, tenantId: string): string {
  return jwt.sign({ tenantId }, env.jwtSecret, {
    subject: userId,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
    issuer: 'etdox-procurement-api',
    audience: 'etdox-api',
  });
}

export async function registerTenantAdmin(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  let user: { id: string; tenantId: string; email: string };
  try {
    user = await createTenantAdmin(input, passwordHash);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new AppError(409, 'ALREADY_EXISTS', 'An account with this email already exists for this organization');
    }
    throw error;
  }
  return {
    accessToken: issueAccessToken(user.id, user.tenantId),
    tokenType: 'Bearer',
    expiresIn: env.jwtExpiresIn,
    user: { ...user, firstName: input.firstName, lastName: input.lastName },
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await findUserForLogin(input.tenantId, input.email);
  const validPassword = user?.password_hash
    ? await bcrypt.compare(input.password, user.password_hash)
    : false;
  if (!user || !user.is_active || !validPassword) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  await recordLogin(user.tenant_id, user.id);
  return {
    accessToken: issueAccessToken(user.id, user.tenant_id),
    tokenType: 'Bearer',
    expiresIn: env.jwtExpiresIn,
    user: {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    },
  };
}
