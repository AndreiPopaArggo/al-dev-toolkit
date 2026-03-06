---
description: List all available task sessions.
---

# List Task Sessions

Lists all task session files with their metadata.

## Instructions

When the user runs `/list-tasks`:

1. **Scan for task files:**
   - Glob for `~/.claude/sessions/task-*.md`

2. **Extract metadata from each file:**
   - Read the first 5 lines of each file to get: Task ID, Created date, Last Updated date, Status
   - Extract the task ID from the `# Task:` header line

3. **Display the list:**
   - If no tasks found:
     ```
     No active tasks found.
     Use /create-task <ID> to start a new task.
     ```
   - If tasks found, show a table:
     ```
     | Task ID | Status | Created | Last Updated |
     |---------|--------|---------|--------------|
     | FE20059 | Active | 2026-02-04 | 2026-02-04 |
     | BUG-1234 | Active | 2026-02-03 | 2026-02-04 |

     Use /load-task <ID> to resume a task, or /create-task <ID> to start a new one.
     ```
