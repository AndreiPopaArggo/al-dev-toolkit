# AL Dev Toolkit

VS Code agent plugin for Business Central AL extension development. Provides planning, implementation, code review, and build workflows through specialized agents and skills.

## Prerequisites

- [VS Code](https://code.visualstudio.com/) with GitHub Copilot
- [AL Language extension](https://marketplace.visualstudio.com/items?itemName=ms-dynamics-smb.al) for VS Code (for the AL compiler)

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

### Workflow Commands

| Command | Description |
|---------|-------------|
| `/plan` | Plan a BC feature before implementing |
| `/implement` | Implement from a previously created plan |
| `/quick` | Quick implementation for simple 1-2 file changes |
| `/brainstorm` | Refine a vague idea into a plannable requirement |
| `/build-fix` | Fix AL build errors one at a time |

### Skills (14)

Skills are loaded automatically by agents or invoked by commands.

**Coding conventions:** al-coding-style, al-patterns, al-performance, al-security, al-testing

**Workflows:** al-planning, al-implementation, brainstorming, build-fix, quick

**Review:** code-review-al, project-code-review

**Research:** bc-research

**Docs:** generate-project-docs, md-to-pdf

### Agents (7)

| Agent | Role |
|-------|------|
| researcher | Investigates BC base application source |
| project-documenter | Analyzes codebases for documentation |
| coder | Writes AL code from plans |
| build-error-resolver | Fixes compiler errors with minimal changes |
| code-reviewer | Reviews code quality, security, CodeCop |
| performance-reviewer | Reviews SetLoadFields, N+1, FlowField misuse |
| spec-reviewer | Verifies implementation matches requirements |

### MCP Server

The plugin connects to a remote **al-mcp-server** for BC base application symbol lookup. The connection is configured in the bundled `.mcp.json` — no local setup needed.

## How It Works

Describe a BC task naturally and the plugin routes it automatically:

- **Vague idea** → brainstorming session
- **Complex feature** → planning → implementation with agent teams
- **Simple change** → quick implementation with review

## Project Configuration

Each BC project should have a `.github/copilot-instructions.md` or `CLAUDE.md` in the project root with:

```markdown
## Project Info

- BC Version: 25.0
- Deployment: SaaS
- Object ID Range: 50100-50199
```
