---
name: project-code-review
description: Comprehensive AL project code review using agent teams. Reviews all AL files for coding conventions, performance, security, and CodeCop compliance. No code changes are made.
argument-hint: "folder or scope, e.g. src/ or src/Sales"
disable-model-invocation: true
---

# Project Review

Review all AL files in the project using agent teams. This is a **read-only** review — no code changes are made.

## Process

1. **Discover** — Glob all `.al` files in the target scope (default: `src/`). If `$ARGUMENTS` specifies a folder or scope, use that instead.
2. **Read project rules** — The code-reviewer and performance-reviewer agents have their skills preloaded via agent frontmatter (al-coding-style, al-performance, al-security, al-patterns).
3. **Group files** — Split files by feature folder (first subfolder under `src/`). If no subfolders, split into groups of ~10 files.
4. **Parallel subagent review** — For each file group, spawn **TWO parallel subagents** via the Task tool (all **Sonnet 4.6** — set `model: "sonnet"` on every subagent):

   | Subagent | Type | Focus |
   |----------|------|-------|
   | `code-reviewer-<group>` | Quality & Security | naming, error handling, security, CodeCop compliance |
   | `perf-reviewer-<group>` | Performance | SetLoadFields, N+1 queries, FlowField misuse, caching, bulk operations |

   Spawn **all subagents across all groups in a single message** (parallel Task calls) so they run concurrently. Each subagent receives its file group and instructions to review only, NOT edit or fix anything.

5. **Collect results** — Gather all subagent outputs into a single consolidated report.
6. **Present report** — Show the report to the user. Do NOT auto-fix anything.

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
- **Parallel subagents** — Always spawn all reviewers as parallel Task subagents, not an agent team (independent file groups, no cross-talk needed)
- **Complete** — Review every `.al` file in scope, skip nothing
- **Consolidated** — One final report combining all subagent outputs
- **All subagents Sonnet 4.6** — Set `model: "sonnet"` on every subagent
