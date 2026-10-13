# ETDOX Procurement API

Tenant-scoped procurement API built with Express, TypeScript, PostgreSQL, Zod,
JWT authentication, and PostgreSQL row-level security.

## Run locally

Requirements: Node.js 20+ and PostgreSQL 15+.

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL`, a unique `JWT_SECRET`
   with at least 32 characters, and `WEBHOOK_ENCRYPTION_KEY` to 32 random bytes
   encoded as exactly 64 hexadecimal characters. Generate a key with:

   ```powershell
   Copy-Item .env.example .env
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Put the generated value in `.env`; the API validates its length and hex
   encoding at startup. Keep this key separate from `JWT_SECRET`, store it
   securely, and retain it for as long as encrypted webhook secrets must remain
   usable. Rotating it without first re-encrypting stored webhook secrets makes
   existing ciphertext undecryptable.

3. Create an empty PostgreSQL database, then apply the schema using either:

   ```powershell
   npm run migrate
   ```

   or `psql`:

   ```powershell
   psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f .\database\schema.sql
   ```

   `database/schema.sql` is a standalone copy of
   `src/database/migrations/001_init.sql`. The migration runner records applied
   migration names and applies each migration transactionally.

4. Start the API:

   ```powershell
   npm run dev
   ```

   `GET http://localhost:4000/api/v1/health` checks API liveness.

## Authentication

Create a tenant and its first organization administrator:

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "organizationName": "Example Organization",
  "email": "admin@example.com",
  "password": "use-a-unique-password-of-12-chars",
  "firstName": "Alex",
  "lastName": "Admin"
}
```

Registration returns a bearer token and the new tenant ID. Sign-in requires the
tenant ID because email addresses are unique within a tenant, not globally:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "tenantId": "<tenant-id-from-registration>",
  "email": "admin@example.com",
  "password": "use-a-unique-password-of-12-chars"
}
```

Send the returned token as `Authorization: Bearer <accessToken>`. The initial
administrator role is tenant-scoped and receives the permissions required for
the implemented procurement APIs. Passwords are hashed with bcrypt; credentials
are never returned by API responses.

## Implemented API surface

All endpoints use the `/api/v1` prefix. Authenticated routes require a bearer
token and permission checks. Collection endpoints use `limit` and `offset`
pagination (maximum `limit` 100); monetary values are persisted as PostgreSQL
`NUMERIC`, not floating-point columns.

| Area | Endpoints |
| --- | --- |
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Organization | `GET/PATCH /organization`, `GET/POST /departments`, `GET/POST /cost-centers` |
| Users and roles | `GET/POST /users`, `GET/PATCH /users/:id`, `PUT /users/:id/roles`, `PUT /users/:id/password`; `GET/POST /roles`, `PATCH/DELETE /roles/:id` |
| Purchase requests | `GET/POST /purchase-requests`, `GET/PATCH /purchase-requests/:id`, `POST /:id/submit`, `POST /:id/cancel` |
| Approvals/workflows | Workflow definitions and versions, activation, pending tasks, approval actions at `/approvals` |
| Suppliers | `GET/POST /suppliers`, `GET/PATCH /suppliers/:id`, `POST /suppliers/:id/status` |
| Purchase orders | `GET/POST /purchase-orders`, `GET /:id`, `POST /:id/approve`, `POST /:id/issue`, `POST /:id/acknowledge` |
| Goods receipts | `GET/POST /purchase-orders/:purchaseOrderId/receipts`, `POST /:purchaseOrderId/receipts/:receiptId/post` |
| Invoices | `GET/POST /invoices`, `GET /:id`, `POST /:id/validate`, `POST /:id/approve`, `POST /:id/payment-ready`, `POST /:id/mark-paid` |
| Budgets | `GET/POST /budgets`, `PATCH /budgets/:id` |
| Analytics | `GET /analytics/summary` |
| Audit | `GET /audit-events` |
| Contracts | `GET/POST /contracts`, `GET/PATCH/DELETE /contracts/:id`, `POST /contracts/:id/status` |
| Billing | `GET/PUT/PATCH /billing/account`, `PATCH /billing/account/status`, `GET/POST /billing/entitlements`, `PATCH/DELETE /billing/entitlements/:id` |
| Webhooks | `GET/POST /webhooks`, `GET/PATCH/DELETE /webhooks/:id`, `GET /webhooks/:id/deliveries`, `GET /webhooks/:id/deliveries/:deliveryId/attempts`, `POST /webhooks/:id/deliveries/:deliveryId/replay` |
| Notifications | `GET /notifications`, `GET /notifications/:id`, `PATCH /notifications/:id/read` |
| Attachments | `GET/POST /purchase-requests/:id/attachments`, `DELETE /purchase-requests/:id/attachments/:attachmentId`; `GET/POST /suppliers/:id/documents`, `DELETE /suppliers/:id/documents/:documentId` |

Configure and activate a workflow for `purchase_request` before submitting
requests. Workflow graphs use `nodes` (`start`, `approval`, `end`) and directed
`edges`; approval nodes can optionally specify a tenant user `assigneeId`.
Workflow versions are immutable once created, and submitted requests retain
their selected definition/run.

The invoice API records invoice state and matching outcomes; `mark-paid` records
an external payment outcome and does not move funds or connect to a bank.
The billing API stores billing-account metadata and feature entitlements; it
does not integrate a payment processor. Webhook replay queues an existing
delivery for a worker and does not make an outbound request in the API process.
Matching audit actions are atomically written to the webhook delivery queue;
an asynchronous delivery worker is still required to sign and send requests.
Notification preferences are not available because the current database
schema has no preferences table. The API exposes the authenticated user's
in-app inbox and read state; email delivery requires an external worker.
File APIs register and manage object-storage metadata; they do not accept binary
uploads or generate download URLs. Upload files through your configured private
object-storage service, then register its tenant-prefixed storage key through
the API. The application must authorize reads before issuing short-lived signed
download URLs. Never expose raw storage keys as public URLs.

Role permissions are validated against the supported API permission set.
Organization administrator roles are system-managed and cannot be edited,
deleted, or granted to other users through role assignment.

## Database and tenant isolation

The schema includes 36 tenant-scoped tables for organization, supplier, request,
workflow, purchase-order, receipt, invoice, budget, contract, billing, webhook, notification,
idempotency, and audit data. Composite tenant foreign keys prevent relations
between different organizations. Indexes support tenant-filtered reads and status
queues.

Tenant-owned tables use row-level security. Every tenant transaction must use
`withTenantTransaction`, which sets `app.tenant_id` transaction-locally; absent,
empty, or malformed context fails closed. Keep database transactions short and
do not reuse a connection after bypassing this helper. Audit rows are
append-only at the database layer. Runtime database roles must not be PostgreSQL
superusers or have `BYPASSRLS`; policies are forced even when using the schema
owner role.

## Development checks

```powershell
npm run build
npm test
```

The API uses a common JSON error shape with a request ID. Validation failures
include field paths/codes; unknown routes return JSON `404` responses.
