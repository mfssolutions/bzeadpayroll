-- ============================================================
-- Fix Migration: update_employee_profile_v2
-- Supports structured address fields for employee self-edit
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_employee_profile_v2(
  p_phone          TEXT DEFAULT NULL,
  p_gender         TEXT DEFAULT NULL,
  p_date_of_birth  TEXT DEFAULT NULL,
  p_address_line1  TEXT DEFAULT NULL,
  p_address_line2  TEXT DEFAULT NULL,
  p_city           TEXT DEFAULT NULL,
  p_county         TEXT DEFAULT NULL,
  p_postcode       TEXT DEFAULT NULL,
  p_country        TEXT DEFAULT NULL,
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
    address_line1   = COALESCE(NULLIF(p_address_line1, ''), address_line1),
    address_line2   = COALESCE(NULLIF(p_address_line2, ''), address_line2),
    city            = COALESCE(NULLIF(p_city, ''), city),
    county          = COALESCE(NULLIF(p_county, ''), county),
    postcode        = COALESCE(NULLIF(p_postcode, ''), postcode),
    country         = COALESCE(NULLIF(p_country, ''), country),
    emergency_name  = COALESCE(NULLIF(p_emergency_name, ''), emergency_name),
    emergency_phone = COALESCE(NULLIF(p_emergency_phone, ''), emergency_phone),
    updated_at      = NOW()
  WHERE id = v_employee_id
  RETURNING to_json(employees.*) INTO v_result;

  RETURN v_result;
END;
$$;
