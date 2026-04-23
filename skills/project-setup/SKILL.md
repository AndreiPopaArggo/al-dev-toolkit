---
name: project-setup
description: Project configuration discovery. Read at the start of every task to understand BC version, ID ranges, deployment target, and coding rules.
user-invocable: false
---

# Project Setup

Before starting any task, read these project files to understand the project configuration.

## 1. `app.json` (required)

Extract:
- **App name and publisher**
- **Object ID ranges** (`idRanges`) — verify planned object IDs fall within range
- **BC version** (`platform` or `application` version)
- **Dependencies** — what packages the project depends on

## 2. `CodeCop.json` (if exists)

Extract:
- **mandatoryAffixes** — prefix/suffix required on all object and field names (NOT on captions)

## 3. `.github/copilot-instructions.md` (if exists)

Extract:
- **Deployment target** (SaaS / OnPrem / Both) — constrains which patterns are viable
- **Project-specific rules** — any conventions beyond the standard AL coding style
- **Build configuration** — any custom build steps or requirements

If this file doesn't exist, ask the user about deployment target when it matters for design decisions.

## Project Paths

Plans and context files are stored in project-local directories:
- **Plans:** `.github/plans/` — implementation plans created by `/plan`
- **Context:** `.github/context/` — brainstorm outputs, requirement docs, temporary research notes
