
// backend/src/modules/suppliers/suppliers.repository.js

import {
  withTenantTransaction as withDatabaseTenantTransaction,
} from "../../config/database.js";

const TABLE = "suppliers";

// ------------------------------------------------------------
// Database column mappings
// ------------------------------------------------------------

const CANDIDATES = {
  id: ["id", "supplier_id", "vendor_id"],
  tenant: ["tenant_id", "tenantId"],
  name: ["legal_name", "name", "supplier_name", "vendor_name", "company_name"],
  tradingName: ["trading_name"],
  code: ["supplier_code", "vendor_code", "code"],
  email: ["contact_email", "email", "supplier_email"],
  phone: ["contact_phone", "phone", "phone_number", "mobile"],
  contactPerson: ["contact_name", "contact_person", "primary_contact", "contact_person_name"],
  address: ["address", "street_address", "business_address"],
  city: ["city", "town"],
  state: ["state", "province"],
  country: ["country", "country_name"],
  postalCode: ["postal_code", "zip_code", "postcode"],
  taxId: ["tax_identifier", "tax_id", "gstin", "gst_number", "vat_number"],
  registrationNumber: ["registration_number"],
  website: ["website"],
  category: ["category", "supplier_category", "vendor_category"],
  currency: ["currency"],
  paymentTerms: ["payment_terms", "payment_term"],
  status: ["status", "supplier_status", "vendor_status"],
  onboardingStatus: ["onboarding_status"],
  onboardingSubmittedAt: ["onboarding_submitted_at"],
  reviewedBy: ["reviewed_by"],
  reviewedAt: ["reviewed_at"],
  reviewNotes: ["review_notes"],
  riskRating: ["risk_rating"],
  metadata: ["metadata"],
  notes: ["notes", "description", "remarks"],
  createdBy: ["created_by", "created_by_user_id", "user_id"],
  createdAt: ["created_at", "createdAt"],
  updatedAt: ["updated_at", "updatedAt"],
};

const VALID_STATUSES = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "SUSPENDED",
  "REJECTED",
  "ARCHIVED",
]);

const VALID_ONBOARDING_STATUSES = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
]);

const STATUS_ALIASES = {
  INACTIVE: "SUSPENDED",
  PENDING: "PENDING_REVIEW",
};

const ONBOARDING_ALIASES = {
  PENDING: "NOT_STARTED",
};

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------

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

function normalizeSupplierStatus(value, fallback = "DRAFT") {
  const raw = String(value ?? fallback).trim().toUpperCase();
  const normalized = STATUS_ALIASES[raw] ?? raw;

  if (!VALID_STATUSES.has(normalized)) {
    throw httpError(`Invalid supplier status: ${value}`, 400);
  }

  return normalized;
}

function normalizeOnboardingStatus(
  value,
  fallback = "NOT_STARTED",
) {
  const raw = String(value ?? fallback).trim().toUpperCase();
  const normalized = ONBOARDING_ALIASES[raw] ?? raw;

  if (!VALID_ONBOARDING_STATUSES.has(normalized)) {
    throw httpError(`Invalid onboarding status: ${value}`, 400);
  }

  return normalized;
}

function normalizeCurrency(value) {
  const currency = String(value ?? "INR").trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw httpError(
      "Currency must be a valid three-letter currency code.",
      400,
    );
  }

  return currency;
}

function normalizeRequiredText(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw httpError(`${fieldName} is required.`, 400);
  }

  return value.trim();
}

// ------------------------------------------------------------
// Address normalization
// ------------------------------------------------------------

function normalizeAddress(address) {
  if (address === undefined || address === null) {
    return {};
  }

  if (typeof address === "string") {
    const trimmed = address.trim();

    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed;
      }
    } catch {
      // Treat a normal address string as a street address.
    }

    return { street: trimmed };
  }

  if (
    typeof address === "object" &&
    !Array.isArray(address)
  ) {
    return address;
  }

  throw httpError(
    "Supplier address must be an object or string.",
    400,
  );
}

// ------------------------------------------------------------
// Tenant transaction
// ------------------------------------------------------------

async function withTenantTransaction(user, callback) {
  return withDatabaseTenantTransaction(
    getTenantId(user),
    callback,
  );
}

// ------------------------------------------------------------
// Database column discovery
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// Supplier normalization
// ------------------------------------------------------------

function normalizeSupplier(row, columns) {
  if (!row) {
    return null;
  }

  const get = (key) =>
    columns[key] ? row[columns[key]] ?? null : null;

  return {
    id: row[columns.id],

    name: row[columns.name],
    legalName: row[columns.name],

    tradingName: get("tradingName"),
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
    registrationNumber: get("registrationNumber"),
    website: get("website"),

    category: get("category"),
    currency: get("currency"),
    paymentTerms: get("paymentTerms"),

    status: get("status"),
    onboardingStatus: get("onboardingStatus"),
    onboardingSubmittedAt: get("onboardingSubmittedAt"),

    reviewedBy: get("reviewedBy"),
    reviewedAt: get("reviewedAt"),
    reviewNotes: get("reviewNotes"),

    riskRating: get("riskRating"),
    metadata: get("metadata"),

    notes: get("notes") ?? get("reviewNotes"),

    createdBy: get("createdBy"),
    createdAt: get("createdAt"),
    updatedAt: get("updatedAt"),

    raw: row,
  };
}

// ------------------------------------------------------------
// LIST SUPPLIERS
// ------------------------------------------------------------

