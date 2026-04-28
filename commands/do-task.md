---
description: "Run an arggoplanner (dotProject) task end-to-end: fetch task + timeline + attachments + cross-task references via the read-only mysql-planner MCP, scope to the latest unsatisfied request, then drive /al-planning → /al-implementation. Designed for fresh VS Code Copilot Chat conversations."
argument-hint: "<taskID> [--force] [free-form instructions]"
---

# /do-task — End-to-end task implementation from arggoplanner

Drives a dotProject task from "ticket in arggoplanner" to "implemented, built, reviewed AL code." Six phases:

1. **Fetch** — pull task + project + logs + files + referenced tasks via `mysql-planner` MCP
2. **Gates** — completion gate (2a) + non-coding gate (2b)
3. **Attachment gate** — if files are attached on the task, prompt the user to drop them in chat
4. **Plan** — invoke al-planning skill with a structured payload and the `[DISPATCH_CONTEXT: do-task taskID=<N>]` marker
5. **Implement** — invoke al-implementation skill in the same context
6. **Report** — print final summary with dotProject task URL

You are the orchestrator. Run the phases in order. Do NOT skip phases.

## Argument parsing

`$ARGUMENTS` has the form: `<taskID> [--force] [free-form text...]`

1. Trim leading/trailing whitespace from `$ARGUMENTS`.
2. The first whitespace-separated token must be a positive integer — that's `<taskID>`. If it is missing or non-numeric, stop with: `/do-task requires a numeric taskID as the first argument. Usage: /do-task <taskID> [--force] [instructions]`.
3. After the taskID, check if the next token is the literal `--force`. If so, set `force = true` and remove it. Otherwise `force = false`.
4. Everything remaining is the free-form user instructions string. May be empty.

## Phase 1 — Fetch

All four queries below run via `mcp__mysql-planner__mysql_query`. The MCP is read-only; that's expected.

