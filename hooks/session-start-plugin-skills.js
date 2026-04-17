#!/usr/bin/env node
/**
 * SessionStart Plugin Skills Guidance Hook
 *
 * Reminds the main agent to route BC AL work through the plugin's
 * skills and commands instead of handling tasks ad-hoc.
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
          'AL Dev Toolkit is active. Route BC AL work through the plugin\'s skills/commands '
          + 'instead of handling it ad-hoc:\n'
          + '- Vague idea → /brainstorming\n'
          + '- New feature (multi-file) → /al-planning, then /al-implementation\n'
          + '- Simple 1-2 file change → /quick\n'
          + '- Build errors → /build-fix (dispatches build-error-resolver)\n'
          + '- Review changed files → /code-review-al\n'
          + '- Review full project → /project-code-review\n'
          + '- BC base app lookup (standard objects, events, tables, procedures) → /bc-research (dispatches researcher subagent via MCP)\n'
          + '- Project documentation → /generate-project-docs\n'
          + 'Follow the skill files; do not invent alternative workflows. If unsure which skill applies, ask the user.'
      }
    };
    console.log(JSON.stringify(result));
  } catch (e) {
    process.stderr.write(`[session-start-plugin-skills] ${e.message}\n`);
  }
});
