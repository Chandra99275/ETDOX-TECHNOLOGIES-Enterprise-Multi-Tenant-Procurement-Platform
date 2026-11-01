// backend/src/modules/budgets/budgets.service.js

import {
  listBudgets as repositoryListBudgets,
  findBudgetById,
  createBudget as repositoryCreateBudget,
  updateBudget as repositoryUpdateBudget,
} from "./budgets.repository.js";

function getRole(user) {
  if (typeof user?.role === "string") {
    return user.role.toLowerCase();
  }

  if (typeof user?.roleName === "string") {
    return user.roleName.toLowerCase();
  }

  if (typeof user?.role_name === "string") {
    return user.role_name.toLowerCase();
  }

  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    const firstRole = user.roles[0];

    return String(
      typeof firstRole === "string"
        ? firstRole
        : firstRole?.name ?? firstRole?.role ?? "",
    ).toLowerCase();
  }

  return "";
}

function requireAuthenticatedUser(user) {
  const userId = user?.id ?? user?.userId ?? user?.user_id;
  const tenantId = user?.tenantId ?? user?.tenant_id;

  if (!userId) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }

  if (!tenantId) {
    const error = new Error("Tenant context is missing.");
    error.statusCode = 403;
    throw error;
  }
}

function requireBudgetManager(user) {
  requireAuthenticatedUser(user);

  if (!["admin", "finance"].includes(getRole(user))) {
    const error = new Error(
      "Only admins and finance users can create or update budgets.",
    );
    error.statusCode = 403;
    throw error;
  }
}

function validateBudgetDates(input) {
  if (input.startDate && input.endDate) {
    if (new Date(input.startDate) > new Date(input.endDate)) {
      const error = new Error(
        "The budget start date must be on or before its end date.",
      );
      error.statusCode = 400;
      throw error;
    }
  }
}

export async function listBudgets(user, filters = {}) {
  requireAuthenticatedUser(user);

  return repositoryListBudgets(user, {
    status: filters.status,
    department: filters.department,
    fiscalYear: filters.fiscalYear,
    search: filters.search?.trim() || undefined,
    page: filters.page,
    limit: filters.limit,
  });
}

export async function getBudget(user, budgetId) {
  requireAuthenticatedUser(user);

  const budget = await findBudgetById(user, budgetId);

  if (!budget) {
    const error = new Error("Budget not found.");
    error.statusCode = 404;
    throw error;
  }

  return budget;
}

export async function createBudget(user, input) {
  requireBudgetManager(user);
  validateBudgetDates(input);

  return repositoryCreateBudget(user, input);
}

export async function updateBudget(user, budgetId, input) {
  requireBudgetManager(user);
  validateBudgetDates(input);

  return repositoryUpdateBudget(user, budgetId, input);
}