---
name: statusline-setup
description: >-
  Open, configure, or customize the Statusline Kit HUD in the Google Antigravity
  App (side panel, full-page sidebar view, or inline card) and optionally wire
  the Antigravity CLI status line. Use when the user wants to open their status
  line, customize trackers, switch themes, or adjust usage tracker settings.
---

# Statusline Setup (Antigravity App GUI & CLI)

## In the Google Antigravity App (GUI)

1. **Open the live Statusline HUD** by calling the `statusline-kit_statusline` MCP tool `open_statusline`.
   - It opens docked in the **Side Panel** (`aux_pane`) beside the conversation and stays updated via the plugin's bundled `hooks.json` lifecycle hooks.
   - Users can also launch it manually at any time from **Overview > Plugins**, the side panel **`+`** menu, **`⋯` > Plugins**, or full-width from **Plugins** in the left sidebar.
   - For a compact inline status bar inside the chat stream, call `statusline_card`.

2. **Customize directly in the HUD** (click **Customize** in the Statusline panel) or via the `update_statusline_config` tool:
   - `theme`: `"default"` | `"minimal"` | `"powerline"` | `"no-color"`
   - `lines`: array of rows of tracker IDs (e.g. `[["state", "model", "workspace"], ["usage", "activity"]]`)
   - `usageOptions`: toggle `showBar`, `showTokens`, `showTokenBreakdown`, `showCacheRate`, `showCost`, `showQuota`, `warnThreshold`, `criticalThreshold`.

3. **Add custom trackers** via the **+ Add Shell Command Tracker** form in the HUD, via `add_custom_tracker`, or by placing drop-in `.mjs` files in `~/.gemini/statusline-kit/trackers/`.

## Optional: Also Enable in Antigravity CLI

If the user also uses the terminal CLI (`agy`), run:

```bash
node ../../scripts/statusline.mjs --install
```

Then run `/statusline on` in `agy`.