export async function listSuppliers(user, filters = {}) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getSupplierColumns(client);

    const conditions = [];
    const params = [];

    if (filters.status && columns.status) {
      params.push(normalizeSupplierStatus(filters.status));

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
        columns.tradingName,
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
      Math.max(
        1,
        Number.parseInt(filters.limit, 10) || 20,
      ),
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

    const total = countResult.rows[0].total;

    return {
      items: result.rows.map((row) =>
        normalizeSupplier(row, columns),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

// ------------------------------------------------------------
// FIND SUPPLIER BY ID
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// CREATE SUPPLIER
// ------------------------------------------------------------

export async function createSupplier(user, input) {
  return withTenantTransaction(user, async (client) => {
    const columns = await getSupplierColumns(client);

    const supplierName = normalizeRequiredText(
      input.name,
      "Supplier legal name",
    );

    const supplierCode = normalizeRequiredText(
      input.code,
      "Supplier code",
    );

    const currency = normalizeCurrency(
      input.currency ?? user?.currency ?? "INR",
    );

    const status = normalizeSupplierStatus(
      input.status,
      "DRAFT",
    );

    const onboardingStatus = normalizeOnboardingStatus(
      input.onboardingStatus,
      "NOT_STARTED",
    );

    const data = {};

    const assign = (column, value) => {
      if (column && value !== undefined) {
        data[column] = value;
      }
    };

    // Tenant and supplier identity.
    assign(columns.tenant, getTenantId(user));
    assign(columns.name, supplierName);
    assign(columns.code, supplierCode);

    // Contact information.
    assign(columns.email, input.email?.trim().toLowerCase());
    assign(columns.phone, input.phone);
    assign(columns.contactPerson, input.contactPerson);

    // Address JSONB.
    if (columns.address) {
      assign(
        columns.address,
        normalizeAddress(input.address),
      );
    }

    // Optional business information.
    assign(columns.city, input.city);
    assign(columns.state, input.state);
    assign(columns.country, input.country);
    assign(columns.postalCode, input.postalCode);

    assign(columns.taxId, input.taxId);
    assign(columns.registrationNumber, input.registrationNumber);
    assign(columns.website, input.website);

    assign(columns.category, input.category);
    assign(columns.currency, currency);
    assign(columns.paymentTerms, input.paymentTerms);

    // PostgreSQL CHECK constraint-compatible values.
    assign(columns.status, status);
    assign(columns.onboardingStatus, onboardingStatus);

    assign(
      columns.onboardingSubmittedAt,
      input.onboardingSubmittedAt,
    );

    // Review and risk information.
    assign(columns.reviewedBy, input.reviewedBy);
    assign(columns.reviewedAt, input.reviewedAt);
    assign(columns.reviewNotes, input.reviewNotes);
    assign(columns.riskRating, input.riskRating);

    // JSONB metadata.
    if (columns.metadata) {
      assign(columns.metadata, input.metadata ?? {});
    }

    assign(columns.notes, input.notes);
    assign(columns.createdBy, getUserId(user));

    if (columns.createdAt) {
      data[columns.createdAt] = new Date();
    }

    if (columns.updatedAt) {
      data[columns.updatedAt] = new Date();
    }

    const entries = Object.entries(data);

    if (entries.length === 0) {
      throw httpError(
        "No valid supplier fields were provided.",
        400,
      );
    }

    const values = entries.map(([, value]) => value);

    const placeholders = values.map(
      (_, index) => `$${index + 1}`,
    );

    const result = await client.query(
      `INSERT INTO ${quote(TABLE)}
        (${entries
          .map(([column]) => quote(column))
          .join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING ${selectColumns(columns)}`,
      values,
    );

    return normalizeSupplier(result.rows[0], columns);
  });
}

// ------------------------------------------------------------
// UPDATE SUPPLIER
// ------------------------------------------------------------

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

    // Supplier identity.
    if (input.name !== undefined) {
      assign(
        columns.name,
        normalizeRequiredText(input.name, "Supplier legal name"),
      );
    }

    assign(columns.tradingName, input.tradingName);

    if (input.code !== undefined) {
      assign(
        columns.code,
        normalizeRequiredText(input.code, "Supplier code"),
      );
    }

    // Contact information.
    if (input.email !== undefined) {
      assign(columns.email, input.email?.trim().toLowerCase());
    }

    assign(columns.phone, input.phone);
    assign(columns.contactPerson, input.contactPerson);

    // Address.
    if (input.address !== undefined) {
      assign(
        columns.address,
        normalizeAddress(input.address),
      );
    }

    // Business information.
    assign(columns.city, input.city);
    assign(columns.state, input.state);
    assign(columns.country, input.country);
    assign(columns.postalCode, input.postalCode);

    assign(columns.taxId, input.taxId);
    assign(columns.registrationNumber, input.registrationNumber);
    assign(columns.website, input.website);

    assign(columns.category, input.category);

    if (input.currency !== undefined) {
      assign(columns.currency, normalizeCurrency(input.currency));
    }

    assign(columns.paymentTerms, input.paymentTerms);

    // Normalize status values before updating PostgreSQL.
    if (input.status !== undefined) {
      assign(
        columns.status,
        normalizeSupplierStatus(input.status),
      );
    }

    if (input.onboardingStatus !== undefined) {
      assign(
        columns.onboardingStatus,
        normalizeOnboardingStatus(input.onboardingStatus),
      );
    }

    assign(
      columns.onboardingSubmittedAt,
      input.onboardingSubmittedAt,
    );

    // Review and risk information.
    assign(columns.reviewedBy, input.reviewedBy);
    assign(columns.reviewedAt, input.reviewedAt);
    assign(columns.reviewNotes, input.reviewNotes);
    assign(columns.riskRating, input.riskRating);

    if (input.metadata !== undefined) {
      assign(columns.metadata, input.metadata);
    }

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
