---
description: End and delete a task session. Usage: /end-task <taskID>
---

# End Task Session

Deletes a task session file, marking the task as complete.

## Instructions

When the user runs `/end-task <taskID>`:

1. **Validate the argument:**
   - If no task ID is provided, list available tasks and ask which one to end
   - Sanitize the task ID for filename lookup: replace spaces and special characters with `-`

2. **Find the session file:**
   - Look for `~/.claude/sessions/task-<sanitizedID>.md`
   - If not found, try a case-insensitive glob match
   - If still not found, inform the user and list available tasks

3. **Confirm before deleting:**
   - Show the task ID and a brief summary (first few lines)
   - Ask the user to confirm deletion
   - If the task has uncompleted TODOs, warn the user

4. **Delete the file:**
   - Only after user confirmation
   - Use Bash `rm` to delete `~/.claude/sessions/task-<sanitizedID>.md`

5. **Confirm:**
   ```
   Task <taskID> ended and session file deleted.
   ```

## Arguments

$ARGUMENTS:
- `<taskID>` - Required. The task identifier to end (e.g., FE20059, BUG-1234)
