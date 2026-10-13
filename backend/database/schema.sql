-- ETDOX procurement schema. Safe to apply repeatedly; schema changes after this
-- initial version should be delivered in subsequent migrations.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.tenant_id', true), '')::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION app_enqueue_webhook_deliveries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO webhook_deliveries (tenant_id, webhook_id, event_id, event_type, payload, next_attempt_at)
  SELECT NEW.tenant_id, w.id, NEW.id, NEW.action,
         jsonb_build_object(
           'eventId', NEW.id,
           'tenantId', NEW.tenant_id,
           'actor', jsonb_build_object('type', NEW.actor_type, 'id', NEW.actor_id),
           'action', NEW.action,
           'resource', jsonb_build_object('type', NEW.resource_type, 'id', NEW.resource_id),
           'timestamp', NEW.created_at,
           'metadata', NEW.metadata
         ),
         now()
  FROM webhooks w
  WHERE w.tenant_id = NEW.tenant_id
    AND w.status = 'ACTIVE'
    AND NEW.action = ANY(w.subscribed_events)
  ON CONFLICT (tenant_id, webhook_id, event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  base_currency char(3) NOT NULL DEFAULT 'USD' CHECK (base_currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  email text NOT NULL,
  password_hash text,
  first_name text,
  last_name text,
  title text,
  phone text,
  department_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  permissions text[] NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  manager_id uuid,
  parent_department_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, manager_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL (manager_id),
  FOREIGN KEY (tenant_id, parent_department_id) REFERENCES departments(tenant_id, id) ON DELETE SET NULL (parent_department_id)
);

CREATE TABLE IF NOT EXISTS cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  department_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id) ON DELETE SET NULL (department_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_department_tenant_fk'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_department_tenant_fk
      FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id) ON DELETE SET NULL (department_id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS user_roles (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, role_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, role_id) REFERENCES roles(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, assigned_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (assigned_by)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_code text NOT NULL,
  legal_name text NOT NULL,
  trading_name text,
  tax_identifier text,
  registration_number text,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payment_terms text,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','ACTIVE','SUSPENDED','REJECTED','ARCHIVED')),
  onboarding_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (onboarding_status IN ('NOT_STARTED','IN_PROGRESS','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED')),
  onboarding_submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  risk_rating text CHECK (risk_rating IS NULL OR risk_rating IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, supplier_code),
  FOREIGN KEY (tenant_id, reviewed_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (reviewed_by)
);

CREATE TABLE IF NOT EXISTS supplier_onboarding_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL,
  section_key text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETE','REJECTED')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, supplier_id, section_key),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL,
  document_type text NOT NULL,
  file_name text NOT NULL,
  storage_key text NOT NULL,
  content_type text,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  expires_on date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, uploaded_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (uploaded_by)
);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  resource_type text NOT NULL,
  graph jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name, version),
  FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (created_by)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','APPROVED','REJECTED','CANCELLED','FAILED')),
  active_node text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, definition_id) REFERENCES workflow_definitions(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_number text NOT NULL,
  requester_id uuid NOT NULL,
  department_id uuid,
  cost_center_id uuid,
  preferred_supplier_id uuid,
  workflow_run_id uuid,
  required_by_date date,
  justification text,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(19,4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total numeric(19,4) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','IN_APPROVAL','APPROVED','REJECTED','CHANGES_REQUESTED','CANCELLED','CONVERTED_TO_PO')),
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, request_number),
  FOREIGN KEY (tenant_id, requester_id) REFERENCES users(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id) ON DELETE SET NULL (department_id),
  FOREIGN KEY (tenant_id, cost_center_id) REFERENCES cost_centers(tenant_id, id) ON DELETE SET NULL (cost_center_id),
  FOREIGN KEY (tenant_id, preferred_supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE SET NULL (preferred_supplier_id),
  FOREIGN KEY (tenant_id, workflow_run_id) REFERENCES workflow_runs(tenant_id, id) ON DELETE SET NULL (workflow_run_id)
);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_request_id uuid NOT NULL,
  line_number integer NOT NULL CHECK (line_number > 0),
  description text NOT NULL,
  quantity numeric(19,4) NOT NULL CHECK (quantity > 0),
  unit_of_measure text,
  unit_price numeric(19,4) NOT NULL CHECK (unit_price >= 0),
  tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  category text,
  line_total numeric(19,4) NOT NULL CHECK (line_total >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, purchase_request_id, line_number),
  FOREIGN KEY (tenant_id, purchase_request_id) REFERENCES purchase_requests(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_request_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_key text NOT NULL,
  content_type text,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, purchase_request_id) REFERENCES purchase_requests(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, uploaded_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (uploaded_by)
);

CREATE TABLE IF NOT EXISTS approval_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_run_id uuid NOT NULL,
  node_id text NOT NULL,
  assignee_id uuid,
  delegated_from uuid,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CHANGES_REQUESTED','CANCELLED','SKIPPED')),
  action text,
  comment text,
  due_at timestamptz,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, workflow_run_id) REFERENCES workflow_runs(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, assignee_id) REFERENCES users(tenant_id, id) ON DELETE SET NULL (assignee_id),
  FOREIGN KEY (tenant_id, delegated_from) REFERENCES users(tenant_id, id) ON DELETE SET NULL (delegated_from)
);

