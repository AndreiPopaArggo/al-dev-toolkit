# AL Dev Toolkit

Claude Code plugin for Business Central AL extension development. Provides planning, implementation, code review, and build workflows through specialized agents and skills.

## Prerequisites

- [Claude Code](https://claude.ai/claude-code) (includes Node.js)
- [.NET SDK 8.0+](https://dotnet.microsoft.com/download/dotnet/8.0) (for AL symbol parsing)
- [AL Language extension](https://marketplace.visualstudio.com/items?itemName=ms-dynamics-smb.al) for VS Code (for the AL compiler)

## Installation

Add the marketplace and install the plugin:

```bash
/plugin marketplace add AndreiPopaArggo/al-dev-toolkit
/plugin install al-dev-toolkit@bc-al-toolkit
```

Then run the setup wizard:

```
/setup
```

The wizard will configure directories, notifications, status line, global CLAUDE.md, and install the AL MCP server.

## What You Get

### Workflow Commands

| Command | Description |
|---------|-------------|
| `/plan` | Plan a BC feature before implementing |
| `/implement` | Implement from a previously created plan |
| `/quick` | Quick implementation for simple 1-2 file changes |
| `/brainstorm` | Refine a vague idea into a plannable requirement |
| `/build-fix` | Fix AL build errors one at a time |
| `/setup` | First-time setup wizard |

### Task Management Commands

| Command | Description |
|---------|-------------|
| `/create-task` | Create a new task session |
| `/load-task` | Load an existing task session |
| `/end-task` | End and delete a task session |
| `/list-tasks` | List all available task sessions |
| `/save-session` | Save session state to a task file |
| `/prune-session-file` | Clean up session file entries |

### Utility Commands

| Command | Description |
|---------|-------------|
| `/notify` | Toggle notification sound on/off |

### Skills (14)

Skills are loaded automatically by agents or invoked by commands. You don't call them directly.

**Coding conventions:** al-coding-style, al-patterns, al-performance, al-security, al-testing

**Workflows:** al-planning, al-implementation, brainstorming, build-fix, quick

**Review:** code-review-al, project-code-review

**Research:** bc-research

**Docs:** generate-project-docs, md-to-pdf

### Agents (7)

| Agent | Model | Role |
|-------|-------|------|
| researcher | opus | Investigates BC base application source |
| project-documenter | opus | Analyzes codebases for documentation |
| coder | sonnet | Writes AL code from plans |
| build-error-resolver | sonnet | Fixes compiler errors with minimal changes |
| code-reviewer | sonnet | Reviews code quality, security, CodeCop |
| performance-reviewer | sonnet | Reviews SetLoadFields, N+1, FlowField misuse |
| spec-reviewer | sonnet | Verifies implementation matches requirements |

## How It Works

Describe a BC task naturally and the plugin routes it automatically:

- **Vague idea** → brainstorming session
- **Complex feature** → planning → implementation with agent teams
- **Simple change** → quick implementation with review

The main agent orchestrates specialized sub-agents. It never writes AL code directly — coders, reviewers, and researchers each handle their part.

## Project CLAUDE.md

Each BC project should have a `CLAUDE.md` in the project root with:

```markdown
## Project Info

- BC Version: 25.0
- Deployment: SaaS
- Object ID Range: 50100-50199
```

The global `CLAUDE.md` (created by `/setup`) handles workflow routing and conventions. The project-level file handles project-specific settings.
