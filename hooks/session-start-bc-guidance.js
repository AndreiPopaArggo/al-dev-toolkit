#!/usr/bin/env node
/**
 * SessionStart BC Guidance Hook
 *
 * Injects a rule at session start telling the main agent to dispatch
 * BC base app questions to the researcher subagent (which uses
 * al-mcp-server) instead of scanning .alpackages / .app files.
 */

let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const result = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          'BC base app research rule: For any question about standard BC objects, '
          + 'events, tables, procedures, page layouts, or installed extension symbols, '
          + 'dispatch the "researcher" subagent (or use the /bc-research skill). '
          + 'Do NOT Read, Grep, or Glob .alpackages directories or .app files to answer '
          + 'base app questions — the researcher uses the al-mcp-server MCP tools and '
          + 'returns a concise summary. Use Read/Grep only for the developer\'s own '
          + 'project source files.'
      }
    };
    console.log(JSON.stringify(result));
  } catch (e) {
    process.stderr.write(`[session-start-bc-guidance] ${e.message}\n`);
  }
});
