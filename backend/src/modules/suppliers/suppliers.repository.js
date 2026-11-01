// backend/src/modules/suppliers/suppliers.repository.js

import { pool } from "../../config/database.js";

const TABLE = "suppliers";

const CANDIDATES = {
  id: ["id", "supplier_id", "vendor_id"],
  tenant: ["tenant_id", "tenantId"],
  name: ["name", "supplier_name", "vendor_name", "company_name"],
  code: ["supplier_code", "vendor_code", "code"],
  email: ["email", "contact_email", "supplier_email"],
  phone: ["phone", "phone_number", "contact_phone", "mobile"],
  contactPerson: [
    "contact_person",
    "contact_name",
    "primary_contact",
    "contact_person_name",
  ],
  address: ["address", "street_address", "business_address"],
  city: ["city", "town"],
  state: ["state", "province"],
  country: ["country", "country_name"],
  postalCode: ["postal_code", "zip_code", "postcode"],
  taxId: ["tax_id", "gstin", "gst_number", "vat_number"],
  category: ["category", "supplier_category", "vendor_category"],
  paymentTerms: ["payment_terms", "payment_term"],
  status: ["status", "supplier_status", "vendor_status"],
  notes: ["notes", "description", "remarks"],
  createdBy: ["created_by", "created_by_user_id", "user_id"],
  createdAt: ["created_at", "createdAt"],
  updatedAt: ["updated_at", "updatedAt"],
};

const quote = (identifier) =>
  `"${String(identifier).replaceAll('"', '""')}"`;

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getTenantId(user) {
  const tenantId = user?.tenantId ?? user?.tenant_id;

  if (!tenantId) {
    throw httpError("Tenant context is missing.", 403);
  }

  return String(tenantId);
}

function getUserId(user) {
  return user?.id ?? user?.userId ?? user?.user_id ?? null;
}

async function withTenantTransaction(user, callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Tenant context must be set on this same connection and transaction.
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [getTenantId(user)],
    );

    const result = await callback(client);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getSupplierColumns(client) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [TABLE],
  );

  const all = result.rows.map((row) => row.column_name);

  if (all.length === 0) {
    throw httpError(
      'The "suppliers" table was not found in the current database schema.',
      500,
    );
  }

  const columns = { all };

  for (const [key, candidates] of Object.entries(CANDIDATES)) {
    columns[key] =
      candidates.find((candidate) => all.includes(candidate)) ?? null;
  }

  if (!columns.id || !columns.tenant || !columns.name) {
    throw httpError(
      "The suppliers table must have an ID, tenant ID, and supplier name column.",
      500,
    );
  }

  return columns;
}

function selectColumns(columns) {
  return columns.all.map(quote).join(", ");
}

function normalizeSupplier(row, columns) {
  if (!row) return null;

  const get = (key) =>
    columns[key] ? row[columns[key]] ?? null : null;

  return {
    id: row[columns.id],
    name: row[columns.name],
    code: get("code"),
    email: get("email"),
    phone: get("phone"),
    contactPerson: get("contactPerson"),
    address: get("address"),
    city: get("city"),
    state: get("state"),
    country: get("country"),
    postalCode: get("postalCode"),
    taxId: get("taxId"),
    category: get("category"),
    paymentTerms: get("paymentTerms"),
    status: get("status"),
    notes: get("notes"),
    createdBy: get("createdBy"),
    createdAt: get("createdAt"),
    updatedAt: get("updatedAt"),
    raw: row,
  };
}

