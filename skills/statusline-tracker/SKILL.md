---
name: statusline-tracker
description: >-
  Create, register, and test a new custom tracker for the Statusline Kit status
  line. Use when the user wants to extend their Antigravity CLI status line with
  a new custom tracker (JavaScript/ESM module or shell command).
---

# Create a Custom Statusline Tracker

Statusline Kit supports two easy ways to add custom trackers to the status line:

## Option A: Drop-in JS/ESM Tracker Module (Recommended)

1. **Scaffold a new tracker** in `~/.gemini/statusline-kit/trackers/<id>.mjs`:
   ```bash
   node ../../scripts/statusline.mjs --init-tracker <tracker-id>
   ```
   Any `.mjs` or `.js` file in `~/.gemini/statusline-kit/trackers/` is auto-discovered on every render.

2. **Implement `render(ctx)`** in the scaffolded file. `ctx` provides:
   - `ctx.payload`: full Antigravity CLI status line JSON payload (`model`, `context_window`, `cost`, `quota`, `workspace`, `vcs`, `agent_state`, `subagents`, `task_count`, `terminal_width`, etc.)
   - `ctx.options`: user options from `config.json` under `trackerOptions.<id>`
   - `ctx.terminalWidth`: live terminal column width
   - `ctx.colorEnabled`: whether ANSI colors are enabled

   Return `null` to hide, a `string`, a `TrackerSegment` (`{ icon, text, color, bold, dim, priority, minWidth }`), or `TrackerSegment[]`.

3. **Add `<tracker-id>` to `lines`** in `~/.gemini/statusline-kit/config.json`.

## Option B: Shell Command Tracker

Add an entry under `customTrackers` in `~/.gemini/statusline-kit/config.json` and reference its `id` in `lines`:

```json
{
  "customTrackers": [
    {
      "type": "command",
      "id": "k8s-context",
      "command": "kubectl config current-context",
      "icon": "⎈",
      "color": "cyan",
      "timeoutMs": 500
    }
  ]
}
```

The command receives the Antigravity CLI JSON payload on `stdin` and its first line of `stdout` is displayed.

## Verify

List discovered trackers and preview the updated status line:

```bash
node ../../scripts/statusline.mjs --list-trackers
node ../../scripts/statusline.mjs --preview
```
