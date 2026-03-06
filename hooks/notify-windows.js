#!/usr/bin/env node
/**
 * Windows Toast Notification Hook
 * Fires on Notification and Stop events to alert the user.
 * Features: per-type titles, audible beep, focus detection.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const CONFIG_FILE = path.join(HOME, '.claude', 'notify-config.json');

// Config: { "sound": true }
let config = { sound: true };
try {
  config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
} catch { /* use defaults */ }

let inputData = '';
process.stdin.on('data', (chunk) => { inputData += chunk; });
process.stdin.on('end', () => {
  let message = 'Claude Code needs your attention';
  let notificationType = '';
  let hookEvent = '';
  let event = {};

  try {
    event = JSON.parse(inputData);
    hookEvent = event.hook_event_name || '';
    notificationType = event.notification_type || '';
    if (event.message) message = event.message;
    else if (hookEvent === 'Stop') message = 'Claude Code has finished';
  } catch { /* use defaults */ }

  // Choose title and beep pattern based on notification type
  let title = 'Claude Code';
  let beep = "[Console]::Beep(800,200);[Console]::Beep(1000,200)";

  if (notificationType === 'permission_prompt') {
    title = 'Claude Code - Permission Needed';
    beep = "[Console]::Beep(600,150);[Console]::Beep(900,150);[Console]::Beep(1200,200)";
  } else if (notificationType === 'elicitation_dialog') {
    title = 'Claude Code - Input Required';
    beep = "[Console]::Beep(700,150);[Console]::Beep(1100,200)";
  } else if (hookEvent === 'PostToolUse' && (event.tool_name === 'AskUserQuestion' || notificationType === 'AskUserQuestion')) {
    title = 'Claude Code - Question';
    message = event.tool_input?.question || event.message || 'Claude has a question for you';
    beep = "[Console]::Beep(700,150);[Console]::Beep(1100,200)";
  } else if (hookEvent === 'Stop') {
    title = 'Claude Code - Done';
    beep = "[Console]::Beep(1000,100);[Console]::Beep(1200,100)";
  }

  // Check if the Claude Code terminal is focused — skip notification if so
  let isFocused = false;
  try {
    const windowTitle = execSync(
      `powershell.exe -NoProfile -NonInteractive -Command "` +
      `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class Win32{[DllImport(\\\"user32.dll\\\")]public static extern IntPtr GetForegroundWindow();[DllImport(\\\"user32.dll\\\",CharSet=CharSet.Auto)]public static extern int GetWindowText(IntPtr hWnd,System.Text.StringBuilder lpString,int nMaxCount);}';` +
      `$h=[Win32]::GetForegroundWindow();$sb=New-Object System.Text.StringBuilder 256;[Win32]::GetWindowText($h,$sb,256)|Out-Null;$sb.ToString()"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim().toLowerCase();
    isFocused = windowTitle.includes('claude') || windowTitle.includes('mintty') || windowTitle.includes('windows terminal');
  } catch {
    // focus check failed — proceed with notification
  }

  if (isFocused) {
    process.exit(0);
  }

  const safe = message.replace(/'/g, "''");

  try {
    execSync(
      `powershell.exe -NoProfile -NonInteractive -Command "` +
      `${config.sound ? beep + ';' : ''}` +
      `[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null;` +
      `$n = New-Object System.Windows.Forms.NotifyIcon;` +
      `$n.Icon = [System.Drawing.SystemIcons]::Information;` +
      `$n.Visible = $true;` +
      `$n.ShowBalloonTip(5000, '${title}', '${safe}', [System.Windows.Forms.ToolTipIcon]::Info);` +
      `Start-Sleep -Milliseconds 5500;` +
      `$n.Dispose()"`,
      { stdio: 'ignore', timeout: 10000 }
    );
  } catch {
    // notification failed — silent
  }

  process.exit(0);
});
