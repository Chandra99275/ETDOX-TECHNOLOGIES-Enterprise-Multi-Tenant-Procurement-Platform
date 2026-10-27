
CREATE TABLE IF NOT EXISTS approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,
    request_id UUID NOT NULL
        REFERENCES procurement_requests(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL CHECK (step_number > 0),
    approver_role VARCHAR(50) NOT NULL
        CHECK (approver_role IN ('manager', 'finance', 'admin')),
    approver_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
    comment TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (request_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_org_status
    ON approval_steps(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_approval_steps_approver
    ON approval_steps(approver_id, status);

CREATE TABLE IF NOT EXISTS approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,
    request_id UUID NOT NULL
        REFERENCES procurement_requests(id) ON DELETE CASCADE,
    approval_step_id UUID REFERENCES approval_steps(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(30) NOT NULL
        CHECK (action IN (
            'submitted', 'approved', 'rejected',
            'returned', 'cancelled', 'commented'
        )),
    comment TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_history_request
    ON approval_history(request_id, created_at DESC);
