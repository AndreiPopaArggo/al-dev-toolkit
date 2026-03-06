---
description: Load an existing task session. Usage: /load-task <taskID>
---

# Load Task Session

Loads a task-specific session file into the current context.

## Instructions

When the user runs `/load-task <taskID>`:

1. **Validate the argument:**
   - If no task ID is provided, list available tasks and ask the user which one to load
   - Sanitize the task ID for filename lookup: replace spaces and special characters with `-`

2. **Find the session file:**
   - Look for `~/.claude/sessions/task-<sanitizedID>.md`
   - If not found, try a case-insensitive glob match on `~/.claude/sessions/task-*.md` in case of casing differences
   - If still not found, list available tasks and inform the user

3. **Load the session:**
   - Read the full contents of the session file
   - Present it clearly to the conversation so the context is established

4. **Detect phase and linked plan:**
   - Check if the session file has a `## Plan File` section
   - If a plan file is linked, read it too and note its existence
   - Determine the current phase:
     - **No plan file linked** → task is in **planning phase** (suggest `/plan`)
     - **Plan file linked, TODOs unchecked** → task is in **implementation phase** (suggest `/implement`)
     - **Plan file linked, TODOs checked** → task may be **complete** (suggest review or `/end-task`)

5. **Read the project's CLAUDE.md:**
   - After loading the session, check for and read the project's `CLAUDE.md` (in the project root)
   - This follows the Core Rules requirement

6. **Output format:**
   ```
   Task <taskID> loaded.

   [full session file contents]

   Phase: <planning | implementation | complete>
   Plan: <path to plan file | none>

   Ready to work. <phase-appropriate suggestion>
   ```

## Arguments

$ARGUMENTS:
- `<taskID>` - Required. The task identifier to load (e.g., FE20059, BUG-1234)
