
import { withTenantTransaction } from "../../config/database.js";

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getIdentity(user) {
  const tenantId = user?.tenantId ?? user?.tenant_id;
  const userId = user?.id ?? user?.userId ?? user?.user_id;

  if (!tenantId || !userId) {
    throw httpError("Authenticated user and tenant are required.", 401);
  }

  return { tenantId, userId };
}

// Resolve supplier through explicit user-to-supplier mapping.
// Never infer supplier ownership using email or supplier name.
async function resolveSupplier(client, user) {
  const { tenantId, userId } = getIdentity(user);

  const result = await client.query(
    `SELECT
        s.id,
        s.tenant_id,
        s.legal_name,
        s.trading_name,
        s.supplier_code,
        s.contact_email,
        s.contact_name,
        s.contact_phone,
        s.status,
        s.onboarding_status,
        s.currency,
        s.payment_terms,
        s.address
     FROM public.supplier_user_accounts sua
     INNER JOIN public.suppliers s
       ON s.id = sua.supplier_id
      AND s.tenant_id = sua.tenant_id
     WHERE sua.tenant_id = $1
       AND sua.user_id = $2
       AND sua.is_active = TRUE
     LIMIT 1`,
    [tenantId, userId]
  );

  if (!result.rows.length) {
    throw httpError(
      "No active supplier account is linked to this login. Contact your procurement administrator.",
      403
    );
  }

  return result.rows[0];
}

function mapSupplierProduct(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    supplierId: row.supplier_id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    brand: row.brand,
    unitOfMeasure: row.unit_of_measure,
    unitPrice: Number(row.unit_price || 0),
    currency: row.currency,
    stockQuantity: Number(row.stock_quantity || 0),
    minimumOrderQuantity: Number(row.minimum_order_quantity || 1),
    status: row.status,
    imageUrl: row.image_url,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function getInputValue(input, camelKey, snakeKey) {
  if (hasOwn(input, camelKey)) return input[camelKey];
  if (snakeKey && hasOwn(input, snakeKey)) return input[snakeKey];
  return undefined;
}

function normalizeProductInput(input = {}, { partial = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw httpError("Invalid product data.", 400);
  }

  const fields = {};

  const definitions = [
    ["sku", "sku", "sku"],
    ["name", "name", "name"],
    ["description", "description", "description"],
    ["category", "category", "category"],
    ["brand", "brand", "brand"],
    ["unitOfMeasure", "unitOfMeasure", "unit_of_measure"],
    ["unitPrice", "unitPrice", "unit_price"],
    ["currency", "currency", "currency"],
    ["stockQuantity", "stockQuantity", "stock_quantity"],
    ["minimumOrderQuantity", "minimumOrderQuantity", "minimum_order_quantity"],
    ["status", "status", "status"],
    ["imageUrl", "imageUrl", "image_url"],
  ];

  for (const [property, camelKey, snakeKey] of definitions) {
    const value = getInputValue(input, camelKey, snakeKey);

    if (value !== undefined) {
      fields[property] = value;
    }
  }

  if (!partial && (!fields.sku || !fields.name)) {
    throw httpError("Product SKU and name are required.", 400);
  }

  if (partial && Object.keys(fields).length === 0) {
    throw httpError("Provide at least one product field to update.", 400);
  }

  if (fields.sku !== undefined) {
    fields.sku = String(fields.sku).trim();

    if (!fields.sku || fields.sku.length > 100) {
      throw httpError("SKU is required and must not exceed 100 characters.", 400);
    }
  }

  if (fields.name !== undefined) {
    fields.name = String(fields.name).trim();

    if (!fields.name || fields.name.length > 200) {
      throw httpError("Product name is required and must not exceed 200 characters.", 400);
    }
  }

  for (const property of ["description", "category", "brand", "imageUrl"]) {
    if (fields[property] !== undefined) {
      fields[property] =
        fields[property] === null || String(fields[property]).trim() === ""
          ? null
          : String(fields[property]).trim();
    }
  }

  if (fields.unitOfMeasure !== undefined) {
    fields.unitOfMeasure = String(fields.unitOfMeasure).trim();

    if (!fields.unitOfMeasure || fields.unitOfMeasure.length > 40) {
      throw httpError("Unit of measure is required and must not exceed 40 characters.", 400);
    }
  }

  if (fields.unitPrice !== undefined) {
    fields.unitPrice = Number(fields.unitPrice);

    if (!Number.isFinite(fields.unitPrice) || fields.unitPrice < 0) {
      throw httpError("Unit price must be a valid non-negative number.", 400);
    }
  }

  if (fields.stockQuantity !== undefined) {
    fields.stockQuantity = Number(fields.stockQuantity);

    if (!Number.isFinite(fields.stockQuantity) || fields.stockQuantity < 0) {
      throw httpError("Stock quantity must be a valid non-negative number.", 400);
    }
  }

  if (fields.minimumOrderQuantity !== undefined) {
    fields.minimumOrderQuantity = Number(fields.minimumOrderQuantity);

    if (
      !Number.isFinite(fields.minimumOrderQuantity) ||
      fields.minimumOrderQuantity <= 0
    ) {
      throw httpError("Minimum order quantity must be greater than zero.", 400);
    }
  }

  if (fields.currency !== undefined) {
    fields.currency = String(fields.currency).trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(fields.currency)) {
      throw httpError("Currency must be a valid three-letter currency code.", 400);
    }
  }

  if (fields.status !== undefined) {
    fields.status = String(fields.status).trim().toUpperCase();

    if (!["ACTIVE", "INACTIVE", "OUT_OF_STOCK"].includes(fields.status)) {
      throw httpError("Invalid product status.", 400);
    }
  }

  return fields;
}

