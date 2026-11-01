-- ============================================================
-- ETDOX - Initial Database Schema
-- File: 001_init.sql
-- PostgreSQL 16+
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tenants
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tenants_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);

-- ------------------------------------------------------------
-- 2. Roles
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. Users
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES public.tenants(id),

    name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),

    CONSTRAINT users_tenant_email_unique
        UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id
    ON public.users (tenant_id);

CREATE INDEX IF NOT EXISTS idx_users_email
    ON public.users (LOWER(email));

-- ------------------------------------------------------------
-- 4. User-role assignments
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    role_id UUID NOT NULL
        REFERENCES public.roles(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, role_id)
);

-- ------------------------------------------------------------
-- 5. Purchase requests
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES public.tenants(id),

    requested_by UUID
        REFERENCES public.users(id),

    title VARCHAR(150) NOT NULL,
    description TEXT,

    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT purchase_requests_amount_check
        CHECK (amount >= 0),

    CONSTRAINT purchase_requests_status_check
        CHECK (
            status IN (
                'DRAFT',
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_tenant
    ON public.purchase_requests (tenant_id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_status
    ON public.purchase_requests (tenant_id, status);

-- ------------------------------------------------------------
-- 6. Budgets
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES public.tenants(id),

    name VARCHAR(150) NOT NULL,
    description TEXT,

    allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    spent_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT budgets_amount_check
        CHECK (allocated_amount >= 0 AND spent_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_budgets_tenant
    ON public.budgets (tenant_id);

-- ------------------------------------------------------------
-- 7. Invoices
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES public.tenants(id),

    invoice_number VARCHAR(100) NOT NULL,
    supplier_name VARCHAR(200),

    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT invoices_amount_check
        CHECK (amount >= 0),

    CONSTRAINT invoices_tenant_number_unique
        UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant
    ON public.invoices (tenant_id);

CREATE INDEX IF NOT EXISTS idx_invoices_status
    ON public.invoices (tenant_id, status);

-- ------------------------------------------------------------
-- 8. Goods receipt items
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES public.tenants(id),

    purchase_request_id UUID
        REFERENCES public.purchase_requests(id),

    item_name VARCHAR(200) NOT NULL,
    quantity NUMERIC(15, 3) NOT NULL DEFAULT 1,

    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT goods_receipt_quantity_check
        CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_goods_receipt_tenant
    ON public.goods_receipt_items (tenant_id);

-- ------------------------------------------------------------
-- 9. Migration tracking
-- ------------------------------------------------------------
-- This table definition is used only when the table does not exist.
-- Existing tracking tables are not altered here.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    migration_name TEXT PRIMARY KEY,
    checksum TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;