#!/usr/bin/env node
let input = '';
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input); } catch { }

  const model = (data.model && data.model.display_name) || '??';
  const pct = Math.round(data.context_window?.used_percentage || 0);
  const barWidth = 10;
  const filled = Math.round(pct * barWidth / 100);
  const bar = '\u2593'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  process.stdout.write(`[${model}] ${bar} ${pct}%`);
});
