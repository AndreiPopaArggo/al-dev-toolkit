# SessionStart Plugin Skills Guidance Hook
#
# Reminds the main agent to route BC AL work through the plugin's
# skills and commands instead of handling tasks ad-hoc.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $null = [Console]::In.ReadToEnd()

    # ASCII-safe source: inject Unicode chars at runtime so PS 5.1 doesn't
    # misdecode the .ps1 as CP1252 when no BOM is present.
    $a = [char]0x2192  # right arrow

    $context = @"
AL Dev Toolkit is active. Route BC AL work through the plugin's skills/commands instead of handling it ad-hoc:
- Vague idea $a /brainstorming
- New feature (multi-file) $a /al-planning, then /al-implementation
- Simple 1-2 file change $a /quick
- Build errors $a /build-fix (dispatches build-error-resolver)
- Review changed files $a /code-review-al
- Review full project $a /project-code-review
- BC base app lookup (standard objects, events, tables, procedures) $a /bc-research (dispatches researcher subagent via MCP)
- Project documentation $a /generate-project-docs
Follow the skill files; do not invent alternative workflows. If unsure which skill applies, ask the user.
"@

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