// --------------------------------------------------
// SUPPLIER PROFILE
// --------------------------------------------------

export async function getSupplierProfile(user) {
  const { tenantId } = getIdentity(user);

  return withTenantTransaction(tenantId, async (client) => {
    const supplier = await resolveSupplier(client, user);

    return {
      id: supplier.id,
      name: supplier.trading_name || supplier.legal_name,
      legalName: supplier.legal_name,
      supplierCode: supplier.supplier_code,
      email: supplier.contact_email,
      contactName: supplier.contact_name,
      phone: supplier.contact_phone,
      status: supplier.status,
      onboardingStatus: supplier.onboarding_status,
      currency: supplier.currency,
      paymentTerms: supplier.payment_terms,
      address: supplier.address,
    };
  });
}

// --------------------------------------------------
// SUPPLIER PRODUCTS
// --------------------------------------------------

export async function listSupplierProducts(
  user,
  { limit = 100, offset = 0, search = "", status } = {}
) {
  const { tenantId } = getIdentity(user);

  return withTenantTransaction(tenantId, async (client) => {
    const supplier = await resolveSupplier(client, user);

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
    const safeOffset = Math.max(
      Number.isInteger(Number(offset)) ? Number(offset) : 0,
      0
    );

    const values = [tenantId, supplier.id];
    let filterSql = "";

    if (search && String(search).trim()) {
      values.push(`%${String(search).trim()}%`);
      filterSql += ` AND (
        p.sku ILIKE $${values.length}
        OR p.name ILIKE $${values.length}
        OR COALESCE(p.category, '') ILIKE $${values.length}
        OR COALESCE(p.brand, '') ILIKE $${values.length}
      )`;
    }

    if (status) {
      const normalizedStatus = String(status).trim().toUpperCase();

      if (!["ACTIVE", "INACTIVE", "OUT_OF_STOCK"].includes(normalizedStatus)) {
        throw httpError("Invalid product status filter.", 400);
      }

      values.push(normalizedStatus);
      filterSql += ` AND p.status = $${values.length}`;
    }

    values.push(safeLimit, safeOffset);

    const result = await client.query(
      `SELECT
          p.id,
          p.tenant_id,
          p.supplier_id,
          p.sku,
          p.name,
          p.description,
          p.category,
          p.brand,
          p.unit_of_measure,
          p.unit_price,
          p.currency,
          p.stock_quantity,
          p.minimum_order_quantity,
          p.status,
          p.image_url,
          p.metadata,
          p.created_at,
          p.updated_at
       FROM public.supplier_products p
       WHERE p.tenant_id = $1
         AND p.supplier_id = $2
         ${filterSql}
       ORDER BY p.created_at DESC
       LIMIT $${values.length - 1}
       OFFSET $${values.length}`,
      values
    );

    return result.rows.map(mapSupplierProduct);
  });
}

