# BC Base App Lookup — AL MCP Server

The AL MCP server tools (`al_search_objects`, `al_get_object_summary`, etc.) query the **standard BC base application, system application, and installed extensions** — NOT the developer's custom project code. Use them to look up standard BC objects, events, table structures, and procedures. For the developer's own AL code, read the project files directly.

## Tool Selection

| Need | Tool | Notes |
|------|------|-------|
| Quick object overview | `al_get_object_summary` | Categorized procedures, key structure |
| Field listing | `al_search_object_members` (memberType: fields) | Filterable by pattern |
| Procedure search | `al_search_object_members` (memberType: procedures) | Wildcard patterns |
| Page control lookup | `al_search_object_members` (memberType: controls, pattern) | Returns full layout path (e.g. content > Item > Base Unit of Measure) |
| Controls in a fast tab | `al_search_object_members` (memberType: controls, group: "Item") | Restricts to one group subtree |
| Full object structure | `al_get_object_definition` (summaryMode: false) | Use fieldLimit/procedureLimit |
| Source code snippet | `al_get_source` (objectName, memberName, memberType) | Actual AL implementation code — procedure bodies, field triggers, etc. |
| Who extends X? | `al_find_references` (referenceType: extends) | Cross-package |
| Who uses table X? | `al_find_references` (referenceType: table_usage) | Cross-package |
| Object search | `al_search_objects` | Pattern + type + package filtering |

## What MCP Provides

- **Full procedure signatures:** parameter names, types with concrete subtypes (Record "Sales Header", Enum "Item Type", Codeunit "Gen. Jnl.-Post Line"), var/by-reference flag, return types with subtypes
- **Event attributes:** IntegrationEvent, BusinessEvent, EventSubscriber with arguments
- **Visibility:** IsLocal, IsInternal, IsProtected
- **Page layout paths:** full control hierarchy (content > group > field) with group filtering
- **Source code:** procedure bodies, field triggers, and event declarations via `al_get_source`

## MCP Limitations

- **Event execution order:** MCP returns declaration order, not invocation order
- **Scope:** Only covers standard BC objects and installed extensions — NOT the developer's custom project code (use Read/Grep for that)

## Delegating BC Research to Subagents

When spawning researcher agents for BC base app research, include this block:

````
## BC Base App Lookup

Use AL MCP server tools (`mcp__al-mcp-server__*`) to look up standard BC base application objects. These tools cover standard BC objects and installed extensions only, NOT the developer's custom project code.

### Tool selection:
- Overview/categories: `al_get_object_summary`
- Field/procedure search: `al_search_object_members` (memberType: fields|procedures, pattern: "*wildcard*")
- Page control by name: `al_search_object_members` (memberType: controls, pattern: "*name*") — returns full layout path
- Controls in a group: `al_search_object_members` (memberType: controls, group: "GroupName")
- Source code: `al_get_source` (objectName, memberName, memberType: procedure|trigger|field|control)
- Who extends/uses: `al_find_references` (referenceType: extends|table_usage)
- Full definition: `al_get_object_definition` (summaryMode: false, use limits)
````
