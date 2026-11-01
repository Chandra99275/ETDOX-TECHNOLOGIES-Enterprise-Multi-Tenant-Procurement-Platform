import bcrypt from "bcryptjs";

import {
  listUsers as listUsersRepository,
  findUserById as findUserByIdRepository,
  createUser as createUserRepository,
  updateUser as updateUserRepository,
  deactivateUser as deactivateUserRepository,
} from "./users.repository.js";

const ALLOWED_ROLES = new Set([
  "admin",
  "employee",
  "manager",
  "finance",
]);

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireTenantId(actor) {
  if (!actor?.tenantId) {
    throw httpError(
      "The authenticated user does not have a tenant assigned",
      401
    );
  }

  return actor.tenantId;
}

function requireAdmin(actor) {
  if (String(actor?.role ?? "").toLowerCase() !== "admin") {
    throw httpError(
      "Only administrators can perform this operation",
      403
    );
  }
}

export async function listUsers(actor, query) {
  const tenantId = requireTenantId(actor);

  return listUsersRepository(tenantId, query);
}

export async function getUser(actor, userId) {
  const tenantId = requireTenantId(actor);

  const user = await findUserByIdRepository(tenantId, userId);

  if (!user) {
    throw httpError("User not found", 404);
  }

  return user;
}

export async function createUser(actor, input) {
  requireAdmin(actor);

  const tenantId = requireTenantId(actor);

  if (!ALLOWED_ROLES.has(input.role)) {
    throw httpError("Invalid user role", 400);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  return createUserRepository(tenantId, {
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    isActive: input.isActive,
  });
}

export async function updateUser(actor, userId, input) {
  requireAdmin(actor);

  const tenantId = requireTenantId(actor);

  if (input.role && !ALLOWED_ROLES.has(input.role)) {
    throw httpError("Invalid user role", 400);
  }

  // The API intentionally does not allow administrators to change
  // their own role through this endpoint.
  if (
    input.role &&
    String(actor.id) === String(userId) &&
    input.role !== String(actor.role).toLowerCase()
  ) {
    throw httpError(
      "You cannot change your own role through this endpoint",
      403
    );
  }

  return updateUserRepository(tenantId, userId, input);
}

export async function deactivateUser(actor, userId) {
  requireAdmin(actor);

  const tenantId = requireTenantId(actor);

  if (String(actor.id) === String(userId)) {
    throw httpError(
      "You cannot deactivate your own account",
      403
    );
  }

  return deactivateUserRepository(tenantId, userId);
}