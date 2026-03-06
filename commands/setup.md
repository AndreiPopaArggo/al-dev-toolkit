---
description: "First-time setup wizard. Creates directories, configures notifications, status line, CLAUDE.md, and installs al-mcp-server."
allowed-tools: [Bash, Read, Write, Glob, AskUserQuestion]
---

# Setup Wizard

Walk a new user through everything the plugin does NOT ship with. Run each step in order, skipping what already exists. Show a clear status after each step.

## Step 1: Create directories

Check and create if missing:
- `~/.claude/context/` — temporary context files for planning
- `~/.claude/sessions/` — task session tracking files
- `~/.claude/plans/` — plan files from /plan

For each: if it exists, print `[exists]`, if not, create it and print `[created]`.

## Step 2: Notifications

Check if `~/.claude/notify-config.json` exists.

**If it exists:** Print `[exists] Notification config found.`

**If not:** Create it with:
```json
{
  "sound": false
}
```
Print `[created] Notification config (sound off by default).`

Then tell the user:
> Notifications are now configured. Sound is off by default. Use `/notify` anytime to toggle sound on/off.

## Step 3: Status line

Check if `~/.claude/scripts/statusline.js` exists.

**If it exists:** Print `[exists] Status line script found.`

**If not:** Create `~/.claude/scripts/` directory if needed, then write this file to `~/.claude/scripts/statusline.js`:

```javascript
#!/usr/bin/env node
let input = '';
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input); } catch { }

  const model = (data.model && data.model.display_name) || '??';
  const pct = Math.round(data.context_window?.used_percentage || 0);
  const barWidth = 10;
  const filled = Math.round(pct * barWidth / 100);
  const bar = '\u2593'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  process.stdout.write(`[${model}] ${bar} ${pct}%`);
});
```

Print `[created] Status line script.`

Then configure it by running:
```bash
claude config set statusLine.command "node $HOME/.claude/scripts/statusline.js"
```

Print the result. If it fails, tell the user to run the command manually.

## Step 4: Global CLAUDE.md

Check if `~/.claude/CLAUDE.md` exists.

**If it exists:** Print `[exists] Global CLAUDE.md found. Skipping (will not overwrite).`

**If not:** Write the following template to `~/.claude/CLAUDE.md`:

---BEGIN TEMPLATE---
# BC AL Development Assistant

Make the smallest correct change that satisfies the requirement.

## Core Rules

- **Always read the project-level CLAUDE.md** before any exploration or code changes. Project-level instructions override global defaults.
- **Start simple.** Do not over-engineer. Present the minimal viable approach first.
- **Only make changes that are explicitly requested.** Do not add extra files, cleanup, or "improvements" without permission.
- When asked to apply specific numbered items (e.g., "apply #1 and #3"), apply **ONLY** those items.

## Platform

Windows (MSYS/Git Bash). Use forward slashes in paths. `$HOME` instead of `%USERPROFILE%`.

## Repository Structure

- `src/` — Production AL objects (one object per file)
- `test/` — Test codeunits (only when explicitly requested)
- `app.json` — Object ID ranges and dependencies (all object types share the same range)

## Context Documents

Temporary documents for the current chat go in `~/.claude/context/`. Read files from this folder when the user references them.

## Build

Detect the AL compiler dynamically (picks the latest installed version):

```bash
ALC_EXE=$(ls -d $HOME/.vscode/extensions/ms-dynamics-smb.al-*/bin/win32/alc.exe 2>/dev/null | sort -V | tail -1)
"$ALC_EXE" /project:"." /packagecachepath:".alpackages"
```

If the glob matches nothing, the AL Language extension is not installed.

## Workflow Routing

When the user describes a BC task, **automatically route** to the right workflow. Do NOT wait for them to type a command — evaluate the request and invoke the appropriate skill immediately.

| Request type | Route to | Examples |
|-------------|----------|----------|
| **Vague idea** — no specific feature, object, or behavior named | `al-dev-toolkit:brainstorming` skill | "improve the sales process", "we need better inventory controls" |
| **Complex task** | `al-dev-toolkit:al-planning` skill | "add credit limit validation that blocks sales orders", "extend customer card with rating system" |
| **Simple task** | `al-dev-toolkit:quick` skill | "add a field to track last shipment date", "rename the caption on field X", "fix the bug in codeunit Y" |

**Complex if ANY of these apply:** requires base app source lookup, creates a new table, touches posting/financial/security logic, 3+ files, or unclear scope. **When unsure, default to planning.**

**`/implement`** executes a previously created plan — it is the build phase that follows `/plan`.

**If the user explicitly types `/plan`, `/quick`, `/implement`, or `/brainstorm`**, follow their command regardless of the routing rules above.

The main agent is an **orchestrator** — it dispatches subagents and does NOT write AL code directly. Small reads (checking `app.json`, confirming a file exists, reading a few lines) are fine and preferred over spawning agents.

## Exploration

For known project files/paths, use direct Glob/Read — do not spawn Explore agents for trivial lookups. Reserve Explore agents for broad research (3+ queries, unfamiliar codebase areas).

For base app research during /plan, the `researcher` agent handles all investigation. Do NOT spawn Explore agents for base app lookups — use researcher agents which have the Detective personality and BC lookup instructions baked in.

## Self-Review Before Responding

Spawn a haiku self-review agent before finishing your response to catch completeness gaps.

