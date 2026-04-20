-- ============================================================
-- Payroll RMS - Supabase Database Schema (Production)
-- Run this in Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'hr_admin' CHECK (role IN ('super_admin', 'hr_admin')),
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth DATE,
    address TEXT,
    department VARCHAR(100),
    designation VARCHAR(100),
    joining_date DATE,
    basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    bank_account VARCHAR(50),
    pan_no VARCHAR(20),
    pf_no VARCHAR(30),
    emergency_name VARCHAR(200),
    emergency_phone VARCHAR(20),
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_credentials (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'halfday')),
    check_in TIME,
    check_out TIME,
    total_hours DECIMAL(5,2),
    marked_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    duration INT NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    approved_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_balances (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    year INT NOT NULL,
    sick_leave INT NOT NULL DEFAULT 12,
    casual_leave INT NOT NULL DEFAULT 10,
    earned_leave INT NOT NULL DEFAULT 8,
    used_sick INT NOT NULL DEFAULT 0,
    used_casual INT NOT NULL DEFAULT 0,
    used_earned INT NOT NULL DEFAULT 0,
    UNIQUE(employee_id, year)
);

CREATE TABLE IF NOT EXISTS payroll (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    basic_salary DECIMAL(12,2) DEFAULT 0.00,
    hra DECIMAL(12,2) DEFAULT 0.00,
    special_allowance DECIMAL(12,2) DEFAULT 0.00,
    conveyance_allowance DECIMAL(12,2) DEFAULT 0.00,
    medical_allowance DECIMAL(12,2) DEFAULT 0.00,
    performance_bonus DECIMAL(12,2) DEFAULT 0.00,
    festival_bonus DECIMAL(12,2) DEFAULT 0.00,
    other_earnings DECIMAL(12,2) DEFAULT 0.00,
    bonus DECIMAL(12,2) DEFAULT 0.00,
    gross_earnings DECIMAL(12,2) DEFAULT 0.00,
    pf_deduction DECIMAL(12,2) DEFAULT 0.00,
    professional_tax DECIMAL(12,2) DEFAULT 0.00,
    tds DECIMAL(12,2) DEFAULT 0.00,
    esic_deduction DECIMAL(12,2) DEFAULT 0.00,
    loan_deduction DECIMAL(12,2) DEFAULT 0.00,
    other_deductions DECIMAL(12,2) DEFAULT 0.00,
    total_deductions DECIMAL(12,2) DEFAULT 0.00,
    net_salary DECIMAL(12,2) DEFAULT 0.00,
    working_days INT DEFAULT 22,
    days_present INT DEFAULT 22,
    status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, month, year)
);