The existing `mcp-subagent-guard.ps1` PreToolUse hook only matches `al-mcp-server` patterns (verified by reading the script's regex), so `mysql_query` is unrestricted from the main agent turn. Do NOT spawn a researcher subagent for these queries — call the SQL tool directly.

### Q1 — Task + project

```sql
SELECT t.task_id, t.task_name, t.task_description, t.task_status,
       t.task_percent_complete, t.task_priority, t.task_DeveloperDueDate,
       t.task_owner, t.task_creator, t.task_project,
       p.project_name, p.project_short_name, p.project_company
FROM tasks t LEFT JOIN projects p ON t.task_project = p.project_id
WHERE t.task_id = <taskID>;
```

If the result set is empty: stop with `Task <taskID> not found in arggoplanner.`

If the MCP call returns a transport error: stop with the raw error followed by `Retry /do-task <taskID>; if persistent, contact maintainer.`

### Q2 — Logs (chronological)

```sql
SELECT task_log_id, task_log_name, task_log_description,
       task_log_creator, task_log_hours, task_log_date, task_log_type
FROM task_log
WHERE task_log_task = <taskID>
ORDER BY task_log_date;
```

Empty result is fine — many new tasks have zero logs.

### Q3 — Attachments

```sql
SELECT file_id, file_real_filename, file_name, file_type,
       file_size, file_date, file_description
FROM files
WHERE file_task = <taskID>;
```

Empty result is fine — most tasks have no attachments. Phase 3 only triggers if this returns rows.

### Cross-task discovery (regex pass)

After Q1 and Q2 return, scan `task_description` (from Q1) and every `task_log_description` (from Q2) for these two patterns:

- URL form: `task_id=(\d+)` — matches dotProject deep-links like `http://sql/arggoplanner/index.php?m=tasks&a=view&task_id=4013`. Reliably a task reference.
- Phrase form: `\b[Tt]ask\s+(\d{4,5})\b` — matches "task 21333", "Task 4013".

Bare 5-digit numbers are intentionally NOT matched — they collide with AL object IDs (e.g. page 51023, codeunit 50006).

Collect the unique task IDs found (excluding the current `<taskID>` itself). If the set is empty, skip Q4. Otherwise run Q4.

### Q4 — Referenced task summaries

```sql
SELECT t.task_id, t.task_name, t.task_description, t.task_percent_complete,
       (SELECT GROUP_CONCAT(task_log_description ORDER BY task_log_date SEPARATOR '\n---\n')
        FROM task_log WHERE task_log_task = t.task_id) AS log_dump
FROM tasks t
WHERE t.task_id IN (<comma-separated referenced ids>);
```

This is single-hop — do NOT recurse into the referenced tasks' own references. If the user wants to drill into one, they run `/do-task <ref-id>` separately.

After Q1–Q4 complete, hold the results in working memory. Do NOT print raw SQL output back to the user. Phases 2, 3, 4 will use the data.

## Phase 2a — Completion gate

If `force = true` (the user passed `--force`), skip this gate entirely and proceed to Phase 2b.

Otherwise, decide whether the task has any unsatisfied request. **Stop signals — any one trips the gate:**

- `task_percent_complete = 100` (from Q1).
- The latest log entry (last row of Q2 by date) is a delivery / fix acknowledgment from a developer with no later requester reply asking for more. Strong markers used by this team: `@se poate testa`, `rezolvat`, `modificat pe productie`, `@instalat`, `pus pe productie`. These are signals to read for context — do not regex-match. A log that says "rezolvat partial" with a follow-up request immediately after is NOT a stop signal.
- The latest log is a verification ask only ("rog verificare", "please verify") with no code work pending — i.e. the dev has already delivered and asked the requester to confirm.

**Synthesize from context, do not pattern-match.** Read the timeline as a human reviewer would. The markers are this team's vocabulary; use them as hints, not contracts. Other teams may use different wording — the gate must still trip on equivalent meaning.

**If a stop signal trips, stop with this message:**

```
Task <taskID> appears complete.

Last activity (<task_log_date>): <first 200 chars of last log description, ellipsis if longer>

Re-run with `/do-task <taskID> --force` if you disagree, or refine the dotProject task with the new ask.

dotProject: http://sql/arggoplanner/index.php?m=tasks&a=view&task_id=<taskID>
```

If no stop signal, proceed to Phase 2b.

## Phase 2b — Non-coding gate

`--force` does NOT bypass this gate. `--force` is for "the agent is wrong about completion." It is not for "I want to run code generation on a non-coding task."

Decide whether the latest unsatisfied request is actually a coding task. **Stop signals:**

- The task is a pure estimation / scoping ask. Patterns: description starts with or is dominated by "rog estimare" / "rog evaluare" / "estimate effort" / "scope this" / "give me an estimate", and the log timeline contains only effort numbers, role assignments, or planning meta — no implementation request.
- The task is purely operational — installing a binary, running a script, configuring a cloud resource — with no AL code to write.
- The task is asking for a code review only ("review the X branch", "verify this works") with no new code to produce.

**If a stop signal trips, stop with this message:**

```
Task <taskID> is not a coding task (<short reason: estimation/scoping/operations/review-only>).

/do-task only handles development tasks. Convert the dotProject task to a concrete development request, then re-run.

dotProject: http://sql/arggoplanner/index.php?m=tasks&a=view&task_id=<taskID>
```

If neither gate trips, proceed to Phase 3.

## Phase 3 — Attachment gate

If Q3 returned zero rows, skip this phase and proceed to Phase 4.

If Q3 returned rows, the user must attach the files in chat before planning can proceed. Print:

```
Task <taskID> has <N> attachment(s) in arggoplanner:
  - <file_name> (<file_type>, <human-readable size>)
  - <file_name> (<file_type>, <human-readable size>)
  ...

Please drop them into this chat (drag/drop or paste), then say "go" or just continue. I'll resume from there.

dotProject: http://sql/arggoplanner/index.php?m=tasks&a=view&task_id=<taskID>
```

Then **stop the current turn**. Do NOT proceed to Phase 4 — the user has not attached the files yet.

When the user replies on the next turn (typically with files attached and a brief message like "go" or even no message), the model resumes /do-task. Files are now in conversation context — Phase 4's payload assembly will reference them as "(user has dropped the following in chat: ...)". You do NOT need to re-fetch from arggoplanner; the data from Phases 1–3 is still in your context.

**If the user replies without attaching files** (says "skip" or "no files" or similar): proceed to Phase 4 anyway. al-planning may flag the missing context as a clarifying question if it determines the description is not enough. Do NOT enforce attachment yourself.

## Phase 4 — Plan

Assemble the payload below and invoke the al-planning skill inline (same context, NOT a subagent).

### Payload template

The payload is a markdown blob you build by substituting fields from Phases 1 (Q1–Q4) and the parsed arguments. Build it exactly in the structure below — al-planning's orchestrator instructions reference these section headings.

```
[DISPATCH_CONTEXT: do-task taskID=<taskID>]

# Task <taskID>: <task_name>

**Project:** <project_name> (<project_short_name>)
**Status:** <task_status> · <task_percent_complete>% complete · due <task_DeveloperDueDate>
**dotProject URL:** http://sql/arggoplanner/index.php?m=tasks&a=view&task_id=<taskID>

## User instructions for this run

<free-form text from $ARGUMENTS, or the literal string "(none — default behavior: scope to latest unsatisfied request)" when empty>

## Original description

<task_description verbatim>

## Timeline (chronological)

### <task_log_date> · log #<task_log_id> · type <task_log_type> · creator <task_log_creator>

<task_log_description>

### <task_log_date> · log #<task_log_id> · type <task_log_type> · creator <task_log_creator>

<task_log_description>

(repeat for every log row from Q2 in chronological order)

## Attachments

<one of:>
- "(no attachments on this task)" — when Q3 returned zero rows
- "(user has dropped the following in chat: <comma-separated filenames the model can see in conversation context>)" — when Phase 3 ran and the user attached files

## Referenced tasks (one-hop context, NOT work to plan)

<one of:>
- "(no cross-task references found)" — when Q4 was skipped
- one block per Q4 row:

### Task <ref task_id>: <ref task_name> — <ref task_percent_complete>% complete

<ref task_description>

**Recent log dump:**
<last 5 entries from log_dump, oldest first; trim each to 500 chars max with ellipsis if longer>

## Orchestrator instructions

This is an iterative ticket from arggoplanner. Read the timeline holistically before planning.

**Scope rule (default):** Plan ONLY the latest unsatisfied request. Earlier completed work is context — note existing object IDs, prior decisions, established conventions; do NOT re-plan it.

**User instructions in the section above override the scope rule** when present.

**Completion markers used by this team** (strong signals, not contracts): `@se poate testa`, `rezolvat`, `modificat pe productie`, `@instalat`, `pus pe productie`. A dev reply containing these usually means delivered. `@feedback` and `@in lucru` are work-in-progress / new-request signals.

**Cross-task references** in the timeline have already been pre-fetched into the section above. They are context only — do NOT generate plans for them. If you spot a task reference the regex missed, you may issue an additional `mysql_query` to fetch it.

If anything is ambiguous after reading the timeline + user instructions + referenced tasks, ASK CLARIFYING QUESTIONS before designing (al-planning Step 4 — one question at a time).

When done planning, write the plan file to `.github/plans/task-<taskID>-plan.md` (with `plan.id: task-<taskID>-plan`), update LATEST, and return control. Do NOT present the 3-option handoff prompt — /do-task always continues.
```

### Invoke al-planning

Pass the assembled payload as `$ARGUMENTS` to the al-planning skill. Run the skill in the current context (not a subagent). al-planning will:

1. Detect the `[DISPATCH_CONTEXT: do-task taskID=<taskID>]` marker.
2. Run its specificity gate (Step 0). If the request is too vague even after the timeline analysis, al-planning stops with its specificity message — relay that to the user verbatim and stop /do-task.
3. Read project config, glob src/**/*.al, run researcher subagents, design.
4. Write the plan file to `.github/plans/task-<taskID>-plan.md` with `plan.id: task-<taskID>-plan` (forced by the marker).
5. Update LATEST.
6. Recognize the marker → skip the 3-option Handoff prompt → return control to /do-task.

If al-planning asks a clarifying question, pause /do-task — the user answers — al-planning resumes — /do-task continues to Phase 5 once the plan file is written.

After al-planning returns, verify the plan file exists at `.github/plans/task-<taskID>-plan.md`. If the file is missing, stop with: `al-planning did not produce a plan file. Check the al-planning output and re-run /do-task <taskID> when the issue is resolved.`

## Phase 5 — Implement

Invoke the al-implementation skill inline (same context, NOT a subagent). al-implementation runs as today — no /do-task-specific overrides at this phase. The plan file path is already in conversation context, so al-implementation's "Plan path in prompt" detection (Step 1, priority 1) picks it up.

al-implementation will:

1. Detect the plan via the path in conversation context.
2. Mutate `plan.status: draft → implementing` in the plan file.
3. Run pre-implementation setup (read app.json / CodeCop.json / .github/copilot-instructions.md).
4. Dispatch coder subagents per its dispatch sizing rules (legacy prose vs new-format frontmatter — al-planning produces new-format, so the DAG-based dispatch applies).
5. Run #ms-dynamics-smb.al/al_build + #ms-dynamics-smb.al/al_get_diagnostics. Run build-error-resolver subagent if needed (max 3 cycles).
6. Run spec-reviewer subagent (mandatory gate). If GAPS, dispatch a coder to fix and re-build. Max 3 spec-fix cycles.
7. Run code-reviewer + performance-reviewer subagents in parallel.
8. If reviewers find issues, dispatch a coder to fix, rebuild, re-run reviewers ONCE.
9. If all gates pass, mutate `plan.status: implementing → complete`.

Capture al-implementation's final output: build status, reviewer verdicts, files modified, any escalations. /do-task uses these for Phase 6.

If al-implementation halts mid-flow (build cycles exhausted, reviewer verdict BLOCK that wasn't fixable, spec-reviewer GAPS that survived 3 rounds): proceed to Phase 6 anyway. Phase 6's Outstanding section captures what's incomplete.

## Phase 6 — Report

Print the final summary to the user. Build the message from values captured in Phases 1, 4, and 5.

```
## /do-task <taskID> — Done

**Task:** <task_name> (<project_short_name>)
**Plan:** .github/plans/task-<taskID>-plan.md (status: <plan.status from the plan file after Phase 5>)
**Build:** <"green (0 errors)" if al-implementation reported a clean build; otherwise "<N> errors remaining">
**Spec review:** <PASS / GAPS — N items>
**Code review:** <APPROVE / FIX FIRST / BLOCK>
**Performance review:** <APPROVE / FIX FIRST / BLOCK>

**Files created/modified:**
- <relative path> (<object type>, <object id if applicable>)
- ...

**Outstanding:**
- <bullet for each unresolved review finding, build error, or escalation>
- (or the literal "(none)" if everything is clean)

**dotProject:** http://sql/arggoplanner/index.php?m=tasks&a=view&task_id=<taskID>

Note: arggoplanner is read-only via the MCP. Update task status / add a delivery log manually.
```

After printing this, /do-task is done. Do NOT continue or ask the user what's next — the user will type their next request when ready.

## User's Request

$ARGUMENTS
