# Statusline Kit

A customizable, tracker-extensible **Status Line HUD** plugin for the **Google Antigravity App (GUI)** — and **Antigravity CLI** — inspired by Claude Code's customizable status line, with a built-in **Usage Tracker**.

> **How it works in the Antigravity App (GUI):**
> The Antigravity App does not expose a native bottom-footer bar hook, so Statusline Kit ships as a **native Antigravity MCP App + Lifecycle Hooks plugin**:
> - **Side Panel HUD (`aux_pane`)**: Docks right beside your conversation via **Overview > Plugins**, the side panel **`+`** menu, or by asking the agent to open it.
> - **Full-Page View (`global`)**: Accessible from **Plugins** in the left sidebar.
> - **Inline Chat Card**: Compact status bar rendered directly in chat (`statusline_card`).
> - **Live Telemetry (`hooks.json`)**: Automatically captures `SessionStart`, `PreInvocation`, `PostToolUse`, `PostInvocation`, and `Stop` events plus transcript token usage so the HUD stays live as you work.

## Features

- **Built-in Usage Tracker (`usage`)**: Context window progress meter, `%` used, total tokens vs. window size, optional input/output split, prompt cache hit ratio, estimated session USD cost, and turn/tool counters.
- **Built-in Companion Trackers**: `state` (agent status, mode, sandbox), `model`, `workspace` (folder + Git branch), and `activity` (subagents, tasks, artifacts, confirmations).
- **Extensible with Custom Trackers**:
  1. **GUI "+ Add" Form** or `add_custom_tracker` MCP tool (shell command trackers)
  2. **Drop-in JS/ESM Modules** auto-discovered from `~/.gemini/statusline-kit/trackers/*.mjs`
  3. **Programmatic TypeScript API** (`TrackerRegistry`, `renderStatusLine`)
- **Zero Runtime Dependencies**: Runs directly on Antigravity's bundled Node.js runtime (`"command": "node"`) with no `npm install` required.

## Installing in the Google Antigravity App (GUI)

### Option 1: Install Globally (All Workspaces)

Copy or symlink this folder into your global Antigravity plugins directory:

```bash
mkdir -p ~/.gemini/config/plugins
cp -R /path/to/statusline-kit ~/.gemini/config/plugins/statusline-kit
```

### Option 2: Install Per-Workspace

Place the folder inside `.agents/plugins/statusline-kit` at the root of your project.

### Option 3: Install via CLI (Syncs to Antigravity App)

```bash
agy plugin validate --strict ./statusline-kit
agy plugin install ./statusline-kit
```

Then in the **Antigravity App**:
1. Open **Customizations > Installed** in the left sidebar and verify **Statusline Kit** is enabled.
2. Open the Statusline HUD from **Overview > Plugins > Statusline**, the side panel **`+`** menu, **Plugins** in the left sidebar, or by prompting: *"Open the Statusline HUD in the side panel"*.

## Extending with Custom Trackers

### 1. From the GUI
Click **Customize** in the Statusline HUD, enter an `id` and shell `command` (e.g. `git rev-parse --short HEAD`), and click **+ Add**.

### 2. Drop-in JS/ESM Tracker (`~/.gemini/statusline-kit/trackers/<id>.mjs`)

```js
export default {
  id: 'git-diff',
  name: 'Git Diff Tracker',
  render(ctx) {
    return {
      icon: '±',
      text: `+12 -3`,
      color: 'yellow',
    };
  },
};
```

Add `"git-diff"` to `lines` in `~/.gemini/statusline-kit/config.json` (or toggle it on in the HUD's **Customize** drawer).

## Also Works in Antigravity CLI (`agy`)

```bash
node ./statusline-kit/scripts/statusline.mjs --install
```

Then run `/statusline on` in `agy`.

## Testing

```bash
npm test
```
