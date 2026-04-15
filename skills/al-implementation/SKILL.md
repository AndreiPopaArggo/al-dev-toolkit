---
name: al-implementation
description: "Implement from a plan or conversation context. Covers code, build, and review."
argument-hint: "[optional: additional instructions or plan path]"
disable-model-invocation: true
tools: ['agent', 'read', 'search']
---

# AL Implementation Skill

The main agent acts as a **pure orchestrator**. It runs subagents, runs builds, and reports results.

<HARD-GATE>
- Do NOT write or edit AL code directly. All coding is done by coder subagents.
- Do NOT read .al source files to "verify" coder output. That is the reviewers' job.
- Do NOT fix build errors directly. Run a build-error-resolver subagent.
- Do NOT fix review findings directly. Run a coder subagent for fixes.
- Exception: reading project config files (CLAUDE.md, app.json, CodeCop.json) is allowed.
</HARD-GATE>

## Step 1: Detect the Plan

Check for a plan in this priority order:

1. **Plan path in prompt** — if the invoker passed a file path (e.g., from al-planning skill or `/implement path/to/plan.md`), read that file
2. **Loaded task session** — read the session file, find `## Plan File` section, read the linked plan
3. **LATEST pointer** — check `~/.claude/plans/LATEST` for the most recent plan path. If the file exists and the referenced plan file exists, use it.
4. **Conversation context** — use the current conversation as the plan (user discussed changes directly)

If no plan is found by any method, ask the user.

## Step 2: Pre-implementation Setup

1. **Read project CLAUDE.md** — extract BC version, deployment target, project rules
2. **Read `app.json`** — verify object ID ranges match the plan
3. **Read `CodeCop.json`** (if exists) — extract mandatoryAffixes

## Step 3: Implement (Coder Subagents)

Run subagents **using the coder agent with Sonnet** for all coding work.

**PASTE the full plan content into every coder's prompt.** Do not tell coders to read the plan file — provide the text directly so they start with full context immediately.

**Every coder prompt must include:**
- The full plan content (pasted, not a file path)
- The assigned file list (which files this coder creates/modifies)
- Instruction: "If anything in the plan is ambiguous for your assigned files, ask before guessing."
- Instruction: "Follow all rules from your Required Reading section (al-coding-style, al-patterns, al-performance, al-security)."

**1-2 files:** Run a single coder subagent with Sonnet.

**3+ files:** Run **multiple parallel coder subagents** — one per 1-3 files:
- Split by file assignment, not by object type
- Each subagent works independently; coordination goes through the orchestrator

Example split for a 6-file task:
- **Coder A:** Table extension + enum (2 files)
- **Coder B:** Event subscriber codeunit + service codeunit (2 files)
- **Coder C:** Page extension + permission set (2 files)

After all coders complete, verify no cross-file conflicts (duplicate IDs, mismatched references).

## Step 4: Build

Run the default VS Code build task (AL: Package) to compile. Check the terminal output for errors.

If errors occur, run a **subagent using the build-error-resolver agent with Sonnet** to fix them.

**Max 3 build-fix cycles.** If still failing after 3, stop and report remaining errors to the user.

## Step 5: Spec Review

After a **successful build**, run a **subagent using the spec-reviewer agent with Sonnet**.

**PASTE the full plan content into the spec-reviewer's prompt.** The agent has its own verification protocol (EXISTS / SUBSTANTIVE / WIRED) — just provide the plan as the spec.

**If GAPS:** Run a coder subagent to fix spec gaps. Rebuild to verify fixes compile. Then proceed to Step 6.

**If PASS:** Proceed to Step 6.

## Step 6: Quality + Performance Review (Parallel)

After spec compliance passes, run **TWO parallel subagents** (both with Sonnet):

| Agent | Focus |
|-------|-------|
| `code-reviewer` | Quality & Security — naming, Labels, DataClassification, error handling, CodeCop |
| `performance-reviewer` | Performance — SetLoadFields, N+1, FlowField misuse, bulk ops, caching |

Both agents have their review rules referenced in their Required Reading sections.

**Verdict resolution:** If either says BLOCK → BLOCK. If either says FIX FIRST → FIX FIRST. APPROVE only when both approve.

## Step 7: Apply Review Fixes

- If reviewers find issues, run a coder subagent to apply fixes
- Rebuild to verify fixes compile
- Do NOT re-run full reviewers after fixes (avoid infinite loop)
- **Post-fix spot-check:** After rebuild passes, read the modified files and verify the review fixes didn't break spec compliance — do the files still implement the plan's requirements? This is a quick read, not a full spec-reviewer re-run.

## Step 8: Report

Present a summary:
- Files created/modified (with object types and IDs)
- Build status (success / errors remaining)
- Review findings applied
- Items from the plan that were skipped or need attention

**STOP.** Ask if the user wants anything else.

## Additional Instructions

$ARGUMENTS
