---
name: al-implementation
description: "Implement AL code from a plan. Use when a plan file exists (in .github/plans/ or conversation context) and the user wants to implement it — phrases like 'implement this', 'build it', 'go ahead', 'start coding'. Dispatches coder subagents, builds, and runs reviewers. Do NOT use without a plan — use al-planning first."
argument-hint: "[optional: additional instructions or plan path]"
tools: ['agent', 'read', 'search', 'vscode', 'al_build', 'al_getdiagnostics']
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
- The dispatch marker `[DISPATCH_CONTEXT: orchestrated]` at the top of the prompt — tells the coder that this skill will run the build in Step 4 and the coder must NOT build itself (per-file builds in parallel dispatches fail on cross-file dependencies).
- Plan context: the full plan content for legacy prose plans; per-object context (see new-format section below) for new-format plans. Do not tell coders to read the plan file.
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

## Step 4: Build (MANDATORY after code changes)

Building is **mandatory** after any coder subagent edits — do not skip to review without a clean build.

1. Call `al_build` with `scope: "current"` to compile and produce the `.app`.
2. Call `al_getdiagnostics` with `severities: ["error"]` (and `scope: "current"`) to retrieve any errors as a structured list. Do not parse terminal output.

If `al_build` returns `success: false` OR `al_getdiagnostics` returns a non-empty error list, run a **subagent using the build-error-resolver agent with Sonnet** to fix them.

**Max 3 build-fix cycles.** If still failing after 3, stop and report remaining errors to the user.

## Step 5: Spec Review (MANDATORY gate before Step 6)

After a **successful build**, run a **subagent using the spec-reviewer agent with Sonnet**. Step 6 MUST NOT start until this step returns PASS.

**PASTE the full plan content into the spec-reviewer's prompt.** The agent has its own verification protocol (COVERAGE / EXISTS / SUBSTANTIVE / WIRED — see the agent's own skill file). For new-format plans with `requirements[]`, the agent runs a deterministic Requirement Coverage check against `objects[].satisfies` before per-object verification.

**If GAPS:** Run a coder subagent to fix spec gaps (include `[DISPATCH_CONTEXT: orchestrated]` in the coder's prompt — this skill handles the rebuild below). Rebuild to verify fixes compile. Then re-run spec-reviewer. Repeat up to **3 times**. If still GAPS after 3 attempts, STOP and escalate to the user with the outstanding gaps — do not proceed to Step 6 and do not silently accept the gaps.

**If PASS:** Proceed to Step 6.

**Do not shortcut this step.** Code-reviewer and performance-reviewer verify how code is built (style, security, performance). Spec-reviewer verifies that the right code was built. Running Step 6 first wastes reviewer budget on code that may need to be rewritten.

## Step 6: Quality + Performance Review (Parallel)

After spec compliance passes, run **TWO parallel subagents** (both with Sonnet):

| Agent | Focus |
|-------|-------|
| `code-reviewer` | Quality & Security — naming, Labels, DataClassification, error handling, CodeCop |
| `performance-reviewer` | Performance — SetLoadFields, N+1, FlowField misuse, bulk ops, caching |

Both agents have their review rules referenced in their Required Reading sections.

**Verdict resolution:** If either says BLOCK → BLOCK. If either says FIX FIRST → FIX FIRST. APPROVE only when both approve.

## Step 7: Apply Review Fixes and Verify

- If reviewers find issues, run a coder subagent to apply fixes (include `[DISPATCH_CONTEXT: orchestrated]` in the coder's prompt — this skill handles the rebuild below)
- Rebuild via `al_build` (`scope: "current"`), then `al_getdiagnostics` (`severities: ["error"]`) — if errors remain, dispatch build-error-resolver (max 3 build-fix cycles) until clean. Building after code fixes is **mandatory**.
- Re-run code-reviewer and performance-reviewer in parallel **ONCE** to verify the fixes landed correctly
  - If both APPROVE → proceed to Step 8
  - If new BLOCK or FIX FIRST findings → STOP and escalate to the user with the outstanding findings. Do not loop reviewers again (prevents infinite review cycles).
- **Post-fix spot-check:** After the verification reviewers return APPROVE, read the modified files and verify the fixes didn't break spec compliance — do the files still implement the plan's requirements? This is a quick read, not a full spec-reviewer re-run.

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
