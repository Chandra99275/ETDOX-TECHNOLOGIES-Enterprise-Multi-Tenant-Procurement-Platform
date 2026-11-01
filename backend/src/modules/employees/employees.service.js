// backend/src/modules/employees/employees.service.js

import bcrypt from "bcryptjs";

import {
  listEmployees,
  getEmployeeById,
  findEmployeeByEmail,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "./employees.repository.js";

const WRITABLE_ROLES = new Set(["admin", "manager"]);

function getRole(user) {
  const role = user?.role ?? user?.roles?.[0]?.name ?? user?.roles?.[0];
  return String(role ?? "").toLowerCase();
}

function assertAuthenticated(user) {
  if (!user?.id) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }
}

function assertCanManageEmployees(user) {
  assertAuthenticated(user);

  if (!WRITABLE_ROLES.has(getRole(user))) {
    const error = new Error(
      "You do not have permission to manage employees.",
    );
    error.statusCode = 403;
    throw error;
  }
}

function getTenantId(user) {
  const tenantId = user?.tenantId ?? user?.tenant_id;

  if (!tenantId) {
    const error = new Error("Your account does not have a tenant ID.");
    error.statusCode = 403;
    throw error;
  }

  return tenantId;
}

function normalizeInput(body = {}) {
  const allowedFields = [
    "firstName",
    "lastName",
    "name",
    "email",
    "phone",
    "department",
    "jobTitle",
    "employeeCode",
    "status",
    "password",
  ];

  const input = {};

  for (const field of allowedFields) {
    if (body[field] === undefined) continue;

    input[field] =
      typeof body[field] === "string"
        ? body[field].trim()
        : body[field];
  }

  if (input.email) {
    input.email = input.email.toLowerCase();
  }

  if (!input.name && (input.firstName || input.lastName)) {
    input.name = [input.firstName, input.lastName]
      .filter(Boolean)
      .join(" ");
  }

  return input;
}

function validateEmployee(input, { partial = false } = {}) {
  if (!partial) {
    if (!input.email) {
      const error = new Error("Email is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!input.password) {
      const error = new Error("Password is required when creating an employee.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (
    input.email !== undefined &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
  ) {
    const error = new Error("Please provide a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  if (
    input.password !== undefined &&
    input.password.length < 8
  ) {
    const error = new Error("Password must contain at least 8 characters.");
    error.statusCode = 400;
    throw error;
  }

  for (const field of [
    "firstName",
    "lastName",
    "name",
    "department",
    "jobTitle",
    "employeeCode",
  ]) {
    if (
      input[field] !== undefined &&
      input[field].length > 150
    ) {
      const error = new Error(`${field} must be 150 characters or fewer.`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (
    input.status !== undefined &&
    !["active", "inactive", "suspended"].includes(input.status)
  ) {
    const error = new Error(
      "Status must be active, inactive, or suspended.",
    );
    error.statusCode = 400;
    throw error;
  }

  return input;
}

function splitPassword(input) {
  const { password, ...employeeFields } = input;
  return { password, employeeFields };
}

export async function listEmployeesService(user, query = {}) {
  assertAuthenticated(user);

  return listEmployees(getTenantId(user), {
    search: typeof query.search === "string" ? query.search.trim() : undefined,
    status: query.status,
    page: query.page,
    limit: query.limit,
  });
}

export async function getEmployeeService(user, employeeId) {
  assertAuthenticated(user);

  const employee = await getEmployeeById(getTenantId(user), employeeId);

  if (!employee) {
    const error = new Error("Employee not found.");
    error.statusCode = 404;
    throw error;
  }

  return employee;
}

export async function createEmployeeService(user, body = {}) {
  assertCanManageEmployees(user);

  const input = validateEmployee(normalizeInput(body));
  const tenantId = getTenantId(user);

  const existing = await findEmployeeByEmail(tenantId, input.email);

  if (existing) {
    const error = new Error(
      "An account with this email already exists in your organization.",
    );
    error.statusCode = 409;
    throw error;
  }

  const { password, employeeFields } = splitPassword(input);

  // Store only a password hash, never the plain-text password.
  const passwordHash = await bcrypt.hash(password, 12);

  return createEmployee(tenantId, {
    ...employeeFields,
    passwordHash,
    status: employeeFields.status ?? "active",
  });
}

export async function updateEmployeeService(
  user,
  employeeId,
  body = {},
) {
  assertCanManageEmployees(user);

  const input = validateEmployee(normalizeInput(body), {
    partial: true,
  });

  const tenantId = getTenantId(user);

  if (Object.keys(input).length === 0) {
    const error = new Error("Provide at least one field to update.");
    error.statusCode = 400;
    throw error;
  }

  if (input.email) {
    const existing = await findEmployeeByEmail(tenantId, input.email);

    if (existing && String(existing.id) !== String(employeeId)) {
      const error = new Error(
        "Another account already uses this email address.",
      );
      error.statusCode = 409;
      throw error;
    }
  }

  const { password, employeeFields } = splitPassword(input);

  const updateData = { ...employeeFields };

  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  const updated = await updateEmployee(
    tenantId,
    employeeId,
    updateData,
  );

  if (!updated) {
    const error = new Error("Employee not found.");
    error.statusCode = 404;
    throw error;
  }

  return updated;
}

export async function deleteEmployeeService(user, employeeId) {
  assertCanManageEmployees(user);

  // Prevent an administrator from accidentally deleting their own account.
  if (String(user.id) === String(employeeId)) {
    const error = new Error("You cannot delete your own account.");
    error.statusCode = 400;
    throw error;
  }

  const deleted = await deleteEmployee(getTenantId(user), employeeId);

  if (!deleted) {
    const error = new Error("Employee not found.");
    error.statusCode = 404;
    throw error;
  }

  return { message: "Employee deleted successfully." };
}