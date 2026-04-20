-- ============================================================
-- SECURITY HARDENING MIGRATION
-- Run ONCE on production Supabase (already applied April 2026)
-- ============================================================

-- 1. REVOKE all table privileges from anon role
--    RLS is enabled, but defense-in-depth: anon should have ZERO table access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- 2. REVOKE all function execute from PUBLIC and anon
--    Only authenticated (logged-in) users should call RPCs
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- 3. GRANT function execute only to authenticated role
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION update_employee_profile(text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_employee_profile_v2(text,text,text,text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_employee(text,text,text,text,text,text,text,text,numeric,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_employee_v2(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text,text,text,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_leave_request(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payroll_batch(integer,integer) TO authenticated;

-- 4. Set secure default for future functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- 5. Revoke schema CREATE from anon
REVOKE CREATE ON SCHEMA public FROM anon;
