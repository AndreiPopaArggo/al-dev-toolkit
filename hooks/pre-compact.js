#!/usr/bin/env node
/**
 * PreCompact Hook - Log compaction event
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs before Claude compacts context. Logs the event for diagnostics.
 * Does NOT modify task session files (updates are handled explicitly).
 */

const path = require('path');
const {
  getSessionsDir,
  getDateTimeString,
  ensureDir,
  appendFile
} = require('./lib/utils');

async function main() {
  const sessionsDir = getSessionsDir();
  const compactionLog = path.join(sessionsDir, 'compaction-log.txt');

  ensureDir(sessionsDir);

  // Log compaction event with timestamp
  const timestamp = getDateTimeString();
  appendFile(compactionLog, `[${timestamp}] Context compaction triggered\n`);

  console.log('[PreCompact] Compaction event logged');
  process.exit(0);
}

main().catch(err => {
  console.log('[PreCompact] Error:', err.message);
  process.exit(0);
});
