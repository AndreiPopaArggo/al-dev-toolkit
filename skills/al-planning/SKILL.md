---
name: al-planning
description: "Plan a BC feature before implementing it. Use when the user asks for a new feature, multi-object change, or significant AL implementation that needs design — involves 3+ files, new tables/pages/codeunits, event subscriptions, or architectural decisions. Produces a plan file, does NOT write code. Do NOT use for simple 1-2 file changes (use quick) or vague ideas (use brainstorming)."
argument-hint: "<description of what to build>"
---

# AL Planning

You are the orchestrator. Understand what the user wants, research the base app, design the solution, write a plan file. Do NOT implement anything.

<HARD-GATE>
- Do NOT write AL code, create .al files, or invoke implementation during planning. The ONLY output is a plan file and a summary.
- Do NOT read source files to verify researcher results — trust them. If a summary seems incomplete, spawn another targeted researcher instead.
- Do NOT spawn subagents to write the plan — the orchestrator writes it directly.
- Do NOT read large base app source files directly. All codebase research is done by researcher agents.
- Exception: project config files (app.json, CodeCop.json, .github/copilot-instructions.md) and context files (.github/context/) are small — read those directly.
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

1. **Read project config** — follow the [Project Setup](../project-setup/SKILL.md) skill: `app.json` (ID ranges, dependencies), `CodeCop.json` (mandatoryAffixes), `.github/copilot-instructions.md` (BC version, deployment target, project rules). If deployment target is missing, ask the user.
2. **Check `.github/context/`** — if context files exist, read referenced ones, list unreferenced ones and ask if relevant.
3. **Glob `src/**/*.al`** — know what already exists (names only).
4. **Ask clarifying questions** — if the requirement passes the specificity gate but still has ambiguities, ask before researching. One question at a time.

## Research

Run **parallel subagents using the researcher agent** (with Sonnet) to investigate the base app. You know BC — use your domain knowledge to decide what needs researching.

**Always investigate:**
- Integration events (OnBefore/OnAfter) in relevant base app codeunits
- Table structures for relevant base app tables
- Existing project extensions that touch the same area
- Extensions from other packages that touch the same base objects (`al_find_references` with `referenceType: extends`)

**Researcher spawn prompts** — the researcher agent definition bakes in the Detective personality and MCP lookup instructions. Only pass:
- Project root path
- The specific research task and focus areas

**Fill gaps before designing.** If research has holes, run targeted follow-up researcher subagents. Use #microsoft-learn/microsoft_docs_search / #microsoft-learn/microsoft_docs_fetch for quick documentation lookups.

## Design

Design the solution directly from research findings. Do NOT delegate design to subagents.

- Determine objects needed (tables, pages, codeunits, extensions, enums)
- Choose events to subscribe to (from research)
- Assign object IDs from available range
- Document design decisions with rationale
- Determine file paths following project conventions

## Write the Plan

**Dispatch context detection:** Before writing the plan, check `$ARGUMENTS` for a marker of the form `[DISPATCH_CONTEXT: do-task taskID=<N>]`. If present, extract `<N>` and use it for the filename and `plan.id` per the table below.

**Location:**
- Default: `.github/plans/plan-<YYYYMMDD-HHMM>.md` with `plan.id: plan-YYYYMMDD-HHMM`
- When `[DISPATCH_CONTEXT: do-task taskID=<N>]` is present: `.github/plans/task-<N>-plan.md` with `plan.id: task-<N>-plan`

The plan must be **self-contained** — a coder with only the plan file must be able to implement.

**Plan format — YAML frontmatter + prose.**

The file starts with a YAML frontmatter block (machine-readable) followed by the prose body (human-readable). The frontmatter shape, field reference, object type enum, status lifecycle, authority rule, and writer discipline checklist are defined in [plan-schema.md](./plan-schema.md) — read it before writing a plan.

Skeleton:

