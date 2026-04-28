---
description: "Package user feedback + conversation context + Copilot Chat session log into a single shareable markdown report for the plugin maintainer. Use when something in al-dev-toolkit didn't behave as expected — wrong agent ran, hook didn't fire, slash command misbehaved, build cycle stalled."
argument-hint: "<what went wrong and what you expected>"
---

# Feedback Report

Bundle the user's feedback, current conversation, and the Copilot Chat session log into one markdown file the user can attach to an email / issue / Slack message to the plugin maintainer.

## User Feedback

$ARGUMENTS

## Procedure

1. **Verify $ARGUMENTS is non-empty.** If empty, ask: "In one or two sentences — what went wrong, and what did you expect to happen?" Wait for the answer; treat it as the feedback text from here on.

2. **Read environment info** (best-effort, skip silently if missing):
   - `app.json` → BC version, project name, ID ranges, publisher
   - `.claude-plugin/plugin.json` → plugin name + version
   - Current working directory

3. **Ask for the session log.** Tell the user:

   > To diagnose this, I need the Copilot Chat session log. Two ways to get it:
   >
   > 1. **Output panel** — VS Code → View → Output → "GitHub Copilot Chat" channel → click "Open in Editor" → paste the failing turn (the request right before things went wrong, plus the response) into this chat.
   > 2. **Debug log file** — paste the path to `debug-logs/<sessionId>/main.jsonl` (the JSONL log for this session).
   >
   > If you can't get either, just say "skip" and I'll write the report with conversation context only.

   Wait for the response.

4. **Read the log** if a path was given. If pasted text, use that. If skipped, note that the log is missing in the report and continue.

5. **Scan the log for relevant markers** (only when log is available). Capture present-vs-absent for each:

   Agent-level (`ccreq:<hash>... | success | <model> | <ms> | [<mode>]`):
   - `[panel/editAgent]` — built-in Edit Agent ran
   - `[tool/runSubagent-<name>]` — plugin agent invoked as subagent (note which `<name>`)
   - `[panel/<mode-name>]` — custom chat-mode panel
   - `[copilotLanguageModelWrapper]` — internal Copilot wrapper (ignore)

   Hook-level:
   - `[ToolCallingLoop] SessionStart hook provided context for session` — SessionStart hook fired
   - `[ToolCallingLoop] Stop hook result: shouldContinue=...` — Stop hook fired

   Other useful signals: slash-command echo, lines containing `error` / `blocked` / `denied`, `mcp-subagent-guard` rejections, `<ms>` outliers.

6. **Compose the report** using the template below. Pull the conversation summary from your own context — what the user asked, what you did, where it went sideways. Keep excerpts trimmed to the failing turn; do NOT dump the whole transcript.

7. **Redact** anything that looks like a credential, token, connection string, or proprietary code before writing the file. If unsure, ask the user.

8. **Save** to `feedback-<YYYYMMDD-HHMMSS>.md` in the workspace root (use the current date/time). If a workspace isn't open, ask the user where to save.

9. **Ask the user**: "Send this report to andrei.popa@arggo.com via Outlook now? (yes / no)" — wait for the answer.

10. **If yes** — run the PowerShell snippet under "Sending via Outlook" below, substituting `<project-name>`, `<file-path>`, the date, and the user's feedback into the placeholders. Capture stdout: `sent` means it went through; anything starting with `failed:` means Outlook wasn't available or the COM call errored. On failure, fall through to step 11 so the user can attach the file manually.

11. **Report back**:
    - Saved file path
    - Send status — one of: "sent to andrei.popa@arggo.com", "skipped — attach manually", "send failed: <reason> — attach manually"
    - Note that the file is local-only and not committed.

## Sending via Outlook

Single-quoted here-strings (`@'...'@`) do not expand PowerShell variables, so the user's feedback text can contain anything safely. Replace the four placeholders before running.

~~~powershell
$body = @'
Feedback from <project-name>:

<user feedback verbatim from $ARGUMENTS>

Full report attached.
'@

try {
    $ol = New-Object -ComObject Outlook.Application
    $mail = $ol.CreateItem(0)  # olMailItem
    $mail.To = 'andrei.popa@arggo.com'
    $mail.Subject = 'al-dev-toolkit feedback — <project-name> — <YYYY-MM-DD>'
    $mail.Body = $body
    $mail.Attachments.Add('<full-path-to-feedback-file>') | Out-Null
    $mail.Send()
    Write-Output 'sent'
} catch {
    Write-Output "failed: $($_.Exception.Message)"
}
~~~

If Outlook isn't installed, the COM call will throw and the catch block writes `failed: ...`. Some corporate Outlook configurations may show a one-time security prompt ("a program is trying to send mail on your behalf") — that's the Outlook Object Model Guard, not a script bug; the user clicks Allow.

## Report Template

~~~markdown
# al-dev-toolkit Feedback

**Date:** {ISO timestamp}
**Plugin:** {name + version from plugin.json, or "unknown"}
**BC version:** {from app.json, or "unknown"}
**Project:** {from app.json, or "unknown"}
**Workspace:** {cwd}

## User Feedback

{verbatim from $ARGUMENTS, or follow-up answer}

## What I Was Doing

{1–3 sentences: what the user was trying to accomplish in this conversation}

## What Happened

{1–3 sentences: actual symptoms — wrong agent ran, hook silent, command produced nothing, build stalled, etc.}

## What I Expected

{1–3 sentences derived from the user's feedback}

## Session Log Markers

{when log is available — bullet list, mark each as present or absent}

- [present | absent] Slash-command echo for `/<command>`
- [present | absent] `[ToolCallingLoop] SessionStart hook provided context for session`
- [present | absent] `[tool/runSubagent-<expected-agent>]`
- [present | absent] `[panel/editAgent]` (note: when this is the only agent driver, plugin custom agents did NOT run as main)
- [other relevant markers found]

{when log is missing}

> Session log not provided.

## Conversation Excerpt

{the user's request and the key agent steps — trimmed, just the failing turn}

## Log Excerpt

{verbatim lines from the session log, trimmed to the failing turn — or "n/a"}
~~~

## Notes

- Keep the bundle focused: ~1–3 pages of markdown. Enough to diagnose, not a transcript dump.
- Never include credentials, tokens, or sensitive code — redact before writing.
- The maintainer reads this cold, so the "What I Was Doing / What Happened / What I Expected" section is the load-bearing part.
