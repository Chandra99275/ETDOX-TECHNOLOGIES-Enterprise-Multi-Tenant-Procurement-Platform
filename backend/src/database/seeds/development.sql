-- ============================================================
-- ETDOX - Development Seed Data
-- File: seeds/development.sql
--
-- Development environments only.
-- Does not reset existing user passwords.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Demo tenant
-- ------------------------------------------------------------

INSERT INTO public.tenants (
    id,
    name,
    slug,
    status
)
VALUES (
    'b4383f9e-8e4a-42d7-9d34-ba59e5ea9a9e',
    'ETDOX Demo',
    'etdox-demo',
    'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Demo roles
-- ------------------------------------------------------------

INSERT INTO public.roles (
    name,
    description
)
VALUES
    ('admin', 'Tenant administrator'),
    ('employee', 'Employee access'),
    ('manager', 'Manager and approval access'),
    ('finance', 'Finance and invoice access')
ON CONFLICT (name) DO NOTHING;

COMMIT;