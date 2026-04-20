# Post-Build Reminder - PostToolUse Hook
#
# After a successful AL build, reminds the agent to run code reviewers
# (spec-reviewer then code-reviewer + performance-reviewer in parallel).
#
# Detects builds from:
# - al_build tool (VS Code LM Tool or AL MCP server) - structured success field
# - VS Code build task (execute/createAndRunTask, execute/runInTerminal) - legacy
# - Direct alc.exe calls via Bash - legacy

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ASCII-safe source: inject Unicode chars at runtime so PS 5.1 doesn't
# misdecode the .ps1 as CP1252 when no BOM is present.
$em = [char]0x2014  # em-dash

$REMINDER = "[Post-Build] Build succeeded. Required review order: (1) spec-reviewer FIRST $em for new-format plans with requirements[], this runs Requirement Coverage against objects[].satisfies. (2) After spec-reviewer returns PASS, run code-reviewer + performance-reviewer in parallel. Do not declare the task complete before all three reviewers have returned."

function Emit-Reminder {
    $result = @{
        hookSpecificOutput = @{
            hookEventName     = 'PostToolUse'
            additionalContext = $script:REMINDER
        }
    }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 10 -Compress))
}

function Test-AlBuildTool {
    param([string]$ToolName)
    return $ToolName -match '(^|__)al_build$'
}

function Test-StructuredBuildSucceeded {
    param($Response)
    if ($null -eq $Response) { return $false }
    if ($Response -is [string]) {
        try {
            $parsed = $Response | ConvertFrom-Json -ErrorAction Stop
            return ($parsed.success -eq $true)
        } catch { return $false }
    }
    # PSCustomObject (from ConvertFrom-Json) or Hashtable
    return ($Response.success -eq $true)
}

try {
    $inputData = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrEmpty($inputData)) { exit 0 }

    $toolUse = $inputData | ConvertFrom-Json -ErrorAction Stop
    $toolName = if ($toolUse.tool_name) { [string]$toolUse.tool_name } else { '' }

    # Path 1: structured al_build call - trust the tool's success field.
    if (Test-AlBuildTool -ToolName $toolName) {
        $response = if ($null -ne $toolUse.tool_response) { $toolUse.tool_response } else { $toolUse.tool_output }
        if (Test-StructuredBuildSucceeded -Response $response) {
            Emit-Reminder
        }
        exit 0
    }

    # Path 2: legacy shell/task build - fall back to output-regex detection.
    $legacyTools = @('execute/createAndRunTask', 'execute/runInTerminal', 'Bash')
    if ($toolName -notin $legacyTools) { exit 0 }

    $command = ''
    if ($toolUse.tool_input) {
        if ($toolUse.tool_input.command) { $command = [string]$toolUse.tool_input.command }
        elseif ($toolUse.tool_input.task) { $command = [string]$toolUse.tool_input.task }
    }

    $output = ''
    if ($null -ne $toolUse.tool_response -and $toolUse.tool_response -is [string]) {
        $output = $toolUse.tool_response
    }
    if (-not $output -and $toolUse.tool_output -and $toolUse.tool_output.stdout) {
        $output = [string]$toolUse.tool_output.stdout
    }

    $isAlBuild = ($command -match '(?i)al[:\s]*package') -or ($command -like '*alc.exe*') -or ($output -match '(?i)al[:\s]*package')
    if (-not $isAlBuild) { exit 0 }

    if ($output -match '(?i)0 error\(s\)') {
        Emit-Reminder
    }
} catch {
    [Console]::Error.WriteLine("[post-build-remind] $($_.Exception.Message)")
}
