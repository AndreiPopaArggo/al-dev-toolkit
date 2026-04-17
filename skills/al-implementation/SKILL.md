---
name: al-implementation
description: "Implement AL code from a plan. Use when a plan file exists (in .github/plans/ or conversation context) and the user wants to implement it — phrases like 'implement this', 'build it', 'go ahead', 'start coding'. Dispatches coder subagents, builds, and runs reviewers. Do NOT use without a plan — use al-planning first."
argument-hint: "[optional: additional instructions or plan path]"
tools: ['agent', 'read', 'search']
---

# AL Implementation Skill

The main agent acts as a **pure orchestrator**. It runs subagents, runs builds, and reports results.

<HARD-GATE>
- Do NOT write or edit AL code directly. All coding is done by coder subagents.
- Do NOT read .al source files to "verify" coder output. That is the reviewers' job.
- Do NOT fix build errors directly. Run a build-error-resolver subagent.
- Do NOT fix review findings directly. Run a coder subagent for fixes.
- Exception: reading project config files (app.json, CodeCop.json, .github/copilot-instructions.md) is allowed.
- Exception: editing the `plan.status` line in a plan file's YAML frontmatter is allowed (and required for lifecycle transitions).
</HARD-GATE>

## Step 1: Detect the Plan

Check for a plan in this priority order:

1. **Plan path in prompt** — if the invoker passed a file path (e.g., from al-planning skill or `/implement path/to/plan.md`), read that file
2. **Loaded task session** — read the session file, find `## Plan File` section, read the linked plan
3. **LATEST pointer** — check `.github/plans/LATEST` for the most recent plan path. If the file exists and the referenced plan file exists, use it.
4. **Conversation context** — use the current conversation as the plan (user discussed changes directly)

If no plan is found by any method, ask the user.

## Step 1b: Parse Plan Format

After reading the plan file, detect its format:

- If the file starts with `---\n`, it is **new-format** — parse the YAML frontmatter block between the first two `---` lines per [plan-schema.md](../al-planning/plan-schema.md). Use YAML as authoritative for:
  - `objects[]` — what exists, types, IDs, file paths, deps, satisfied requirements
  - `implementation_sequence` — order of coder dispatch
  - `requirements[]` — for spec-reviewer input
  - `project.*` — for pre-implementation config validation
  - `plan.status` — lifecycle state
- If the file does NOT start with `---\n`, it is **legacy prose-only** — continue with existing prose-reading behavior (enumerate objects from `### <Name>` headings under `## Objects`).
- If the frontmatter block exists but is malformed or conflicts with the prose, fall back to prose and emit: "Plan frontmatter appears malformed or out-of-sync; using prose fallback. Consider regenerating."

**Mutate status on dispatch:** before starting Step 3, if the plan is new-format and `plan.status == draft`, update it to `implementing`. After a successful full cycle (Step 8 reached with no blocking reviewer verdicts — see Step 8 for exact conditions), update it to `complete`. Use the Edit tool to change only the `status:` line in the frontmatter; do not touch any other field or the prose body.

Note: this skill owns only the `draft → implementing` and `implementing → complete` transitions. The `implementing → draft` rollback (plan revision) is owned by `al-planning`, not this skill.

## Step 2: Pre-implementation Setup

1. **Read project config** — follow the [Project Setup](../project-setup/SKILL.md) skill to extract BC version, deployment target, project rules
2. **Read `app.json`** — verify object ID ranges match the plan
3. **Read `CodeCop.json`** (if exists) — extract mandatoryAffixes

## Step 3: Implement (Coder Subagents)

Run subagents **using the coder agent with Sonnet** for all coding work.

**Coder prompt contents depend on plan format.** Legacy prose plans: paste the full plan content into every coder's prompt (do not tell coders to read the plan file). New-format plans: paste only the per-object context described below, not the full plan. Either way, do not ask the coder to read the plan file.

**Every coder prompt must include:**
- The full plan content (pasted, not a file path)
- The assigned file list (which files this coder creates/modifies)
- Instruction: "If anything in the plan is ambiguous for your assigned files, ask before guessing."
- Instruction: "Follow all rules from your Required Reading section (al-coding-style, al-patterns, al-performance, al-security)."

**Dispatch sizing (legacy prose plans):**
- 1-2 files → single coder subagent with Sonnet
- 3+ files → multiple parallel coder subagents, one per 1-3 files, split by file assignment

**Dispatch sizing (new-format plans with frontmatter):**
Use `objects[]` + `depends_on` to compute a DAG. Dispatch independent objects (no unfulfilled deps) in parallel; dispatch dependents only after their prerequisites complete. Respect `implementation_sequence` when it orders objects that are otherwise parallelizable.

For each coder, include in the prompt:
- The `objects[].key`, `type`, `id`, `name`, `file`, `extends`, `satisfies`
- The full prose section for that object from the plan body
- The full project config block (`project.*` from frontmatter)

Example split for a 6-file new-format plan where `objects[]` has keys `[CustomerExt, ItemExt, CreditMgt, SalesPostSub, CreditCard, PermissionSet]` with `SalesPostSub.depends_on=[CreditMgt]`:
- **Wave 1 (parallel):** Coder A → CustomerExt + ItemExt; Coder B → CreditMgt; Coder C → CreditCard + PermissionSet
- **Wave 2 (sequential after Wave 1):** Coder D → SalesPostSub

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

If the plan is new-format and all of the following are true:
- Build is green (0 errors)
- `code-reviewer` and `performance-reviewer` both returned APPROVE, OR returned non-APPROVE verdicts whose fixes were applied in Step 7 and the post-fix rebuild + spot-check passed
- `spec-reviewer` returned PASS

then update `plan.status: implementing` → `complete` in the plan file (Edit tool, modify only the `status:` line) before presenting the summary. If any of those are false, leave status as `implementing` and note the blocking reviewer/build state.

Present a summary:
- Files created/modified (with object types and IDs)
- Build status (success / errors remaining)
- Review findings applied
- Items from the plan that were skipped or need attention
- For new-format plans: final `plan.status`

**STOP.** Ask if the user wants anything else.

## Additional Instructions

$ARGUMENTS
