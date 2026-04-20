---
name: generate-project-docs
description: Generate comprehensive project-level documentation using parallel subagents. Use when asked to document a BC project. Covers data model, business logic, UI, integrations, and base app context.
argument-hint: "[optional: scope or output preferences]"
disable-model-invocation: true
tools: ['agent', 'read', 'search', 'vscode', 'al_symbolsearch']
---

# Generate Project Documentation

Generate comprehensive, high-quality documentation for a BC AL project using parallel subagents. The main agent acts as orchestrator — it does NOT read source files itself. All analysis is delegated to subagents to preserve the orchestrator's context window.

## Phase 0: User Input

Before doing anything else, ask the user these 3 questions:

**Question 1 — Audience:**
- Header: "Audience"
- Question: "Who is the target audience for this documentation?"
- Option A: **Technical (developers)** — "Detailed code-level docs: object references, event maps, data model with fields, procedure signatures, extension points."
- Option B: **Overview (non-technical)** — "High-level business docs: module descriptions, workflows, what the extension does, setup instructions."

**Question 2 — Output format:**
- Header: "Output format"
- Question: "How should the documentation be structured?"
- Option A: **Single file** — "One comprehensive markdown document with table of contents in docs/."
- Option B: **Multiple files with index** — "Separate files per section (data-model.md, business-logic.md, etc.) with an index.md linking them in docs/."

**Question 3 — Diagrams:**
- Header: "Diagrams"
- Question: "Should the documentation include Mermaid diagrams?"
- Option A: **Yes, include diagrams** — "ER diagrams for data model, flowcharts for key processes, dependency graphs for object relationships."
- Option B: **No, text only** — "Tables and text descriptions only, no diagrams."

Store the answers as `AUDIENCE`, `FORMAT`, and `DIAGRAMS` for use in all subsequent phases.

---

## Phase 1: Discovery (Single Subagent — Opus)

Run **1 subagent using the project-documenter agent with Opus**. Give it this task:

> Scan the project and return a structured JSON manifest. Do NOT write documentation — only collect facts.
>
> 1. Read `app.json` — extract: app name, publisher, ID ranges, version, dependencies
> 2. Read project config — `app.json` (BC version from `platform`/`application`), `.github/copilot-instructions.md` (conventions, special notes). If BC version is not documented, note "BC_VERSION: UNKNOWN" in the manifest.
> 3. **Enumerate AL objects via `al_symbolsearch`.** Issue one call per object kind relevant to BC documentation, using a broad query (e.g. `query: "*"` or empty) scoped to the current project (exclude dependencies). Target kinds: `Table`, `TableExtension`, `Page`, `PageExtension`, `Codeunit`, `Report`, `XmlPort`, `Query`, `Enum`, `EnumExtension`, `Interface`, `PermissionSet`. For each symbol record: object type, name, ID, file path, and `extends` target (for extensions). This replaces glob+regex parsing for the core inventory.
> 4. **Pattern-based signals (not expressible as symbol kinds)** — use Grep on the files surfaced in step 3:
>    - Event subscribers: grep for `[EventSubscriber(` and extract object type, object name, event name from the attribute
>    - HttpClient/HttpRequestMessage: grep for these type names — record file paths only
>    - API pages: filter step 3's `Page` results where a grep on the file finds `PageType = API`
>    - Warehouse refs: grep for `"Warehouse Shipment"`, `"Warehouse Receipt"`, `"Whse."`, `"Bin"`, `"Zone"` — record file paths
>    - CRM refs: grep for `Contact`, `Opportunity`, `"Interaction Log"`, `Segment` — record file paths
> 5. Group files by feature folder (first subfolder under `src/`, derived from the file paths returned by `al_symbolsearch`)
> 6. Return the manifest as a structured markdown document with these sections:
>    - `## Project Info` (app name, publisher, version, ID ranges, BC version)
>    - `## Dependencies` (from app.json)
>    - `## Folder Structure` (tree of src/ subfolders with file counts)
>    - `## Object Inventory` (table: object type → count, built from `al_symbolsearch` results)
>    - `## File List by Folder` (grouped list: folder → files with object type and name)
>    - `## Extension Targets` (list: extension object → base object it extends, from the `extends` field of `al_symbolsearch` results)
>    - `## Event Subscribers` (list: subscriber codeunit → target object → event name)
>    - `## Integration Signals` (HttpClient files, API pages, XMLports, Warehouse refs, CRM refs)
>
> Fallback: if `al_symbolsearch` is unavailable or returns zero results (project not loaded in the AL language server), fall back to glob on `src/**/*.al` and regex-extract object declarations.
>
> Use `mcp__microsoft-learn__microsoft_docs_search` and `mcp__microsoft-learn__microsoft_docs_fetch` instead of web search for any Microsoft documentation lookups. Use `web/fetch` for URL fetching.

