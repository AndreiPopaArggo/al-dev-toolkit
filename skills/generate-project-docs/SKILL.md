---
name: generate-project-docs
description: Generate comprehensive project-level documentation using agent teams. Covers data model, business logic, UI, integrations, and base app context.
disable-model-invocation: true
---

# Generate Project Documentation

Generate comprehensive, high-quality documentation for a BC AL project using agent teams. The main agent acts as orchestrator — it does NOT read source files itself. All analysis is delegated to teammates to preserve the orchestrator's context window.

## Phase 0: User Input

Before doing anything else, ask the user these 3 questions using `AskUserQuestion` in a **single call**:

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

## Phase 1: Discovery (Single Agent — Opus)

Spawn **1 project-documenter agent (opus)** via the Task tool. Give it this task:

> Scan the project and return a structured JSON manifest. Do NOT write documentation — only collect facts.
>
> 1. Read `app.json` — extract: app name, publisher, ID ranges, version, dependencies
> 2. Read project `CLAUDE.md` — extract: BC version, conventions, special notes. If BC version is not documented, note "BC_VERSION: UNKNOWN" in the manifest.
> 3. Glob all `.al` files in the project `src/` folder
> 4. For each `.al` file, extract (using Grep, not full reads):
>    - Object type and name (from `table`, `page`, `codeunit`, `tableextension`, `pageextension`, `enumextension`, `enum`, `report`, `xmlport`, `query`, `interface`, `permissionset` declarations)
>    - For extensions: the `extends` target name
>    - For event subscribers: the `[EventSubscriber(...)]` attribute — extract object type, object name, event name
>    - For HttpClient/HttpRequestMessage: file paths where these types appear
>    - For API pages: files with `PageType = API`
>    - For XMLports: file paths
>    - For references to Warehouse tables (`"Warehouse Shipment"`, `"Warehouse Receipt"`, `"Whse."`, `"Bin"`, `"Zone"`): file paths
>    - For references to Contact/CRM tables (`Contact`, `Opportunity`, `"Interaction Log"`, `Segment`): file paths
> 5. Group files by feature folder (first subfolder under `src/`)
> 6. Return the manifest as a structured markdown document with these sections:
>    - `## Project Info` (app name, publisher, version, ID ranges, BC version)
>    - `## Dependencies` (from app.json)
>    - `## Folder Structure` (tree of src/ subfolders with file counts)
>    - `## Object Inventory` (table: object type → count)
>    - `## File List by Folder` (grouped list: folder → files with object type and name)
>    - `## Extension Targets` (list: extension object → base object it extends)
>    - `## Event Subscribers` (list: subscriber codeunit → target object → event name)
>    - `## Integration Signals` (HttpClient files, API pages, XMLports, Warehouse refs, CRM refs)
>
> Use `mcp__microsoft-learn__microsoft_docs_search` and `mcp__microsoft-learn__microsoft_docs_fetch` instead of WebSearch for any Microsoft documentation lookups. Use WebFetch for URL fetching.

Wait for this agent to complete. Parse its manifest to determine which Phase 2.5 and 2.6 teammates are needed.

---

## Phase 2 + 2.5: Core & Base App Analysis (Agent Team)

Create **agent team `docs-core`** and spawn all core + base app teammates. All use **Sonnet 4.6** — set `model: "sonnet"` on every teammate.

**Why a team:** The 5 core analyzers investigate different facets of the same codebase — Data Model, Business Logic, UI, Events, Setup — and their findings genuinely overlap. The Event Map teammate traces chains that span codeunits and tables; the UI teammate documents pages that call codeunits and display table data. Real-time messaging lets teammates cross-validate findings and resolve cross-scope questions directly, eliminating the need for a separate cross-reference resolution phase.

Each teammate prompt must include the **Common Preamble** prepended, then the teammate-specific prompt.

### Common Preamble (include in every teammate prompt)

> {MANIFEST}
>
> **Audience:** {AUDIENCE}
>
> You have full read access to all project files. Look things up yourself first. If you need information that falls within another teammate's scope (e.g., you're analyzing UI and need to understand a codeunit's purpose), **send a targeted message** to that specific teammate. Do not broadcast.
>
> Use `mcp__microsoft-learn__microsoft_docs_search` and `mcp__microsoft-learn__microsoft_docs_fetch` instead of WebSearch for any Microsoft documentation lookups. Use WebFetch for URL fetching.

### Phase 2: Project Analysis (always 5 teammates)

#### Teammate 2A — Data Model

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
> **Cross-scope questions:** First, try messaging the relevant teammate directly (e.g., ask Teammate 2B about codeunit behavior). Only add to `## Needs Context` if you cannot resolve it via messaging or reading files in your scope.

#### Teammate 2B — Business Logic

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
> **Cross-scope questions:** First, try messaging the relevant teammate directly (e.g., ask Teammate 2A about table structure). Only add to `## Needs Context` if you cannot resolve it via messaging or reading files in your scope.

#### Teammate 2C — UI Layer

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
> **Cross-scope questions:** First, try messaging the relevant teammate directly (e.g., ask Teammate 2B about codeunit flows). Only add to `## Needs Context` if you cannot resolve it via messaging or reading files in your scope.

#### Teammate 2D — Event & Integration Map

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
> **Cross-scope questions:** First, try messaging the relevant teammate directly. Only add to `## Needs Context` if you cannot resolve it via messaging or reading files in your scope.

