# SessionStart BC Guidance Hook
#
# Injects a rule at session start telling the main agent to dispatch
# BC base app questions to the researcher subagent (which uses
# al-mcp-server) instead of scanning .alpackages / .app files.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $null = [Console]::In.ReadToEnd()

    # ASCII-safe source: inject Unicode chars at runtime so PS 5.1 doesn't
    # misdecode the .ps1 as CP1252 when no BOM is present.
    $em = [char]0x2014  # em-dash

    $context = "BC base app research rule: For any question about standard BC objects, events, tables, procedures, page layouts, or installed extension symbols, dispatch the `"researcher`" subagent (or use the /bc-research skill). Do NOT Read, Grep, or Glob .alpackages directories or .app files to answer base app questions $em the researcher uses the al-mcp-server MCP tools and returns a concise summary. Use Read/Grep only for the developer's own project source files."

    $result = @{
        hookSpecificOutput = @{
            hookEventName     = 'SessionStart'
            additionalContext = $context
        }
    }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 10 -Compress))
} catch {
    [Console]::Error.WriteLine("[session-start-bc-guidance] $($_.Exception.Message)")
}
