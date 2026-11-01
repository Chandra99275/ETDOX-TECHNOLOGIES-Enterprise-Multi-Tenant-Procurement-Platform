// backend/src/modules/suppliers/suppliers.controller.js

import * as suppliersService from "./suppliers.service.js";

function sendError(res, error) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("[Suppliers Controller]", error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An internal error occurred while processing the supplier request."
        : error.message,
  });
}

export async function listSuppliers(req, res) {
  try {
    const result = await suppliersService.listSuppliers(
      req.user,
      req.validatedQuery ?? req.query,
    );

    return res.status(200).json({
      success: true,
      message: "Suppliers retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getSupplier(req, res) {
  try {
    const supplier = await suppliersService.getSupplier(
      req.user,
      req.params.id,
    );

    return res.status(200).json({
      success: true,
      message: "Supplier retrieved successfully.",
      data: supplier,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createSupplier(req, res) {
  try {
    const supplier = await suppliersService.createSupplier(
      req.user,
      req.validatedBody,
    );

    return res.status(201).json({
      success: true,
      message: "Supplier registered successfully.",
      data: supplier,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateSupplier(req, res) {
  try {
    const supplier = await suppliersService.updateSupplier(
      req.user,
      req.params.id,
      req.validatedBody,
    );

    return res.status(200).json({
      success: true,
      message: "Supplier updated successfully.",
      data: supplier,
    });
  } catch (error) {
    return sendError(res, error);
  }
}