---
description: "Toggle notification sound on/off"
argument-hint: "[on|off]"
allowed-tools: [Read, Write]
---

Read the file `~/.claude/notify-config.json`.

If the user passed `on` or `off` as an argument, set `"sound"` to `true` or `false` accordingly and write the file back.

If no argument was passed, toggle the current value (true → false, false → true) and write the file back.

After writing, confirm the new state to the user in one short sentence, e.g. "Notification sound is now **off**."

Arguments: $ARGUMENTS
