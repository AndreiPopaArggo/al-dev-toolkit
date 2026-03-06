---
description: Create a new task session. Usage: /create-task <taskID>
---

# Create Task Session

Creates a new task-specific session file for tracking work.

## Instructions

When the user runs `/create-task <taskID>`:

1. **Validate the argument:**
   - If no task ID is provided, ask the user for one
   - Sanitize the task ID for use as a filename: replace spaces and special characters with `-`, keep alphanumeric and `-`
   - The display ID (used inside the file) should remain as the user typed it

2. **Check for duplicates:**
   - Check if `~/.claude/sessions/task-<sanitizedID>.md` already exists
   - If it does, inform the user and ask if they want to load it instead (`/load-task`)

3. **Get the current timestamp:**
   - Run `date +"%Y-%m-%d %H:%M"` in Bash to get the actual date and time
   - Use this value for both **Created** and **Last Updated** fields

4. **Create the session file:**
   - Write to: `~/.claude/sessions/task-<sanitizedID>.md`
   - Use the template below

5. **Confirm to user:**
   - Show the file path
   - Confirm the task is created and active

## Session File Template

```markdown
# Task: <taskID>
**Created:** <YYYY-MM-DD HH:MM>
**Last Updated:** <YYYY-MM-DD HH:MM>
**Status:** Active

## Description


## TODOs
- [ ]

## Completed


## Notes

```

## Arguments

$ARGUMENTS:
- `<taskID>` - Required. The task identifier (e.g., FE20059, BUG-1234)
