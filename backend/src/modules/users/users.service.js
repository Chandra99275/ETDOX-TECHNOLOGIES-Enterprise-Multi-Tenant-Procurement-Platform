import bcrypt from 'bcryptjs';
import * as usersRepository from './users.repository.js';

function appError(statusCode, message, code) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

function requireTenant(tenantId) {
  if (!tenantId) {
    throw appError(
      403,
      'A valid tenant context is required.',
      'TENANT_CONTEXT_REQUIRED'
    );
  }
}

function validateUserId(userId) {
  if (
    typeof userId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
  ) {
    throw appError(400, 'Invalid user ID.', 'INVALID_USER_ID');
  }
}

function cleanName(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw appError(400, `${field} is required.`, 'VALIDATION_ERROR');
  }

  if (value.trim().length > 100) {
    throw appError(
      400,
      `${field} must be 100 characters or fewer.`,
      'VALIDATION_ERROR'
    );
  }

  return value.trim();
}

function cleanEmail(value) {
  if (typeof value !== 'string') {
    throw appError(400, 'A valid email is required.', 'VALIDATION_ERROR');
  }

  const email = value.trim().toLowerCase();

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw appError(400, 'A valid email is required.', 'VALIDATION_ERROR');
  }

  return email;
}

function validatePassword(password) {
  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 72
  ) {
    throw appError(
      400,
      'Password must be between 12 and 72 characters.',
      'VALIDATION_ERROR'
    );
  }
}

export async function listUsers({
  tenantId,
  page = 1,
  limit = 20,
  search = '',
}) {
  requireTenant(tenantId);

  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  if (
    !Number.isInteger(parsedPage) ||
    parsedPage < 1 ||
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > 100
  ) {
    throw appError(
      400,
      'Page must be positive and limit must be between 1 and 100.',
      'INVALID_PAGINATION'
    );
  }

  if (typeof search !== 'string') {
    throw appError(400, 'Invalid search value.', 'VALIDATION_ERROR');
  }

  const result = await usersRepository.listByTenant({
    tenantId,
    page: parsedPage,
    limit: parsedLimit,
    search: search.trim().slice(0, 100),
  });

  return {
    users: result.users,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total: result.total,
      totalPages: Math.ceil(result.total / parsedLimit),
    },
  };
}

export async function getUser({ tenantId, userId }) {
  requireTenant(tenantId);
  validateUserId(userId);

  const user = await usersRepository.findById(tenantId, userId);

  if (!user) {
    throw appError(404, 'User not found.', 'USER_NOT_FOUND');
  }

  return user;
}

export async function createUser({ tenantId, input = {} }) {
  requireTenant(tenantId);

  const firstName = cleanName(input.firstName, 'First name');
  const lastName = cleanName(input.lastName, 'Last name');
  const email = cleanEmail(input.email);

  validatePassword(input.password);

  const existingUser = await usersRepository.findByEmail(
    tenantId,
    email
  );

  if (existingUser) {
    throw appError(
      409,
      'A user with this email already exists in this tenant.',
      'EMAIL_ALREADY_EXISTS'
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    return await usersRepository.create({
      tenantId,
      firstName,
      lastName,
      email,
      passwordHash,
    });
  } catch (error) {
    // Also handles a concurrent request that creates the same email.
    if (error.code === '23505') {
      throw appError(
        409,
        'A user with this email already exists.',
        'EMAIL_ALREADY_EXISTS'
      );
    }

    throw error;
  }
}

export async function updateUser({ tenantId, userId, input = {} }) {
  requireTenant(tenantId);
  validateUserId(userId);

  const updates = {};

  if (input.firstName !== undefined) {
    updates.firstName = cleanName(input.firstName, 'First name');
  }

  if (input.lastName !== undefined) {
    updates.lastName = cleanName(input.lastName, 'Last name');
  }

  if (input.email !== undefined) {
    updates.email = cleanEmail(input.email);
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') {
      throw appError(
        400,
        'isActive must be true or false.',
        'VALIDATION_ERROR'
      );
    }

    updates.isActive = input.isActive;
  }

  if (input.password !== undefined) {
    validatePassword(input.password);
    updates.passwordHash = await bcrypt.hash(input.password, 12);
  }

  if (Object.keys(updates).length === 0) {
    throw appError(
      400,
      'Provide at least one supported field to update.',
      'NO_UPDATE_FIELDS'
    );
  }

  try {
    const user = await usersRepository.update(
      tenantId,
      userId,
      updates
    );

    if (!user) {
      throw appError(404, 'User not found.', 'USER_NOT_FOUND');
    }

    return user;
  } catch (error) {
    if (error.code === '23505') {
      throw appError(
        409,
        'A user with this email already exists.',
        'EMAIL_ALREADY_EXISTS'
      );
    }

    throw error;
  }
}

export async function deactivateUser({ tenantId, userId }) {
  requireTenant(tenantId);
  validateUserId(userId);

  const user = await usersRepository.deactivate(tenantId, userId);

  if (!user) {
    throw appError(404, 'User not found.', 'USER_NOT_FOUND');
  }

  return user;
}