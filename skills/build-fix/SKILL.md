---
name: build-fix
description: "Fix AL compiler errors one at a time. Use when an AL build (AL: Package task or alc.exe) fails with compiler errors, CodeCop warnings (AA0xxx), or AppSource warnings (AS0xxx). Fixes one error, rebuilds, repeats. Do NOT use for runtime errors or business logic bugs."
argument-hint: "[optional: scope or instructions]"
---

# Build Fix Skill

Incrementally fix BC AL compiler errors.

## Workflow

1. **Activate deferred AL build tools first.** Before any AL build or diagnostics call, use `tool_search` for the AL project build tools. Treat a result containing `al_build` and `al_getdiagnostics` as successful activation.
   - Keep provider-qualified IDs such as `ms-dynamics-smb.al/al_build` and `ms-dynamics-smb.al/al_get_diagnostics` in custom agent/tool allow-lists; those are configuration-side IDs.
   - After deferred activation, call the runtime names returned by `tool_search`: `al_build` and `al_getdiagnostics`.
   - Do not conclude the tool is unavailable just because it is absent from the initial visible tool list, absent from `tools_*.json`, or named differently from the provider-qualified allow-list ID.
   - If `tool_search` returns `al_getdiagnostics` but the runtime call still cannot be made, report a deferred-tool expansion failure, then fall back to the direct `alc.exe`/AL Package build route.

2. **Run AL compiler** with `al_build({scope:"current"})`. Then call `al_getdiagnostics({scope:"workspace", severities:["error","warning"], areas:["AL"], limit:100})` to retrieve the typed diagnostic list.

3. **Read diagnostics:** the response is already grouped by file with structured fields — no terminal parsing required.
   - Each item: `file`, `line`, `column`, `severity`, `code` (e.g. `AL0118`, `AA0021`, `AS0011`), `message`
   - Sort locally by severity (Error before Warning) and priority order below

4. **Loop: fix and rebuild until clean.** For each error in priority order:
   - Read the file and show error with surrounding context
   - Explain the issue
   - Apply the fix (smallest possible change)
   - Re-run `al_build({scope:"current"})` then `al_getdiagnostics({scope:"workspace", severities:["error"], areas:["AL"]})`
   - Verify error resolved (item with same `code` at same `file`/`line` no longer present)

   Continue the loop (re-parse new build output if errors remain) until one of these terminal conditions:
   - Build reports 0 errors — SUCCESS, go to step 6
   - Same error fails to resolve after 3 attempts — ESCALATE (step 5)
   - Fix introduces new errors that cannot be resolved — rollback and ESCALATE (step 5)
   - User requests pause — stop and report current state

5. **Escalate (do not silently exit with errors):**
   If the loop cannot reach 0 errors, STOP and explicitly report to the user: which errors remain, what was tried, and why each attempt failed. Do not claim success. Do not declare the task done. The build must be clean, or the user must be told it is not.

6. **Report final state:**
   - Errors fixed (list)
   - Errors remaining (list — MUST be empty for success)
   - Warnings addressed (only if user asked for warning fixes)
   - **Final build status: PASS (0 errors) or FAIL (errors remain)**

## Optional: Scope via LATEST Plan

If `.github/plans/LATEST` exists and points to a new-format plan (file starts with `---\n`), optionally read its YAML frontmatter (see [plan-schema.md](../al-planning/plan-schema.md)) to prioritize fixes. Use `objects[].file` as the in-scope file list: errors in those files are "in-feature" and get priority over errors in unrelated files.

This is a passive enhancement — if the LATEST pointer is missing, the plan is legacy prose, or the frontmatter is malformed, proceed as usual with all reported errors.

## Priority Order

Fix in this order: AL0xxx (compiler) -> dependency errors -> AA0xxx (CodeCop) -> AS0xxx (AppSourceCop)

## Common AL Compiler Errors (AL0xxx)

| Code | Issue | Fix |
|------|-------|-----|
| AL0118 | Name not in context | Declare variable or check spelling |
| AL0132 | Duplicate member name | Use unique name |
| AL0185 | Object not accessible | Check app.json deps, Access property |
| AL0217 | Invalid property value | Use valid enum value |
| AL0254 | Record not initialized | Add Get/Find before use |
| AL0432 | Object ID outside range | Check app.json idRanges |
| AL0499 | Cannot convert type | Use Evaluate() or correct type |
| AL0603 | Return type mismatch | Return correct type |

## Common CodeCop Errors (AA0xxx)

| Code | Issue | Fix |
|------|-------|-----|
| AA0001 | Implicit `with` | Use explicit variable reference |
| AA0005 | Unnecessary `begin..end` | Remove around single statements |
| AA0008 | Missing parentheses | Add `()` to function calls |
| AA0021 | Variable declaration order | Reorder: Record -> Report -> Codeunit -> ... -> simple types |
| AA0074 | Exit not last | Restructure control flow |
| AA0137 | Unused variable | Remove declaration |
| AA0139 | TextConst (obsolete) | Use Label instead |
| AA0175 | Find('-')/Find('+') | Use FindFirst()/FindLast() |
| AA0181 | FindFirst in loop | Use FindSet() for repeat..until |

## Important

- Fix **one error at a time** — AL errors cascade, fixing one may resolve others
- **Minimal diffs only** — fix the error, nothing else
- **Never refactor** surrounding code
- **Never change business logic** to fix a type error

## User Instructions

$ARGUMENTS
