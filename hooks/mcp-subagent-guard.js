#!/usr/bin/env node
/**
 * MCP Subagent Guard - PreToolUse Hook
 *
 * Intercepts MCP tool calls (al-mcp-server, microsoft-learn) from the
 * main agent and denies them with a message to use a researcher subagent
 * instead. MCP results are large and should be pruned by a subagent
 * before reaching the main context.
 *
 * Allows MCP calls from subagents (agent_id present in input).
 */

let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const event = JSON.parse(inputData);
    const toolName = event.tool_name || '';

    // Only intercept MCP tools from this plugin's servers
    const isMcpTool = toolName.startsWith('mcp__al-mcp-server__')
      || toolName.startsWith('mcp__microsoft-learn__');

    if (!isMcpTool) {
      process.exit(0);
    }

    // Allow MCP calls from subagents — they handle pruning
    if (event.agent_id) {
      process.exit(0);
    }

    // Deny MCP calls from the main agent
    const result = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'MCP tool results are large and will flood your context. '
          + 'Dispatch a researcher subagent to call MCP tools and return a concise summary. '
          + 'Use the bc-research skill or spawn a researcher agent for BC base app lookups.'
      }
    };
    console.log(JSON.stringify(result));

  } catch (e) {
    process.stderr.write(`[mcp-subagent-guard] ${e.message}\n`);
  }
});