CREATE TABLE IF NOT EXISTS approval_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  delegator_id uuid NOT NULL,
  delegate_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (delegator_id <> delegate_id),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, delegator_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, delegate_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_number text NOT NULL,
  purchase_request_id uuid,
  supplier_id uuid NOT NULL,
  payment_terms text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(19,4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total numeric(19,4) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','ISSUED','ACKNOWLEDGED','PARTIALLY_RECEIVED','RECEIVED','COMPLETED','CLOSED','CANCELLED')),
  issued_version integer CHECK (issued_version IS NULL OR issued_version > 0),
  issued_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, po_number),
  FOREIGN KEY (tenant_id, purchase_request_id) REFERENCES purchase_requests(tenant_id, id) ON DELETE SET NULL (purchase_request_id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (created_by)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL,
  source_request_item_id uuid,
  line_number integer NOT NULL CHECK (line_number > 0),
  description text NOT NULL,
  quantity numeric(19,4) NOT NULL CHECK (quantity > 0),
  unit_of_measure text,
  unit_price numeric(19,4) NOT NULL CHECK (unit_price >= 0),
  tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  line_total numeric(19,4) NOT NULL CHECK (line_total >= 0),
  quantity_received numeric(19,4) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_invoiced numeric(19,4) NOT NULL DEFAULT 0 CHECK (quantity_invoiced >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, purchase_order_id, line_number),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES purchase_orders(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, source_request_item_id) REFERENCES purchase_request_items(tenant_id, id) ON DELETE SET NULL (source_request_item_id)
);

CREATE TABLE IF NOT EXISTS purchase_order_issued_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  snapshot jsonb NOT NULL,
  content_hash text,
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, purchase_order_id, version),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES purchase_orders(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, issued_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (issued_by)
);

CREATE TABLE IF NOT EXISTS purchase_order_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL,
  amendment_number integer NOT NULL CHECK (amendment_number > 0),
  reason text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','APPLIED','CANCELLED')),
  created_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, purchase_order_id, amendment_number),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES purchase_orders(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (created_by),
  FOREIGN KEY (tenant_id, approved_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (approved_by)
);

CREATE TABLE IF NOT EXISTS purchase_order_amendment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amendment_id uuid NOT NULL,
  purchase_order_item_id uuid,
  action text NOT NULL CHECK (action IN ('ADD','UPDATE','REMOVE')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, amendment_id) REFERENCES purchase_order_amendments(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, purchase_order_item_id) REFERENCES purchase_order_items(tenant_id, id) ON DELETE SET NULL (purchase_order_item_id)
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  purchase_order_id uuid NOT NULL,
  delivery_note_reference text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','REVERSED')),
  received_at timestamptz,
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, receipt_number),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES purchase_orders(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, received_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (received_by)
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  goods_receipt_id uuid NOT NULL,
  purchase_order_item_id uuid NOT NULL,
  quantity_received numeric(19,4) NOT NULL CHECK (quantity_received > 0),
  condition text CHECK (condition IS NULL OR condition IN ('ACCEPTED','DAMAGED','REJECTED','PARTIAL')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, goods_receipt_id) REFERENCES goods_receipts(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, purchase_order_item_id) REFERENCES purchase_order_items(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL,
  purchase_order_id uuid,
  invoice_number text NOT NULL,
  issue_date date,
  due_date date,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(19,4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total numeric(19,4) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total_amount numeric(19,4) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','VALIDATING','EXCEPTION','PENDING_APPROVAL','APPROVED','PAYMENT_READY','PAID','CLOSED','VOID')),
  matching_outcome jsonb,
  external_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, supplier_id, invoice_number),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES purchase_orders(tenant_id, id) ON DELETE SET NULL (purchase_order_id),
  CHECK (due_date IS NULL OR issue_date IS NULL OR due_date >= issue_date)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  purchase_order_item_id uuid,
  line_number integer NOT NULL CHECK (line_number > 0),
  description text,
  quantity numeric(19,4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(19,4) NOT NULL CHECK (unit_price >= 0),
  tax_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total numeric(19,4) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, invoice_id, line_number),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, purchase_order_item_id) REFERENCES purchase_order_items(tenant_id, id) ON DELETE SET NULL (purchase_order_item_id)
);

