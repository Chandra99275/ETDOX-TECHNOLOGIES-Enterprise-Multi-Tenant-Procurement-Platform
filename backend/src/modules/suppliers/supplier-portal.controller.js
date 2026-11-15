
import {
  listSupplierRfqs,
  listSupplierPurchaseOrders,
  listSupplierDeliveries,
  listSupplierProducts,
  createSupplierProduct,
  updateSupplierProduct,
  deleteSupplierProduct,
} from "./supplier-portal.repository.js";

function handleControllerError(res, error, operation) {
  console.error(`[Supplier Portal] ${operation} failed:`, error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode
      ? error.message
      : "An unexpected supplier portal error occurred.",
  });
}

// --------------------------------------------------
// SUPPLIER RFQs
// --------------------------------------------------

// GET /api/v1/supplier/rfqs
export async function getSupplierRfqs(req, res) {
  try {
    const rfqs = await listSupplierRfqs(
      req.user,
      req.validatedQuery || {}
    );

    return res.status(200).json({
      success: true,
      rfqs,
      items: rfqs,
      message: "No RFQ records are currently available.",
    });
  } catch (error) {
    return handleControllerError(res, error, "List RFQs");
  }
}

// --------------------------------------------------
// SUPPLIER PURCHASE ORDERS
// --------------------------------------------------

// GET /api/v1/supplier/purchase-orders
export async function getSupplierPurchaseOrders(req, res) {
  try {
    const purchaseOrders = await listSupplierPurchaseOrders(
      req.user,
      req.validatedQuery || {}
    );

    return res.status(200).json({
      success: true,
      purchaseOrders,
      orders: purchaseOrders,
      items: purchaseOrders,
      pagination: {
        limit: req.validatedQuery?.limit ?? 100,
        offset: req.validatedQuery?.offset ?? 0,
        count: purchaseOrders.length,
      },
    });
  } catch (error) {
    return handleControllerError(res, error, "List purchase orders");
  }
}

// --------------------------------------------------
// SUPPLIER DELIVERIES
// --------------------------------------------------

// GET /api/v1/supplier/deliveries
export async function getSupplierDeliveries(req, res) {
  try {
    const deliveries = await listSupplierDeliveries(
      req.user,
      req.validatedQuery || {}
    );

    return res.status(200).json({
      success: true,
      deliveries,
      shipments: deliveries,
      items: deliveries,
      pagination: {
        limit: req.validatedQuery?.limit ?? 100,
        offset: req.validatedQuery?.offset ?? 0,
        count: deliveries.length,
      },
    });
  } catch (error) {
    return handleControllerError(res, error, "List deliveries");
  }
}

// --------------------------------------------------
// SUPPLIER PRODUCTS
// --------------------------------------------------

// GET /api/v1/supplier/products
export async function getSupplierProducts(req, res) {
  try {
    const products = await listSupplierProducts(
      req.user,
      req.validatedQuery || {}
    );

    return res.status(200).json({
      success: true,
      products,
      items: products,
      pagination: {
        limit: req.validatedQuery?.limit ?? 100,
        offset: req.validatedQuery?.offset ?? 0,
        count: products.length,
      },
    });
  } catch (error) {
    return handleControllerError(res, error, "List products");
  }
}

// POST /api/v1/supplier/products
export async function postSupplierProduct(req, res) {
  try {
    const product = await createSupplierProduct(
      req.user,
      req.body || {}
    );

    return res.status(201).json({
      success: true,
      product,
      message: "Product created successfully.",
    });
  } catch (error) {
    return handleControllerError(res, error, "Create product");
  }
}

// PUT /api/v1/supplier/products/:id
export async function putSupplierProduct(req, res) {
  try {
    const product = await updateSupplierProduct(
      req.user,
      req.params.id,
      req.body || {}
    );

    return res.status(200).json({
      success: true,
      product,
      message: "Product updated successfully.",
    });
  } catch (error) {
    return handleControllerError(res, error, "Update product");
  }
}

// DELETE /api/v1/supplier/products/:id
export async function removeSupplierProduct(req, res) {
  try {
    const result = await deleteSupplierProduct(
      req.user,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      ...result,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    return handleControllerError(res, error, "Delete product");
  }
}
