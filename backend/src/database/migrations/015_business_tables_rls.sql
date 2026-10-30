-- 015_business_tables_rls.sql
-- Allow backend application connection queries to operate with explicit WHERE tenant_id = $1
-- while strictly enforcing tenant isolation whenever app.tenant_id context is configured.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'departments',
    'cost_centers',
    'suppliers',
    'purchase_requests',
    'purchase_request_items',
    'purchase_request_attachments',
    'purchase_orders',
    'purchase_order_items',
    'goods_receipts',
    'goods_receipt_items',
    'invoices',
    'invoice_items',
    'budgets',
    'budget_transactions',
    'audit_events',
    'notifications',
    'approvals',
    'issues',
    'contracts',
    'webhooks'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id()) WITH CHECK (app_current_tenant_id() IS NULL OR tenant_id = app_current_tenant_id())',
        tbl
      );
    END IF;
  END LOOP;
END;
$$;