CREATE TABLE IF NOT EXISTS company_settings (
    id BIGSERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'text',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. SECURITY DEFINER HELPER FUNCTIONS
--    These bypass RLS internally, preventing infinite recursion
--    on self-referencing policies (admin_users checks admin_users).
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE auth_uid = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT ec.employee_id INTO v_id
  FROM public.employee_credentials ec
  WHERE ec.auth_uid = auth.uid();
  RETURN v_id;
END;
$$;

-- ============================================================
-- 3. REGISTRATION RPC FUNCTIONS (SECURITY DEFINER)
--    Called from the React app via supabase.rpc().
--    These run with elevated privileges.
-- ============================================================

-- 3.1 Admin-creates-employee (auth user + employee + credentials + leave balance)
--     Only callable by admins. Creates the Supabase Auth user server-side
--     so the admin never needs to sign out / sign back in.
CREATE OR REPLACE FUNCTION public.admin_create_employee(
  p_first_name   TEXT,
  p_last_name    TEXT,
  p_email        TEXT,
  p_password     TEXT,
  p_phone        TEXT DEFAULT NULL,
  p_department   TEXT DEFAULT NULL,
  p_designation  TEXT DEFAULT NULL,
  p_joining_date TEXT DEFAULT NULL,
  p_basic_salary NUMERIC DEFAULT 0,
  p_gender       TEXT DEFAULT NULL,
  p_bank_account TEXT DEFAULT NULL,
  p_pan_no       TEXT DEFAULT NULL,
  p_pf_no        TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid  UUID;
  v_emp_pk    BIGINT;
  v_next_num  INT;
  v_emp_id    TEXT;
  v_username  TEXT;
  v_result    JSON;
BEGIN
  -- Only admins can call this
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied — admin only';
  END IF;

  -- Validate required fields
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Check email not already registered
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  -- 1. Create Supabase Auth user directly (server-side, no session switch)
  v_auth_uid := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_auth_uid,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', p_first_name || ' ' || p_last_name, 'role', 'employee'),
    NOW(), NOW(), '', ''
  );

  -- Also insert identity record (required for email/password login)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_auth_uid, v_auth_uid,
    jsonb_build_object('sub', v_auth_uid::TEXT, 'email', p_email),
    'email', v_auth_uid::TEXT,
    NOW(), NOW(), NOW()
  );

  -- 2. Generate employee ID (EMP-NNNN)
  SELECT COALESCE(MAX(id), 0) + 1001 INTO v_next_num FROM employees;
  v_emp_id := 'EMP-' || LPAD(v_next_num::TEXT, 4, '0');

  -- Username from email prefix
  v_username := split_part(p_email, '@', 1);

  -- 3. Insert employee record
  INSERT INTO employees (
    employee_id, first_name, last_name, email, phone,
    department, designation, joining_date, basic_salary,
    gender, bank_account, pan_no, pf_no
  ) VALUES (
    v_emp_id, p_first_name, p_last_name, p_email, p_phone,
    NULLIF(p_department, ''), NULLIF(p_designation, ''),
    CASE WHEN p_joining_date IS NOT NULL AND p_joining_date != '' THEN p_joining_date::DATE ELSE NULL END,
    p_basic_salary,
    NULLIF(p_gender, ''), NULLIF(p_bank_account, ''), NULLIF(p_pan_no, ''), NULLIF(p_pf_no, '')
  )
  RETURNING id INTO v_emp_pk;

  -- 4. Insert auth credentials link
  INSERT INTO employee_credentials (employee_id, auth_uid, username)
  VALUES (v_emp_pk, v_auth_uid, v_username);

  -- 5. Insert default leave balances for current year
  INSERT INTO leave_balances (employee_id, year)
  VALUES (v_emp_pk, EXTRACT(YEAR FROM NOW())::INT);

  -- Return employee info
  SELECT json_build_object(
    'id', e.id,
    'employee_id', e.employee_id,
    'username', v_username,
    'email', e.email,
    'first_name', e.first_name,
    'last_name', e.last_name
  ) INTO v_result
  FROM employees e WHERE e.id = v_emp_pk;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 4. EMPLOYEE PROFILE UPDATE (SECURITY DEFINER)
