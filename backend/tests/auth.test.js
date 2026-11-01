import test from "node:test";
import assert from "node:assert/strict";

import {
  request,
  login,
  extractToken,
} from "./test-utils.js";

test("POST /auth/login authenticates a valid user", async () => {
  const result = await login();

  assert.ok(result.token.length > 0);
});

test("POST /auth/login rejects invalid credentials", async () => {
  const result = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: `invalid-${Date.now()}@example.invalid`,
      password: "InvalidPassword-NotARealAccount-123!",
    }),
  });

  assert.ok(
    [400, 401, 403].includes(result.response.status),
    `Expected an authentication rejection, received HTTP ${result.response.status}: ${result.text}`
  );

  assert.equal(
    extractToken(result.body),
    null,
    "Invalid credentials must not return an access token."
  );
});

test("Protected endpoint rejects a request without a token", async () => {
  const result = await request("/auth/me");

  assert.ok(
    [401, 403].includes(result.response.status),
    `Expected HTTP 401 or 403, received ${result.response.status}: ${result.text}`
  );
});

test("Protected endpoint accepts a valid token", async () => {
  const { token } = await login();

  const result = await request("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.ok(
    result.response.status >= 200 && result.response.status < 300,
    `Authenticated /auth/me failed with HTTP ${result.response.status}: ${result.text}`
  );
});