Wait for this subagent to complete. Parse its manifest to determine which Phase 2.5 and 2.6 subagents are needed.

---

## Phase 2 + 2.5: Core & Base App Analysis (Parallel Subagents)

Run all core analysis and base app research subagents **in parallel**. All use **Sonnet**.

Each subagent prompt must include the **Common Preamble** prepended, then the subagent-specific prompt.

### Common Preamble (include in every subagent prompt)

> {MANIFEST}
>
> **Audience:** {AUDIENCE}
>
> You have full read access to all project files. Look things up yourself first. If you encounter cross-scope references you cannot resolve, add them to a `## Needs Context` section at the end of your report.
>
> Use `mcp__microsoft-learn__microsoft_docs_search` and `mcp__microsoft-learn__microsoft_docs_fetch` instead of web search for any Microsoft documentation lookups. Use `web/fetch` for URL fetching.

### Phase 2: Project Analysis (always 5 subagents)

#### Subagent 2A — Data Model

> You are analyzing the DATA MODEL of this AL project. Read ALL table, table extension, enum, and enum extension files listed in the manifest.
>
> For each table, extract:
> - Table ID and name
> - Purpose (infer from fields, name, and usage)
> - All fields: ID, name, type, DataClassification, description
> - Keys (primary and secondary)
> - FlowFields and their CalcFormula
> - TableRelation references (what other tables are linked)
> - Field groups
> - Field triggers with business logic (summarize, don't copy verbatim)
>
> For each table extension, extract:
> - Which base table it extends
> - Added fields (same detail as above)
> - Modified triggers
>
> For each enum / enum extension:
> - Values and captions
> - Whether extensible
>
> If AUDIENCE is "technical": include field IDs, types, exact DataClassification values, key definitions.
> If AUDIENCE is "overview": include field names and purposes only, skip IDs and technical details.
>
> Return as a markdown report with `## Tables`, `## Table Extensions`, `## Enums` sections.
> If you encounter cross-scope references you cannot resolve, add them to `## Needs Context`.

#### Subagent 2B — Business Logic

> You are analyzing the BUSINESS LOGIC of this AL project. Read ALL codeunit and interface files listed in the manifest.
>
> For each codeunit, extract:
> - Codeunit ID and name
> - Purpose (infer from name, procedures, and usage)
> - Access level (Public/Internal)
> - Whether it has a TableNo trigger (handler pattern)
> - All public/internal procedures: name, parameters, return type, purpose
> - Event publishers: `[IntegrationEvent]` procedures with parameter descriptions
> - Event subscribers: what they subscribe to and what they do
> - TryFunction procedures
> - CommitBehavior attributes
> - Key business flows: trace the main logic path through the codeunit
>
> For each interface:
> - Methods defined
> - Known implementations in the project
>
> If AUDIENCE is "technical": include procedure signatures, parameter types, event attributes.
> If AUDIENCE is "overview": describe what each codeunit does in business terms, skip signatures.
>
> Return as a markdown report with `## Codeunits`, `## Interfaces`, `## Key Business Flows` sections.
> If you encounter cross-scope references you cannot resolve, add them to `## Needs Context`.

#### Subagent 2C — UI Layer

> You are analyzing the UI LAYER of this AL project. Read ALL page, page extension, report, and report extension files listed in the manifest.
>
> For each page, extract:
> - Page ID and name
> - PageType (Card, List, Document, API, etc.)
> - SourceTable
> - Layout structure: groups, parts, subpages
> - Actions: what they do, which objects they call (RunObject, Codeunit.Run, etc.)
> - Promoted actions
>
> For each page extension:
> - Which base page it extends
> - Added fields, actions, layout modifications
>
> For each report / report extension:
> - Report ID and name
> - DataItems and their relationships
> - Request page fields
> - Output type (PDF, Excel, Word, etc.)
>
> If AUDIENCE is "technical": include action triggers, RunObject targets, layout details.
> If AUDIENCE is "overview": describe what each page/report is for in user terms (what screens the user sees, what reports they can print).
>
> Return as a markdown report with `## Pages`, `## Page Extensions`, `## Reports` sections.
> If you encounter cross-scope references you cannot resolve, add them to `## Needs Context`.

#### Subagent 2D — Event & Integration Map

> You are analyzing the EVENT ARCHITECTURE and INTERNAL INTEGRATION patterns of this AL project. Read ALL files in the project, focusing on events and cross-object communication.
>
> Extract:
> - All event publishers: which object, event name, parameters, when it fires (Before/After what)
> - All event subscribers: which object subscribes, to what event, what it does
> - Build a complete event map: Publisher -> Event -> Subscriber(s) -> Action
> - Identify event chains: subscriber A triggers logic that publishes event B, subscribed by C
> - Codeunit.Run calls: which objects invoke which codeunits
> - RunObject actions: which pages open which other pages/reports
> - Record references across objects: which codeunits operate on which tables
>
> If AUDIENCE is "technical": include full event signatures, parameter details, subscriber binding.
> If AUDIENCE is "overview": describe the event flows in business terms ("when a sales order is posted, the system automatically...").
>
> Return as a markdown report with `## Event Publishers`, `## Event Subscribers`, `## Event Flow Map`, `## Object Dependencies` sections.
> If you encounter cross-scope references you cannot resolve, add them to `## Needs Context`.

#### Subagent 2E — Setup & Permissions

> You are analyzing the SETUP, CONFIGURATION, and PERMISSIONS of this AL project. Read ALL setup tables, permission sets, install codeunits, and upgrade codeunits listed in the manifest.
>
> Extract:
> - Setup tables: fields, default values, purpose of each setting
> - Permission sets: name, what they grant access to, assignable or not
> - Install codeunit (if exists): what it initializes on first install
> - Upgrade codeunit (if exists): upgrade steps, data migration logic
> - Any Notification patterns for setup guidance
>
> If AUDIENCE is "technical": include permission levels (RIMD/X), field IDs, upgrade procedure details.
> If AUDIENCE is "overview": describe what settings are available and what permissions users need.
>
> Return as a markdown report with `## Setup Tables`, `## Permission Sets`, `## Install/Upgrade Logic` sections.

### Phase 2.5: Base App Research (on-demand — parallel with Phase 2)

**Only run if the manifest shows the corresponding dependencies.**

#### Subagent 2.5A — Base Tables

Run if Extension Targets contains table extensions.

> You are researching BASE APPLICATION TABLES that this project extends. Use AL MCP server tools (`mcp__al-mcp-server__*`) for all base app lookups. Use `al_get_source` for actual implementation code.
>
> For each table extension in the manifest, look up the base table. Extract:
> - Table purpose in standard BC
> - Key fields relevant to understanding the extension
> - Important triggers (OnInsert, OnModify, OnDelete, field OnValidate)
> - Key FlowFields
> - How the table fits in standard BC flows (e.g., "Sales Header is the main table for sales documents, used by Sales-Post codeunit for posting")
>
> Return a markdown report: one section per base table, focused on what's relevant to understanding the extensions.

#### Subagent 2.5B — Base Pages

Run if Extension Targets contains page extensions.

> You are researching BASE APPLICATION PAGES that this project extends. Use AL MCP server tools (`mcp__al-mcp-server__*`) for all base app lookups. Use `al_get_source` for actual implementation code.
>
> For each page extension in the manifest, look up the base page. Extract:
> - Page purpose: what business process it serves
> - PageType and SourceTable
> - Key layout areas (where the extension's fields/actions are being added)
> - Important existing actions that the extension may interact with
>
> Return a markdown report: one section per base page.

#### Subagent 2.5C — Base Events

Run if Event Subscribers list is non-empty.

> You are researching BASE APPLICATION EVENTS that this project subscribes to. Use AL MCP server tools (`mcp__al-mcp-server__*`) for all base app lookups. Use `al_get_source` for actual implementation code.
>
> For each event subscriber in the manifest, find the publisher procedure in the base app source. Extract:
> - Which codeunit/table publishes the event
> - What the publisher procedure does (the business context)
> - When the event fires (before/after what operation)
> - What the event parameters mean
> - The surrounding code: what happens before and after the event fires
> - Whether the event supports `IsHandled` pattern
>
> Return a markdown report: one section per subscribed event, with enough context to understand WHY the extension subscribes to it.

#### Subagent 2.5D — Base Codeunits

Run if manifest shows references to standard codeunits like "Sales-Post", "Gen. Jnl.-Post Line", etc.

> You are researching BASE APPLICATION CODEUNITS that this project references or interacts with. Use AL MCP server tools (`mcp__al-mcp-server__*`) for all base app lookups. Use `al_get_source` for actual implementation code.
>
> For each referenced standard codeunit, find and read the source. Extract:
> - Codeunit purpose: what business process it handles
> - Key procedures and their flow
> - Where events are published (that this extension might subscribe to)
> - The overall posting/processing flow if it's a posting codeunit
>
> Return a markdown report: one section per base codeunit, focused on the procedures and flows relevant to this extension.

---

## Phase 2.6: External Integration Analysis (on-demand subagents)

**Only run if the manifest's Integration Signals section shows the corresponding patterns.** Run integration subagents in parallel alongside Phase 2/2.5 if possible, or as a second parallel batch. All use **Sonnet**. Include the Common Preamble in every subagent prompt.

If no integration signals exist in the manifest, skip this phase entirely.

#### Subagent 2.6A — External APIs

Run if HttpClient/HttpRequestMessage files found.

> You are analyzing EXTERNAL API INTEGRATIONS in this AL project. Read all files flagged in the manifest as having HttpClient/HttpRequestMessage usage.
>
> Extract:
> - Which external systems/APIs are called
> - Endpoints (URL patterns, base URLs)
> - Authentication method (OAuth2, API Key, Basic Auth, certificate)
> - Request/response structure (JSON fields, headers)
> - Error handling and retry logic
> - Which codeunits manage the integration
> - Credential storage (IsolatedStorage, Azure Key Vault, setup table)
>
> If AUDIENCE is "technical": include request/response field mappings, auth flow details, error codes handled.
> If AUDIENCE is "overview": describe what external systems are connected and what data flows between them.
>
> Return as a markdown report with `## External Systems`, `## API Endpoints`, `## Authentication`, `## Data Flow` sections.

#### Subagent 2.6B — WMS Integration

Run if Warehouse table references found.

> You are analyzing WAREHOUSE MANAGEMENT (WMS) INTEGRATION in this AL project. Read all files that reference warehouse-related tables and codeunits. Use AL MCP server tools to look up relevant base app warehouse objects.
>
> Extract:
> - Which warehouse flows are affected (shipment, receipt, pick, put-away, movement, bin management)
> - Custom fields added to warehouse documents
> - Event subscribers modifying warehouse posting
> - Custom warehouse logic (special bin assignment, custom pick logic, etc.)
> - How the extension's main business process interacts with warehouse operations
>
> If AUDIENCE is "technical": include table/codeunit references, event subscriber details, posting flow modifications.
> If AUDIENCE is "overview": describe in warehouse operations terms what the extension changes.
>
> Return as a markdown report.

#### Subagent 2.6C — CRM Integration

Run if Contact/CRM table references found.

> You are analyzing CRM/CONTACT MANAGEMENT INTEGRATION in this AL project. Read all files that reference Contact, Opportunity, Interaction Log, Segment, or related CRM tables. Use AL MCP server tools to look up relevant base app CRM objects.
>
> Extract:
> - Which CRM entities are extended or customized
> - Custom fields on Contact or related tables
> - Synchronization logic (Customer <-> Contact, Vendor <-> Contact)
> - Custom interaction logging
> - Opportunity pipeline modifications
> - Marketing/segment customizations
>
> If AUDIENCE is "technical": include field details, event subscribers, sync procedure logic.
> If AUDIENCE is "overview": describe the CRM workflow changes in business terms.
>
> Return as a markdown report.

#### Subagent 2.6D — Data Exchange

Run if XMLports or API pages found.

> You are analyzing DATA EXCHANGE interfaces in this AL project. Read all XMLport and API page files.
>
> Extract:
> - XMLports: data format (XML/CSV/JSON), field mappings, import/export direction, target tables
> - API pages: entity name, source table, exposed fields, OData capabilities
> - Web service registrations (if any install codeunit publishes them)
> - Data transformation logic
>
> If AUDIENCE is "technical": include field mappings, API entity definitions, XMLport node structure.
> If AUDIENCE is "overview": describe what data can be imported/exported and through which interfaces.
>
> Return as a markdown report with `## XMLports`, `## API Pages`, `## Web Services` sections.

---

## Phase 2b: Cross-Reference Resolution

After ALL subagents from Phase 2, 2.5, and 2.6 complete, check each output for a `## Needs Context` section.

If any subagent flagged unresolved items in `## Needs Context`:
1. **First, check if another subagent's output already answers the question.** Often the answer exists in another report.
2. **Only if the answer is NOT in any existing report**, run targeted micro-subagents with Sonnet using the project-documenter agent to investigate.

If no subagents flagged `## Needs Context`, skip this phase entirely.

---

## Phase 3: Diagrams (conditional — Parallel Subagents)

**Only execute if user chose "Yes, include diagrams".** Run diagram subagents **in parallel** (all with Sonnet). Each subagent receives the relevant Phase 2 reports as input.

### Subagent 3A — ER Diagram (always)

> Using the Data Model report (Phase 2A) and Base Tables report (Phase 2.5A, if exists), generate Mermaid ER diagrams.
>
> Rules:
> - Project tables: normal style
> - Base app tables (that are extended): show with `%%base` comment for identification
> - Include TableRelation links as relationships
> - Include key fields only (PK, FK, important business fields) — not every field
> - If the model is large (15+ tables), split into multiple diagrams by feature area
> - Use the erDiagram syntax
>
> Return the Mermaid code blocks with a brief description above each diagram.

### Subagent 3B — Dependency & Flow Diagrams (always)

> Using the Event Map report (Phase 2D), Business Logic report (Phase 2B), and any integration reports (Phase 2.6), generate Mermaid diagrams:
>
> 1. **Object Dependency Graph** — flowchart showing which objects reference/call which others. Color-code by type (tables=blue, codeunits=orange, pages=green). Include base app objects in dashed style.
> 2. **Event Subscriber Map** — flowchart showing event publishers -> events -> subscribers -> actions.
> 3. **Key Business Process Flowcharts** — for each major business flow identified (e.g., posting, approval, integration sync), create a flowchart showing the step-by-step process with decision points.
>
> Return the Mermaid code blocks with a brief description above each diagram.

### Subagent 3C — Integration Map (only if Phase 2.6 subagents were run)

> Using the integration reports (Phase 2.6A-D), generate a Mermaid flowchart showing:
>
> - External systems connected to the BC extension
> - Direction of data flow (inbound, outbound, bidirectional)
> - Which codeunits manage each integration
> - Authentication method per connection
> - If WMS/CRM integration exists, show how it connects to the standard BC warehouse/CRM modules
>
> Return the Mermaid code block with a brief description.

---

## Phase 4: Synthesis (Single Subagent — Opus)

Run **1 subagent using the project-documenter agent with Opus**. Give it:
- ALL reports from Phase 2, 2.5, 2.6, 2b
- ALL diagrams from Phase 3 (if generated)
- The user's choices: `AUDIENCE`, `FORMAT`, `DIAGRAMS`
- The project manifest from Phase 1

### Subagent Prompt — Phase 4 Synthesis

> You are writing the FINAL DOCUMENTATION for this AL project. You have received analysis reports from multiple specialized subagents. Your job is to synthesize them into a cohesive, well-structured document.
>
> **Audience:** {AUDIENCE}
> **Format:** {FORMAT}
> **Include diagrams:** {DIAGRAMS}
>
> ### If AUDIENCE is "technical":
>
> Write documentation for developers who will maintain or extend this codebase. Include:
> 1. **Project Overview** — app name, publisher, purpose, BC version, dependencies, ID ranges
> 2. **Architecture Overview** — high-level description of modules/features, how they interconnect
> 3. **Data Model** — all tables with fields, relationships, extensions to base app (explain what's being extended and why)
> 4. **Business Logic** — codeunits, key procedures, business flows, event architecture
> 5. **User Interface** — pages, page extensions, reports, navigation structure
> 6. **Integration Points** — external APIs, WMS, CRM, data exchange (only sections that exist)
> 7. **Event Architecture** — complete publisher/subscriber map with business context
> 8. **Base Application Extensions** — what standard BC objects are extended and how they modify standard behavior
> 9. **Setup & Configuration** — setup tables, permission sets, install/upgrade logic
> 10. **Object Reference** — complete table of all objects (ID, name, type, purpose)
>
> ### If AUDIENCE is "overview":
>
> Write documentation for business stakeholders. Include:
> 1. **What This Extension Does** — plain-language description of the business functionality
> 2. **Modules & Features** — what features are available, organized by business area
> 3. **User Screens** — what pages/screens the user interacts with, what they can do on each
> 4. **Reports** — what reports are available and what information they provide
> 5. **Setup Guide** — what needs to be configured, what each setting controls
> 6. **Integrations** — what external systems are connected, what data flows between them
> 7. **Permissions** — what permission sets are needed and who should have them
>
> ### Writing rules:
> - Do NOT copy-paste raw subagent reports. Synthesize, restructure, and write cohesive prose.
> - Remove duplication — if the same information appears in multiple reports, merge it.
> - Add a Table of Contents at the top.
> - Use consistent heading hierarchy (# for title, ## for main sections, ### for subsections).
> - If diagrams were generated, embed them in the appropriate sections (not in a separate "Diagrams" section).
> - Cross-reference between sections where relevant (e.g., "see [Data Model](#data-model) for field details").
> - For technical docs: include file:line references where useful.
> - For overview docs: no code, no file references, no technical jargon.
>
> ### Output:
>
> **If FORMAT is "Single file":**
> Write the complete documentation to `docs/PROJECT-DOCS.md` in the project root. Create the `docs/` folder if it doesn't exist.
>
> **If FORMAT is "Multiple files with index":**
> Create `docs/` folder with:
> - `docs/index.md` — Table of contents with links to all section files
> - `docs/01-overview.md` — Project overview / What this extension does
> - `docs/02-architecture.md` — Architecture overview (technical) or Modules & Features (overview)
> - `docs/03-data-model.md` — Data model
> - `docs/04-business-logic.md` — Business logic (technical only)
> - `docs/05-user-interface.md` — UI layer / User screens
> - `docs/06-integrations.md` — Integration points (only if integrations exist)
> - `docs/07-events.md` — Event architecture (technical only)
> - `docs/08-base-extensions.md` — Base app extensions (technical only)
> - `docs/09-setup.md` — Setup & configuration / Setup guide
> - `docs/10-object-reference.md` — Object reference table (technical only)
> - `docs/11-permissions.md` — Permission sets
> Skip files for sections that don't apply.

---

## Error Handling

- If Phase 1 finds **no `.al` files**, report "No AL files found in src/" and stop.
- AL MCP tools have base app packages pre-loaded — no version check needed before running Phase 2.5 subagents.
- If any subagent fails or returns empty, note it in the final documentation as "[Section unavailable — analysis incomplete]" rather than silently omitting it.
- If the project has no extensions to base app (no table/page extensions, no event subscribers), skip Phase 2.5 entirely and note in docs: "This is a standalone extension with no modifications to standard BC objects."
- If the project has no integration signals, skip Phase 2.6 entirely.

## Model & Execution Rules

| Phase | Execution | Max subagents | Model |
|-------|-----------|---------------|-------|
| 1 Discovery | Single subagent | 1 | **Opus** |
| 2 + 2.5 Core & Base App | Parallel subagents | up to 9 | **Sonnet** |
| 2.6 Integration | Parallel subagents | up to 4 | **Sonnet** |
| 2b Cross-ref | Targeted micro-subagents (fallback) | variable | **Sonnet** |
| 3 Diagrams | Parallel subagents | up to 3 | **Sonnet** |
| 4 Synthesis | Single subagent | 1 | **Opus** |

**Coordination model:** All subagents work independently and return reports to the orchestrator. Cross-scope questions are resolved in Phase 2b by checking other subagents' outputs first, then running targeted follow-up subagents if needed.
