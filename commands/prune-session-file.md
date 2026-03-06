---
description: Remove session entries from a task file, keeping the header. Usage: /prune-session-file <taskID>
---

# Prune Session File Command

Strips all appended session entries from a task file, keeping only the header (metadata, TODOs, Description, Completed, Notes).

## Usage

`/prune-session-file <taskID>`

## Instructions for Claude

When the user runs `/prune-session-file <taskID>`:

1. **Validate the task ID:**
   - If no task ID is provided, list available tasks and ask which one to prune
   - Sanitize the task ID for filename lookup

2. **Find the task file:**
   - Look for `~/.claude/sessions/task-<sanitizedID>.md`
   - If not found, inform the user and list available tasks

3. **Parse the task file:**
   - The file has two sections:
     - **Header** (everything before the first `---` separator): Task metadata, Description, TODOs, Completed, Notes
     - **Session entries** (after the first `---`): Appended by `/save-session`
   - If there are no session entries, inform the user and do nothing

4. **Rewrite the file:**
   - Keep only the header
   - Remove all `---` separated session entries
   - Update `**Last Updated:**` timestamp
   - Show the user how many entries were removed

## Example

```
/prune-session-file FE20059
```

Output:
```
Pruned task FE20059: removed 4 session entries, header preserved.
```

## Arguments

$ARGUMENTS:
- `<taskID>` - Required. The task identifier (e.g., FE20059, BUG-1234)
