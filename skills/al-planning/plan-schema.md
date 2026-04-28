# Plan Schema

This document defines the YAML frontmatter used by every plan produced by `al-planning`. Every consumer (skill, agent, future hook) references this file — do not duplicate the schema elsewhere.

## Anatomy of a plan file

A plan is a single markdown file with two parts:

1. **YAML frontmatter** — machine-readable data (defined below). Enclosed between `---\n` markers at the top of the file.
2. **Prose body** — human-readable narrative: requirement, design decisions, object descriptions, event signatures, open questions.

The frontmatter is authoritative for lists and coordinates (what exists, what depends on what, what implements what). The prose is authoritative for descriptions and code (fields per object, event signatures, rationale). See [Authority rule](#authority-rule) below.

## Template

```yaml
---
plan:
  id: plan-20260417-1030            # correlates with filename
  created: 2026-04-17T10:30:00Z     # ISO 8601
  feature: "Short feature name"
  status: draft                     # draft | implementing | complete

project:
  bc_version: "25.0"
  deployment: SaaS                  # SaaS | OnPrem | Both
  object_id_range: [50100, 50199]   # from app.json, [min, max] inclusive
  mandatory_affixes: [KRL]          # from CodeCop.json; may be empty

requirements:
  - id: R1
    text: "Clear statement of what this requirement demands"
  - id: R2
    text: "..."

research_topics_covered:
  - "Free-text description of topics the researcher(s) covered"
  - "..."

objects:
  - key: StableKey                  # unique within this plan
    type: codeunit                  # see object type enum below
    id: 50100
    name: "Exact AL Object Name KRL"
    file: "src/Folder/Name.Codeunit.al"
    extends: null                   # or "BaseObjectName" for *extension types
    depends_on: []                  # list of other objects[].key values
    satisfies: [R1]                 # requirement IDs; required when requirements[] non-empty

implementation_sequence: [KeyA, KeyB, KeyC]  # ordered object keys; may override topological order

open_questions: []                  # free-text strings; empty if none
---
```

## Field reference

### `plan`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `plan.id` | string | yes | Correlates to filename stem. Format: `plan-YYYYMMDD-HHMM`. |
| `plan.created` | ISO 8601 timestamp | yes | UTC |
| `plan.feature` | string | yes | Short human-readable feature name |
| `plan.status` | enum | yes | `draft` \| `implementing` \| `complete` |

### `project`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `project.bc_version` | string | yes | BC version from `copilot-instructions.md` |
| `project.deployment` | enum | yes | `SaaS` \| `OnPrem` \| `Both` |
| `project.object_id_range` | `[int, int]` | yes | `[min, max]` inclusive, from `app.json` |
| `project.mandatory_affixes` | list of strings | yes | From `CodeCop.json`; `[]` if none |

### `requirements`

Optional section. If present, every entry must be referenced by at least one `objects[].satisfies`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `requirements[].id` | string | yes | Short stable ID (e.g., `R1`, `R2`) |
| `requirements[].text` | string | yes | One-sentence requirement statement |

### `research_topics_covered`

List of free-text strings describing what researcher subagents already investigated. Consumed by future parallel-research dedup.

The key must be present; use `[]` if no research has been done yet.

### `objects`

The list of AL objects the plan will create. **The core of the frontmatter.**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `objects[].key` | string | yes | Unique within this plan. Used by `depends_on`, `implementation_sequence`, status tracking. Pick a stable, descriptive identifier (e.g., `CreditLimitMgt`, `SalesPostSub`) |
| `objects[].type` | enum | yes | See [object type enum](#object-type-enum) |
| `objects[].id` | int | yes | Must fall within `project.object_id_range` |
| `objects[].name` | string | yes | Exact AL object name, including mandatory affix |
| `objects[].file` | string | yes | Path relative to project root. Format: `src/<folder>/<Name>.<ObjectType>.al` |
| `objects[].extends` | string \| null | yes | Base object name for `*extension` types; `null` for non-extension types |
| `objects[].depends_on` | list of keys | yes | Other object keys this object depends on; `[]` if none |
| `objects[].satisfies` | list of requirement IDs | conditional | **Required when `requirements[]` is non-empty.** List of `requirements[].id` values this object implements |

### `implementation_sequence`

Ordered list of object keys. Kept even though derivable from `depends_on` — lets the planner override the default topological order when there's a human reason.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `implementation_sequence` | list of object keys | yes | Ordered list. Every entry must reference an existing `objects[].key`. May override the default topological sort from `depends_on` |

### `open_questions`

Free-text strings describing unresolved items. `[]` if none.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `open_questions` | list of strings | yes | Free-text items. `[]` if none |

## Object type enum

Valid values for `objects[].type`:

| Type | Notes |
|------|-------|
| `table` | |
| `tableextension` | `extends` required |
| `page` | |
| `pageextension` | `extends` required |
| `pagecustomization` | `extends` required |
| `report` | |
| `reportextension` | `extends` required |
| `codeunit` | |
| `xmlport` | |
| `query` | |
| `enum` | |
| `enumextension` | `extends` required |
| `interface` | |
| `permissionset` | |
| `permissionsetextension` | `extends` required |
| `profile` | |
| `controladdin` | |
| `entitlement` | |

## Status lifecycle

```
draft ──(/implement runs, whether immediately or later)──> implementing
implementing ──(all objects built + reviews APPROVE)─────> complete
implementing ──(plan revision required)──────────────────> draft
```

- `draft` — written by `al-planning`, not yet being implemented
- `implementing` — coder dispatch has started
- `complete` — all objects have passing build + APPROVE from reviewers

## Authority rule

When frontmatter and prose disagree, which wins?

| Question | Authoritative source |
|----------|---------------------|
| Which objects exist in this plan? | YAML `objects[]` |
| Which requirements exist? | YAML `requirements[]` |
| Implementation order | YAML `implementation_sequence` |
| Object IDs, file paths, types | YAML |
| Status, deployment, ID range | YAML |
| What fields does an object have? | Prose section for that object |
| Event subscription AL signatures | Prose (code blocks) |
| Design rationale | Prose |

**Rule of thumb:** YAML is authoritative for lists and coordinates. Prose is authoritative for descriptions and code.

## Writer discipline (for the orchestrator in `al-planning`)

After writing a plan file, run these checks before announcing completion. Fix any mismatch inline; if the fix requires new information, ask the user.

- [ ] Every `objects[].key` has a matching `### <Name>` heading in the prose Objects section
- [ ] Every `### <Name>` heading in the prose Objects section has a matching YAML entry in `objects[]`
- [ ] Every entry in `requirements[]` is referenced by at least one `objects[].satisfies`
- [ ] Every `objects[].id` falls within `project.object_id_range`
- [ ] Every `objects[].type` is one of the values listed in [Object type enum](#object-type-enum)
- [ ] Every `objects[].extends` is non-null when `type` is an `*extension` or `pagecustomization`, and null otherwise
- [ ] Every `objects[].depends_on` entry references an existing `objects[].key` in this plan
- [ ] Every `implementation_sequence` entry references an existing `objects[].key`
- [ ] `plan.status` is `draft`

## Reading plans (for consumer skills and agents)

1. **Detect format.** If the file starts with `---\n`, it is new-format (has frontmatter). Otherwise it is legacy prose-only.
2. **If new-format:** parse the YAML block between the first two `---` lines. Use YAML values as authoritative for lists and coordinates.
3. **If legacy:** fall back to reading the prose structure as before (headers and section enumeration).
4. **If new-format frontmatter is malformed or conflicts with prose:** fall back to prose and emit: "Plan frontmatter appears malformed or out-of-sync; using prose fallback. Consider regenerating."

## Worked example

```yaml
---
plan:
  id: plan-20260417-1030
  created: 2026-04-17T10:30:00Z
  feature: "Credit Limit Validation"
  status: draft

project:
  bc_version: "25.0"
  deployment: SaaS
  object_id_range: [50100, 50199]
  mandatory_affixes: [KRL]

requirements:
  - id: R1
    text: "Block sales order release when customer exceeds credit limit"
  - id: R2
    text: "Warn on customer card when balance near limit"

research_topics_covered:
  - "Sales-Post codeunit OnBefore* events"
  - "Customer table Balance FlowField"

objects:
  - key: CreditLimitMgt
    type: codeunit
    id: 50100
    name: "Credit Limit Mgt KRL"
    file: "src/Credit/CreditLimitMgt.Codeunit.al"
    extends: null
    depends_on: []
    satisfies: [R1, R2]
  - key: CustomerExt
    type: tableextension
    id: 50100
    name: "Customer KRL"
    file: "src/Credit/Customer.TableExt.al"
    extends: "Customer"
    depends_on: []
    satisfies: [R2]
  - key: SalesPostSub
    type: codeunit
    id: 50101
    name: "Sales Post Subscribers KRL"
    file: "src/Credit/SalesPostSubscribers.Codeunit.al"
    extends: null
    depends_on: [CreditLimitMgt]
    satisfies: [R1]

implementation_sequence: [CustomerExt, CreditLimitMgt, SalesPostSub]
open_questions: []
---

# Plan: Credit Limit Validation

## Requirement
[prose...]

## Design Decisions
[prose...]

## Objects

### CreditLimitMgt (codeunit 50100)
[fields, procedures, key logic — prose]

### CustomerExt (tableextension 50100)
[fields — prose]

### SalesPostSub (codeunit 50101)
[event subscriptions, key logic — prose]

## Event Subscriptions
[AL signatures — prose]

## Open Questions
```
