# BZEAD Payroll Audit and Fixes

Date: 2026-04-20
Status: 35 total issues (15 fixed, 35 found across 3 rounds)

## Audit Round 1 — COMPLETED (commit b188791, ebf7f7c)

All 15 original findings were fixed and pushed:
hardcoded company name, leave balance map, payroll attendance fallback, UK defaults, BZD prefix, INR symbols, settings error handling, hardcoded times, supabase env guard, fetchLeaveBalance error handling, confirm() → Modal, console.error removal, CI workflow, CSS import ordering, residual UK strings.

---

## Audit Round 2 — Deep Audit (17 CRITICAL Issues)

ALL items below are CRITICAL. Evidence is real, from the codebase.

### 1. Dashboard leave approval never updates leave_balances
Admin Dashboard approve/reject changes `leave_requests.status` only — never touches `leave_balances` table. Leave entitlement stays wrong.
- `src/pages/admin/Dashboard.jsx` L127, L132, L345

### 2. Leave approval is non-atomic (two separate writes)
Status update and balance update are two independent Supabase calls with no transaction. Mid-failure = approved request with unchanged balance.
- `src/pages/admin/LeaveRequests.jsx` L99, L130

### 3. Payroll processing is non-atomic (loop of upserts)
Employee payroll rows are written one-by-one in a loop. One failure = partially processed month.
- `src/pages/admin/Payroll.jsx` L88, L94

### 4. Salary calculation ignores attendance entirely
`calculatePayroll()` in helpers.js does not use `days_present` or `working_days`. Absent employees receive full computed net salary.
- `src/pages/admin/Payroll.jsx` L90
- `src/utils/helpers.js` L92

### 5. Disabled admin accounts still have full access
`is_admin()` DB helper and app-side role check only verify `auth_uid` existence in `admin_users`, never check `status = 'active'`.
- `supabase-schema.sql` L148, L156
- `src/contexts/AuthContext.jsx` L33, L40

### 6. Admin email update creates identity drift
Admin Profile updates `admin_users.email` but never updates `auth.users` email. Login email and profile email diverge.
- `src/pages/admin/Profile.jsx` L44, L46

### 7. Password change skips current-password verification
No `current_password` field or re-auth before calling `auth.updateUser`. Anyone with an active session can change the password.
- `src/pages/admin/Profile.jsx` L14, L62, L75

### 8. Settings save ignores per-upsert errors
Each setting upsert response's `error` object is never checked. Success toast fires even if writes fail.
- `src/pages/admin/Settings.jsx` L43, L49, L53

### 9. Settings writes omit setting_type → type drift
Upserts don't include `setting_type`, but the hook's runtime parser branches on it (json vs number vs text). New saves lose type info.
- `src/pages/admin/Settings.jsx` L50
- `src/hooks/useCompanySettings.js` L17, L19

### 10. settingsError is produced but never consumed
`useCompanySettings` exposes `settingsError` but no page or component reads it. Settings fetch failures are invisible to the user.
- `src/hooks/useCompanySettings.js` L31, L64

### 11. Employee Dashboard ignores query errors
Multiple Supabase queries run without checking returned `error`. Failed reads show false zeros as if valid data.
- `src/pages/employee/Dashboard.jsx` L48, L63, L85

### 12. Employee Attendance ignores query errors
Query error is not checked before setting attendance state. Backend failure = silent empty attendance list.
- `src/pages/employee/Attendance.jsx` L23, L31, L32

### 13. Employee Payslips suppresses query errors
Error from payslips query is ignored, falls through to loaded state. Users see empty payslips with no failure indicator.
- `src/pages/employee/Payslips.jsx` L28, L29

### 14. Schema-source drift (v1 baseline vs v2 RPCs)
App calls v2 RPCs (`admin_create_employee_v2`, `update_employee_profile_v2`) but baseline `supabase-schema.sql` only defines v1. Deployment depends on separate migration files being run manually.
- `src/pages/admin/Employees.jsx` L359
- `src/pages/employee/Profile.jsx` L90
- `supabase-schema.sql` L186, L313
- `migration-uk.sql` L27
- `migration-fix-profile-rpc.sql` L6

### 15. No Supabase CLI migration tracking
Migration SQL files sit loose in `payroll-app/` root — not under `supabase/migrations/`. Reproducible DB state is not guaranteed.
- `supabase/` directory (only has `config.toml`)
- `migration-uk.sql`, `migration-fix-profile-rpc.sql`

### 16. Hardcoded admin credentials in SQL seed
Default admin email and password are plaintext in the schema seed script. Secret exposure risk if repo is public or script is reused.
- `supabase-schema.sql` L537, L557

