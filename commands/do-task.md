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

## User's Request

$ARGUMENTS