export async function listSuppliers(user, filters = {}) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getSupplierColumns(client);
    const conditions = [];
    const params = [];

    if (filters.status && columns.status) {
      params.push(filters.status);
      conditions.push(
        `${quote(columns.status)}::text = $${params.length}`,
      );
    }

    if (filters.category && columns.category) {
      params.push(filters.category);
      conditions.push(
        `${quote(columns.category)}::text = $${params.length}`,
      );
    }

    if (filters.search) {
      const searchable = [
        columns.name,
        columns.code,
        columns.email,
        columns.contactPerson,
        columns.taxId,
      ].filter(Boolean);

      if (searchable.length > 0) {
        params.push(`%${filters.search}%`);
        const placeholder = `$${params.length}`;

        conditions.push(
          `(${searchable
            .map(
              (column) =>
                `${quote(column)}::text ILIKE ${placeholder}`,
            )
            .join(" OR ")})`,
        );
      }
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const page = Math.max(
      1,
      Number.parseInt(filters.page, 10) || 1,
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(filters.limit, 10) || 20),
    );

    const offset = (page - 1) * limit;

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total
         FROM ${quote(TABLE)}
         ${where}`,
      params,
    );

    const queryParams = [...params, limit, offset];

    const result = await client.query(
      `SELECT ${selectColumns(columns)}
         FROM ${quote(TABLE)}
         ${where}
        ORDER BY ${
          columns.createdAt
            ? `${quote(columns.createdAt)} DESC NULLS LAST`
            : `${quote(columns.name)} ASC`
        }
        LIMIT $${queryParams.length - 1}
       OFFSET $${queryParams.length}`,
      queryParams,
    );

    return {
      items: result.rows.map((row) =>
        normalizeSupplier(row, columns),
      ),
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(
          countResult.rows[0].total / limit,
        ),
      },
    };
  });
}

export async function findSupplierById(user, supplierId) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getSupplierColumns(client);

    const result = await client.query(
      `SELECT ${selectColumns(columns)}
         FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)}::text = $1
        LIMIT 1`,
      [String(supplierId)],
    );

    return normalizeSupplier(
      result.rows[0] ?? null,
      columns,
    );
  });
}

export async function createSupplier(user, input) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getSupplierColumns(client);
    const data = {};

    const assign = (column, value) => {
      if (column && value !== undefined) {
        data[column] = value;
      }
    };

    assign(columns.tenant, getTenantId(user));
    assign(columns.name, input.name);
    assign(columns.code, input.code);
    assign(columns.email, input.email);
    assign(columns.phone, input.phone);
    assign(columns.contactPerson, input.contactPerson);
    assign(columns.address, input.address);
    assign(columns.city, input.city);
    assign(columns.state, input.state);
    assign(columns.country, input.country);
    assign(columns.postalCode, input.postalCode);
    assign(columns.taxId, input.taxId);
    assign(columns.category, input.category);
    assign(columns.paymentTerms, input.paymentTerms);
    assign(columns.status, input.status ?? "active");
    assign(columns.notes, input.notes);
    assign(columns.createdBy, getUserId(user));

    if (columns.createdAt) {
      data[columns.createdAt] = new Date();
    }

    if (columns.updatedAt) {
      data[columns.updatedAt] = new Date();
    }

    const entries = Object.entries(data);

    const values = entries.map(([, value]) => value);
    const placeholders = values.map(
      (_, index) => `$${index + 1}`,
    );

    const result = await client.query(
      `INSERT INTO ${quote(TABLE)}
        (${entries.map(([column]) => quote(column)).join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING ${selectColumns(columns)}`,
      values,
    );

    return normalizeSupplier(result.rows[0], columns);
  });
}

export async function updateSupplier(user, supplierId, input) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getSupplierColumns(client);

    const existing = await client.query(
      `SELECT ${selectColumns(columns)}
         FROM ${quote(TABLE)}
        WHERE ${quote(columns.id)}::text = $1
        FOR UPDATE`,
      [String(supplierId)],
    );

    if (existing.rowCount === 0) {
      throw httpError("Supplier not found.", 404);
    }

    const data = {};

    const assign = (column, value) => {
      if (column && value !== undefined) {
        data[column] = value;
      }
    };

    assign(columns.name, input.name);
    assign(columns.code, input.code);
    assign(columns.email, input.email);
    assign(columns.phone, input.phone);
    assign(columns.contactPerson, input.contactPerson);
    assign(columns.address, input.address);
    assign(columns.city, input.city);
    assign(columns.state, input.state);
    assign(columns.country, input.country);
    assign(columns.postalCode, input.postalCode);
    assign(columns.taxId, input.taxId);
    assign(columns.category, input.category);
    assign(columns.paymentTerms, input.paymentTerms);
    assign(columns.status, input.status);
    assign(columns.notes, input.notes);

    if (columns.updatedAt) {
      data[columns.updatedAt] = new Date();
    }

    const entries = Object.entries(data);

    if (entries.length === 0) {
      return normalizeSupplier(existing.rows[0], columns);
    }

    const values = entries.map(([, value]) => value);
    const assignments = entries.map(
      ([column], index) =>
        `${quote(column)} = $${index + 1}`,
    );

    values.push(String(supplierId));

    const result = await client.query(
      `UPDATE ${quote(TABLE)}
          SET ${assignments.join(", ")}
        WHERE ${quote(columns.id)}::text = $${values.length}
        RETURNING ${selectColumns(columns)}`,
      values,
    );

    return normalizeSupplier(result.rows[0], columns);
  });
}