#### Teammate 2E — Setup & Permissions

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
> No `## Needs Context` needed — setup is self-contained.

### Phase 2.5: Base App Research (on-demand — same team `docs-core`)

**Only spawn if the manifest shows the corresponding dependencies.** These teammates are part of team `docs-core` alongside the Phase 2 teammates.

#### Teammate 2.5A — Base Tables

Spawn if Extension Targets contains table extensions.

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

#### Teammate 2.5B — Base Pages

Spawn if Extension Targets contains page extensions.

> You are researching BASE APPLICATION PAGES that this project extends. Use AL MCP server tools (`mcp__al-mcp-server__*`) for all base app lookups. Use `al_get_source` for actual implementation code.
>
> For each page extension in the manifest, look up the base page. Extract:
> - Page purpose: what business process it serves
> - PageType and SourceTable
> - Key layout areas (where the extension's fields/actions are being added)
> - Important existing actions that the extension may interact with
>
> Return a markdown report: one section per base page.

#### Teammate 2.5C — Base Events

Spawn if Event Subscribers list is non-empty.

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

#### Teammate 2.5D — Base Codeunits

Spawn if manifest shows references to standard codeunits like "Sales-Post", "Gen. Jnl.-Post Line", etc.

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

**Only spawn if the manifest's Integration Signals section shows the corresponding patterns.** Spawn integration subagents via the Task tool alongside the Phase 2/2.5 batch if possible, or as a second parallel batch if Phase 2 results are needed first. All subagents use **Sonnet 4.6**. Include the Common Preamble in every subagent prompt.

If no integration signals exist in the manifest, skip this phase entirely.

#### Subagent 2.6A — External APIs

Spawn if HttpClient/HttpRequestMessage files found.

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

Spawn if Warehouse table references found.

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

Spawn if Contact/CRM table references found.

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

Spawn if XMLports or API pages found.

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

## Phase 2b: Cross-Reference Resolution (lightweight fallback)

Most cross-scope questions should be resolved in real-time within the `docs-core` team via teammate messaging. This phase is a **fallback** for anything that slipped through.

After ALL teammates from team `docs-core` and all Phase 2.6 subagents complete, check each output for a `## Needs Context` section.

If any agent flagged unresolved items in `## Needs Context`:
1. **First, check if another agent's output already answers the question.** Often the answer exists in a teammate's report.
2. **Only if the answer is NOT in any existing report**, spawn targeted micro-agents via the Task tool (project-documenter, sonnet) to investigate.

If no agents flagged `## Needs Context`, skip this phase entirely (expected in most cases thanks to team communication).

---

## Phase 3: Diagrams (conditional — Parallel Subagents)

**Only execute if user chose "Yes, include diagrams".** Spawn diagram subagents via the Task tool in a **single message** (parallel Task calls). All use **Sonnet 4.6**. Each subagent receives the relevant Phase 2 reports as input.

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

### Subagent 3C — Integration Map (only if Phase 2.6 subagents were spawned)

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

## Phase 4: Synthesis (Single Agent — Opus)

Spawn **1 project-documenter agent (opus)** via the Task tool. Give it:
- ALL reports from Phase 2, 2.5, 2.6, 2b
- ALL diagrams from Phase 3 (if generated)
- The user's choices: `AUDIENCE`, `FORMAT`, `DIAGRAMS`
- The project manifest from Phase 1

### Agent Prompt — Phase 4 Synthesis

> You are writing the FINAL DOCUMENTATION for this AL project. You have received analysis reports from multiple specialized teammates. Your job is to synthesize them into a cohesive, well-structured document.
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
> - Do NOT copy-paste raw agent reports. Synthesize, restructure, and write cohesive prose.
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
- AL MCP tools have base app packages pre-loaded — no version check needed before spawning Phase 2.5 teammates.
- If any teammate fails or returns empty, note it in the final documentation as "[Section unavailable — analysis incomplete]" rather than silently omitting it.
- If the project has no extensions to base app (no table/page extensions, no event subscribers), skip Phase 2.5 entirely and note in docs: "This is a standalone extension with no modifications to standard BC objects."
- If the project has no integration signals, skip Phase 2.6 entirely.

## Model & Execution Rules

| Phase | Execution | Max agents | Model |
|-------|-----------|------------|-------|
| 1 Discovery | Single Task subagent | 1 | **Opus** |
| 2 + 2.5 Core & Base App | **Agent team `docs-core`** | up to 9 | **Sonnet 4.6** |
| 2.6 Integration | Parallel Task subagents | up to 4 | **Sonnet 4.6** |
| 2b Cross-ref | Parallel Task micro-agents (fallback) | variable | **Sonnet 4.6** |
| 3 Diagrams | Parallel Task subagents | up to 3 | **Sonnet 4.6** |
| 4 Synthesis | Single Task subagent | 1 | **Opus** |

**Why team for Phase 2/2.5:** Core analyzers investigate overlapping facets of the same codebase — the Event Map traces chains through codeunits and tables, the UI documents pages that call codeunits and display table data. Real-time messaging lets teammates cross-validate findings and resolve questions directly, eliminating most of Phase 2b.

**Why subagents for Phase 2.6/3:** Integration analyzers (APIs, WMS, CRM) and diagram generators have independent scopes — they don't need to talk to each other. The orchestrator collects their outputs.
