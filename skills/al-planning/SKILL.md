---
name: al-planning
description: "Plan before implementing. Use for BC features, multi-object implementations, or unclear requirements."
argument-hint: "<description of what to build>"
disable-model-invocation: true
---

# AL Planning

You are the orchestrator. Understand what the user wants, research the base app, design the solution, write a plan file. Do NOT implement anything.

<HARD-GATE>
- Do NOT write AL code, create .al files, or invoke implementation during planning. The ONLY output is a plan file and a summary.
- Do NOT read source files to verify researcher results — trust them. If a summary seems incomplete, spawn another targeted researcher instead.
- Do NOT spawn subagents to write the plan — the orchestrator writes it directly.
- Do NOT read large base app source files directly. All codebase research is done by researcher agents.
- Exception: project config files (CLAUDE.md, app.json, CodeCop.json) and user context files (~/.claude/context/) are small — read those directly.
</HARD-GATE>

## When to Use

- New features requiring 3+ files
- Changes requiring base app research (events, table structures)
- Unclear or ambiguous requirements
- Anything touching posting, financial, or security code

## When NOT to Use

- Simple 1-2 file changes where you know exactly what to do → use `/quick`
- Bug fixes in a single file → use `/quick` or direct conversation
- Field additions, page layout tweaks → use `/quick`

## Understand

**Step 0 — Specificity gate:**

Before anything else, evaluate the user's request. A plannable request names a **specific feature, behavior, or object** to build. A vague request does not.

| Specific (proceed) | Vague (redirect to `/brainstorm`) |
|---------------------|-----------------------------------|
| "Add credit limit validation that blocks sales orders" | "Improve the sales process" |
| "Extend customer card with a rating system" | "Make customer management better" |
| "Block posting when item is blocked on location" | "We need better inventory controls" |
| "Add a field to track last shipment date on sales header" | "Do something with shipments" |

**If vague:** Stop planning. Tell the user:

> This request is too broad to plan directly. Run `/brainstorm [your idea]` first — it will help refine the idea into a specific, plannable requirement through a short conversation.

**If specific:** Continue to step 1.

**Steps 1-5:**

1. **Read project config** — `CLAUDE.md` (BC version, deployment target, project rules), `app.json` (ID ranges, dependencies), `CodeCop.json` (mandatoryAffixes). If deployment target is missing, ask the user.
2. **Check `~/.claude/context/`** — if context files exist, read referenced ones, list unreferenced ones and ask if relevant.
3. **Glob `src/**/*.al`** — know what already exists (names only).
4. **Ask clarifying questions** — if the requirement passes the specificity gate but still has ambiguities, ask before researching. One question at a time.

## Research

Spawn **parallel researcher agents** (subagent_type: `researcher`) to investigate the base app. You know BC — use your domain knowledge to decide what needs researching.

**Always investigate:**
- Integration events (OnBefore/OnAfter) in relevant base app codeunits
- Table structures for relevant base app tables
- Existing project extensions that touch the same area

**Researcher spawn prompts** — the agent definition bakes in the Detective personality and MCP lookup instructions. Only pass:
- Project root path
- The specific research task and focus areas

**Fill gaps before designing.** If research has holes, spawn targeted follow-up researchers. Use `mcp__microsoft-learn__microsoft_docs_search` / `mcp__microsoft-learn__microsoft_docs_fetch` for quick documentation lookups.

## Design

Design the solution directly from research findings. Do NOT delegate design to subagents.

- Determine objects needed (tables, pages, codeunits, extensions, enums)
- Choose events to subscribe to (from research)
- Assign object IDs from available range
- Document design decisions with rationale
- Determine file paths following project conventions

## Write the Plan

**Location:**
- Task session active: `~/.claude/plans/task-<taskID>-plan.md`
- No session: `~/.claude/plans/plan-<YYYYMMDD-HHMM>.md`

The plan must be **self-contained** — a coder with only the plan file must be able to implement.

**Plan format:**

```
# Plan: [Feature Name]

**Created:** YYYY-MM-DD HH:MM
**BC Version:** [version]
**Deployment:** [SaaS/OnPrem/Both]
**Object ID Range:** [from app.json]
**Mandatory Affixes:** [from CodeCop.json]

## Requirement
[User's request, clarified]

## Design Decisions
1. [Decision] — [Rationale]

## Objects

### [Object Name]
- **Type / ID / Name / File / Extends**
- **Fields:** field ID, name, type, DataClassification for each
- **Event Subscriptions:** full AL signatures, copy-paste ready
- **Procedures:** name, parameters with types, return type, one-line purpose
- **Key Logic:** what this object does and why

## Implementation Sequence
1. [Object] — [why this order]

## Event Subscriptions
[Full signatures, copy-paste ready]

## Open Questions
[Unresolved items, if any]
```

## Handoff

If a task session is active, update the session file with a `## Plan File` link and TODO items.

**Write LATEST pointer:** Save the plan file path to `~/.claude/plans/LATEST` (overwrite if exists). This allows `/implement` to find the most recent plan without manual path entry.

Present the plan summary (design decisions, file list, open questions), then ask via AskUserQuestion:

> Plan saved to `[plan-file-path]`. Three options:
>
> **1) Fresh context implementation** — I'll clear context and start `/implement` with only the plan file. Best for large plans where research consumed a lot of context.
>
> **2) Continue in this session** — I'll dispatch coder subagents right now. Faster, but orchestrator keeps the research context in memory.
>
> **3) Review first** — I'll stop here. Review the plan, then run `/implement [plan-path]` when ready.

If 1: Spawn an implementation orchestrator (subagent_type: `general-purpose`, model: `opus`) that reads the al-dev-toolkit:al-implementation skill and the plan file. This subagent gets a fresh context window — no research baggage. It handles the full cycle: coders, build, review. Report its results when done.
If 2: Invoke the al-dev-toolkit:al-implementation skill and execute it directly in this session with the plan already in context.
If 3: Stop.

## User's Request

$ARGUMENTS
