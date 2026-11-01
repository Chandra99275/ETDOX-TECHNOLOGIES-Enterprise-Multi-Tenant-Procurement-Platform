import * as tenantsRepository from "./tenants.repository.js";

const PLATFORM_ADMIN_ROLES = new Set([
  "platform_admin",
  "super_admin",
]);

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeActor(actor) {
  return {
    id: actor?.id ?? actor?.userId,
    tenantId: actor?.tenantId ?? actor?.tenant_id,
    role: String(actor?.role ?? "").toLowerCase(),
  };
}

function requireAuthenticatedActor(actor) {
  const normalized = normalizeActor(actor);

  if (!normalized.id || !normalized.tenantId) {
    throw httpError(
      "Authenticated user and tenant information are required",
      401
    );
  }

  return normalized;
}

function requirePlatformAdmin(actor) {
  const normalized = requireAuthenticatedActor(actor);

  if (!PLATFORM_ADMIN_ROLES.has(normalized.role)) {
    throw httpError(
      "Platform administrator privileges are required",
      403
    );
  }

  return normalized;
}

/**
 * List tenants across the platform.
 */
export async function listTenants(actor, query) {
  requirePlatformAdmin(actor);

  return tenantsRepository.listTenants(query);
}

/**
 * Return the tenant associated with the current authenticated user.
 */
export async function getMyTenant(actor) {
  const normalized = requireAuthenticatedActor(actor);

  const tenant = await tenantsRepository.findTenantById(
    normalized.tenantId
  );

  if (!tenant) {
    throw httpError("Your tenant could not be found", 404);
  }

  return tenant;
}

/**
 * Get any tenant by ID. Cross-tenant lookups require a platform admin.
 */
export async function getTenant(actor, tenantId) {
  const normalized = requireAuthenticatedActor(actor);

  if (
    normalized.tenantId !== tenantId &&
    !PLATFORM_ADMIN_ROLES.has(normalized.role)
  ) {
    throw httpError(
      "You cannot access another tenant",
      403
    );
  }

  const tenant = await tenantsRepository.findTenantById(tenantId);

  if (!tenant) {
    throw httpError("Tenant not found", 404);
  }

  return tenant;
}

/**
 * Create a tenant on the platform.
 */
export async function createTenant(actor, input) {
  requirePlatformAdmin(actor);

  const existing = await tenantsRepository.findTenantBySlug(input.slug);

  if (existing) {
    throw httpError(
      "A tenant with this slug already exists",
      409
    );
  }

  return tenantsRepository.createTenant(input);
}

/**
 * Update tenant metadata.
 */
export async function updateTenant(actor, tenantId, input) {
  requirePlatformAdmin(actor);

  if (input.slug) {
    const existing = await tenantsRepository.findTenantBySlug(
      input.slug
    );

    if (existing && existing.id !== tenantId) {
      throw httpError(
        "Another tenant already uses this slug",
        409
      );
    }
  }

  const tenant = await tenantsRepository.updateTenant(
    tenantId,
    input
  );

  if (!tenant) {
    throw httpError("Tenant not found", 404);
  }

  return tenant;
}