export async function createSupplierProduct(user, input) {
  const { tenantId } = getIdentity(user);
  const fields = normalizeProductInput(input);

  return withTenantTransaction(tenantId, async (client) => {
    const supplier = await resolveSupplier(client, user);

    const result = await client.query(
      `INSERT INTO public.supplier_products (
          tenant_id,
          supplier_id,
          sku,
          name,
          description,
          category,
          brand,
          unit_of_measure,
          unit_price,
          currency,
          stock_quantity,
          minimum_order_quantity,
          status,
          image_url
       )
       VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
       )
       RETURNING *`,
      [
        tenantId,
        supplier.id,
        fields.sku,
        fields.name,
        fields.description ?? null,
        fields.category ?? null,
        fields.brand ?? null,
        fields.unitOfMeasure ?? "unit",
        fields.unitPrice ?? 0,
        fields.currency ?? supplier.currency ?? "INR",
        fields.stockQuantity ?? 0,
        fields.minimumOrderQuantity ?? 1,
        fields.status ?? "ACTIVE",
        fields.imageUrl ?? null,
      ]
    );

    return mapSupplierProduct(result.rows[0]);
  });
}

export async function updateSupplierProduct(user, productId, input) {
  const { tenantId } = getIdentity(user);
  const fields = normalizeProductInput(input, { partial: true });

  return withTenantTransaction(tenantId, async (client) => {
    const supplier = await resolveSupplier(client, user);

    const columnMap = {
      sku: "sku",
      name: "name",
      description: "description",
      category: "category",
      brand: "brand",
      unitOfMeasure: "unit_of_measure",
      unitPrice: "unit_price",
      currency: "currency",
      stockQuantity: "stock_quantity",
      minimumOrderQuantity: "minimum_order_quantity",
      status: "status",
      imageUrl: "image_url",
    };

    const values = [];
    const assignments = [];

    for (const [property, column] of Object.entries(columnMap)) {
      if (fields[property] !== undefined) {
        values.push(fields[property]);
        assignments.push(`${column} = $${values.length}`);
      }
    }

    assignments.push("updated_at = NOW()");

    values.push(tenantId);
    const tenantParameter = values.length;

    values.push(supplier.id);
    const supplierParameter = values.length;

    values.push(productId);
    const productParameter = values.length;

    const result = await client.query(
      `UPDATE public.supplier_products
       SET ${assignments.join(", ")}
       WHERE tenant_id = $${tenantParameter}
         AND supplier_id = $${supplierParameter}
         AND id = $${productParameter}
       RETURNING *`,
      values
    );

    if (!result.rows.length) {
      throw httpError("Product not found or you do not have permission to update it.", 404);
    }

    return mapSupplierProduct(result.rows[0]);
  });
}

export async function deleteSupplierProduct(user, productId) {
  const { tenantId } = getIdentity(user);

  return withTenantTransaction(tenantId, async (client) => {
    const supplier = await resolveSupplier(client, user);

    const result = await client.query(
      `DELETE FROM public.supplier_products
       WHERE tenant_id = $1
         AND supplier_id = $2
         AND id = $3
       RETURNING id`,
      [tenantId, supplier.id, productId]
    );

    if (!result.rows.length) {
      throw httpError("Product not found or you do not have permission to delete it.", 404);
    }

    return {
      id: result.rows[0].id,
      deleted: true,
    };
  });
}

// --------------------------------------------------
// SUPPLIER PURCHASE ORDERS
// --------------------------------------------------

