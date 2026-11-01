// backend/src/modules/budgets/budgets.controller.js

import * as budgetsService from "./budgets.service.js";

function sendError(res, error) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("[Budgets Controller]", error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An internal error occurred while processing the budget request."
        : error.message,
  });
}

export async function listBudgets(req, res) {
  try {
    const result = await budgetsService.listBudgets(
      req.user,
      req.validatedQuery ?? req.query,
    );

    return res.status(200).json({
      success: true,
      message: "Budgets retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getBudget(req, res) {
  try {
    const budget = await budgetsService.getBudget(
      req.user,
      req.params.id,
    );

    return res.status(200).json({
      success: true,
      message: "Budget retrieved successfully.",
      data: budget,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createBudget(req, res) {
  try {
    const budget = await budgetsService.createBudget(
      req.user,
      req.validatedBody,
    );

    return res.status(201).json({
      success: true,
      message: "Budget created successfully.",
      data: budget,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateBudget(req, res) {
  try {
    const budget = await budgetsService.updateBudget(
      req.user,
      req.params.id,
      req.validatedBody,
    );

    return res.status(200).json({
      success: true,
      message: "Budget updated successfully.",
      data: budget,
    });
  } catch (error) {
    return sendError(res, error);
  }
}