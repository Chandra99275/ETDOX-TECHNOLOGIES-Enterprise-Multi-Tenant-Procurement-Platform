import test from "node:test";
import assert from "node:assert/strict";

import {
  login,
  request,
  authenticatedRequest,
  assertSuccessfulRead,
  extractRecords,
} from "./test-utils.js";

const BUDGETS_PATH =
  process.env.ETDOX_BUDGETS_PATH || "/budgets";

test("GET budgets rejects unauthenticated requests", async () => {
  const result = await request(BUDGETS_PATH);

  assert.ok(
    [401, 403].includes(result.response.status),
    `Expected HTTP 401 or 403, received ${result.response.status}: ${result.text}`
  );
});

test("Authenticated user can access the budgets endpoint", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, BUDGETS_PATH);

  assertSuccessfulRead(result, `GET ${BUDGETS_PATH}`);
});

test("Budget listing returns a valid collection when available", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, BUDGETS_PATH);

  assertSuccessfulRead(result, `GET ${BUDGETS_PATH}`);

  const records = extractRecords(result.body);

  if (records.length > 0) {
    assert.ok(
      records.every((record) => record && typeof record === "object"),
      "Budget results should contain objects."
    );
  }
});

test("Budget endpoint does not expose internal server errors", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, BUDGETS_PATH);

  assert.ok(
    result.response.status < 500,
    `Budget endpoint returned HTTP ${result.response.status}: ${result.text}`
  );
});