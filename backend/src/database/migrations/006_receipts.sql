
CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(50) NOT NULL,
    purchase_order_id UUID NOT NULL
        REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    received_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'partial', 'rejected', 'cancelled')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, receipt_number),
    UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id UUID NOT NULL
        REFERENCES goods_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NOT NULL
        REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
    quantity_received NUMERIC(12, 2) NOT NULL
        CHECK (quantity_received > 0),
    quantity_accepted NUMERIC(12, 2) NOT NULL
        CHECK (quantity_accepted >= 0),
    quantity_rejected NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (quantity_rejected >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (quantity_accepted + quantity_rejected <= quantity_received),

    -- Required when another table references this composite key.
    UNIQUE (goods_receipt_id, purchase_order_item_id),
    UNIQUE (goods_receipt_id, id)
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_org_date
    ON goods_receipts(organization_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipt_items_order_item
    ON goods_receipt_items(purchase_order_item_id);
