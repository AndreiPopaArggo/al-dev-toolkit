---
description: "One-time setup for a BC project using al-dev-toolkit. Writes project-level instructions so future agent sessions pick up project config, plugin routing, and AL-file workflow guarding automatically. Run once per project."
argument-hint: "(interactive — no arguments)"
---

# al-dev-toolkit Project Setup

Set up a BC project to use the al-dev-toolkit plugin. Produces two files in the user's project:

1. `.github/copilot-instructions.md` — always-loaded session instructions (project config + plugin routing)
2. `.github/instructions/al-workflow.instructions.md` — auto-applies when AL files are in context (routing guard + skill enforcement)

## Steps

1. **Guard — check if setup already done.** Before anything else, check whether `.github/copilot-instructions.md` or `.github/instructions/al-workflow.instructions.md` already exists in the project. If either exists:
   - Report which file(s) are present.
   - Ask the user: "Setup appears to have been run already. Overwrite both files? (yes / no / update-rules-only)"
     - **no** → stop immediately.
     - **update-rules-only** → skip to step 4 (ask for SaaS/OnPrem and Project-Specific Rules), then rewrite only the `## Project Info` and `## Project-Specific Rules` sections of `.github/copilot-instructions.md` and leave `al-workflow.instructions.md` untouched. Preserve any manual edits the user made to other sections.
     - **yes** → continue to step 2 (full re-run, both files overwritten).

   If neither file exists, proceed to step 2.

2. **Read `app.json`** — extract:
   - Object ID range (first entry in `idRanges`; if multiple, list all)
   - BC version (`platform` or `application`)
   - Publisher, App name

3. **Read `CodeCop.json` if present** — extract `mandatoryAffixes`.

4. **Ask the user**, one question at a time:
   - "Is this project **SaaS**, **OnPrem**, or **Both**?"
   - "Anything project-specific the agent should know? (e.g. 'use codeunit X for posting', 'integrate with system Y'). Press enter to skip."

5. **Write `.github/copilot-instructions.md`** using Template A below. Create `.github/` if missing.

6. **Write `.github/instructions/al-workflow.instructions.md`** using Template B below (literal, no placeholders). Create `.github/instructions/` if missing.

7. **Report**: both file paths, extracted Project Info values, and a pointer ("agent reads these on every session; start with `/al-planning` or `/quick`").

## Template A — `.github/copilot-instructions.md`

Fill `{placeholders}` from extracted/asked values. Omit the **Project-Specific Rules** section if the user gave nothing.

~~~markdown
# Project Instructions

Instructions for the AI agent working in this Business Central project. Loaded automatically at session start.

## Project Info

- **BC Version:** {from app.json}
- **Deployment:** {SaaS | OnPrem | Both}
- **Object ID Range:** {from app.json idRanges}
- **Mandatory Affixes:** {from CodeCop.json, or "none"}
- **Publisher:** {from app.json}

## Plugin

This project uses **al-dev-toolkit**. Route BC work through its commands — they own the coding conventions (DataClassification, Labels, SetLoadFields, affix, CodeCop). Do not write AL code outside these commands.

| User intent | Command |
|---|---|
| Vague idea, not sure what to build | `/brainstorming` |
| Multi-object feature, new tables/pages/codeunits, event subscriptions | `/al-planning` → `/al-implementation` |
| 1-2 file change (field, property, caption) | `/quick` |
| Build error in AL compiler | `/build-fix` |
| Review changed AL files after edits | `/code-review-al` |

### Routing rules

- Pick a command from the table above instead of writing code directly.
- Multi-object work: always run `/al-planning` before `/al-implementation`. The plan is the contract.
- After any AL edit: run `/code-review-al` unless the user says otherwise.
- Don't bypass the coder agent — it owns the conventions.
- The `researcher` agent is read-only; it investigates BC base application symbols via `al-mcp-server`. Don't read `.alpackages` directly.

### Paths

- Plans: `.github/plans/`
- Context files the user adds for a task: `.github/context/`

## Project-Specific Rules

{user answer from step 3, verbatim — or section omitted}
~~~

## Template B — `.github/instructions/al-workflow.instructions.md`

Literal content (no placeholders):

~~~markdown
---
description: "Route AL work through al-dev-toolkit. Applied automatically when an AL file is in context."
applyTo: "**/*.al"
---

# AL Workflow Guard

This project uses the al-dev-toolkit plugin. AL edits must go through its commands — the plugin owns the conventions, patterns, performance, and security rules.

## Routing

| Request | Command |
|---|---|
| Vague idea, not sure what to build | `/brainstorming` → `/al-planning` |
| New objects, multi-object change, new feature, event subscriptions | `/al-planning` → `/al-implementation` |
| 1-2 file change (field, property, caption, page tweak) | `/quick` |
| Compiler error | `/build-fix` |
| Review changed files | `/code-review-al` |

Do NOT edit AL directly without running one of these commands. Multi-object work must start with `/al-planning` — the plan is the contract the coder agent implements against.

## Skill enforcement

When editing AL through any of the commands above, the agent must load and apply the plugin's AL skill library:

- `al-coding-style` — naming, declaration order, Labels, self-reference
- `al-patterns` — events, interfaces, temp tables, setup tables
- `al-performance` — SetLoadFields, FindSet vs Get, FlowField handling
- `al-security` — DataClassification, permission sets, credential handling

The `coder` agent preloads these automatically. Any other agent editing AL must load them explicitly before writing code.

## Base-app references

When reading Microsoft base-app code via `al-mcp-server` or `microsoft-learn` MCPs, use it for signatures, behavior, and patterns only. Do **not** copy variable names verbatim — Microsoft base app uses different conventions (no `_` on locals, no `p` on parameters, etc.). The project conventions in `al-coding-style` apply to every variable you declare, regardless of what surrounding lookup results look like.
~~~
