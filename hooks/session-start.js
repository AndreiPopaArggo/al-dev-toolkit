#!/usr/bin/env node
/**
 * SessionStart Hook - Task-based session management
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs when a new Claude session starts. Lists available task sessions
 * and suggests the user create or load one.
 */

const path = require('path');
const fs = require('fs');
const {
  getClaudeDir,
  getSessionsDir,
  getLearnedSkillsDir,
  findFiles,
  ensureDir,
  readFile
} = require('./lib/utils');

/**
 * Get error log path (persists errors for next session)
 */
function getErrorLogPath() {
  return path.join(getClaudeDir(), 'session-start-errors.log');
}

/**
 * Log an error to persistent file (will be shown next session)
 */
function logError(message) {
  const errorPath = getErrorLogPath();
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(errorPath, entry, 'utf8');
  } catch {
    // Can't even write errors - nothing we can do
  }
}

/**
 * Check for and return any errors from previous sessions
 * Returns error text or empty string
 */
function checkPreviousErrors() {
  const errorPath = getErrorLogPath();
  let errorContext = '';
  if (fs.existsSync(errorPath)) {
    try {
      const errors = fs.readFileSync(errorPath, 'utf8').trim();
      if (errors) {
        errorContext = [
          '',
          '=== SESSION START ERRORS (from previous run) ===',
          errors,
          '=== END ERRORS ===',
          ''
        ].join('\n');
      }
      // Clear the error log after displaying
      fs.unlinkSync(errorPath);
    } catch {
      // Ignore read errors
    }
  }
  return errorContext;
}

/**
 * Parse task metadata from a task session file
 */
function parseTaskFile(filePath) {
  const content = readFile(filePath);
  if (!content) return null;

  const lines = content.split('\n');
  let taskId = path.basename(filePath, '.md').replace(/^task-/, '');
  let created = '';
  let lastUpdated = '';
  let status = '';

  for (const line of lines.slice(0, 10)) {
    const taskMatch = line.match(/^#\s+Task:\s*(.+)/);
    if (taskMatch) taskId = taskMatch[1].trim();

    const createdMatch = line.match(/\*\*Created:\*\*\s*(.+)/);
    if (createdMatch) created = createdMatch[1].trim();

    const updatedMatch = line.match(/\*\*Last Updated:\*\*\s*(.+)/);
    if (updatedMatch) lastUpdated = updatedMatch[1].trim();

    const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)/);
    if (statusMatch) status = statusMatch[1].trim();
  }

  return { taskId, created, lastUpdated, status, filePath };
}

/**
 * List available task sessions
 * Returns { userMessage, claudeContext } for JSON output
 */
function listTaskSessions() {
  const sessionsDir = getSessionsDir();
  const taskFiles = findFiles(sessionsDir, 'task-*.md');

  if (taskFiles.length === 0) {
    return {
      userMessage: 'No active tasks. Use /create-task <ID> to start one.',
      claudeContext: [
        '=== TASK SESSION MANAGEMENT ===',
        'No active tasks found.',
        '',
        'Use /create-task <ID> to start a new task.',
        '=== END TASK LIST ==='
      ].join('\n')
    };
  }

  const userLines = ['Available tasks:'];
  const claudeLines = [
    '=== TASK SESSION MANAGEMENT ===',
    'Available tasks:',
    ''
  ];

  for (const file of taskFiles) {
    const meta = parseTaskFile(file.path);
    if (meta) {
      const parts = [];
      if (meta.status) parts.push(`status: ${meta.status}`);
      if (meta.created) parts.push(`created: ${meta.created}`);
      if (meta.lastUpdated) parts.push(`updated: ${meta.lastUpdated}`);
      const info = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      userLines.push(`  - ${meta.taskId}${info}`);
      claudeLines.push(`  - ${meta.taskId}${info}`);
    }
  }

  userLines.push('', 'Use /load-task <ID> to resume, or /create-task <ID> to start new.');
  claudeLines.push(
    '',
    'Use /load-task <ID> to resume a task, or /create-task <ID> to start a new one.',
    '=== END TASK LIST ==='
  );

  return {
    userMessage: userLines.join('\n'),
    claudeContext: claudeLines.join('\n')
  };
}

async function main() {
  // Collect errors from previous session
  const errorContext = checkPreviousErrors();

  const globalSessionsDir = getSessionsDir();
  const learnedDir = getLearnedSkillsDir();

  // Ensure directories exist
  ensureDir(globalSessionsDir);
  ensureDir(learnedDir);

  // Collect task sessions
  const { userMessage, claudeContext } = listTaskSessions();

  // Collect learned skills
  let skillsContext = '';
  const learnedSkills = findFiles(learnedDir, '*.md');
  if (learnedSkills.length > 0) {
    const skillLines = ['', '=== LEARNED SKILLS AVAILABLE ==='];
    for (const skill of learnedSkills) {
      const name = path.basename(skill.path, '.md');
      skillLines.push(`- ${name}`);
    }
    skillLines.push('=== END LEARNED SKILLS ===');
    skillsContext = skillLines.join('\n');
  }

  // Output single JSON object:
  // - systemMessage: shown to user in terminal
  // - additionalContext: added to Claude's conversation context
  const fullContext = errorContext + claudeContext + skillsContext;
  const output = {};
  if (userMessage) {
    output.systemMessage = userMessage;
  }
  if (fullContext) {
    output.additionalContext = fullContext;
  }
  console.log(JSON.stringify(output));

  process.exit(0);
}

main().catch((err) => {
  const errorMsg = `[SessionStart] Error: ${err.message}`;
  // Output to stdout (Claude sees it now)
  console.log(errorMsg);
  // Also log persistently (Claude sees it next session if missed)
  logError(errorMsg);
  process.exit(0);
});
