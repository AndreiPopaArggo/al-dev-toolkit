---
name: brainstorming
description: "Refine a vague BC idea into a specific, plannable requirement. Use when the user describes a BC feature or change but the scope, approach, or details are unclear — phrases like 'I want something that...', 'maybe we could...', 'how should we handle...'. Do NOT use when the user gives a clear, specific task."
argument-hint: "<your vague idea>"
tools: ['agent', 'read', 'search']
---

# Brainstorming

Help the user turn a vague idea into a specific, plannable BC requirement through short, focused conversation.

<HARD-GATE>
- Do NOT write AL code (.al files) or start planning/implementation.
- Do NOT invoke al-planning, al-implementation, or any coding skill.
- The ONLY outputs are: a refined requirement saved to `.github/context/brainstorm-*.md`, and a suggestion to run `/plan`.
</HARD-GATE>

## Process

### 0. Project context (lightweight)

Before asking questions, get quick awareness of what exists:
- **Read project config** — follow the [Project Setup](../project-setup/SKILL.md) skill for BC version, deployment target (constrains which approaches are viable)
- **Glob `src/**/*.al`** — names only, know what extensions already exist

Do NOT deep-research. This is a 30-second scan, not a research phase.

### 1. Understand the idea

Ask questions **one at a time** to understand what the user wants. Prefer multiple-choice questions when possible. Use project context to inform your questions — if extensions already exist in the area, reference them.

Focus on:
- **What problem** are they solving? (not what feature they want)
- **Who** is affected? (which users/roles)
- **Where** in BC does this happen? (which pages, processes, posting routines)
- **What triggers** the behavior? (user action, posting, scheduled task)

### 2. Explore approaches

Once you understand the problem, propose **2-3 approaches** with trade-offs and your recommendation.

Keep it BC-practical:
- Event subscription vs. custom codeunit
- Table extension vs. new table
- Page extension vs. new page
- SaaS-compatible vs. OnPrem-only patterns

### 3. Refine into a plannable requirement

Synthesize the conversation into a **specific requirement statement** — one paragraph that names:
- The concrete feature/behavior
- Which BC objects are involved
- The trigger and expected outcome
- Any constraints (deployment target, performance, etc.)

Present it to the user for approval.

### 4. Handoff

Once the user approves the requirement:

1. **Save to file** — Create the `.github/context/` directory if it doesn't exist, then write the approved requirement to `.github/context/brainstorm-<topic-slug>.md` using this template:
   ```
   # Brainstorm: [Topic]
   ## Requirement
   [Refined requirement statement]
   ## Approach
   [Chosen approach with rationale]
   ## Constraints
   [Deployment target, performance, compatibility]
   ## Open Questions
   [Anything unresolved]
   ```

2. **Suggest next step:**
   > Requirement saved to `.github/context/brainstorm-<topic>.md`. Run `/plan` to start planning — it will pick up this file automatically.

Do NOT invoke /plan automatically — let the user decide when to proceed.

## Key Principles

- **One question at a time** — don't overwhelm
- **Multiple choice preferred** — easier to answer
- **Stay in BC domain** — ground suggestions in BC patterns and limitations
- **YAGNI** — push back on scope creep during brainstorming
- **Short conversation** — aim for 3-5 exchanges, not 20

## User's Idea

$ARGUMENTS
