-- ============================================================
-- UK Payroll Migration
-- Adds UK-specific columns, creates new RPC function
-- ============================================================

-- 1. Add new UK columns to employees table
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS ni_number VARCHAR(13),
  ADD COLUMN IF NOT EXISTS passport_no VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tax_code VARCHAR(10) DEFAULT '1257L',
  ADD COLUMN IF NOT EXISTS starter_declaration VARCHAR(1) CHECK (starter_declaration IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'Full-time' CHECK (employment_type IN ('Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance')),
  ADD COLUMN IF NOT EXISTS salary_basis VARCHAR(10) DEFAULT 'Monthly' CHECK (salary_basis IN ('Hourly', 'Weekly', 'Monthly')),
  ADD COLUMN IF NOT EXISTS salary_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_cycle VARCHAR(30),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sort_code VARCHAR(8),
  ADD COLUMN IF NOT EXISTS personal_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(200),
  ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(200),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS county VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postcode VARCHAR(10),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'United Kingdom';

-- 2. Create new v2 RPC for employee creation with UK fields and BZD ID format
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
  v_result    JSON;
  v_month     TEXT;
  v_year      TEXT;
  v_seq       INT;
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
  IF p_first_name IS NULL OR p_first_name = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  IF p_last_name IS NULL OR p_last_name = '' THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;

  -- Check email not already registered
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  -- 1. Create Supabase Auth user
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

  -- Insert identity record
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_auth_uid, v_auth_uid,
    jsonb_build_object('sub', v_auth_uid::TEXT, 'email', p_email),
    'email', v_auth_uid::TEXT,
    NOW(), NOW(), NOW()
  );

  -- 2. Generate employee ID in BZD{MM}{YY}{seq} format
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

  -- Username from email prefix
  v_username := split_part(p_email, '@', 1);

  -- 3. Insert employee record with all UK fields
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

-- 3. Update company_settings with UK defaults
INSERT INTO company_settings (setting_key, setting_value)
VALUES
  ('company_registration', ''),
  ('vat_number', '')
ON CONFLICT (setting_key) DO NOTHING;