export async function listSupplierPurchaseOrders(
  user,
  { limit = 100, offset = 0 } = {}
) {
  const { tenantId } = getIdentity(user);

  return withTenantTransaction(tenantId, async (client) => {
    const supplier = await resolveSupplier(client, user);

    const safeLimit = Math.min(
      Math.max(Number(limit) || 100, 1),
      100
    );

    const safeOffset = Math.max(
      Number.isInteger(Number(offset)) ? Number(offset) : 0,
      0
    );

    const result = await client.query(
      `SELECT
          po.id,
          po.po_number,
          po.status,
          po.currency,
          po.subtotal,
          po.tax_total,
          po.total_amount,
          po.payment_terms,
          po.issued_at,
          po.created_at,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', poi.id,
                'lineNumber', poi.line_number,
                'description', poi.description,
                'quantity', poi.quantity,
                'unitOfMeasure', poi.unit_of_measure,
                'unitPrice', poi.unit_price,
                'lineTotal', poi.line_total,
                'quantityReceived', poi.quantity_received
              )
              ORDER BY poi.line_number
            ) FILTER (WHERE poi.id IS NOT NULL),
            '[]'::jsonb
          ) AS items
       FROM public.purchase_orders po
       LEFT JOIN public.purchase_order_items poi
         ON poi.purchase_order_id = po.id
        AND poi.tenant_id = po.tenant_id
       WHERE po.tenant_id = $1
         AND po.supplier_id = $2
       GROUP BY po.id
       ORDER BY po.created_at DESC
       LIMIT $3 OFFSET $4`,
      [tenantId, supplier.id, safeLimit, safeOffset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      poNumber: row.po_number,
      status: row.status,
      currency: row.currency,
      subtotal: Number(row.subtotal || 0),
      taxTotal: Number(row.tax_total || 0),
      totalAmount: Number(row.total_amount || 0),
      paymentTerms: row.payment_terms,
      issuedAt: row.issued_at,
      createdAt: row.created_at,
      items: row.items,
    }));
  });
}

// --------------------------------------------------
// SUPPLIER DELIVERIES
// --------------------------------------------------

export async function listSupplierDeliveries(
  user,
  { limit = 100, offset = 0 } = {}
) {
  const { tenantId } = getIdentity(user);

  return withTenantTransaction(tenantId, async (client) => {
    const supplier = await resolveSupplier(client, user);

    const safeLimit = Math.min(
      Math.max(Number(limit) || 100, 1),
      100
    );

    const safeOffset = Math.max(
      Number.isInteger(Number(offset)) ? Number(offset) : 0,
      0
    );

    const result = await client.query(
      `SELECT
          gr.id,
          gr.receipt_number,
          gr.delivery_note_reference,
          gr.status,
          gr.received_at,
          gr.created_at,
          po.id AS purchase_order_id,
          po.po_number
       FROM public.goods_receipts gr
       INNER JOIN public.purchase_orders po
         ON po.id = gr.purchase_order_id
        AND po.tenant_id = gr.tenant_id
       WHERE gr.tenant_id = $1
         AND po.supplier_id = $2
       ORDER BY gr.created_at DESC
       LIMIT $3 OFFSET $4`,
      [tenantId, supplier.id, safeLimit, safeOffset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      receiptNumber: row.receipt_number,
      deliveryNoteReference: row.delivery_note_reference,
      status: row.status,
      receivedAt: row.received_at,
      createdAt: row.created_at,
      purchaseOrderId: row.purchase_order_id,
      poNumber: row.po_number,
    }));
  });
}

// --------------------------------------------------
// SUPPLIER RFQs
// --------------------------------------------------

export async function listSupplierRfqs(user, _filters = {}) {
  const { tenantId } = getIdentity(user);

  return withTenantTransaction(tenantId, async (client) => {
    await resolveSupplier(client, user);

    // RFQ database module/table has not been configured yet.
    // Return no fabricated RFQ records.
    return [];
  });
}
