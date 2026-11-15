
import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";

import {
  getSupplierRfqs,
  getSupplierPurchaseOrders,
  getSupplierDeliveries,
  getSupplierProducts,
  postSupplierProduct,
  putSupplierProduct,
  removeSupplierProduct,
} from "./supplier-portal.controller.js";

const router = Router();

// --------------------------------------------------
// VALIDATION SCHEMAS
// --------------------------------------------------

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "OUT_OF_STOCK"]).optional(),
});

const productSchema = z.object({
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  description: z.string().nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
  unitOfMeasure: z.string().trim().min(1).max(40).optional(),
  unit_of_measure: z.string().trim().min(1).max(40).optional(),
  unitPrice: z.coerce.number().finite().min(0).optional(),
  unit_price: z.coerce.number().finite().min(0).optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  stockQuantity: z.coerce.number().finite().min(0).optional(),
  stock_quantity: z.coerce.number().finite().min(0).optional(),
  minimumOrderQuantity: z.coerce.number().finite().positive().optional(),
  minimum_order_quantity: z.coerce.number().finite().positive().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "OUT_OF_STOCK"]).optional(),
  imageUrl: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
}).passthrough();

const updateProductSchema = productSchema.partial();

const uuidSchema = z.string().uuid();

// --------------------------------------------------
// VALIDATION MIDDLEWARE
// --------------------------------------------------

function validatePagination(req, res, next) {
  const result = paginationSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid pagination parameters.",
      errors: result.error.flatten(),
    });
  }

  req.validatedQuery = result.data;
  next();
}

function validateProduct(req, res, next) {
  const result = productSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid product details.",
      errors: result.error.flatten(),
    });
  }

  req.body = result.data;
  next();
}

function validateProductUpdate(req, res, next) {
  const idResult = uuidSchema.safeParse(req.params.id);

  if (!idResult.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID.",
    });
  }

  const result = updateProductSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid product update details.",
      errors: result.error.flatten(),
    });
  }

  if (Object.keys(result.data).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one field to update.",
    });
  }

  req.body = result.data;
  next();
}

function validateProductId(req, res, next) {
  const result = uuidSchema.safeParse(req.params.id);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID.",
    });
  }

  next();
}

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

router.use(authenticate);

// --------------------------------------------------
// EXISTING SUPPLIER ROUTES
// --------------------------------------------------

router.get(
  "/purchase-orders",
  validatePagination,
  getSupplierPurchaseOrders
);

router.get(
  "/rfqs",
  validatePagination,
  getSupplierRfqs
);

router.get(
  "/deliveries",
  validatePagination,
  getSupplierDeliveries
);

// --------------------------------------------------
// SUPPLIER PRODUCT ROUTES
// --------------------------------------------------

// List products
router.get(
  "/products",
  validatePagination,
  getSupplierProducts
);

// Create product
router.post(
  "/products",
  validateProduct,
  postSupplierProduct
);

// Update product
router.put(
  "/products/:id",
  validateProductUpdate,
  putSupplierProduct
);

// Delete product
router.delete(
  "/products/:id",
  validateProductId,
  removeSupplierProduct
);

export default router;
