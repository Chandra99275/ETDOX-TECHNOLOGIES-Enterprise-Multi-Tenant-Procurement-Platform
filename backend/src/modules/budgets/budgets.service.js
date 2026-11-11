
import {
  listBudgets as repositoryListBudgets,
  findBudgetById,
  createBudget as repositoryCreateBudget,
  updateBudget as repositoryUpdateBudget,
} from "./budgets.repository.js";

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getRole(user) {
  const roles = [
    user?.role,
    user?.roleName,
    user?.role_name,
    ...(Array.isArray(user?.roles)
      ? user.roles.map((role) =>
          typeof role === "string"
            ? role
            : role?.name ?? role?.role,
        )
      : []),
  ];

  return roles
    .filter(Boolean)
    .map((role) => String(role).toLowerCase());
}

function requireAuthenticatedUser(user) {
  const userId = user?.id ?? user?.userId ?? user?.user_id;
  const tenantId = user?.tenantId ?? user?.tenant_id;

  if (!userId) {
    throw httpError("Authentication is required.", 401);
  }

  if (!tenantId) {
    throw httpError("Tenant context is missing.", 403);
  }
}

function requireBudgetManager(user) {
  requireAuthenticatedUser(user);

  const roles = getRole(user);

  const allowed = roles.some((role) =>
    ["admin", "finance"].includes(role),
  );

  if (!allowed) {
    throw httpError(
      "Only admins and finance users can create or update budgets.",
      403,
    );
  }
}

function validateFiscalYear(value) {
  const fiscalYear = Number(value);

  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
    throw httpError(
      "Fiscal year must be a valid integer between 2000 and 2100.",
    );
  }

  return fiscalYear;
}

function validateBudgetAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw httpError(
      "Allocated amount must be a positive number.",
    );
  }

  return amount;
}

function validateCurrency(value) {
  const currency = String(value ?? "INR").trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw httpError("Currency must be a valid three-letter code.");
  }

  return currency;
}

function validateBudgetInput(input, { partial = false } = {}) {
  const result = { ...input };

  if (!partial || input.fiscalYear !== undefined) {
    result.fiscalYear = validateFiscalYear(input.fiscalYear);
  }

  if (!partial || input.allocatedAmount !== undefined) {
    result.allocatedAmount = validateBudgetAmount(input.allocatedAmount);
  }

  if (!partial || input.currency !== undefined) {
    result.currency = validateCurrency(input.currency);
  }

  if (input.startDate && input.endDate) {
    if (new Date(input.startDate) > new Date(input.endDate)) {
      throw httpError(
        "Budget start date must be before or equal to end date.",
      );
    }
  }

  return result;
}

function validateDepartmentIds(input) {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  for (const field of ["departmentId", "department_id", "costCenterId", "cost_center_id"]) {
    const value = input[field];

    if (value !== undefined && value !== null && value !== "") {
      if (!uuidPattern.test(String(value))) {
        throw httpError(
          `${field} must contain a valid UUID, not a department or cost center name.`,
        );
      }
    }
  }
}

export async function listBudgets(user, filters = {}) {
  requireAuthenticatedUser(user);

  return repositoryListBudgets(user, {
    department: filters.department,
    fiscalYear: filters.fiscalYear,
    search: filters.search,
    page: filters.page,
    limit: filters.limit,
  });
}

export async function getBudget(user, budgetId) {
  requireAuthenticatedUser(user);

  const budget = await findBudgetById(user, budgetId);

  if (!budget) {
    throw httpError("Budget not found.", 404);
  }

  return budget;
}

export async function createBudget(user, input) {
  requireBudgetManager(user);

  const validated = validateBudgetInput(input);
  validateDepartmentIds(validated);

  return repositoryCreateBudget(user, validated);
}

export async function updateBudget(user, budgetId, input) {
  requireBudgetManager(user);

  const validated = validateBudgetInput(input, {
    partial: true,
  });

  validateDepartmentIds(validated);

  return repositoryUpdateBudget(user, budgetId, validated);
}
