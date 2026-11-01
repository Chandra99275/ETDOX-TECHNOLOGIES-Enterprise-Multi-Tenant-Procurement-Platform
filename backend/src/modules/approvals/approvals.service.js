// backend/src/modules/approvals/approvals.service.js

import {
  listApprovals as repositoryListApprovals,
  findApprovalById,
  decideApproval as repositoryDecideApproval,
  getApprovalHistory,
} from "./approvals.repository.js";

function getRole(user) {
  const role = user?.role ?? user?.roleName ?? user?.role_name;

  if (typeof role === "string") {
    return role.toLowerCase();
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
  if (!user?.id && !user?.userId && !user?.user_id) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }

  if (!user?.tenantId && !user?.tenant_id) {
    const error = new Error("Tenant context is missing for this user.");
    error.statusCode = 403;
    throw error;
  }
}

function requireReviewer(user) {
  requireAuthenticatedUser(user);

  const role = getRole(user);

  if (!["admin", "manager"].includes(role)) {
    const error = new Error(
      "Only tenant admins and managers can approve or reject procurement requests.",
    );
    error.statusCode = 403;
    throw error;
  }
}

export async function listApprovals(user, filters) {
  requireAuthenticatedUser(user);

  const normalizedFilters = {
    status: filters.status || undefined,
    search: filters.search?.trim() || undefined,
    page: filters.page,
    limit: filters.limit,
  };

  return repositoryListApprovals(user, normalizedFilters);
}

export async function getApproval(user, requestId) {
  requireAuthenticatedUser(user);

  const request = await findApprovalById(user, requestId);

  if (!request) {
    const error = new Error("Procurement request not found.");
    error.statusCode = 404;
    throw error;
  }

  return request;
}

export async function approveRequest(user, requestId, comments = "") {
  requireReviewer(user);

  return repositoryDecideApproval(
    user,
    requestId,
    "approve",
    comments,
  );
}

export async function rejectRequest(user, requestId, comments = "") {
  requireReviewer(user);

  if (!comments.trim()) {
    const error = new Error("A rejection reason is required.");
    error.statusCode = 400;
    throw error;
  }

  return repositoryDecideApproval(
    user,
    requestId,
    "reject",
    comments,
  );
}

export async function getHistory(user, requestId) {
  requireAuthenticatedUser(user);

  return getApprovalHistory(user, requestId);
}