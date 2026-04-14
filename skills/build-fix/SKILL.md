---
name: build-fix
description: "Fix AL build errors one at a time. Use when alc.exe compilation fails."
argument-hint: "[optional: scope or instructions]"
disable-model-invocation: true
---

# Build Fix Skill

Incrementally fix BC AL compiler errors.

## Workflow

1. **Run AL compiler** using the build command from CLAUDE.md (dynamic alc.exe detection via glob).

2. **Parse error output:**
   - Group by file
   - Sort by severity (Error > Warning)
   - Identify error codes (AL0xxx, AA0xxx, AS0xxx)
   - Error format: `FilePath(Line,Column): error AL0123: Message`

3. **For each error:**
   - Read the file and show error with surrounding context
   - Explain the issue
   - Apply the fix (smallest possible change)
   - Re-run build
   - Verify error resolved

4. **Stop if:**
   - Fix introduces new errors (rollback the fix, try alternative)
   - Same error persists after 3 attempts
   - User requests pause

5. **Show summary:**
   - Errors fixed
   - Errors remaining
   - Warnings to address (only if user asked for warning fixes)

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
