ALTER TABLE budgets ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS name VARCHAR(180);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS department VARCHAR(120);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS spent_amount NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS reserved_amount NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,
    name VARCHAR(180) NOT NULL,
    department VARCHAR(120) NOT NULL,
    fiscal_year INTEGER NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2200),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    allocated_amount NUMERIC(14, 2) NOT NULL
        CHECK (allocated_amount >= 0),
    spent_amount NUMERIC(14, 2) NOT NULL DEFAULT 0
        CHECK (spent_amount >= 0),
    reserved_amount NUMERIC(14, 2) NOT NULL DEFAULT 0
        CHECK (reserved_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'draft')),
    created_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, department, fiscal_year, name),
    UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS budget_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE RESTRICT,
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
    request_id UUID REFERENCES procurement_requests(id) ON DELETE RESTRICT,
    invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('reserve', 'release', 'expense', 'adjustment')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_org_year
    ON budgets(organization_id, fiscal_year, status);

CREATE INDEX IF NOT EXISTS idx_budget_transactions_budget
    ON budget_transactions(budget_id, created_at DESC);