**DO self-review:**
- Multi-part requests — "check A, B, and C"
- Audit/research questions — "which files use X and do they handle Y?"
- Conditional logic — "if X then do Y, otherwise Z"
- Requests with AND/OR — every branch needs addressing
- Comparison requests — "what's the difference between A and B?"

**DON'T self-review:**
- Single-file code changes
- Simple questions with one answer
- Conversational messages (clarifications, preferences, yes/no)
- When `/implement`, `/plan`, or `/quick` is running (subagents handle their own scope)
- Follow-up tweaks to work just completed

**Principle:** Self-review catches *completeness gaps*, not *quality*. Code quality is handled by code-reviewer/performance-reviewer during `/implement`. Spawn a haiku agent (subagent_type: `general-purpose`) to verify all parts of the user's request are addressed. If gaps are found, address them before responding.

## Agent Models

| Agent | Model | Phase |
|-------|-------|-------|
| researcher, project-documenter | opus | Research / On-demand |
| coder, build-error-resolver, code-reviewer, performance-reviewer, spec-reviewer | sonnet | Implementation |
| self-review (completeness check before responding) | haiku | Pre-response |

## BC Base App Lookup

Use AL MCP server tools (`mcp__al-mcp-server__*`) for all base app research. Load packages first: `al_packages(action: load, path: projectRoot)`. Full guide is in the al-dev-toolkit:bc-research skill's bc-mcp-reference.md.

## Definition of Done

- [ ] Compiles without errors
- [ ] DataClassification on all table fields
- [ ] Labels used for all user-facing strings
- [ ] No Commit() in event subscribers

## Plans and Sessions

- Plans are saved as separate files in `~/.claude/plans/` — **NEVER** inline in session files. Format: `task-<taskID>-plan.md` (with session) or `plan-<YYYYMMDD-HHMM>.md` (without).
- Session files live at `~/.claude/sessions/task-<taskID>.md`.

## Preferences

- Prefer implementation over tests (tests only when explicitly requested)
- Prefer manual git operations (user handles commits unless asked)
- Prefer Labels with placeholders over hardcoded strings
- Prefer SetLoadFields for performance on large tables
- Prefer asking for clarification over making assumptions
- Prefer no XML Documentation unless asked for by the user
- Use WebFetch for URL fetching (native tool, no MCP dependency)
- Prefer `mcp__claude_ai_Microsoft_Learn__microsoft_docs_search` and `mcp__claude_ai_Microsoft_Learn__microsoft_docs_fetch` over WebSearch for Microsoft/BC docs
- **MCP tools apply to subagents too.** Instruct subagents to use Microsoft Learn MCP tools instead of WebSearch for BC docs.

## Common Mistakes — Do NOT

- Do NOT use `app.json` for BC version detection — always use the project's `CLAUDE.md`
- `SetLoadFields` does not affect `CalcSums` or `CalcFields` — still use `SetLoadFields` for non-FlowField fields you access after a Find/Get
- Do NOT require named return variables for simple one-line functions (use `exit(value)`)
- Do NOT use `Name.ObjectType.al` naming backwards (correct: `CustomerRating.Table.al`)
- Do NOT create files not mentioned in the plan or requested by the user
- Do NOT spawn Explore agents for single-file lookups — use Glob/Read directly
- Do NOT grep raw BC `.al` source files — use AL MCP tools for all base app research

## Gotchas

- `alc.exe` is detected dynamically — see Build section above
- `.alpackages` folder must exist before first build
- `Commit()` in event subscribers breaks transaction integrity
- FlowFields in `SetFilter`/`SetRange` cause full table scans
- `SetLoadFields` must come AFTER `SetRange`, BEFORE `Find`
- Object ID conflicts surface only at deployment, not compilation — check `app.json` ranges early
---END TEMPLATE---

Print `[created] Global CLAUDE.md template.`

## Step 5: Check .NET SDK 8.0

Run `dotnet --version` to check if .NET SDK is installed.

**If installed and version starts with 8 or higher:** Print `[ok] .NET SDK found: <version>`

**If not installed or wrong version:** Print:
> .NET SDK 8.0 or higher is required by al-mcp-server to parse AL symbol packages.
>
> Install it from: https://dotnet.microsoft.com/download/dotnet/8.0
>
> After installing, restart your terminal and run `/setup` again to continue.

Then **stop here** — do not proceed to Step 6. The user needs to install .NET first.

## Step 6: Install al-mcp-server

**Check:** Run `claude mcp get al-mcp-server` to see if it's already registered.

**If installed:** Print `[exists] al-mcp-server is already registered.`

**If not installed:** Tell the user:

> al-mcp-server provides AI access to BC base application symbols. I'll register it now.

Run:
```bash
claude mcp add al-mcp-server -s user -- npx -y github:AndreiPopaArggo/AL-Dependency-MCP-Server
```

Verify with `claude mcp get al-mcp-server` and print the result.

## Step 7: Summary

Print a summary table:

```
Setup Complete
--------------
Directories:      [status]
Notifications:    [status] (use /notify to toggle sound)
Status line:      [status]
Global CLAUDE.md: [status]
.NET SDK:         [status]
al-mcp-server:    [status]
```

If all steps passed, print:
> You're all set! Open a BC project folder and start coding.

## Arguments

$ARGUMENTS
