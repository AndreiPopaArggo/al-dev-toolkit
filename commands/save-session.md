---
description: Save session state to a task file. Usage: /save-session <taskID> [message]
---

# Save Session Command

Saves current session state to a task-specific session file.

## Usage

`/save-session <taskID> [optional message]`

## What This Command Does

When invoked, create a structured session entry and **append** it to the task's session file.

## File Location

Save to: `~/.claude/sessions/task-<taskID>.md`

Example: `/save-session FE20059 "finished posting logic"` → saves to `~/.claude/sessions/task-FE20059.md`

## Instructions for Claude

When the user runs `/save-session <taskID> [message]`:

1. **Validate the task ID:**
   - First argument is the task ID (required)
   - If no task ID is provided, list available tasks with `/list-tasks` logic and ask which one to save to
   - Sanitize the task ID for filename: replace spaces and special characters with `-`
   - Remaining arguments after the task ID are the optional message

2. **Find the task file:**
   - Look for `~/.claude/sessions/task-<sanitizedID>.md`
   - If not found, inform the user: "Task <ID> not found. Use /create-task <ID> first, or /list-tasks to see available tasks."
   - Do NOT create the file — that's `/create-task`'s job

3. **Read existing task file:**
   - Read the full contents of the task file
   - Check for existing Known Issues, What's Left, and TODOs sections
   - Note any uncompleted items

4. **Get the current timestamp:**
   - Run `date +"%Y-%m-%d %H:%M"` in Bash to get the actual date and time
   - Use this value for the session entry header and the `**Last Updated:**` field

5. **Gather context automatically:**
   - Run `git status` and `git branch` to get git state
   - Check current TaskList items (if any active tasks exist)
   - Recall files you've read/edited during this session

6. **Confirm issue resolution (IMPORTANT):**
   - If there are existing Known Issues, What's Left, or unchecked TODOs from the task file, present them to the user
   - Ask the user to confirm which items have been fixed/completed
   - Only remove items that the user explicitly confirms are resolved
   - Do NOT assume issues are fixed — always ask for confirmation
   - Keep unconfirmed issues in the updated file

7. **Update the task file:**
   - Update the `**Last Updated:**` timestamp
   - Update the `## TODOs` section: mark completed items, add new ones
   - Move confirmed-completed items to `## Completed`
   - Append the session entry (format below) after the existing content

8. **Evaluate session for learnable patterns:**
   - Review the session for reusable patterns, new conventions, or insights
   - If anything worth saving is found, propose writing it to the memory files (`~/.claude/projects/.../memory/`)
   - If nothing worth saving, skip silently

9. **Confirm to user:**
   - Show path where file was saved
   - Summarize key points captured
   - List any unresolved issues/todos carried forward

## Session Entry Format

Append the following structure to the task file:

```markdown

---
## Session Entry: YYYY-MM-DD HH:MM
**Context:** [user's message, or "Checkpoint save"]

### Current State
- **Phase:** [exploring | planning | implementing | debugging | testing | refactoring]

### What Worked
- [Approach/solution that succeeded]
  - Evidence: [how it was verified - test passed, build succeeded, etc.]

### What Failed
- [Approach that was attempted but didn't work]
  - Why: [error message, issue encountered, or reason it didn't fit]

### What's Untried
- [Approaches considered but not yet attempted]
  - Reason: [why not tried yet - blocked, lower priority, need more info]

### Known Issues
- [ ] [Issue 1 - description and where it occurs]

### Agent Suggestions
- [Risks or concerns noticed during session]
- [Things that might be forgotten or overlooked]
- [Recommendations for the next session]

### Auto-detected Context
**Git:** [branch name] | [X files uncommitted] | [clean/dirty]
**Modified this session:** [list key files read/edited]

### Notes
- [Important decisions made and rationale]
- [Gotchas or surprises discovered]
---
```

## Example Output

After running `/save-session FE20059 "finished posting logic"`:

```
Saving to task FE20059...

Current task file has these open items:
  TODOs:
    1. [ ] Implement posting codeunit
    2. [ ] Add error handling for duplicate entries
    3. [ ] Create permission set
  Known Issues:
    4. [ ] FlowField performance on Sales Line Amount

Which items have been resolved? (Enter numbers, e.g., "1, 2" or "none")
> 1

Marked as completed: Implement posting codeunit
Carrying forward: 3 open items

Session saved to: ~/.claude/sessions/task-FE20059.md

Captured:
- Phase: implementing
- 2 things that worked (posting codeunit, event publishers)
- 1 thing that failed (CalcSums on filtered set)
- 3 open TODOs carried forward
- 1 known issue carried forward
- Git: feature/FE20059 branch, 3 uncommitted files
```

## When to Use

- Before running `/compact` - save state before context is summarized
- Before ending session - preserve progress for next time
- At natural breakpoints - completed a milestone within the task
- When context is getting long - checkpoint before hitting limits
- After debugging sessions - capture what you learned

## Arguments

$ARGUMENTS:
- `<taskID>` - Required. The task identifier (e.g., FE20059, BUG-1234)
- `[message]` - Optional context message (e.g., "finished posting", "blocked on API")
