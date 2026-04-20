# BZEAD Payroll Audit and Fixes

Date: 2026-04-20 (Post Full-Fix Audit)
Status: **ALL 15 AUDIT FINDINGS RESOLVED**

---

## Verification Results

1. **Build status: PASS**
   - `npm run build` → 95 modules, 811ms

2. **Lint status: PASS**
   - `npm run lint` → exit 0, **0 problems (0 errors, 0 warnings)**

3. **CI/CD: PRESENT**
   - `.github/workflows/ci.yml` — lint + build on every push/PR to `main`

---

## Resolved Findings

### Critical (3/3 Fixed)

| # | Issue | Fix Applied |
|---|-------|-------------|
| 1 | `BEAUZEAD LTD` hardcoded in 4 files | All 4 now read `settings.company_name` via `useCompanySettings()` |
| 2 | Leave balance map silently credits wrong column for unknown types | Aborts with `toast.error` if leave type not in map — no silent fallback |
| 3 | Payroll `\|\| workingDaysCount` fallback gives 0-attendance employees full pay | Changed to `?? 0` — employees with no records get 0 days present |

### High (6/6 Fixed)

| # | Issue | Fix Applied |
|---|-------|-------------|
| 4 | UK defaults (`'United Kingdom'`, `'1257L'`) hardcoded in employee form | `initialFormState` uses `''`; `openAddModal` reads `settings.default_country` / `settings.default_tax_code` |
| 5 | NI validation message: "required for UK payroll" | Made NI optional — format only validated if a value is entered |
| 6 | Email placeholder `employee@beauzead.com` | Changed to `employee@company.com` |
| 7 | Employee ID fallback prefix `'BZD'` | Changed to generic `'EMP'` |
| 8 | INR `₹` symbols in Settings labels | Labels now currency-neutral: `Professional Tax`, `TDS Threshold` |
| 9 | `useCompanySettings` silently returns `{}` on error | Now returns `settingsError` state; `fetchSettings` returns `{ settings, error }` |
| 10 | Hardcoded time fallbacks at 7 call sites in Attendance | All 7 now use `settings.work_start_time \|\| ''` etc. — no hardcoded times |

### Medium (6/6 Fixed)

| # | Issue | Fix Applied |
|---|-------|-------------|
| 11 | Supabase client no guard for missing env vars | Early `throw new Error(...)` if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` missing |
| 12 | `fetchLeaveBalance` no error handling | Wrapped in try/catch with `toast.error` on failure |
| 13 | 7 `confirm()` / `window.confirm()` calls across 5 files | All replaced with `confirmModal` state + `<Modal>` component (Attendance, LeaveRequests admin, Payroll, Employees, LeaveRequests employee) |
| 14 | 5 `console.error()` in production paths | Removed from AuthContext, Dashboard (×2), Employees (×2) |
| 15 | No CI workflow, no test script | Added `.github/workflows/ci.yml`; added `"test"` script to `package.json` |
| 16 | Google Fonts `@import url()` after Tailwind in `index.css` | Moved to line 1 per CSS spec |

---

## What Is Correctly Wired

1. Supabase client uses env vars + early throw guard
2. RPC calls use correct signatures matching migration SQL
3. All core schema tables present and consumed correctly
4. Auth context correctly distinguishes admin vs employee
5. Departments dynamically loaded from `company_settings`
6. Payroll rates read from `company_settings`
7. Currency formatting globally provided via context
8. Company name dynamically read from `company_settings` in all 4 locations
9. **Lint: 0 errors, 0 warnings. Build: PASS. CI: PRESENT.**