CREATE TABLE IF NOT EXISTS invoice_match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  invoice_item_id uuid,
  purchase_order_item_id uuid,
  goods_receipt_item_id uuid,
  match_type text NOT NULL CHECK (match_type IN ('TWO_WAY','THREE_WAY','DUPLICATE','SUPPLIER','CURRENCY','PRICE','QUANTITY','OTHER')),
  outcome text NOT NULL CHECK (outcome IN ('MATCHED','EXCEPTION','NOT_APPLICABLE')),
  expected_amount numeric(19,4),
  actual_amount numeric(19,4),
  variance_amount numeric(19,4),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, invoice_item_id) REFERENCES invoice_items(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, purchase_order_item_id) REFERENCES purchase_order_items(tenant_id, id) ON DELETE SET NULL (purchase_order_item_id),
  FOREIGN KEY (tenant_id, goods_receipt_item_id) REFERENCES goods_receipt_items(tenant_id, id) ON DELETE SET NULL (goods_receipt_item_id)
);

CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  department_id uuid,
  cost_center_id uuid,
  fiscal_year integer NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 9999),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  allocated numeric(19,4) NOT NULL CHECK (allocated >= 0),
  reserved numeric(19,4) NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  committed numeric(19,4) NOT NULL DEFAULT 0 CHECK (committed >= 0),
  spent numeric(19,4) NOT NULL DEFAULT 0 CHECK (spent >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id) ON DELETE SET NULL (department_id),
  FOREIGN KEY (tenant_id, cost_center_id) REFERENCES cost_centers(tenant_id, id) ON DELETE SET NULL (cost_center_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_type text NOT NULL CHECK (actor_type IN ('USER','SYSTEM','API_KEY','SUPPLIER')),
  actor_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  request_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid,
  channel text NOT NULL CHECK (channel IN ('IN_APP','EMAIL','WEBHOOK')),
  event_type text NOT NULL,
  subject text,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED','READ','CANCELLED')),
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 255),
  request_hash text NOT NULL,
  response_status integer CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  endpoint_url text NOT NULL CHECK (endpoint_url ~ '^https://'),
  secret_encrypted text NOT NULL,
  subscribed_events text[] NOT NULL CHECK (cardinality(subscribed_events) > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','DISABLED')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name),
  FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (created_by)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL,
  event_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DELIVERED','FAILED','ABANDONED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, webhook_id, event_id),
  FOREIGN KEY (tenant_id, webhook_id) REFERENCES webhooks(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  response_status integer CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  response_excerpt text,
  error text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, delivery_id, attempt_number),
  FOREIGN KEY (tenant_id, delivery_id) REFERENCES webhook_deliveries(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL,
  contract_number text NOT NULL,
  title text NOT NULL,
  description text,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  contract_value numeric(19,4) CHECK (contract_value IS NULL OR contract_value >= 0),
  starts_on date,
  ends_on date,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','ACTIVE','EXPIRED','TERMINATED','CLOSED')),
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_storage_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, contract_number),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id) ON DELETE SET NULL (created_by),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  provider text,
  provider_customer_id text,
  billing_email text,
  billing_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAST_DUE','SUSPENDED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (provider, provider_customer_id)
);

