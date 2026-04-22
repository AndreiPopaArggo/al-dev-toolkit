---
name: bc-research
description: Research BC base application. Use when anyone asks about standard BC tables, events, procedures, page layouts, or patterns — anything in the Microsoft Business Central base application or system application. Spawns a researcher subagent to call MCP tools.
argument-hint: "<research goal>"
tools: [agent, read, search, vscode]
---

# BC Base Application Research

Do NOT call AL MCP server tools (`mcp__al-mcp-server__*`) directly — their results are large and will flood your context. Instead, spawn a **researcher** subagent to call MCP tools and return a concise summary.

## Research Goal

$ARGUMENTS

## How to Research

Spawn a researcher subagent with the research goal above. The researcher agent has the MCP tool knowledge built in and will return a structured report.

When spawning the subagent, paste the research goal and any relevant project context (BC version, object ID ranges, existing objects) into the subagent prompt.

## Output Format

The researcher subagent returns results as:
- **Summary** of what was found (object names, field lists, procedure signatures)
- **Code snippets** (30-50 lines each) for the most relevant matches
- **Event publishers** available for subscription (if researching extensibility)
- **Recommendations** on which events/patterns to use for the task at hand

Present the subagent's report to the user as-is. Do not re-research the same questions.
