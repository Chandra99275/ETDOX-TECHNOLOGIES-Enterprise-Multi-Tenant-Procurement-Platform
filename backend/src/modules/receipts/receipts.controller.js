// backend/src/modules/receipts/receipts.controller.js

import {
  listGoodsReceipts,
  getGoodsReceipt,
  createGoodsReceipt,
  updateGoodsReceipt,
  removeGoodsReceipt,
} from "./receipts.service.js";

function handleError(res, error) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;

  if (statusCode >= 500) {
    console.error("[Goods Receipts]", error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An error occurred while processing the goods receipt."
        : error.message,
  });
}

export async function listReceiptsController(req, res) {
  try {
    const result = await listGoodsReceipts(req.user, req.query);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getReceiptController(req, res) {
  try {
    const receipt = await getGoodsReceipt(req.user, req.params.id);

    return res.status(200).json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function createReceiptController(req, res) {
  try {
    const receipt = await createGoodsReceipt(req.user, req.body);

    return res.status(201).json({
      success: true,
      message: "Goods receipt recorded successfully.",
      data: receipt,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateReceiptController(req, res) {
  try {
    const receipt = await updateGoodsReceipt(
      req.user,
      req.params.id,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Goods receipt updated successfully.",
      data: receipt,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function deleteReceiptController(req, res) {
  try {
    const result = await removeGoodsReceipt(req.user, req.params.id);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}