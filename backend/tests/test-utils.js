import assert from "node:assert/strict";

export const API_BASE_URL = (
  process.env.ETDOX_API_BASE_URL || "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

export const TEST_EMAIL =
  process.env.ETDOX_TEST_EMAIL || "admin@etdox.com";

export const TEST_PASSWORD =
  process.env.ETDOX_TEST_PASSWORD || "admin123";

export async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();

  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  return {
    response,
    body,
    text,
  };
}

export function extractToken(body) {
  return (
    body?.data?.accessToken ??
    body?.data?.token ??
    body?.accessToken ??
    body?.token ??
    body?.data?.access_token ??
    body?.access_token ??
    null
  );
}

export async function login(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const result = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  assert.equal(
    result.response.status,
    200,
    `Login failed with HTTP ${result.response.status}: ${result.text}`
  );

  const token = extractToken(result.body);

  assert.ok(
    token,
    `Login succeeded but no access token was found: ${result.text}`
  );

  return {
    token,
    body: result.body,
    response: result.response,
  };
}

export async function authenticatedRequest(token, path, options = {}) {
  return request(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export function extractRecords(body) {
  const candidates = [
    body?.data?.items,
    body?.data?.records,
    body?.data?.results,
    body?.data?.requests,
    body?.data?.users,
    body?.data?.budgets,
    body?.data?.invoices,
    body?.items,
    body?.records,
    body?.results,
    body?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

export function extractRecordId(record) {
  return (
    record?.id ??
    record?.request_id ??
    record?.invoice_id ??
    record?.budget_id ??
    record?.user_id ??
    record?.purchase_request_id ??
    null
  );
}

export function assertSuccessfulRead(result, endpoint) {
  assert.ok(
    result.response.status >= 200 && result.response.status < 300,
    `${endpoint} returned HTTP ${result.response.status}: ${result.text}`
  );

  assert.notEqual(
    result.body?.success,
    false,
    `${endpoint} returned success:false: ${result.text}`
  );
}