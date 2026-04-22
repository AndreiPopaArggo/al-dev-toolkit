#!/usr/bin/env node
/**
 * Post-Build Reminder - PostToolUse Hook
 *
 * After a successful AL build (0 errors), reminds the agent
 * to run code reviewers (quality + performance in parallel).
 *
 * Detects builds from:
 * - al_build tool (VS Code LM Tool or AL MCP server) — structured success field
 * - VS Code build task (execute/createAndRunTask, execute/runInTerminal) — legacy
 * - Direct alc.exe calls via Bash — legacy
 */

const REMINDER = "[Post-Build] Build succeeded. Required review order: (1) spec-reviewer FIRST — for new-format plans with requirements[], this runs Requirement Coverage against objects[].satisfies. (2) After spec-reviewer returns PASS, run code-reviewer + performance-reviewer in parallel. Do not declare the task complete before all three reviewers have returned.";

function emit() {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: REMINDER
    }
  }));
}

function isAlBuildTool(toolName) {
  // Matches bare "al_build", MCP-prefixed "mcp__al-mcp-server__al_build",
  // and VS Code extension-prefixed "ms-dynamics-smb.al/al_build".
  return /(^|__|\/)al_build$/.test(toolName);
}

function structuredBuildSucceeded(response) {
  // al_build returns { success: true, result: "..." }. Accept either the raw object
  // or a JSON-stringified form (some harnesses stringify tool_response).
  if (!response) return false;
  if (typeof response === 'object' && response.success === true) return true;
  if (typeof response === 'string') {
    try {
      const parsed = JSON.parse(response);
      if (parsed && parsed.success === true) return true;
    } catch (_) { /* fall through to legacy check */ }
  }
  return false;
}

let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const toolUse = JSON.parse(inputData);
    const toolName = toolUse.tool_name || '';

    // Path 1: structured al_build call — trust the tool's success field.
    if (isAlBuildTool(toolName)) {
      if (structuredBuildSucceeded(toolUse.tool_response ?? toolUse.tool_output)) {
        emit();
      }
      process.exit(0);
    }

    // Path 2: legacy shell/task build — fall back to output-regex detection.
    const legacyTools = ['execute/createAndRunTask', 'execute/runInTerminal', 'Bash'];
    if (!legacyTools.includes(toolName)) {
      process.exit(0);
    }

    const command = toolUse.tool_input?.command || toolUse.tool_input?.task || '';
    const output = toolUse.tool_response || toolUse.tool_output?.stdout || '';
    const isAlBuild = /al[:\s]*package/i.test(command) || command.includes('alc.exe') || /al[:\s]*package/i.test(output);
    if (!isAlBuild) {
      process.exit(0);
    }

    if (/0 error\(s\)/i.test(output)) {
      emit();
    }

  } catch (e) {
    process.stderr.write(`[post-build-remind] ${e.message}\n`);
  }
});
