---
name: quick
description: "Quick implementation for simple 1-2 file changes. Use when the user asks for a small, well-understood AL code change that touches at most 2 files — rename a caption, add a field, fix a property, add a column to a page. Do NOT use for multi-object features, unclear requirements, or anything needing research."
argument-hint: "<description of change>"
---

# Quick Implementation

For small, well-understood changes that don't need the full /plan → /implement ceremony.

## Step 0 — Classify: Trivial or Substantive?

Before anything else, evaluate the request:

| Trivial (direct edit) | Substantive (agent pipeline) |
|-----------------------|------------------------------|
| Rename a caption or tooltip | Add a new field + event subscriber |
| Change a field property (MinValue, BlankZero, Editable) | New codeunit or page |
| Fix a typo in a Label | Write or refactor business logic |
| Add/remove a column on a page (field already exists) | Changes touching 2+ objects with new logic |
| Change an enum value caption | Anything requiring new procedures |
| Adjust a SetRange/SetFilter constant | Changes you aren't 100% certain about |

**Trivial changes NEVER include creating new files.** Any task that creates new `.al` files uses the substantive path, regardless of how simple the logic is.

**Rule of thumb:** If the change is a single-property or single-line edit to an existing file and you can see exactly what to write, it's trivial. If there's any logic to compose, any new files to create, or any doubt, it's substantive.

---

## Trivial Path (direct edit)

1. **Read project context** — follow the [Project Setup](../project-setup/SKILL.md) skill: `app.json`, `CodeCop.json` (if exists), `.github/copilot-instructions.md` (if exists)
2. **Read the target file**
3. **Read the al-coding-style skill** for naming/style rules
4. **Make the edit directly** using the Edit tool
5. **Build and fix until clean** — call #ms-dynamics-smb.al/al_build({scope:"current"}) then #ms-dynamics-smb.al/al_get_diagnostics({scope:"current", severities:["error"]}).
   - If the error list is non-empty: attempt to fix directly (minimal diffs, up to 3 attempts per error). After each fix, re-run #ms-dynamics-smb.al/al_build and re-query #ms-dynamics-smb.al/al_get_diagnostics.
   - Loop until #ms-dynamics-smb.al/al_get_diagnostics returns an empty error list, OR the same `code` at the same `file`/`line` fails to resolve after 3 attempts, OR fixes introduce new errors you cannot resolve.
   - If the loop cannot reach zero errors, escalate to the Substantive Path (which dispatches build-error-resolver with max 3 build-fix cycles) — do not declare done with a failing build.
6. **Report:** file modified, build status (must be PASS), what changed

No coder agent, no reviewers. Done.

---

## Substantive Path (agent pipeline)

<HARD-GATE>
- Do NOT write or edit AL code directly. Run a coder subagent.
- Do NOT fix build errors directly. Run a build-error-resolver subagent.
- Do NOT fix review findings directly. Run a coder subagent for fixes.
- Exception: reading project config files (app.json, CodeCop.json, .github/copilot-instructions.md) and existing .al files for context is allowed.
</HARD-GATE>

1. **Read project context:**
   - Read project config — follow [Project Setup](../project-setup/SKILL.md) for BC version, deployment target, project rules
   - Read `app.json` — object ID ranges, dependencies
   - Read `CodeCop.json` (if exists) — mandatoryAffixes

2. **If the change involves existing files:**
   - Read those files to understand current state

3. **Implement:**
   - Run a subagent using the **coder** agent with Sonnet
   - **Include the dispatch marker `[DISPATCH_CONTEXT: orchestrated]` at the top of the coder's prompt** — this skill runs the build in Step 4, so the coder must NOT build itself.
   - **PASTE the user's original request and project context into the coder's prompt** — do not make the coder guess from conversation context
   - Include instruction: "If anything is ambiguous, ask before guessing."
   - The coder agent has Required Reading references to al-coding-style and other rules.
   - Coder implements the change directly

4. **Build (MANDATORY after code changes):**
   - Building is mandatory after any coder subagent edits — do not skip to review without a clean build.
   - Call #ms-dynamics-smb.al/al_build({scope:"current"}) to compile, then #ms-dynamics-smb.al/al_get_diagnostics({severities:["error"]}) to retrieve the structured error list.
   - If the error list is non-empty OR #ms-dynamics-smb.al/al_build returned `success:false`: run a subagent using the **build-error-resolver** agent with Sonnet
   - Max 3 build-fix cycles

5. **Spec Review (MANDATORY gate before step 6):**
   After successful build, run a subagent using the **spec-reviewer** agent with Sonnet. Step 6 MUST NOT start until this step returns PASS.
   - **PASTE the user's original request** into the prompt as the spec (user-request input form — no plan frontmatter, so Requirement Coverage does not run; the agent verifies EXISTS / SUBSTANTIVE / WIRED against the request)
   - The agent verifies the implementation matches the request (nothing missing, nothing extra)
   - **If GAPS:** Run a coder subagent to fix (include `[DISPATCH_CONTEXT: orchestrated]` in the coder's prompt — this skill handles the rebuild below). Rebuild. Re-run spec-reviewer. Repeat up to **3 times**. If still GAPS after 3 attempts, STOP and escalate to the user with outstanding gaps — do not proceed to step 6 and do not silently accept the gaps.
   - **If PASS:** Proceed to step 6.

   **Do not shortcut this step.** Code-reviewer and performance-reviewer verify how code is built; spec-reviewer verifies that the right code was built.

6. **Quality + Performance Review (Parallel):**
   Run TWO parallel subagents (both with Sonnet):
   - **code-reviewer** — quality, naming, Labels, DataClassification, CodeCop
   - **performance-reviewer** — SetLoadFields, N+1, FlowField misuse, bulk ops

   Verdict resolution: any BLOCK → BLOCK, any FIX FIRST → FIX FIRST. APPROVE only when both approve.

7. **Apply review fixes and verify (if any findings):**
   - Dispatch a coder subagent to apply the fixes (include `[DISPATCH_CONTEXT: orchestrated]` in the coder's prompt — this skill handles the rebuild below).
   - Rebuild via #ms-dynamics-smb.al/al_build({scope:"current"}) then #ms-dynamics-smb.al/al_get_diagnostics({severities:["error"]}) — if errors remain, dispatch build-error-resolver (max 3 build-fix cycles) until clean.
   - Re-run code-reviewer and performance-reviewer in parallel **ONCE** to verify the fixes landed correctly.
     - If both APPROVE → proceed to step 8.
     - If new BLOCK or FIX FIRST findings → STOP and escalate to the user with the outstanding findings. Do not loop reviewers again (prevents infinite review cycles).
   - **Post-fix spot-check:** After code-reviewer and performance-reviewer both APPROVE, read the modified files and verify the fixes didn't break alignment with the user's original request — does the implementation still do what was asked? This is a quick read, not a full spec-reviewer re-run.

8. **Report:**
   - Files created/modified
   - Build status
   - Review findings applied

## When to Use

- Adding a field to a table extension
- Fixing a bug in a single codeunit
- Small adjustments to page layout
- Renaming or refactoring within 1-2 files

## When NOT to Use

- New features requiring 3+ files → use `/plan`
- Changes requiring base app research → use `/plan`
- Unclear requirements → use `/plan`
- Anything touching posting, financial, or security code → use `/plan`

## User's Request

$ARGUMENTS
