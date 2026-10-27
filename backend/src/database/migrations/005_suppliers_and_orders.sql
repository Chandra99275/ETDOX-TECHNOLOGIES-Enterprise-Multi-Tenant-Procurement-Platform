
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,
    supplier_code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(160),
    email VARCHAR(255),
    phone VARCHAR(40),
    address TEXT,
    tax_id VARCHAR(80),
    payment_terms VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, supplier_code),
    UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,
    order_number VARCHAR(50) NOT NULL,
    request_id UUID REFERENCES procurement_requests(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (status IN (
            'draft', 'issued', 'acknowledged',
            'partially_received', 'received',
            'cancelled', 'closed'
        )),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    ordered_at TIMESTAMPTZ,
    expected_delivery DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, order_number),
    UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL
        REFERENCES purchase_orders(id) ON DELETE CASCADE,
    request_item_id UUID REFERENCES procurement_request_items(id)
        ON DELETE SET NULL,
    item_name VARCHAR(200) NOT NULL,
    description TEXT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(40) NOT NULL DEFAULT 'unit',
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    tax_rate NUMERIC(6, 3) NOT NULL DEFAULT 0
        CHECK (tax_rate >= 0 AND tax_rate <= 100),
    line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (purchase_order_id, id)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org_status
    ON suppliers(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_status
    ON purchase_orders(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order
    ON purchase_order_items(purchase_order_id);
