---
description: "First-time setup wizard. Creates directories, configures CLAUDE.md, installs al-mcp-server."
allowed-tools: [Bash, Read, Write, Glob, AskUserQuestion]
---

# Setup Wizard

Walk a new user through everything the plugin does NOT ship with. Run each step in order, skipping what already exists.

## Step 1: Create directories

Check and create if missing:
- `~/.claude/context/` — temporary context files for planning
- `~/.claude/sessions/` — task session tracking files
- `~/.claude/plans/` — plan files from /plan

For each: if it exists, show "already exists", if not, create it and confirm.

## Step 2: CLAUDE.md guidance

Check if a project-level `CLAUDE.md` exists in the current working directory.

**If it exists:** Read it and check for these recommended sections:
- BC version (e.g., `BC Version: 27.4`)
- Deployment target (`SaaS`, `OnPrem`, or `Both`)
- Project-specific rules or conventions

If any are missing, suggest adding them with example text. Do NOT write automatically — show the suggestion and let the user decide.

**If it doesn't exist:** Ask the user via AskUserQuestion:
> No project CLAUDE.md found. Want me to create one? I'll ask a few questions:
> 1. BC version (e.g., 27.4, 26, 15)
> 2. Deployment target (SaaS / OnPrem / Both)
> 3. Any project-specific conventions?

If yes, create a minimal `CLAUDE.md` with the answers.

## Step 3: al-mcp-server (mandatory)

**What:** AL language MCP server for searching BC base application objects, procedures, fields, and references from compiled .app packages. This is required for base app research during `/plan`.

**Check:** `claude mcp get al-mcp-server`

**If installed:** Show status and confirm it's working.

**If not installed:**
1. Verify Node.js is available: `node --version`
2. Install:
```bash
claude mcp add al-mcp-server -s user -- cmd /c npx al-mcp-server
```
3. Verify: `claude mcp get al-mcp-server`

**After install, load symbols:**
1. Check if `.alpackages` exists in the current working directory
2. **If found:** Load packages: `al_packages(action: load, path: ".")`
3. **If not found:** Ask the user via AskUserQuestion: "No .alpackages folder found in the current directory. Please provide the path to a folder containing .app symbol packages to load."
4. Load packages with the path the user provides: `al_packages(action: load, path: "<user-provided-path>")`

## Step 4: Summary

Show what was set up:
- Directories created (or already existed)
- CLAUDE.md status
- al-mcp-server status

## Arguments

$ARGUMENTS
