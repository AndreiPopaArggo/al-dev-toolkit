# BC Base App Lookup — AL MCP Server

Use AL MCP server tools for structure, discovery, and cross-references.

## Quick Start

```
1. Load packages:  al_packages(action: load, path: <folder-with-.alpackages>)
2. Search/explore: al_search_objects, al_get_object_summary, al_search_object_members
```

**Loading packages:** Check if `.alpackages` exists in the current working directory. If found, load from `"."`. If not found, use AskUserQuestion to ask the user for a folder containing .app symbol packages.

## Tool Selection

| Need | Tool | Notes |
|------|------|-------|
| Quick object overview | `al_get_object_summary` | 96% token reduction, categorized procedures |
| Field listing | `al_search_object_members` (memberType: fields) | Filterable by pattern |
| Procedure search | `al_search_object_members` (memberType: procedures) | Wildcard patterns |
| Full object structure | `al_get_object_definition` (summaryMode: false) | Use fieldLimit/procedureLimit |
| Who extends X? | `al_find_references` (referenceType: extends) | Cross-package |
| Who uses table X? | `al_find_references` (referenceType: table_usage) | Cross-package |
| Object search | `al_search_objects` | Pattern + type + package filtering |

## MCP Limitations & Gap-Filling

The following details are NOT available from MCP:

1. **Parameter types:** `Record` without table name, `Enum` without enum name, `Codeunit` without codeunit name
2. **ByReference:** Always `false` — cannot detect `var` parameters
3. **Code bodies:** Not available — structure only (procedure names, params, properties)
4. **Event execution order:** MCP returns declaration order, not invocation order

**When gap-filling is needed:** If MCP results are insufficient (e.g., you need exact `var` qualifiers, concrete Record type names, or code bodies), use AskUserQuestion to ask the user for a folder containing BC base app source files. Then use the `ReferenceSourceFileName` from MCP results to locate the file in that folder and Grep/Read for the details.

## Delegating BC Research to Subagents

When spawning researcher agents for BC base app research, include this block:

````
## BC Base App Lookup

Use AL MCP server tools (`mcp__al-mcp-server__*`) for all base app lookups. Load packages first: check for `.alpackages` in the working directory; if not found, ask the user for a folder path.

### Tool selection:
- Overview/categories: `al_get_object_summary`
- Field/procedure search: `al_search_object_members` (memberType: fields|procedures, pattern: "*wildcard*")
- Who extends/uses: `al_find_references` (referenceType: extends|table_usage)
- Full definition: `al_get_object_definition` (summaryMode: false, use limits)
````

**Gap-filling:** If MCP results are insufficient (var qualifiers, code bodies needed), ask the user for a BC source folder path, then use `ReferenceSourceFileName` from MCP to locate and Grep/Read the source file.

## Performance (tested across 7 projects)

| Metric | MCP | Old Index Approach |
|--------|-----|--------------------|
| Avg lookup time | ~10s | ~176s |
| Avg tool calls | ~3 | ~17 |
| Avg tokens | ~46K | ~54K |
| Speed advantage | **~17x faster** | — |
