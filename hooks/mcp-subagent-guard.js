#!/usr/bin/env node
/**
 * MCP Context Guard - PreToolUse Hook
 *
 * When the agent calls an al-mcp-server tool, injects a prompt
 * reminding it to use a researcher subagent instead. MCP results
 * are large and should be pruned by a subagent before reaching
 * the main context.
 *
 * Prompt-based: injects additionalContext rather than blocking,
 * so subagents that legitimately need MCP tools are not denied.
 */

let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const event = JSON.parse(inputData);
    const toolName = event.tool_name || '';

    // Debug: log every tool name the hook sees
    process.stderr.write(`[mcp-context-guard] tool_name=${toolName}\n`);

    // Only act on al-mcp-server tools
    // Claude Code uses double underscores (mcp__al-mcp-server__), VS Code uses single (mcp_al-mcp-server_)
    if (!toolName.startsWith('mcp__al-mcp-server__') && !toolName.startsWith('mcp_al-mcp-server_')) {
      process.exit(0);
    }

    const result = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext:
          'MCP tool results are large and will flood your context. '
          + 'Dispatch a researcher subagent to call MCP tools and return a concise summary. '
          + 'Use the bc-research skill or spawn a researcher agent for BC base app lookups.'
      }
    };
    console.log(JSON.stringify(result));

  } catch (e) {
    process.stderr.write(`[mcp-context-guard] ${e.message}\n`);
  }
});
