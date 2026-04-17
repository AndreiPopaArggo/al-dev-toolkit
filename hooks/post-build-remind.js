#!/usr/bin/env node
/**
 * Post-Build Reminder - PostToolUse Hook
 *
 * After a successful AL build (0 errors), reminds the agent
 * to run code reviewers (quality + performance in parallel).
 *
 * Detects builds from:
 * - VS Code build task (execute/createAndRunTask, execute/runInTerminal)
 * - Direct alc.exe calls (legacy/fallback)
 */

let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const toolUse = JSON.parse(inputData);
    const toolName = toolUse.tool_name || '';

    // Only check execute tools and Bash (legacy)
    const buildTools = ['execute/createAndRunTask', 'execute/runInTerminal', 'Bash'];
    if (!buildTools.includes(toolName)) {
      process.exit(0);
    }

    const command = toolUse.tool_input?.command || toolUse.tool_input?.task || '';
    const output = toolUse.tool_response || toolUse.tool_output?.stdout || '';

    // Only trigger on AL build tasks or alc.exe calls
    const isAlBuild = /al[:\s]*package/i.test(command) || command.includes('alc.exe') || /al[:\s]*package/i.test(output);
    if (!isAlBuild) {
      process.exit(0);
    }

    // Check for successful compilation (0 errors)
    if (/0 error\(s\)/i.test(output)) {
      const result = {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: "[Post-Build] Build succeeded. Required review order: (1) spec-reviewer FIRST — for new-format plans with requirements[], this runs Requirement Coverage against objects[].satisfies. (2) After spec-reviewer returns PASS, run code-reviewer + performance-reviewer in parallel. Do not declare the task complete before all three reviewers have returned."
        }
      };
      console.log(JSON.stringify(result));
    }

  } catch (e) {
    process.stderr.write(`[post-build-remind] ${e.message}\n`);
  }
});