CREATE TABLE IF NOT EXISTS entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  value jsonb NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, entitlement_key),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS users_tenant_active_idx ON users (tenant_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_uq ON users (tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS departments_tenant_active_idx ON departments (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS cost_centers_tenant_department_idx ON cost_centers (tenant_id, department_id);
CREATE INDEX IF NOT EXISTS suppliers_tenant_status_idx ON suppliers (tenant_id, status);
CREATE INDEX IF NOT EXISTS supplier_documents_expiry_idx ON supplier_documents (tenant_id, expires_on) WHERE expires_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS workflow_definitions_active_idx ON workflow_definitions (tenant_id, resource_type, is_active);
CREATE INDEX IF NOT EXISTS workflow_runs_resource_idx ON workflow_runs (tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS workflow_runs_status_idx ON workflow_runs (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_requests_status_idx ON purchase_requests (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_requests_requester_idx ON purchase_requests (tenant_id, requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_requests_department_idx ON purchase_requests (tenant_id, department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_request_items_request_idx ON purchase_request_items (tenant_id, purchase_request_id);
CREATE INDEX IF NOT EXISTS approval_tasks_assignee_status_idx ON approval_tasks (tenant_id, assignee_id, status, due_at);
CREATE INDEX IF NOT EXISTS approval_tasks_run_idx ON approval_tasks (tenant_id, workflow_run_id);
CREATE INDEX IF NOT EXISTS approval_delegations_active_idx ON approval_delegations (tenant_id, delegator_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON purchase_orders (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx ON purchase_orders (tenant_id, supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_order_items_order_idx ON purchase_order_items (tenant_id, purchase_order_id);
CREATE INDEX IF NOT EXISTS po_snapshots_order_idx ON purchase_order_issued_snapshots (tenant_id, purchase_order_id, version DESC);
CREATE INDEX IF NOT EXISTS po_amendments_order_status_idx ON purchase_order_amendments (tenant_id, purchase_order_id, status);
CREATE INDEX IF NOT EXISTS goods_receipts_order_idx ON goods_receipts (tenant_id, purchase_order_id, received_at DESC);
CREATE INDEX IF NOT EXISTS goods_receipt_items_order_item_idx ON goods_receipt_items (tenant_id, purchase_order_item_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_supplier_date_idx ON invoices (tenant_id, supplier_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS invoices_po_idx ON invoices (tenant_id, purchase_order_id);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items (tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS invoice_match_invoice_idx ON invoice_match_results (tenant_id, invoice_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS budgets_year_idx ON budgets (tenant_id, fiscal_year);
CREATE UNIQUE INDEX IF NOT EXISTS budgets_dimensions_uq ON budgets
  (tenant_id, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
   COALESCE(cost_center_id, '00000000-0000-0000-0000-000000000000'::uuid), fiscal_year, currency);
CREATE INDEX IF NOT EXISTS audit_events_resource_idx ON audit_events (tenant_id, resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON audit_events (tenant_id, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_inbox_idx ON notifications (tenant_id, user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idempotency_expiry_idx ON idempotency_keys (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS webhooks_active_idx ON webhooks (tenant_id, status);
CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx ON webhook_deliveries (tenant_id, status, next_attempt_at) WHERE status IN ('PENDING','FAILED');
CREATE INDEX IF NOT EXISTS webhook_attempts_delivery_idx ON webhook_delivery_attempts (tenant_id, delivery_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS contracts_supplier_status_idx ON contracts (tenant_id, supplier_id, status, ends_on);
CREATE INDEX IF NOT EXISTS entitlements_active_idx ON entitlements (tenant_id, entitlement_key, ends_at);

-- Recreate triggers so this script also repairs a partially initialized database.
DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION app_reject_audit_mutation();
DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events;
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION app_reject_audit_mutation();
DROP TRIGGER IF EXISTS po_snapshots_no_update ON purchase_order_issued_snapshots;
CREATE TRIGGER po_snapshots_no_update BEFORE UPDATE OR DELETE ON purchase_order_issued_snapshots
  FOR EACH ROW EXECUTE FUNCTION app_reject_audit_mutation();
DROP TRIGGER IF EXISTS po_snapshots_no_truncate ON purchase_order_issued_snapshots;
CREATE TRIGGER po_snapshots_no_truncate BEFORE TRUNCATE ON purchase_order_issued_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION app_reject_audit_mutation();
DROP TRIGGER IF EXISTS audit_events_enqueue_webhooks ON audit_events;
CREATE TRIGGER audit_events_enqueue_webhooks AFTER INSERT ON audit_events
  FOR EACH ROW EXECUTE FUNCTION app_enqueue_webhook_deliveries();

DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = current_schema()
      AND c.column_name = 'updated_at'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at()', table_name);
  END LOOP;
END;
$$;

-- Every tenant-owned table is protected. An absent, empty, or malformed
-- app.tenant_id resolves to NULL and therefore matches no tenant rows.
DO $$
DECLARE
  table_name text;
  tenant_column text;
BEGIN
  FOR table_name, tenant_column IN
    SELECT t.table_name, 'tenant_id'
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON c.table_schema = t.table_schema AND c.table_name = t.table_name
    WHERE t.table_schema = current_schema()
      AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
    HAVING bool_or(c.column_name = 'tenant_id')
    UNION ALL
    SELECT 'tenants', 'id'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (%I = app_current_tenant_id()) WITH CHECK (%I = app_current_tenant_id())',
      table_name, tenant_column, tenant_column
    );
  END LOOP;
END;
$$;
