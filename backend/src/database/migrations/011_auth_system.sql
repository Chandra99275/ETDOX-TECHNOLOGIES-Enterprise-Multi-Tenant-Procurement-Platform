-- 011_auth_system.sql
-- Complete Authentication, Email Verification, Password Reset, and ETDOX Role definitions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE'
      CHECK (status IN ('ACTIVE', 'PENDING_VERIFICATION', 'PENDING_APPROVAL', 'SUSPENDED', 'DISABLED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'requested_role'
  ) THEN
    ALTER TABLE users ADD COLUMN requested_role text;
  END IF;
END $$;

-- Email Verifications Table
CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verif_token ON email_verifications(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verifications(user_id);

-- Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- Organization Invitations Table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_name text NOT NULL,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_email ON invitations(tenant_id, email);

-- Standard ETDOX Roles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'roles'
  ) THEN
    -- Check if roles table has tenant_id or global
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'tenant_id'
    ) THEN
      -- Roles are tenant-scoped in schema.sql
      NULL;
    ELSE
      -- Roles are global in 002_users_and_roles.sql
      INSERT INTO roles (name, description)
      VALUES
        ('requester', 'Creates purchase requests and tracks receipt'),
        ('department_manager', 'Reviews and approves team procurement requests'),
        ('procurement_specialist', 'Manages vendor quotes, PO generation, and sourcing'),
        ('procurement_manager', 'Oversees procurement operations and large approval thresholds'),
        ('finance_manager', 'Reviews 3-way matching and invoice disbursement approvals'),
        ('organization_admin', 'Full administrator for the tenant organization'),
        ('auditor', 'Read-only access across procurement, audit trail, and compliance'),
        ('supplier_user', 'Supplier portal access for orders and invoices')
      ON CONFLICT (name) DO NOTHING;
    END IF;
  END IF;
END $$;
