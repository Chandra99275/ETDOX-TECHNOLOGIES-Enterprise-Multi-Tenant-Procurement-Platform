import test from "node:test";
import assert from "node:assert/strict";

import {
  login,
  request,
  authenticatedRequest,
  assertSuccessfulRead,
  extractRecords,
} from "./test-utils.js";

const USERS_PATH = process.env.ETDOX_USERS_PATH || "/users";

test("GET users requires authentication", async () => {
  const result = await request(USERS_PATH);

  assert.ok(
    [401, 403].includes(result.response.status),
    `Expected HTTP 401 or 403, received ${result.response.status}: ${result.text}`
  );
});

test("Authenticated user can retrieve the users endpoint", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, USERS_PATH);

  assertSuccessfulRead(result, `GET ${USERS_PATH}`);

  assert.ok(
    result.body !== null,
    "The users endpoint should return a response body."
  );
});

test("User listing returns a valid collection when the response contains one", async () => {
  const { token } = await login();

  const result = await authenticatedRequest(token, USERS_PATH);

  assertSuccessfulRead(result, `GET ${USERS_PATH}`);

  const records = extractRecords(result.body);

  if (records.length > 0) {
    assert.ok(
      records.every((record) => typeof record === "object" && record !== null),
      "The user collection should contain objects."
    );
  }
});