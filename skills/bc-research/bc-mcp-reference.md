# BC Base App Lookup — AL MCP Server

The AL MCP server tools (`al_search_objects`, `al_get_object_summary`, etc.) query the **standard BC base application, system application, and installed extensions** — NOT the developer's custom project code. Use them to look up standard BC objects, events, table structures, and procedures. For the developer's own AL code, read the project files directly.

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

**Note:** The MCP tools only cover standard BC objects and installed extensions. They do NOT index the developer's custom project code — use Read/Grep on the project files for that.

## Delegating BC Research to Subagents

When spawning researcher agents for BC base app research, include this block:

````
## BC Base App Lookup

Use AL MCP server tools (`mcp__al-mcp-server__*`) to look up standard BC base application objects. These tools cover standard BC objects and installed extensions only, NOT the developer's custom project code.

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
