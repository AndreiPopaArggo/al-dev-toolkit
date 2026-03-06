#!/usr/bin/env node
/**
 * Post-Build Reminder - PostToolUse Hook (Bash)
 *
 * After a successful AL build (alc.exe with 0 errors), reminds Claude
 * to run code reviewers (quality + performance in parallel).
 */

let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const toolUse = JSON.parse(inputData);

    // Only check Bash tool calls
    if (toolUse.tool_name !== 'Bash') {
      process.exit(0);
    }

    const command = toolUse.tool_input?.command || '';
    const stdout = toolUse.tool_output?.stdout || '';

    // Only trigger on alc.exe calls
    if (!command.includes('alc.exe')) {
      process.exit(0);
    }

    // Check for successful compilation (0 errors)
    if (/0 error\(s\)/i.test(stdout)) {
      console.error('\n[Post-Build] Build succeeded. Run code reviewers now (quality + performance in parallel).\n');
    }

  } catch (e) {
    // On error, silently exit
  }
});
