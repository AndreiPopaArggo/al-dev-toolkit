---
name: code-review-al
description: Review only changed AL files using parallel code-reviewer and performance-reviewer subagents. No code changes are made.
argument-hint: "optional: staged, unstaged, or branch name to diff against"
disable-model-invocation: true
tools: [agent, read, search, vscode, ms-dynamics-smb.al/al_get_diagnostics]
---

# Code Review (Changed Files Only)

Review only the AL files that have been modified, using parallel **code-reviewer** and **performance-reviewer** subagents. This is a **read-only** review — no code changes are made.

## Process

1. **Detect changes** — Determine which `.al` files have changed:
   - Default: `git diff --name-only HEAD` (all uncommitted changes, staged + unstaged)
   - If `$ARGUMENTS` is `staged`: `git diff --name-only --cached` (staged only)
   - If `$ARGUMENTS` is `unstaged`: `git diff --name-only` (unstaged only)
   - If `$ARGUMENTS` is a branch name: `git diff --name-only $ARGUMENTS...HEAD` (all changes since diverging from that branch)
   - Filter to only `.al` files
2. **If no changed AL files** — Report "No AL changes to review" and stop.
3. **Get diffs** — Run `git diff` for the changed AL files to see the actual modifications.
4. **Compiler diagnostic pre-pass** — Call `al_get_diagnostics({scope:"current", severities:["error","warning"], includeRelatedInformation:true, limit:200})`. Filter the result to items whose `file` path is in the changed-file list from step 1. This is the authoritative CodeCop / AppSourceCop / compiler finding list for the scope being reviewed — splitting it by file, you'll pass each subagent its per-file subset so they don't re-derive it from source.
5. **Parallel subagent review** — Run **TWO parallel subagents** (both with Sonnet):

   | Subagent | Focus |
   |----------|-------|
   | **code-reviewer** agent | Quality & Security — naming, error handling, security, CodeCop compliance |
   | **performance-reviewer** agent | Performance — SetLoadFields, N+1 queries, FlowField misuse, caching, bulk operations |

   Each subagent receives the list of changed files, the diffs, the per-file diagnostic slice from step 4, and instructions to review only, NOT edit or fix anything. Subagents should focus on the changed code but may flag pre-existing issues in the same procedures if critical. When citing findings that match a diagnostic code (e.g. `AA0021`, `AS0011`), they should quote the code so the reader can cross-reference the Problems panel.

6. **Collect results** — Merge both subagent outputs into a single consolidated report.
7. **Present report** — Show the report to the user. Do NOT auto-fix anything.

## Report Format

```markdown
# Code Review: [changed file count] files

**Scope:** [staged / unstaged / all uncommitted / diff against branch]
**Files reviewed:** [list]

## Quality & Security (code-reviewer)

### Critical Issues
1. **[Issue]** @ `File.al:Line` — [description]

### High Priority
1. **[Issue]** @ `File.al:Line` — [description]

## Performance (performance-reviewer)

### Critical Issues
1. **[Issue]** @ `File.al:Line` — [description]

### High Priority
1. **[Issue]** @ `File.al:Line` — [description]

## Summary

| Category | CRITICAL | HIGH | MEDIUM |
|----------|----------|------|--------|
| Quality/Security | X | X | X |
| Performance | X | X | X |

**Recommendation:** APPROVE / FIX FIRST / BLOCK
```

## Rules

- **Read-only** — Do NOT edit, write, or fix any files
- **Parallel subagents** — Always run both reviewers as parallel subagents (distinct scopes, no communication needed)
- **Changed files only** — Do not review files that have no modifications
- **Diff-aware** — Reviewers receive the actual diffs, not just full file contents
- **All subagents with Sonnet** — Request Sonnet when running each subagent