--    Only allows updating safe fields. Prevents employees from
--    tampering with basic_salary, status, department, etc.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_employee_profile(
  p_phone TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_date_of_birth TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_emergency_name TEXT DEFAULT NULL,
  p_emergency_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id BIGINT;
  v_result JSON;
BEGIN
  SELECT ec.employee_id INTO v_employee_id
  FROM employee_credentials ec
  WHERE ec.auth_uid = auth.uid();

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  UPDATE employees SET
    phone           = COALESCE(NULLIF(p_phone, ''), phone),
    gender          = COALESCE(NULLIF(p_gender, ''), gender),
    date_of_birth   = CASE
                        WHEN p_date_of_birth IS NOT NULL AND p_date_of_birth != ''
                        THEN p_date_of_birth::DATE
                        ELSE date_of_birth
                      END,
    address         = COALESCE(NULLIF(p_address, ''), address),
    emergency_name  = COALESCE(NULLIF(p_emergency_name, ''), emergency_name),
    emergency_phone = COALESCE(NULLIF(p_emergency_phone, ''), emergency_phone),
    updated_at      = NOW()
  WHERE id = v_employee_id
  RETURNING to_json(employees.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 5. ROW LEVEL SECURITY POLICIES
--    Uses is_admin() and get_my_employee_id() to avoid
--    self-referencing infinite recursion.
-- ============================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- 5.1 admin_users
CREATE POLICY "Admins: full access to admin_users"
  ON admin_users FOR ALL
  USING (is_admin())
  WITH CHECK (true);

-- 5.2 employees
CREATE POLICY "Admins: full access to employees"
  ON employees FOR ALL
  USING (is_admin())
  WITH CHECK (true);

CREATE POLICY "Employees: read own profile"
  ON employees FOR SELECT
  USING (id = get_my_employee_id());
-- NOTE: Employee profile UPDATE is handled securely via
-- update_employee_profile() RPC — no direct UPDATE policy here
-- to prevent salary/status tampering from crafted API calls.

-- 5.3 employee_credentials
CREATE POLICY "Admins: full access to employee_credentials"
  ON employee_credentials FOR ALL
  USING (is_admin())
  WITH CHECK (true);

CREATE POLICY "Employees: read own credentials"
  ON employee_credentials FOR SELECT
  USING (auth_uid = auth.uid());

-- 5.4 attendance
CREATE POLICY "Admins: full access to attendance"
  ON attendance FOR ALL
  USING (is_admin())
  WITH CHECK (true);

CREATE POLICY "Employees: read own attendance"
  ON attendance FOR SELECT
  USING (employee_id = get_my_employee_id());

-- 5.5 leave_requests
CREATE POLICY "Admins: full access to leave_requests"
  ON leave_requests FOR ALL
  USING (is_admin())
  WITH CHECK (true);

CREATE POLICY "Employees: read own leave requests"
  ON leave_requests FOR SELECT
  USING (employee_id = get_my_employee_id());

CREATE POLICY "Employees: create own leave requests"
  ON leave_requests FOR INSERT
  WITH CHECK (employee_id = get_my_employee_id());

CREATE POLICY "Employees: delete own pending leave requests"
  ON leave_requests FOR DELETE
  USING (employee_id = get_my_employee_id() AND status = 'pending');

-- 5.6 leave_balances
CREATE POLICY "Admins: full access to leave_balances"
  ON leave_balances FOR ALL
  USING (is_admin())
  WITH CHECK (true);

CREATE POLICY "Employees: read own leave balances"
  ON leave_balances FOR SELECT
  USING (employee_id = get_my_employee_id());

-- 5.7 payroll
CREATE POLICY "Admins: full access to payroll"
  ON payroll FOR ALL
  USING (is_admin())
  WITH CHECK (true);

CREATE POLICY "Employees: read own payslips"
  ON payroll FOR SELECT
  USING (employee_id = get_my_employee_id());

-- 5.8 company_settings
CREATE POLICY "Admins: full access to company_settings"
  ON company_settings FOR ALL
  USING (is_admin())
  WITH CHECK (true);

CREATE POLICY "Anyone: read company_settings"
  ON company_settings FOR SELECT
  USING (true);

-- ============================================================
-- 6. AUTO-UPDATE TIMESTAMP TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON admin_users;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON employees;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON employee_credentials;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON employee_credentials FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON attendance;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON leave_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON payroll;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payroll FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON company_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON company_settings FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- 7. SEED DATA: Default Company Settings
-- ============================================================

INSERT INTO company_settings (setting_key, setting_value, setting_type) VALUES
('company_name', 'BEAUZEAD LTD', 'text'),
('company_email', 'info@beauzead.com', 'text'),
('company_phone', '+447555394997', 'text'),
('company_address', 'Stanwellway, United Kingdom', 'text'),
('company_website', 'https://www.beauzead.com', 'text'),
('gst_number', '', 'text'),
('pan_number', '', 'text'),
('pf_rate', '12', 'number'),
('esi_rate', '0.75', 'number'),
('professional_tax', '200', 'number'),
('salary_day', '1', 'number'),
('hra_percentage', '40', 'number'),
('special_allowance_percentage', '15', 'number'),
('sick_leave_default', '12', 'number'),
('casual_leave_default', '10', 'number'),
('earned_leave_default', '8', 'number'),
('leave_approval_required', '1', 'boolean'),
('max_continuous_leave', '15', 'number'),
('email_notifications', '1', 'boolean'),
('salary_slip_email', '1', 'boolean'),
('leave_request_email', '1', 'boolean'),
('attendance_reminder', '0', 'boolean'),
('session_timeout', '30', 'number'),
('password_expiry_days', '90', 'number'),
('max_login_attempts', '5', 'number'),
('two_factor_auth', '0', 'boolean'),
('departments', '["Engineering","Human Resources","Sales & Marketing","Accounts & Finance","Operations"]', 'json'),
('leave_types', '["Sick Leave","Casual Leave","Earned Leave"]', 'json'),
('work_start_time', '09:30', 'text'),
('work_end_time', '18:00', 'text'),
('halfday_end_time', '13:30', 'text'),
('tds_threshold', '50000', 'number'),
('tds_rate', '10', 'number')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 8. SEED ADMIN USER
--    The initial admin seed has been applied and the password rotated.
--    DO NOT commit plaintext credentials to version control.
--    To re-seed, run the seed script locally with your own password.
-- ============================================================

-- Seed block removed from public repo for security.
-- See README for first-time setup instructions.
