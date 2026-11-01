import test from "node:test";
import assert from "node:assert/strict";

import {
  login,
  request,
  authenticatedRequest,
  extractRecords,
  extractRecordId,
} from "./test-utils.js";

const RESOURCE_PATH =
  process.env.ETDOX_TENANT_RESOURCE_PATH || "/procurement/requests";

const TENANT_B_EMAIL = process.env.ETDOX_TENANT_B_EMAIL;
const TENANT_B_PASSWORD = process.env.ETDOX_TENANT_B_PASSWORD;

test("Tenant-protected resource rejects unauthenticated access", async () => {
  const result = await request(RESOURCE_PATH);

  assert.ok(
    [401, 403].includes(result.response.status),
    `Expected HTTP 401 or 403, received ${result.response.status}: ${result.text}`
  );
});

test(
  "A user from tenant B cannot access tenant A's purchase request",
  {
    skip:
      !TENANT_B_EMAIL ||
      !TENANT_B_PASSWORD
        ? "Configure ETDOX_TENANT_B_EMAIL and ETDOX_TENANT_B_PASSWORD for cross-tenant testing."
        : false,
  },
  async (t) => {
    const tenantA = await login();
    const tenantB = await login(TENANT_B_EMAIL, TENANT_B_PASSWORD);

    // Find an existing request belonging to tenant A.
    const listResult = await authenticatedRequest(
      tenantA.token,
      RESOURCE_PATH
    );

    assert.ok(
      listResult.response.ok,
      `Could not list tenant A's requests: ${listResult.text}`
    );

    const records = extractRecords(listResult.body);

    if (records.length === 0) {
      t.skip("Tenant A has no purchase requests available for this test.");
      return;
    }

    const recordId = extractRecordId(records[0]);

    if (!recordId) {
      t.skip(
        "Could not identify a request ID. Update extractRecordId() to match the API response."
      );
      return;
    }

    // Tenant B attempts to access tenant A's request.
    const detailPath =
      `${RESOURCE_PATH.replace(/\/+$/, "")}/${encodeURIComponent(recordId)}`;

    const crossTenantResult = await authenticatedRequest(
      tenantB.token,
      detailPath
    );

    assert.ok(
      [403, 404].includes(crossTenantResult.response.status),
      [
        "Possible cross-tenant access vulnerability.",
        `Tenant B received HTTP ${crossTenantResult.response.status}`,
        `for a purchase request belonging to tenant A.`,
        `Response: ${crossTenantResult.text}`,
      ].join(" ")
    );
  }
);

test(
  "Tenant B cannot retrieve tenant A's purchase request through a query parameter",
  {
    skip:
      !TENANT_B_EMAIL ||
      !TENANT_B_PASSWORD
        ? "Configure separate tenant B credentials to run this test."
        : false,
  },
  async (t) => {
    const tenantA = await login();
    const tenantB = await login(TENANT_B_EMAIL, TENANT_B_PASSWORD);

    const listResult = await authenticatedRequest(
      tenantA.token,
      RESOURCE_PATH
    );

    assert.ok(
      listResult.response.ok,
      `Could not list tenant A's requests: ${listResult.text}`
    );

    const records = extractRecords(listResult.body);

    if (records.length === 0) {
      t.skip("Tenant A has no purchase requests available.");
      return;
    }

    const recordId = extractRecordId(records[0]);

    if (!recordId) {
      t.skip("The purchase request ID could not be identified.");
      return;
    }

    const queryPath =
      `${RESOURCE_PATH}?id=${encodeURIComponent(recordId)}`;

    const result = await authenticatedRequest(tenantB.token, queryPath);

    assert.ok(
      result.response.status < 500,
      `Cross-tenant query returned HTTP ${result.response.status}: ${result.text}`
    );

    // A list endpoint may return HTTP 200 while correctly filtering the
    // foreign tenant's record out of the results.
    if (result.response.ok) {
      const returnedRecords = extractRecords(result.body);

      const foreignRecordReturned = returnedRecords.some(
        (record) => String(extractRecordId(record)) === String(recordId)
      );

      assert.equal(
        foreignRecordReturned,
        false,
        "Tenant B's response exposed a purchase request belonging to tenant A."
      );
    }
  }
);