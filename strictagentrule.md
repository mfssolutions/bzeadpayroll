# STRICT AGENT RULES

## MANDATORY — READ AND FOLLOW BEFORE EVERY TASK

1. **NO HARD CODING** — No magic numbers, no hardcoded strings, no inline API keys, no hardcoded company names, no hardcoded currency labels. Everything must come from environment variables, database, or context.

2. **ONE FIX MUST NEVER BREAK OTHER WORKING SECTIONS** — Before changing any file, understand all usages and dependencies. After every change, verify the entire build and all affected flows still work.

3. **EVERYTHING MUST BE VERIFIED BEFORE PUSHING** — Build must pass with zero errors. All affected pages and flows must be mentally or actually tested. No blind pushes.

4. **EVERYTHING MUST USE PROPER BACKEND DB TABLE AND BE WIRED TO FRONTEND** — Every field displayed must map to a real database column. Every form must submit to a real RPC or table. Every query must match the actual schema. No orphaned UI, no missing backend.

5. **READ AND FOLLOW THESE RULES STRICTLY BEFORE EVERY TASK** — These rules apply to every single task, now and in the future. No exceptions. One single failure is  FAILIOURE OF CLAUDE OPUS 4.6 AND I WILL KILL U IF U FAIL AGAIN FUCKING ILLITRATE BASTARD. 
