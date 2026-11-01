// backend/src/modules/invoices/invoices.controller.js

import * as invoicesService from "./invoices.service.js";

function sendError(res, error) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("[Invoices Controller]", error);
  }

  // Do not expose database internals to clients.
  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An internal error occurred while processing the invoice."
        : error.message,
  });
}

export async function listInvoices(req, res) {
  try {
    const result = await invoicesService.listInvoices(
      req.user,
      req.validatedQuery ?? req.query,
    );

    return res.status(200).json({
      success: true,
      message: "Invoices retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getInvoice(req, res) {
  try {
    const invoice = await invoicesService.getInvoice(
      req.user,
      req.params.id,
    );

    return res.status(200).json({
      success: true,
      message: "Invoice retrieved successfully.",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createInvoice(req, res) {
  try {
    const invoice = await invoicesService.createInvoice(
      req.user,
      req.validatedBody,
    );

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully.",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateInvoice(req, res) {
  try {
    const invoice = await invoicesService.updateInvoice(
      req.user,
      req.params.id,
      req.validatedBody,
    );

    return res.status(200).json({
      success: true,
      message: "Invoice updated successfully.",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
}