### 17. Leave type workflow mismatch
Settings UI and employee leave form allow configurable `leave_types`, but admin approval logic maps only 3 fixed labels (`Sick Leave`, `Casual Leave`, `Earned Leave`). Custom types become unapprovable.
- `src/pages/admin/Settings.jsx` L165
- `src/pages/employee/LeaveRequests.jsx` L13
- `src/pages/admin/LeaveRequests.jsx` L108, L113

---

## Audit Round 3 — Final Deep Sweep (18 CRITICAL Issues)

### 18. Payroll table column mismatch — code references `created_at`, schema has `generated_at`
App queries `.order('created_at')` but column doesn't exist. PostgREST returns 400 error — payroll listing is broken.
- `supabase-schema.sql` L117 (defines `generated_at`)
- `src/pages/admin/Payroll.jsx` L38
- `src/pages/employee/Payslips.jsx` L29, L130

### 19. Gender CHECK constraint rejects form option `Prefer not to say`
Schema allows only `Male`, `Female`, `Other`. Form offers a fourth option that causes DB constraint violation.
- `supabase-schema.sql` L37
- `src/pages/admin/Employees.jsx` L89
- `src/pages/employee/Profile.jsx` L165

### 20. Inactive employees retain full access (frontend + RLS)
`get_my_employee_id()` doesn't filter by status. AuthContext doesn't check status. ProtectedRoute doesn't check status. Employee-side equivalent of #5.
- `supabase-schema.sql` L166
- `src/contexts/AuthContext.jsx` L49-L60
- `src/App.jsx` L66-L82

### 21. Deleting approved leave request does not restore leave balance
`doDelete` performs `.delete()` without reversing the `leave_balances` deduction. Used days are permanently lost.
- `src/pages/admin/LeaveRequests.jsx` L148-L155

### 22. Employee leave form allows `from_date > to_date`
`calculateDuration` returns `Math.max(1, ...)` so the `duration < 1` guard can never trigger. Inverted ranges silently submit as 1 day.
- `src/pages/employee/LeaveRequests.jsx` L63-L67, L86

### 23. Exchange rate API key exposed in client bundle
`VITE_EXCHANGE_RATE_API_KEY` is embedded in built JS. Any user can extract it from DevTools.
- `src/contexts/CurrencyContext.jsx` L51

### 24. Username collision in `admin_create_employee_v2`
`split_part(p_email, '@', 1)` for username. Two employees with same local part (e.g. john@a.com, john@b.com) = unhandled unique violation.
- `migration-uk.sql` L116

### 25. `formatDate` timezone off-by-one
`new Date(dateStr)` on date-only string parses as UTC midnight. `.getDate()` returns local day — off by 1 in negative-UTC timezones.
- `src/utils/helpers.js` L10-L15

### 26. N+1 query in Employee Dashboard
7 sequential single-row queries (one per day) for attendance trend chart. Should be one query.
- `src/pages/employee/Dashboard.jsx` L51-L62

### 27. No React ErrorBoundary anywhere
No error boundary wraps routes or components. Any render-time exception = white screen crash.
- `src/App.jsx` (only has Suspense, not ErrorBoundary)

### 28. `handleLogout` has no error handling
`signOut()` not in try/catch. Network error = user stuck on broken state, never navigated away.
- `src/components/layout/AdminLayout.jsx` L55
- `src/components/layout/EmployeeLayout.jsx` L49

### 29. Security settings stored but never enforced
`session_timeout`, `max_login_attempts`, `password_expiry_days` are saved in Settings but zero frontend code reads or enforces them. No inactivity timer, no attempt counter, no expiry check.
- `src/pages/admin/Settings.jsx` L172-L178

### 30. Admin Profile edit has no input validation
`handleUpdateProfile` submits name/email/phone with no length, format, or empty-string validation.
- `src/pages/admin/Profile.jsx` L42-L56

### 31. Dead exports in `utils/helpers.js`
`formatCurrency`, `formatDateTime`, `getMonthName`, `generateEmployeeId` are exported but never imported anywhere.
- `src/utils/helpers.js` L1, L9, L32, L43

### 32. Modal lacks ARIA attributes and focus trap
No `role="dialog"`, no `aria-modal`, no `aria-labelledby`. Tab key escapes overlay.
- `src/components/ui/Modal.jsx` L33-L66

### 33. StatsCard clickable `<div>` instead of `<button>`
When `onClick` is provided, renders `<div onClick>` — not keyboard-focusable, not screen-reader accessible.
- `src/components/ui/StatsCard.jsx` L3-L6

### 34. Floating-point arithmetic for payroll calculations
Native JS floats for salary math. Rounding differences between client preview and DB `DECIMAL(12,2)`.
- `src/utils/helpers.js` L95-L119

### 35. Leave request `from_date` has no `min` constraint
No `min` attribute on date input. Employees can submit leave requests for past dates.
- `src/pages/employee/LeaveRequests.jsx` L181
