---
name: project-code-review
description: Comprehensive AL project code review using parallel subagents. Reviews all AL files for coding conventions, performance, security, and CodeCop compliance. No code changes are made.
argument-hint: "folder or scope, e.g. src/ or src/Sales"
user-invocable: false
disable-model-invocation: false
tools: [agent, read, search, vscode, ms-dynamics-smb.al/al_get_diagnostics]
---

# Project Review

Review all AL files in the project using parallel subagents. This is a **read-only** review — no code changes are made.

## Process

1. **Discover** — Glob all `.al` files in the target scope (default: `src/`). If `$ARGUMENTS` specifies a folder or scope, use that instead.
2. **Read project rules** — The code-reviewer and performance-reviewer agents have review rules in their Required Reading sections.
3. **Compiler diagnostic pre-pass** — Call #ms-dynamics-smb.al/al_get_diagnostics({scope:"all", severities:["error","warning"], includeRelatedInformation:true, limit:200}) once. Build a file-keyed map: `{ "<absolute path>": [diagnostics...] }`. Files not in the map have zero compiler findings. This is the authoritative CodeCop / AppSourceCop / compiler list for the whole project — the reviewers do not need to re-derive anything already on it.
4. **Group files** — Split files by feature folder (first subfolder under `src/`). If no subfolders, split into groups of ~10 files.
5. **Parallel subagent review** — For each file group, run **TWO parallel subagents** (all with Sonnet):

   | Subagent | Focus |
   |----------|-------|
   | **code-reviewer** agent | Quality & Security — naming, error handling, security, CodeCop compliance |
   | **performance-reviewer** agent | Performance — SetLoadFields, N+1 queries, FlowField misuse, caching, bulk operations |

   Run **all subagents across all groups in parallel** so they work concurrently. Each subagent receives its file group, the per-file slice of the diagnostic map from step 3, and instructions to review only, NOT edit or fix anything. Subagents should cite the diagnostic `code` (e.g. `AA0181`, `AS0011`) when a finding matches one, so the consolidated report can cross-reference the Problems panel.

6. **Collect results** — Gather all subagent outputs into a single consolidated report.
7. **Present report** — Show the report to the user. Do NOT auto-fix anything.

## What Each Reviewer Checks

### Naming (HIGH)
- Local variables: `_` prefix
- Parameters: `p` prefix
- Return values: `r` prefix as named returns
- Labels follow same prefix rules as variables
- `this.` used for all internal procedure calls

### Error Handling (CRITICAL)
- All strings use Labels (no hardcoded text)
- Labels use `TableCaption()` / `FieldCaption()` placeholders
- Labels have `Comment` for placeholders
- Find/Get return values checked
- TestField for mandatory fields

### Performance (HIGH)
- SetLoadFields before every Get/Find (mandatory)
- SetLoadFields placed AFTER SetRange, BEFORE Find
- SetAutoCalcFields for FlowFields needed across most loop iterations
- No FlowFields in SetFilter/SetRange
- No BLOB/Media/MediaSet fields in bulk SetLoadFields or query columns
- FindSet for loops, Get for PK lookups
- No database reads inside tight loops
- No unnecessary Validate — direct assignment when OnValidate effects aren't needed
- CalcSums/ModifyAll/DeleteAll for bulk operations
- Dedup guards for loops with repeated key values

### Security (CRITICAL)
- DataClassification on all table fields (no ToBeClassified)
- No hardcoded credentials
- Permission sets defined for new objects
- No Commit() in event subscribers

## Report Format

```markdown
# Project Review: [Project Name]

**Date:** [date]
**Scope:** [folder reviewed]
**Files reviewed:** [count]

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH     | X |
| MEDIUM   | X |

## Critical Issues
1. **[Issue]** @ `File.al:Line` — [description]

## High Priority Issues
1. **[Issue]** @ `File.al:Line` — [description]

## Medium Priority Issues
1. **[Issue]** @ `File.al:Line` — [description]

## Per-File Status

| File | Status | Issues |
|------|--------|--------|
| CustomerRating.Table.al | PASS | 0 |
| RatingService.Codeunit.al | FIX FIRST | 2 HIGH |

## Recommendation
APPROVE / FIX FIRST / BLOCK
```

## Rules

- **Read-only** — Do NOT edit, write, or fix any files
- **Parallel subagents** — Always run all reviewers as parallel subagents (independent file groups, no cross-talk needed)
- **Complete** — Review every `.al` file in scope, skip nothing
- **Consolidated** — One final report combining all subagent outputs
- **All subagents with Sonnet** — Request Sonnet when running each subagent
