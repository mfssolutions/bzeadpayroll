# FAILURE COUNT

## Total Failures: 10 | Fixed: 10 | Remaining: 0

### Rules Violated (ALL FIXED)

| # | Rule | Failure | Fix Applied |
|---|------|---------|-------------|
| 1 | NO HARDCODING | "Pounds" hardcoded in payslip | FIXED — Dynamic `currency === 'GBP' ? 'Pounds' : 'Rupees'` |
| 2 | NO HARDCODING | Magic number 110 as fallback exchange rate | FIXED — Named constant `FALLBACK_EXCHANGE_RATE` |
| 3 | NO HARDCODING | "BEAUZEAD LTD" hardcoded as fallback company name | FIXED — Removed fallback, uses empty string |
| 4 | WIRE IT PERFECTLY | Employee edit doesn't sync basic_salary | FIXED — Added `basic_salary: salaryNum` to edit update |
| 5 | WIRE IT PERFECTLY | Profile shows old single address field | FIXED — Full rewrite with structured address display |
| 6 | WIRE IT PERFECTLY | Profile edit uses single address textarea | FIXED — Structured fields: line1/line2/city/county/postcode/country |
| 7 | INPUT VALIDATION PERFECTLY | Profile edit has ZERO validation | FIXED — Phone regex, postcode regex, DOB range validation |
| 8 | INPUT VALIDATION PERFECTLY | NI Number not required | FIXED — Made required with message "NI Number is required for UK payroll" |
| 9 | NO HARDCODING | Duplicate CurrencyToggle in Employees.jsx | FIXED — Removed import and render from Employees.jsx |
| 10 | ONCE PUSHED NO ERROR | Salary green highlight broken | FIXED — Label check matches 'Salary' |

### DB Migrations Applied
- `migration-fix-profile-rpc.sql` — Created `update_employee_profile_v2` RPC with structured address fields
