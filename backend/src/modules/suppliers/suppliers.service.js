// backend/src/modules/suppliers/suppliers.service.js

import {
  listSuppliers as repositoryListSuppliers,
  findSupplierById,
  createSupplier as repositoryCreateSupplier,
  updateSupplier as repositoryUpdateSupplier,
} from "./suppliers.repository.js";

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
    const role = user.roles[0];

    return String(
      typeof role === "string"
        ? role
        : role?.name ?? role?.role ?? "",
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

function requireSupplierManager(user) {
  requireAuthenticatedUser(user);

  if (!["admin", "finance"].includes(getRole(user))) {
    const error = new Error(
      "Only admins and finance users can register or update suppliers.",
    );
    error.statusCode = 403;
    throw error;
  }
}

export async function listSuppliers(user, filters = {}) {
  requireAuthenticatedUser(user);

  return repositoryListSuppliers(user, {
    search: filters.search?.trim() || undefined,
    status: filters.status,
    category: filters.category?.trim() || undefined,
    page: filters.page,
    limit: filters.limit,
  });
}

export async function getSupplier(user, supplierId) {
  requireAuthenticatedUser(user);

  const supplier = await findSupplierById(user, supplierId);

  if (!supplier) {
    const error = new Error("Supplier not found.");
    error.statusCode = 404;
    throw error;
  }

  return supplier;
}

export async function createSupplier(user, input) {
  requireSupplierManager(user);

  return repositoryCreateSupplier(user, {
    ...input,
    name: input.name.trim(),
    email: input.email?.trim().toLowerCase(),
  });
}

export async function updateSupplier(user, supplierId, input) {
  requireSupplierManager(user);

  if (input.name !== undefined) {
    input = {
      ...input,
      name: input.name.trim(),
    };
  }

  if (input.email !== undefined) {
    input = {
      ...input,
      email: input.email.trim().toLowerCase(),
    };
  }

  return repositoryUpdateSupplier(user, supplierId, input);
}