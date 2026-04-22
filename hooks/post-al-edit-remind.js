#!/usr/bin/env node
/**
 * Post-AL-Edit Reminder - PostToolUse Hook
 *
 * After an Edit or Write to a .al file, reminds the agent to call
 * al_build + al_get_diagnostics and drive both errors AND warnings
 * to zero before ending the turn.
 *
 * Skipped implicitly by the agent when its prompt carries
 * [DISPATCH_CONTEXT: orchestrated] — in that case the orchestrator
 * runs the build.
 */

let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const toolUse = JSON.parse(inputData);
    const toolName = toolUse.tool_name || '';

    if (!['Edit', 'Write'].includes(toolName)) {
      process.exit(0);
    }

    const filePath = toolUse.tool_input?.file_path || '';
    if (!/\.al$/i.test(filePath)) {
      process.exit(0);
    }

    const result = {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `[Post-AL-Edit] Edited AL file: ${filePath}. Before the turn ends, call al_build({scope:"current"}) then al_get_diagnostics({scope:"current", severities:["error","warning"]}) and drive both errors AND warnings on the files you touched to zero — CodeCop (AA0xxx), AppSource (AS0xxx), and compiler warnings count as must-fix unless the user has explicitly accepted one. Do not end the turn with an unbuilt or warning-laden edit. Exception: if your prompt carries [DISPATCH_CONTEXT: orchestrated], skip the build — the orchestrator will run it after you return.`
      }
    };
    console.log(JSON.stringify(result));

  } catch (e) {
    process.stderr.write(`[post-al-edit-remind] ${e.message}\n`);
  }
});
