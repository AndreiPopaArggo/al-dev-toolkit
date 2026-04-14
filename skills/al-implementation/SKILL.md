---
name: al-implementation
description: "Implement from a plan or conversation context. Covers code, build, and review."
argument-hint: "[optional: additional instructions or plan path]"
disable-model-invocation: true
---

# AL Implementation Skill

The main agent acts as a **pure orchestrator**. It dispatches agents, runs builds, and reports results.

<HARD-GATE>
- Do NOT write or edit AL code directly. All coding is done by coder agents.
- Do NOT read .al source files to "verify" coder output. That is the reviewers' job.
- Do NOT fix build errors directly. Spawn a build-error-resolver agent.
- Do NOT fix review findings directly. Spawn a coder agent for fixes.
- Exception: reading project config files (CLAUDE.md, app.json, CodeCop.json) is allowed.
</HARD-GATE>

## Step 1: Detect the Plan

Check for a plan in this priority order:

1. **Plan path in prompt** — if the invoker passed a file path (e.g., from al-planning skill or `/implement path/to/plan.md`), read that file
2. **Loaded task session** — read the session file, find `## Plan File` section, read the linked plan
3. **LATEST pointer** — check `~/.claude/plans/LATEST` for the most recent plan path. If the file exists and the referenced plan file exists, use it.
4. **Conversation context** — use the current conversation as the plan (user discussed changes directly)

If no plan is found by any method, ask the user via AskUserQuestion.

## Step 2: Pre-implementation Setup

1. **Read project CLAUDE.md** — extract BC version, deployment target, project rules
2. **Read `app.json`** — verify object ID ranges match the plan
3. **Read `CodeCop.json`** (if exists) — extract mandatoryAffixes

## Step 3: Implement (Coder Agents)

All coders use **Sonnet** — set `model: "sonnet"` on every agent.

**PASTE the full plan content into every coder's prompt.** Do not tell coders to read the plan file — provide the text directly so they start with full context immediately.

**Every coder prompt must include:**
- The full plan content (pasted, not a file path)
- The assigned file list (which files this coder creates/modifies)
- Instruction: "If anything in the plan is ambiguous for your assigned files, ask via AskUserQuestion before guessing."
- Instruction: "Follow all preloaded skill rules (al-dev-toolkit:al-coding-style, al-dev-toolkit:al-patterns, al-dev-toolkit:al-performance, al-dev-toolkit:al-security)."
- Instruction: "Use MCP tools instead of WebFetch/WebSearch."

**1-2 files:** Spawn a single coder agent (subagent_type: `coder`, model: `sonnet`).

**3+ files:** Create an **agent team** and spawn **multiple coder teammates** — one per 1-3 files:
- Split by file assignment, not by object type
- Teammates can communicate to coordinate shared references

Example split for a 6-file task:
- **Coder A:** Table extension + enum (2 files)
- **Coder B:** Event subscriber codeunit + service codeunit (2 files)
- **Coder C:** Page extension + permission set (2 files)

After all coders complete, verify no cross-file conflicts (duplicate IDs, mismatched references).

## Step 4: Build

Compile using the build command from CLAUDE.md (dynamic alc.exe detection via glob).

If errors occur, spawn a **build-error-resolver agent** (subagent_type: `build-error-resolver`, model: `sonnet`) to fix them.

**Max 3 build-fix cycles.** If still failing after 3, stop and report remaining errors to the user.

## Step 5: Spec Review

After a **successful build**, spawn the **spec-reviewer** agent (subagent_type: `spec-reviewer`, model: `sonnet`).

**PASTE the full plan content into the spec-reviewer's prompt.** The agent has its own verification protocol (EXISTS / SUBSTANTIVE / WIRED) — just provide the plan as the spec.

**If GAPS:** Spawn a coder agent to fix spec gaps. Rebuild to verify fixes compile. Then proceed to Step 6.

**If PASS:** Proceed to Step 6.

## Step 6: Quality + Performance Review (Parallel)

After spec compliance passes, spawn **TWO parallel agents** (both model: `sonnet`) in a single message:

| Agent | Focus |
|-------|-------|
| `code-reviewer` | Quality & Security — naming, Labels, DataClassification, error handling, CodeCop |
| `performance-reviewer` | Performance — SetLoadFields, N+1, FlowField misuse, bulk ops, caching |

Both have their review skills preloaded via agent frontmatter.

**Verdict resolution:** If either says BLOCK → BLOCK. If either says FIX FIRST → FIX FIRST. APPROVE only when both approve.

## Step 7: Apply Review Fixes

- If reviewers find issues, spawn a coder agent to apply fixes (or a team if changes span multiple files)
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
