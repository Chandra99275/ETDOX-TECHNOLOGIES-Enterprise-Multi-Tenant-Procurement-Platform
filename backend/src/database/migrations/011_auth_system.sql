-- ============================================================
-- ETDOX - Authentication System
-- File: 011_auth_system.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Ensure standard roles exist
-- ------------------------------------------------------------

INSERT INTO public.roles (name, description)
VALUES
    ('admin', 'Tenant administrator'),
    ('employee', 'Employee access'),
    ('manager', 'Manager and approval access'),
    ('finance', 'Finance and invoice access')
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Authentication-related user fields
-- ------------------------------------------------------------

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER
        NOT NULL DEFAULT 0;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 3. User lookup indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_tenant_email_lower
    ON public.users (tenant_id, LOWER(email));

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
    ON public.user_roles (role_id);

-- ------------------------------------------------------------
-- 4. Authentication schema checks
-- ------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass
          AND conname = 'users_failed_login_attempts_check'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_failed_login_attempts_check
            CHECK (failed_login_attempts >= 0);
    END IF;
END;
$$;

COMMIT;