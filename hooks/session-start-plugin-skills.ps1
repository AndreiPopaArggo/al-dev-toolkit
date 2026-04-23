# SessionStart Plugin Skills Guidance Hook
#
# Enforces delegation: instructs the main agent to route every BC AL task
# through the plugin's subagents/skills rather than writing AL code inline.
# Appends skills/al-coding-style/SKILL.md as a safety-net ruleset for cases
# where delegation is genuinely impossible. Script body is ASCII-only so
# PS 5.1 parses it correctly without a BOM; the injected skill content is
# read as UTF-8 at runtime.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $null = [Console]::In.ReadToEnd()

    # Read al-coding-style skill at runtime so the injected rules stay in
    # sync with the canonical skill file. If the file is missing or
    # unreadable, skip the fallback block -- the routing directive still
    # carries the primary guidance.
    $pluginRoot = Split-Path -Parent $PSScriptRoot
    $styleFile = Join-Path $pluginRoot 'skills/al-coding-style/SKILL.md'
    $styleContent = ''
    if (Test-Path $styleFile) {
        try {
            $styleContent = Get-Content -Path $styleFile -Raw -Encoding UTF8 -ErrorAction Stop
        } catch {
            [Console]::Error.WriteLine("[session-start-plugin-skills] Could not read ${styleFile}: $($_.Exception.Message)")
        }
    } else {
        [Console]::Error.WriteLine("[session-start-plugin-skills] Skill file not found: $styleFile")
    }

    $directive = @"
AL Dev Toolkit is active. This plugin owns every Business Central AL task in this workspace.

DELEGATION IS MANDATORY. Do NOT write or review AL code in Edit Agent mode without delegating. The plugin's subagents carry project-specific rules (variable prefixes, casing, scope, captions, labels, DataClassification, SetLoadFields, event patterns) that are NOT in your default priors and WILL be wrong if you improvise.

When a user request matches one of these, delegate BEFORE responding:

  AL code writing                            -> runSubagent-coder   (or user: /quick, /al-implementation)
  AL code review (changed files)             -> runSubagent-code-reviewer + runSubagent-performance-reviewer in parallel   (or user: /code-review-al)
  AL code review (full project)              -> user: /project-code-review
  Spec-vs-implementation check               -> runSubagent-spec-reviewer
  Build errors / CodeCop / AppSource warnings -> runSubagent-build-error-resolver   (or user: /build-fix)
  BC base app lookup                         -> runSubagent-researcher   (or user: /bc-research). Do NOT Read/Grep .alpackages or .app files.
  Project documentation                      -> runSubagent-project-documenter   (or user: /generate-project-docs)
  Vague idea / unclear scope                 -> user: /brainstorming
  New feature (3+ files) plan                -> user: /al-planning, then /al-implementation

If the user's request is an AL coding task and no slash command is present, call the matching runSubagent-* tool directly -- that is the correct path, NOT writing code yourself.
"@

    if ($styleContent) {
        $fallback = @"


---- Fallback AL rules (last resort; delegation is still the correct path) ----

The block below is reproduced verbatim from skills/al-coding-style/SKILL.md. Prefer delegating to runSubagent-coder over applying these inline; this block exists only for cases where delegation is genuinely impossible (e.g., user explicitly declines, or a pure clarifying question about style).

$styleContent
"@
    } else {
        $fallback = ''
    }

    $context = $directive + $fallback

    $result = @{
        hookSpecificOutput = @{
            hookEventName     = 'SessionStart'
            additionalContext = $context
        }
    }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 10 -Compress))
} catch {
    [Console]::Error.WriteLine("[session-start-plugin-skills] $($_.Exception.Message)")
}
