// backend/src/modules/invoices/invoices.service.js

import {
  listInvoices as repositoryListInvoices,
  findInvoiceById,
  createInvoice as repositoryCreateInvoice,
  updateInvoice as repositoryUpdateInvoice,
} from "./invoices.repository.js";

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

  if (Array.isArray(user?.roles) && user.roles.length) {
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

function requireInvoiceManager(user) {
  requireAuthenticatedUser(user);

  if (!["admin", "finance"].includes(getRole(user))) {
    const error = new Error(
      "Only admins and finance users can create or update invoices.",
    );
    error.statusCode = 403;
    throw error;
  }
}

function validateInvoiceDates(input) {
  if (
    input.issueDate &&
    input.dueDate &&
    input.dueDate < input.issueDate
  ) {
    const error = new Error(
      "The invoice due date cannot be earlier than the issue date.",
    );
    error.statusCode = 400;
    throw error;
  }
}

export async function listInvoices(user, filters = {}) {
  requireAuthenticatedUser(user);

  return repositoryListInvoices(user, {
    search: filters.search?.trim() || undefined,
    status: filters.status,
    supplierName: filters.supplierName?.trim() || undefined,
    page: filters.page,
    limit: filters.limit,
  });
}

export async function getInvoice(user, invoiceId) {
  requireAuthenticatedUser(user);

  const invoice = await findInvoiceById(user, invoiceId);

  if (!invoice) {
    const error = new Error("Invoice not found.");
    error.statusCode = 404;
    throw error;
  }

  return invoice;
}

export async function createInvoice(user, input) {
  requireInvoiceManager(user);
  validateInvoiceDates(input);

  return repositoryCreateInvoice(user, input);
}

export async function updateInvoice(user, invoiceId, input) {
  requireInvoiceManager(user);
  validateInvoiceDates(input);

  return repositoryUpdateInvoice(user, invoiceId, input);
}