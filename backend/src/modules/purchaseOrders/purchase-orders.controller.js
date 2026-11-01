// backend/src/modules/purchase-orders/purchase-orders.controller.js

import {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  removeOrder,
} from "./purchase-orders.service.js";

function sendError(res, error) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;

  if (statusCode >= 500) {
    console.error("[Purchase Orders]", error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An error occurred while processing the purchase order."
        : error.message,
  });
}

export async function listPurchaseOrdersController(req, res) {
  try {
    const result = await listOrders(req.user, req.query);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getPurchaseOrderController(req, res) {
  try {
    const order = await getOrder(req.user, req.params.id);

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createPurchaseOrderController(req, res) {
  try {
    const order = await createOrder(req.user, req.body);

    return res.status(201).json({
      success: true,
      message: "Purchase order created successfully.",
      data: order,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updatePurchaseOrderController(req, res) {
  try {
    const order = await updateOrder(req.user, req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Purchase order updated successfully.",
      data: order,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function deletePurchaseOrderController(req, res) {
  try {
    const result = await removeOrder(req.user, req.params.id);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}