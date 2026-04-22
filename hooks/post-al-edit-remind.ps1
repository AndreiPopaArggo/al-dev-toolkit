# Post-AL-Edit Reminder - PostToolUse Hook
#
# After an Edit or Write to a .al file, reminds the agent to call
# al_build + al_get_diagnostics and drive both errors AND warnings
# to zero before ending the turn.
#
# Skipped implicitly by the agent when its prompt carries
# [DISPATCH_CONTEXT: orchestrated] - in that case the orchestrator
# runs the build.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $inputData = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrEmpty($inputData)) { exit 0 }

    $event = $inputData | ConvertFrom-Json -ErrorAction Stop
    $toolName = if ($event.tool_name) { [string]$event.tool_name } else { '' }

    if ($toolName -notin @('Edit', 'Write')) { exit 0 }

    $filePath = ''
    if ($event.tool_input -and $event.tool_input.file_path) {
        $filePath = [string]$event.tool_input.file_path
    }
    if ($filePath -notmatch '(?i)\.al$') { exit 0 }

    # ASCII-safe source: inject Unicode chars at runtime so PS 5.1 doesn't
    # misdecode the .ps1 as CP1252 when no BOM is present.
    $em = [char]0x2014  # em-dash

    $context = "[Post-AL-Edit] Edited AL file: $filePath. Before the turn ends, call al_build({scope:`"current`"}) then al_get_diagnostics({scope:`"current`", severities:[`"error`",`"warning`"]}) and drive both errors AND warnings on the files you touched to zero $em CodeCop (AA0xxx), AppSource (AS0xxx), and compiler warnings count as must-fix unless the user has explicitly accepted one. Do not end the turn with an unbuilt or warning-laden edit. Exception: if your prompt carries [DISPATCH_CONTEXT: orchestrated], skip the build $em the orchestrator will run it after you return."

    $result = @{
        hookSpecificOutput = @{
            hookEventName     = 'PostToolUse'
            additionalContext = $context
        }
    }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 10 -Compress))
} catch {
    [Console]::Error.WriteLine("[post-al-edit-remind] $($_.Exception.Message)")
}
