-- ============================================================
-- Audit Fixes Migration
-- Addresses issues #2, #3, #5, #14, #19, #24, #29
-- ============================================================

-- #5: is_admin() must enforce status = 'active'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_uid = auth.uid() AND status = 'active'
  );
END;
$$;

-- #5: get_my_employee_id() must enforce employee status = 'active'
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
  JOIN public.employees e ON e.id = ec.employee_id
  WHERE ec.auth_uid = auth.uid() AND e.status = 'active';
  RETURN v_id;
END;
$$;

-- #19: Expand gender CHECK to include 'Prefer not to say'
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_gender_check;
ALTER TABLE employees ADD CONSTRAINT employees_gender_check
  CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say'));

-- #24: Fix username collision in admin_create_employee_v2
-- Re-create with collision handling: append suffix if username exists
CREATE OR REPLACE FUNCTION public.admin_create_employee_v2(
  p_first_name         TEXT,
  p_last_name          TEXT,
  p_email              TEXT,
  p_password           TEXT,
  p_phone              TEXT DEFAULT NULL,
  p_personal_email     TEXT DEFAULT NULL,
  p_gender             TEXT DEFAULT NULL,
  p_date_of_birth      TEXT DEFAULT NULL,
  p_address_line1      TEXT DEFAULT NULL,
  p_address_line2      TEXT DEFAULT NULL,
  p_city               TEXT DEFAULT NULL,
  p_county             TEXT DEFAULT NULL,
  p_postcode           TEXT DEFAULT NULL,
  p_country            TEXT DEFAULT 'United Kingdom',
  p_department         TEXT DEFAULT NULL,
  p_designation        TEXT DEFAULT NULL,
  p_employment_type    TEXT DEFAULT 'Full-time',
  p_salary_basis       TEXT DEFAULT 'Monthly',
  p_salary_amount      NUMERIC DEFAULT 0,
  p_salary_cycle       TEXT DEFAULT NULL,
  p_bank_name          TEXT DEFAULT NULL,
  p_bank_account       TEXT DEFAULT NULL,
  p_sort_code          TEXT DEFAULT NULL,
  p_joining_date       TEXT DEFAULT NULL,
  p_passport_no        TEXT DEFAULT NULL,
  p_ni_number          TEXT DEFAULT NULL,
  p_tax_code           TEXT DEFAULT '1257L',
  p_starter_declaration TEXT DEFAULT NULL,
  p_company_code       TEXT DEFAULT 'BZD'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid  UUID;
  v_emp_pk    BIGINT;
  v_emp_id    TEXT;
  v_username  TEXT;
  v_base_username TEXT;
  v_suffix    INT;
  v_result    JSON;
  v_month     TEXT;
  v_year      TEXT;
  v_seq       INT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied — admin only';
  END IF;

  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF p_first_name IS NULL OR p_first_name = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  IF p_last_name IS NULL OR p_last_name = '' THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  -- Create Supabase Auth user
  v_auth_uid := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_auth_uid, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', p_first_name || ' ' || p_last_name, 'role', 'employee'),
    NOW(), NOW(), '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_auth_uid, v_auth_uid,
    jsonb_build_object('sub', v_auth_uid::TEXT, 'email', p_email),
    'email', v_auth_uid::TEXT,
    NOW(), NOW(), NOW()
  );

  -- Generate employee ID
  v_month := LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0');
  v_year  := LPAD((EXTRACT(YEAR FROM NOW()) % 100)::TEXT, 2, '0');
  SELECT COALESCE(MAX(
    CASE WHEN employee_id ~ ('^' || p_company_code || v_month || v_year || '\d{4}$')
         THEN CAST(RIGHT(employee_id, 4) AS INT)
         ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM employees;
  v_emp_id := p_company_code || v_month || v_year || LPAD(v_seq::TEXT, 4, '0');

  -- #24: Username with collision handling
  v_base_username := split_part(p_email, '@', 1);
  v_username := v_base_username;
  v_suffix := 1;
  WHILE EXISTS (SELECT 1 FROM employee_credentials WHERE username = v_username) LOOP
    v_username := v_base_username || v_suffix::TEXT;
    v_suffix := v_suffix + 1;
  END LOOP;

  -- Insert employee record
  INSERT INTO employees (
    employee_id, first_name, last_name, email, phone, personal_email,
    gender, date_of_birth,
    address_line1, address_line2, city, county, postcode, country,
    department, designation, employment_type,
    salary_basis, salary_amount, salary_cycle, basic_salary,
    bank_name, bank_account, sort_code,
    joining_date, passport_no, ni_number, tax_code, starter_declaration
  ) VALUES (
    v_emp_id,
    p_first_name, p_last_name, p_email,
    NULLIF(p_phone, ''), NULLIF(p_personal_email, ''),
    NULLIF(p_gender, ''),
    CASE WHEN p_date_of_birth IS NOT NULL AND p_date_of_birth != '' THEN p_date_of_birth::DATE ELSE NULL END,
    NULLIF(p_address_line1, ''), NULLIF(p_address_line2, ''),
    NULLIF(p_city, ''), NULLIF(p_county, ''),
    NULLIF(p_postcode, ''), NULLIF(p_country, ''),
    NULLIF(p_department, ''), NULLIF(p_designation, ''),
    NULLIF(p_employment_type, ''),
    NULLIF(p_salary_basis, ''), p_salary_amount, NULLIF(p_salary_cycle, ''),
    p_salary_amount,
    NULLIF(p_bank_name, ''), NULLIF(p_bank_account, ''), NULLIF(p_sort_code, ''),
    CASE WHEN p_joining_date IS NOT NULL AND p_joining_date != '' THEN p_joining_date::DATE ELSE NULL END,
    NULLIF(p_passport_no, ''), NULLIF(p_ni_number, ''),
    NULLIF(p_tax_code, ''), NULLIF(p_starter_declaration, '')
  )
  RETURNING id INTO v_emp_pk;

  INSERT INTO employee_credentials (employee_id, auth_uid, username)
  VALUES (v_emp_pk, v_auth_uid, v_username);

  INSERT INTO leave_balances (employee_id, year)
  VALUES (v_emp_pk, EXTRACT(YEAR FROM NOW())::INT);

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

-- #2: Atomic leave approval RPC (approve + update balance in one transaction)
CREATE OR REPLACE FUNCTION public.approve_leave_request(p_leave_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave     RECORD;
  v_duration  INT;
  v_field     TEXT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied — admin only';
  END IF;

  SELECT * INTO v_leave FROM leave_requests WHERE id = p_leave_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;
  IF v_leave.status != 'pending' THEN
    RAISE EXCEPTION 'Leave request is not pending';
  END IF;

  v_duration := GREATEST(1, (v_leave.to_date - v_leave.from_date)::INT + 1);

  -- Map leave type to balance column
  CASE v_leave.leave_type
    WHEN 'Sick Leave'   THEN v_field := 'used_sick';
    WHEN 'Casual Leave'  THEN v_field := 'used_casual';
    WHEN 'Earned Leave'  THEN v_field := 'used_earned';
    ELSE RAISE EXCEPTION 'Unknown leave type: %', v_leave.leave_type;
  END CASE;

  -- Update leave request status
  UPDATE leave_requests
  SET status = 'approved',
      approved_by = (SELECT id FROM admin_users WHERE auth_uid = auth.uid()),
      approved_at = NOW()
  WHERE id = p_leave_id;

  -- Update leave balance atomically
  EXECUTE format(
    'UPDATE leave_balances SET %I = %I + $1 WHERE employee_id = $2 AND year = $3',
    v_field, v_field
  ) USING v_duration, v_leave.employee_id, EXTRACT(YEAR FROM v_leave.from_date)::INT;
END;
$$;

-- #3: Atomic payroll generation RPC
CREATE OR REPLACE FUNCTION public.generate_payroll_batch(
  p_month INT,
  p_year  INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp      RECORD;
  v_count    INT := 0;
  v_settings JSONB;
  v_days_present INT;
  v_working_days INT;
  v_basic    NUMERIC;
  v_hra_pct  NUMERIC;
  v_sa_pct   NUMERIC;
  v_pf_pct   NUMERIC;
  v_pt       NUMERIC;
  v_tds_pct  NUMERIC;
  v_hra      NUMERIC;
  v_sa       NUMERIC;
  v_gross    NUMERIC;
  v_pf       NUMERIC;
  v_tds      NUMERIC;
  v_deductions NUMERIC;
  v_net      NUMERIC;
  v_month_start DATE;
  v_month_end   DATE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied — admin only';
  END IF;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end   := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Load settings into a map
  SELECT jsonb_object_agg(setting_key, setting_value)
  INTO v_settings
  FROM company_settings
  WHERE setting_key IN ('hra_percentage','special_allowance_percentage','pf_percentage','professional_tax','tds_percentage');

  v_hra_pct := COALESCE((v_settings->>'hra_percentage')::NUMERIC, 0);
  v_sa_pct  := COALESCE((v_settings->>'special_allowance_percentage')::NUMERIC, 0);
  v_pf_pct  := COALESCE((v_settings->>'pf_percentage')::NUMERIC, 0);
  v_pt      := COALESCE((v_settings->>'professional_tax')::NUMERIC, 0);
  v_tds_pct := COALESCE((v_settings->>'tds_percentage')::NUMERIC, 0);

  -- Count working days (weekdays) in the month
  SELECT COUNT(*) INTO v_working_days
  FROM generate_series(v_month_start, v_month_end, '1 day'::INTERVAL) d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6);

  IF v_working_days = 0 THEN v_working_days := 1; END IF;

  FOR v_emp IN
    SELECT id, basic_salary FROM employees WHERE status = 'active'
  LOOP
    -- Skip if payroll already generated
    IF EXISTS (SELECT 1 FROM payroll WHERE employee_id = v_emp.id AND month = p_month AND year = p_year) THEN
      CONTINUE;
    END IF;

    -- Count present days
    SELECT COUNT(*) INTO v_days_present
    FROM attendance
    WHERE employee_id = v_emp.id
      AND attendance_date BETWEEN v_month_start AND v_month_end
      AND status = 'present';

    v_basic := COALESCE(v_emp.basic_salary, 0) * v_days_present / v_working_days;
    v_hra   := ROUND(v_basic * v_hra_pct / 100, 2);
    v_sa    := ROUND(v_basic * v_sa_pct / 100, 2);
    v_gross := ROUND(v_basic + v_hra + v_sa, 2);
    v_pf    := ROUND(v_basic * v_pf_pct / 100, 2);
    v_tds   := ROUND(v_basic * v_tds_pct / 100, 2);
    v_deductions := ROUND(v_pf + v_pt + v_tds, 2);
    v_net   := ROUND(v_gross - v_deductions, 2);

    INSERT INTO payroll (
      employee_id, month, year, basic_salary,
      hra, special_allowance, gross_earnings,
      pf_deduction, professional_tax, tds,
      total_deductions, net_salary, status, generated_at
    ) VALUES (
      v_emp.id, p_month, p_year, ROUND(v_basic, 2),
      v_hra, v_sa, v_gross,
      v_pf, v_pt, v_tds,
      v_deductions, v_net, 'generated', NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- #29: Add session timeout enforcement column if not exists
-- (The client-side session timeout reads from company_settings.session_timeout)
-- Ensure the setting exists with a default
INSERT INTO company_settings (setting_key, setting_value, setting_type)
VALUES ('session_timeout', '30', 'number')
ON CONFLICT (setting_key) DO NOTHING;

-- #16: Seed admin credentials have been removed from the public schema file.
-- The password was rotated on the live database.
