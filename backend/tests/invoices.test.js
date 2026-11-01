import test from "node:test";
import assert from "node:assert/strict";

import {
  login,
  request,
  authenticatedRequest,
  assertSuccessfulRead,
  extractRecords,
} from "./test-utils.js";

const INVOICES_PATH =
  process.env.ETDOX_INVOICES_PATH || "/invoices";

test("GET invoices rejects unauthenticated requests", async () => {
  const result = await request(INVOICES_PATH);

  assert.ok(
    [401, 403].includes(result.response.status),
    `Expected HTTP 401 or 403, received ${result.response.status}: ${result.text}`
  );
});

test("Authenticated user can access the invoices endpoint", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, INVOICES_PATH);

  assertSuccessfulRead(result, `GET ${INVOICES_PATH}`);
});

test("Invoice listing returns a valid collection when available", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, INVOICES_PATH);

  assertSuccessfulRead(result, `GET ${INVOICES_PATH}`);

  const records = extractRecords(result.body);

  if (records.length > 0) {
    assert.ok(
      records.every((record) => record && typeof record === "object"),
      "Invoice results should contain objects."
    );
  }
});

test("Invoice endpoint does not expose raw SQL or stack traces", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, INVOICES_PATH);

  const responseText = result.text.toLowerCase();

  assert.ok(
    !responseText.includes("node_modules/"),
    "Invoice response should not expose internal Node.js file paths."
  );

  assert.ok(
    !responseText.includes("select * from"),
    "Invoice response should not expose raw SQL queries."
  );
});