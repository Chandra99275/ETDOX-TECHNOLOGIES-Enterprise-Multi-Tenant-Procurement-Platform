import test from "node:test";
import assert from "node:assert/strict";

import {
  login,
  request,
  authenticatedRequest,
  assertSuccessfulRead,
  extractRecords,
} from "./test-utils.js";

const PROCUREMENT_PATH =
  process.env.ETDOX_PROCUREMENT_PATH || "/procurement/requests";

test("GET procurement requests rejects unauthenticated requests", async () => {
  const result = await request(PROCUREMENT_PATH);

  assert.ok(
    [401, 403].includes(result.response.status),
    `Expected HTTP 401 or 403, received ${result.response.status}: ${result.text}`
  );
});

test("Authenticated user can retrieve purchase requests", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, PROCUREMENT_PATH);

  assertSuccessfulRead(result, `GET ${PROCUREMENT_PATH}`);
});

test("Purchase request list has a valid collection structure", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, PROCUREMENT_PATH);

  assertSuccessfulRead(result, `GET ${PROCUREMENT_PATH}`);

  const records = extractRecords(result.body);

  if (records.length > 0) {
    assert.ok(
      records.every((record) => record && typeof record === "object"),
      "Purchase request results should contain objects."
    );
  }
});

test("Purchase request list does not expose database stack traces", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, PROCUREMENT_PATH);

  const responseText = result.text.toLowerCase();

  assert.ok(
    !responseText.includes("node_modules/"),
    "API response should not expose internal Node.js file paths."
  );

  assert.ok(
    !responseText.includes("select * from"),
    "API response should not expose raw SQL queries."
  );
});