# AL Dev Toolkit v1.1.1

VS Code agent plugin for Business Central AL extension development. Provides planning, implementation, code review, and build workflows through specialized agents and skills.

## Prerequisites

- [VS Code](https://code.visualstudio.com/) with GitHub Copilot
- [AL Language extension](https://marketplace.visualstudio.com/items?itemName=ms-dynamics-smb.al) for VS Code (for the AL compiler)
- [Node.js](https://nodejs.org/) (required by plugin hooks)

## Installation

### From marketplace

1. Enable agent plugins: set `chat.plugins.enabled` to `true` in VS Code settings
2. Open the Extensions view (`Ctrl+Shift+X`) and search `@agentPlugins`
3. Find **al-dev-toolkit** and select **Install**

### From source

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **Chat: Install Plugin From Source**
3. Enter: `https://github.com/AndreiPopaArggo/al-dev-toolkit`

### Local development

Add to your VS Code `settings.json`:

```json
"chat.pluginLocations": {
    "C:/path/to/al-dev-toolkit": true
}
```

## What You Get

### Commands

| Command | Description |
|---------|-------------|
| `/al-planning` | Plan a BC feature before implementing |
| `/al-implementation` | Implement from a previously created plan |
| `/quick` | Quick implementation for simple 1-2 file changes |
| `/brainstorming` | Refine a vague idea into a plannable requirement |
| `/build-fix` | Fix AL build errors one at a time |
| `/code-review-al` | Review only changed AL files (git diff) |
| `/project-code-review` | Review all AL files in a folder/project |
| `/bc-research` | Research BC base application objects and events |
| `/generate-project-docs` | Generate comprehensive project documentation |

### Skills (16)

Skills are loaded automatically by agents or invoked by commands.

**Coding conventions:** al-coding-style, al-patterns, al-performance, al-security, al-testing

**Workflows:** al-planning, al-implementation, brainstorming, build-fix, quick

**Review:** code-review-al, project-code-review

**Research:** bc-research

**Docs:** generate-project-docs

**Configuration:** project-setup

### Agents (8)

| Agent | Role |
|-------|------|
| researcher | Investigates BC base application source |
| project-documenter | Analyzes codebases for documentation |
| coder | Writes AL code from plans |
| build-error-resolver | Fixes compiler errors with minimal changes |
| code-reviewer | Reviews code quality, security, CodeCop |
| performance-reviewer | Reviews SetLoadFields, N+1, FlowField misuse |
| spec-reviewer | Verifies implementation matches requirements |
| codeunit-reuse-analyzer | Flags plan codeunits that could merge into existing ones (OnPrem / Both) |

### MCP Servers

The plugin connects to two remote MCP servers (configured in `.mcp.json`):

| Server | Purpose |
|--------|---------|
| **al-mcp-server** | BC base application symbol lookup (objects, events, source code) |
| **microsoft-learn** | Official Microsoft Learn documentation search |

### Hooks

| Hook | Event | Purpose |
|------|-------|---------|
| **MCP Subagent Guard** | PreToolUse | Denies direct MCP tool calls from the main agent — forces BC base app lookups through a researcher subagent to keep context clean |
| **Post-Build Reminder** | PostToolUse | Detects successful AL builds and reminds the agent to run code reviewers (quality + performance in parallel) |

## How It Works

Describe a BC task naturally and the plugin routes it automatically:

- **Vague idea** → brainstorming session
- **Complex feature** → planning → implementation with agent teams
- **Simple change** → quick implementation with review

## Plan Format

Plans produced by `/plan` start with a YAML frontmatter block (machine-readable object list, dependencies, requirement coverage, status) followed by the traditional prose body (requirement, design decisions, object descriptions). Downstream skills and agents consume the frontmatter for structured dispatch; the prose remains the source of descriptions and code.

Schema and writer discipline are documented in [`skills/al-planning/plan-schema.md`](skills/al-planning/plan-schema.md). Legacy prose-only plans from earlier versions continue to work via format detection.

## Project Configuration

Each BC project should have a `.github/copilot-instructions.md` or `CLAUDE.md` in the project root with:

```markdown
## Project Info

- BC Version: 25.0
- Deployment: SaaS
- Object ID Range: 50100-50199
```
