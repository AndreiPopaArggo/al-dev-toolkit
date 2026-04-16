---
name: bc-research
description: Research BC base application. Use when anyone asks about standard BC tables, events, procedures, page layouts, or patterns — anything in the Microsoft Business Central base application or system application.
argument-hint: "<research goal>"
---

# BC Base Application Research

Research the Microsoft Business Central base application using the AL MCP server tools. The server has the standard BC packages pre-loaded — use it for all base app questions.

## Research Goal

$ARGUMENTS

## How to Research

Use the AL MCP server tools (`mcp__al-mcp-server__*`) for all base app research. These tools query the standard BC base application, system application, and installed extensions.

See [bc-mcp-reference.md](bc-mcp-reference.md) for the full tool guide.

## Output Format

Return results as:
- **Summary** of what was found (object names, field lists, procedure signatures)
- **Code snippets** (30-50 lines each) for the most relevant matches — use `al_get_source` for actual implementation code
- **Event publishers** available for subscription (if researching extensibility)
- **Recommendations** on which events/patterns to use for the task at hand
