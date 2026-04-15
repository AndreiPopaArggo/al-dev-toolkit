---
name: bc-research
description: Research BC base application source code. Use when user mentions "base app", "base application", "Microsoft base app", "standard BC", or asks about tables, events, procedures, or patterns in the Microsoft Business Central base application.
argument-hint: <BC-version>: <research goal>
---

# BC Base Application Research

Research the Microsoft Business Central base application source code using a researcher agent.

## Version (REQUIRED in Arguments)

The **main agent must resolve the BC version** before invoking this skill and include it in the arguments. Format: `<version>: <research goal>`

Examples:
- `BC27.4: Find events on Sales Header posting`
- `BC26: Get Customer table fields and triggers`
- `NAV2017: Find Sales-Post codeunit OnRun trigger`

If no version prefix is provided, **do NOT guess**. Search for a project `CLAUDE.md` in the current working directory. If not found, return an error asking the caller to specify the version.

## Research Goal

$ARGUMENTS

## How to Research

Use the AL MCP server tools (`mcp__al-mcp-server__*`) for all base app research.

See [bc-mcp-reference.md](bc-mcp-reference.md) for the full MCP tool guide.

## Output Format

Return results as:
- **Summary** of what was found (object names, field lists, procedure signatures)
- **Code snippets** (30-50 lines each) for the most relevant matches — use `al_get_source` for actual implementation code
- **Event publishers** available for subscription (if researching extensibility)
- **Recommendations** on which events/patterns to use for the task at hand
