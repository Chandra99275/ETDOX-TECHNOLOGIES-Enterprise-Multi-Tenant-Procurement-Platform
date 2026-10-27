
CREATE TABLE IF NOT EXISTS procurement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,
    request_number VARCHAR(40) NOT NULL,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    department VARCHAR(120),
    category VARCHAR(120),
    justification TEXT,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    estimated_amount NUMERIC(14, 2) NOT NULL
        CHECK (estimated_amount >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'draft', 'pending', 'manager_approved',
            'manager_rejected', 'finance_approved',
            'finance_rejected', 'approved', 'rejected',
            'ordered', 'partially_received', 'received',
            'cancelled'
        )),
    manager_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    manager_decision VARCHAR(20)
        CHECK (manager_decision IN ('approved', 'rejected')),
    manager_comment TEXT,
    manager_decided_at TIMESTAMPTZ,
    finance_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    finance_decision VARCHAR(20)
        CHECK (finance_decision IN ('approved', 'rejected')),
    finance_comment TEXT,
    finance_decided_at TIMESTAMPTZ,
    needed_by DATE,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, request_number),
    UNIQUE (organization_id, id)
);

CREATE INDEX IF NOT EXISTS idx_procurement_org_status
    ON procurement_requests(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_requester
    ON procurement_requests(requester_id, created_at DESC);

CREATE TABLE IF NOT EXISTS procurement_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL
        REFERENCES procurement_requests(id) ON DELETE CASCADE,
    item_name VARCHAR(200) NOT NULL,
    description TEXT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(40) NOT NULL DEFAULT 'unit',
    estimated_unit_price NUMERIC(14, 2) NOT NULL
        CHECK (estimated_unit_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (request_id, id)
);

CREATE INDEX IF NOT EXISTS idx_request_items_request
    ON procurement_request_items(request_id);