```
---
plan:
  id: plan-YYYYMMDD-HHMM
  created: <ISO 8601 UTC>
  feature: "[Feature Name]"
  status: draft

project:
  bc_version: "[version]"
  deployment: [SaaS|OnPrem|Both]
  object_id_range: [<min>, <max>]
  mandatory_affixes: [<affixes from CodeCop.json>]

requirements:
  - id: R1
    text: "..."

research_topics_covered:
  - "..."

objects:
  - key: <StableKey>
    type: <object type>
    id: <int>
    name: "<Exact AL Object Name>"
    file: "src/<folder>/<Name>.<Type>.al"
    extends: <null or "BaseName">
    depends_on: []
    satisfies: [R1]

implementation_sequence: [<keys in order>]
open_questions: []
---

# Plan: [Feature Name]

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

**Writer discipline — run before announcing completion.** After writing the plan file, run the full writer discipline checklist in [plan-schema.md](./plan-schema.md) under the "Writer discipline" section. It covers prose/YAML bidirectional matching, requirement coverage, object ID range, `depends_on` and `implementation_sequence` key integrity, `plan.status = draft`, `objects[].type` enum conformance, and `objects[].extends` non-null pairing with extension types.

If any check fails: fix silently if the fix is mechanical (regenerate a missing prose heading, correct an out-of-range ID against `app.json`); ask the user if the fix requires a design decision (e.g., prose mentions an object with no YAML entry and no obvious key/type).

## Codeunit Reuse Review (OnPrem / Both only)

Skip this step when `project.deployment == SaaS` — SaaS publishers get unlimited extension ranges, so minting new codeunits per concern is fine. Also skip when the plan has no `objects[]` entries with `type: codeunit` (nothing to review).

When `project.deployment` is `OnPrem` or `Both` **and** the plan contains new codeunits, run a subagent using the **codeunit-reuse-analyzer agent** (with Sonnet). OnPrem object IDs are a finite resource, and many "new" codeunits in a plan can be merged into an existing project codeunit without loss of clarity.

**Dispatch:**
- Pass the project root path and the plan file path (just written).
- No plan content pasted — the agent reads the frontmatter and prose directly.

**Response:** a markdown table of verdicts, one row per candidate codeunit — `KEEP_NEW` or `MERGE_INTO <name>` with rationale.

**If every verdict is `KEEP_NEW`:** note the check passed in the handoff summary and continue.

**If any `MERGE_INTO`:** present the verdict table to the user verbatim and ask, merge-by-merge, which to apply. For each accepted merge:

1. Remove the merged codeunit's entry from `objects[]`
2. Update any other object whose `depends_on` listed the merged key — drop that entry (the target is pre-existing and therefore not tracked in `objects[]`)
3. Remove the merged key from `implementation_sequence`
4. In the prose `## Objects` section, move the merged codeunit's description under the target's existing `### <Name>` heading (as new procedures), then delete the merged `### <Name>` heading
5. Re-run the writer discipline checklist from [plan-schema.md](./plan-schema.md)

Do not apply merges silently — the user decides each one. If the user rejects all merges, leave the plan untouched.

## Handoff

**Write LATEST pointer:** Save the plan file path to `.github/plans/LATEST` (overwrite if exists). This allows `/implement` to find the most recent plan without manual path entry. Create the `.github/plans/` directory if it doesn't exist.

**If `[DISPATCH_CONTEXT: do-task taskID=<N>]` was present in `$ARGUMENTS`:** the caller (`/do-task`) will continue to al-implementation itself. Present a brief plan summary (design decisions, file list, open questions) and STOP — do not present the 3-option prompt. Return control to the caller.

**Otherwise** present the plan summary (design decisions, file list, open questions), then ask the user:

> Plan saved to `[plan-file-path]`. Three options:
>
> **1) Fresh context implementation** — I'll clear context and start `/implement` with only the plan file. Best for large plans where research consumed a lot of context.
>
> **2) Continue in this session** — I'll dispatch coder subagents right now. Faster, but orchestrator keeps the research context in memory.
>
> **3) Review first** — I'll stop here. Review the plan, then run `/implement [plan-path]` when ready.

If 1: Run a subagent to act as an implementation orchestrator — it reads the al-implementation skill and the plan file. This subagent gets a fresh context window — no research baggage. It handles the full cycle: coders, build, review. Report its results when done.
If 2: Invoke the al-implementation skill and execute it directly in this session with the plan already in context.
If 3: Stop.

## User's Request

$ARGUMENTS
