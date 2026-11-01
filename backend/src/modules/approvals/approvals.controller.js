// backend/src/modules/approvals/approvals.controller.js

import * as approvalsService from "./approvals.service.js";

function getRequestId(req) {
  return req.params.id;
}

function getComments(req) {
  return String(req.body?.comments ?? "").trim();
}

function sendError(res, error) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("[Approvals Controller]", error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An internal error occurred while processing the approval."
        : error.message,
  });
}

export async function listApprovals(req, res) {
  try {
    const result = await approvalsService.listApprovals(
      req.user,
      req.validatedQuery ?? req.query,
    );

    return res.status(200).json({
      success: true,
      message: "Approval requests retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getApproval(req, res) {
  try {
    const result = await approvalsService.getApproval(
      req.user,
      getRequestId(req),
    );

    return res.status(200).json({
      success: true,
      message: "Approval request retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function approveRequest(req, res) {
  try {
    const result = await approvalsService.approveRequest(
      req.user,
      getRequestId(req),
      getComments(req),
    );

    return res.status(200).json({
      success: true,
      message: "Procurement request approved successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function rejectRequest(req, res) {
  try {
    const result = await approvalsService.rejectRequest(
      req.user,
      getRequestId(req),
      getComments(req),
    );

    return res.status(200).json({
      success: true,
      message: "Procurement request rejected successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getApprovalHistory(req, res) {
  try {
    const result = await approvalsService.getHistory(
      req.user,
      getRequestId(req),
    );

    return res.status(200).json({
      success: true,
      message: "Approval history retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}