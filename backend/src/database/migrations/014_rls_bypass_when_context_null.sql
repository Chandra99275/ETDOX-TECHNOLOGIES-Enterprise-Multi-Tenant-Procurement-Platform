-- 014_rls_bypass_when_context_null.sql
-- Allow auth lookups (login by email, token verification) when app.tenant_id is not yet set,
-- while strictly enforcing tenant isolation whenever app.tenant_id is set.

DO $$
DECLARE
  tbl text;
BEGIN
  -- Update policy for tenants and organizations
  FOR tbl IN SELECT unnest(ARRAY['tenants', 'organizations'])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (app_current_tenant_id() IS NULL OR id = app_current_tenant_id()) WITH CHECK (app_current_tenant_id() IS NULL OR id = app_current_tenant_id())',
        tbl
      );
    END IF;
  END LOOP;

  -- Update policy for users, roles, user_roles, user_sessions, invitations
  FOR tbl IN SELECT unnest(ARRAY['users', 'roles', 'user_roles', 'user_sessions', 'invitations'])
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
