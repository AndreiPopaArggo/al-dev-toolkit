# MCP Context Guard - PreToolUse Hook
#
# When the agent calls an al-mcp-server tool, injects a prompt reminding
# it to use a researcher subagent instead. MCP results are large and
# should be pruned by a subagent before reaching the main context.
#
# Prompt-based: injects additionalContext rather than blocking, so
# subagents that legitimately need MCP tools are not denied.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $inputData = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrEmpty($inputData)) { exit 0 }

    $event = $inputData | ConvertFrom-Json -ErrorAction Stop
    $toolName = if ($event.tool_name) { [string]$event.tool_name } else { '' }

    # Claude Code: mcp__al-mcp-server__*  VS Code: mcp_al_mcp_server_*
    if ($toolName -notmatch '^mcp_{1,2}al[-_]mcp[-_]server_{1,2}') {
        exit 0
    }

    $context = @"
MCP tool results are large and will flood your context. Dispatch a researcher subagent to call MCP tools and return a concise summary. Use the bc-research skill or spawn a researcher agent for BC base app lookups.
"@

    $result = @{
        hookSpecificOutput = @{
            hookEventName     = 'PreToolUse'
            additionalContext = $context
        }
    }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 10 -Compress))
} catch {
    [Console]::Error.WriteLine("[mcp-context-guard] $($_.Exception.Message)")
}
