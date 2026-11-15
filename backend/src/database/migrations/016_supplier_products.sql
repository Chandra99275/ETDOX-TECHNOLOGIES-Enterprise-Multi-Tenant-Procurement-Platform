
-- ============================================================
-- ETDOX: SUPPLIER PRODUCT CATALOG
-- Tenant-isolated, supplier-owned product records
-- ============================================================

CREATE TABLE IF NOT EXISTS public.supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL,
    supplier_id UUID NOT NULL,

    sku VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,

    category VARCHAR(120),
    brand VARCHAR(120),

    unit_of_measure VARCHAR(40) NOT NULL DEFAULT 'unit',

    unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0
        CHECK (unit_price >= 0),

    currency CHAR(3) NOT NULL DEFAULT 'INR',

    stock_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),

    minimum_order_quantity NUMERIC(14, 2) NOT NULL DEFAULT 1
        CHECK (minimum_order_quantity > 0),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK')),

    image_url TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT supplier_products_supplier_fk
        FOREIGN KEY (tenant_id, supplier_id)
        REFERENCES public.suppliers (tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT supplier_products_tenant_sku_unique
        UNIQUE (tenant_id, supplier_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier
    ON public.supplier_products (tenant_id, supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_status
    ON public.supplier_products (tenant_id, supplier_id, status);

CREATE INDEX IF NOT EXISTS idx_supplier_products_name
    ON public.supplier_products (tenant_id, lower(name));

-- Keep updated_at current when a product is changed.
CREATE OR REPLACE FUNCTION public.set_supplier_product_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_products_updated_at
    ON public.supplier_products;

CREATE TRIGGER trg_supplier_products_updated_at
BEFORE UPDATE ON public.supplier_products
FOR EACH ROW
EXECUTE FUNCTION public.set_supplier_product_updated_at();

-- Enable row-level security.
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_products_tenant_isolation
    ON public.supplier_products;

CREATE POLICY supplier_products_tenant_isolation
    ON public.supplier_products
    USING (tenant_id = public.app_current_tenant_id())
    WITH CHECK (tenant_id = public.app_current_tenant_id());
