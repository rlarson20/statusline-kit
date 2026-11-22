import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { formatUsd, stripAnsi } from './ansi.ts';
import {
  DEFAULT_CONFIG_DIR,
  DEFAULT_CONFIG_PATH,
  resolveConfig,
} from './config.ts';
import { TrackerRegistry } from './registry.ts';
import { renderStatusLine } from './renderer.ts';
import { buildGuiStatusLinePayload, readLiveState } from './telemetry.ts';
import type {
  AnsiColor,
  StatusLineConfig,
  ThemeName,
  TrackerSegment,
  UsageTrackerOptions,
} from './types.ts';
import { buildStatuslineAppHtml } from './ui/statusline-app.ts';

export const STATUSLINE_UI_URI = 'ui://statusline-kit/statusline.html';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface GuiSegment {
  icon?: string;
  plainText: string;
  color?: AnsiColor;
  bold?: boolean;
}

export interface StatuslineSnapshot {
  textSummary: string;
  structuredContent: {
    config: ReturnType<typeof resolveConfig>;
    availableTrackers: Array<{ id: string; name: string; description?: string }>;
    rows: GuiSegment[][];
    usageSummary: {
      usedPercentage: number;
      totalTokens: number;
      windowSize: number;
      costDisplay: string;
      turnCount: number;
      toolCallCount: number;
      agentState: string;
    };
  };
}

export async function computeStatuslineSnapshot(
  dataDir?: string,
  configPath?: string
): Promise<StatuslineSnapshot> {
  const payload = buildGuiStatusLinePayload(dataDir);
  const live = readLiveState(dataDir);
  const config = resolveConfig(undefined, {
    configPath,
    workspaceDir: payload.workspace?.current_dir,
  });

  const registry = new TrackerRegistry(true);
  await registry.loadFromConfig(config);

  // Build structured rows for the GUI HUD
  const rows: GuiSegment[][] = [];
  for (const lineIds of config.lines) {
    const row: GuiSegment[] = [];
    for (const id of lineIds) {
      const tracker = registry.get(id);
      if (!tracker) continue;
      try {
        const res = await Promise.race([
          Promise.resolve().then(() =>
            tracker.render({
              payload,
              config,
              options: config.trackerOptions[id] ?? {},
              terminalWidth: 140,
              colorEnabled: false,
              now: Date.now(),
            })
          ),
          new Promise<null>((r) => setTimeout(() => r(null), config.trackerTimeoutMs)),
        ]);
        if (!res) continue;
        const segments: TrackerSegment[] =
          typeof res === 'string'
            ? [{ text: res }]
            : Array.isArray(res)
              ? res
              : [res];
        for (const seg of segments) {
          if (!seg?.text) continue;
          row.push({
            icon: seg.icon,
            plainText: stripAnsi(seg.text),
            color: seg.color,
            bold: seg.bold,
          });
        }
      } catch {
        // fault-isolated
      }
    }
    if (row.length > 0) rows.push(row);
  }

  const plainText = await renderStatusLine(payload, registry, config, {
    forceColor: false,
  });

  const totalTokens =
    (payload.context_window?.total_input_tokens ?? 0) +
    (payload.context_window?.total_output_tokens ?? 0);
  const windowSize = payload.context_window?.context_window_size ?? 1_048_576;
  const usedPercentage = payload.context_window?.used_percentage ?? 0;
  const costDisplay =
    payload.cost && typeof payload.cost.total_usd === 'number'
      ? formatUsd(payload.cost.total_usd, Boolean(payload.cost.estimated))
      : '$0.00';

  return {
    textSummary: plainText || 'Statusline Kit ready (no active telemetry yet).',
    structuredContent: {
      config,
      availableTrackers: registry.list().map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
      })),
      rows,
      usageSummary: {
        usedPercentage,
        totalTokens,
        windowSize,
        costDisplay,
        turnCount: live.turnCount,
        toolCallCount: live.toolCallCount,
        agentState: live.agentState,
      },
    },
  };
}

function readEditableConfig(configPath = DEFAULT_CONFIG_PATH): StatusLineConfig {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')) as StatusLineConfig;
    }
  } catch {
    // start fresh
  }
  return {};
}

function writeEditableConfig(
  cfg: StatusLineConfig,
  configPath = DEFAULT_CONFIG_PATH
): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}

export async function handleMcpRequest(
  req: JsonRpcRequest,
  opts?: { dataDir?: string; configPath?: string }
): Promise<Record<string, unknown> | null> {
  const { method, params = {} } = req;

  if (method === 'initialize') {
    return {
      protocolVersion: '2025-06-18',
      serverInfo: {
        name: 'statusline-kit',
        version: '1.0.0',
      },
      capabilities: {
        tools: {},
        resources: {},
        extensions: {
          'io.modelcontextprotocol/ui': {},
          'com.google.antigravity/ui': {
            entrypoints: ['aux_pane', 'global'],
          },
        },
      },
    };
  }

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return null;
  }

  if (method === 'ping') {
    return {};
  }

  if (method === 'resources/list') {
    return {
      resources: [
        {
          uri: STATUSLINE_UI_URI,
          name: 'Statusline Kit HUD',
          description:
            'Interactive customizable status line HUD with built-in usage tracker for the Antigravity App.',
          mimeType: 'text/html;profile=mcp-app',
        },
      ],
    };
  }

  if (method === 'resources/read') {
    const uri = String(params.uri ?? '');
    if (uri === STATUSLINE_UI_URI) {
      return {
        contents: [
          {
            uri: STATUSLINE_UI_URI,
            mimeType: 'text/html;profile=mcp-app',
            text: buildStatuslineAppHtml(),
          },
        ],
      };
    }
    throw { code: -32602, message: `Unknown resource URI: ${uri}` };
  }

  if (method === 'tools/list') {
    return {
      tools: [
        {
          name: 'open_statusline',
          description:
            'Open the live customizable Statusline Kit HUD in the Antigravity App side panel or full-page view, showing built-in usage metrics and custom trackers.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
          _meta: {
            ui: {
              resourceUri: STATUSLINE_UI_URI,
            },
            'com.google.antigravity/ui': {
              entrypoints: [
                { type: 'aux_pane', title: 'Statusline' },
                { type: 'global', title: 'Statusline' },
              ],
            },
          },
        },
        {
          name: 'statusline_card',
          description:
            'Render a compact interactive status line card inline in chat with live usage and custom trackers.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
          _meta: {
            ui: {
              resourceUri: STATUSLINE_UI_URI,
            },
          },
        },
        {
          name: 'get_statusline_state',
          description:
            'Return the current rendered status line rows, usage summary, active trackers, and configuration.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
          _meta: {
            ui: {
              visibility: ['app', 'model'],
            },
          },
        },
        {
          name: 'update_statusline_config',
          description:
            'Update Statusline Kit theme, active tracker lines, or built-in usage tracker options.',
          inputSchema: {
            type: 'object',
            properties: {
              theme: {
                type: 'string',
                enum: ['default', 'minimal', 'powerline', 'no-color'],
              },
              lines: {
                type: 'array',
                items: { type: 'array', items: { type: 'string' } },
              },
              usageOptions: {
                type: 'object',
                description: 'Partial UsageTrackerOptions overrides.',
              },
            },
          },
          _meta: {
            ui: {
              visibility: ['app', 'model'],
            },
          },
        },
        {
          name: 'add_custom_tracker',
          description:
            'Register a new shell-command or drop-in JS/ESM custom tracker and add it to the active status line.',
          inputSchema: {
            type: 'object',
            required: ['id', 'type'],
            properties: {
              id: { type: 'string', description: 'Unique kebab-case tracker ID' },
              type: { type: 'string', enum: ['command', 'module'] },
              command: { type: 'string', description: 'Shell command (required when type="command")' },
              path: { type: 'string', description: 'Module path (required when type="module")' },
              icon: { type: 'string' },
              color: { type: 'string' },
            },
          },
          _meta: {
            ui: {
              visibility: ['app', 'model'],
            },
          },
        },
      ],
    };
  }

  if (method === 'tools/call') {
    const toolName = String(params.name ?? '');
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    const configPath = opts?.configPath ?? DEFAULT_CONFIG_PATH;

    if (
      toolName === 'open_statusline' ||
      toolName === 'statusline_card' ||
      toolName === 'get_statusline_state'
    ) {
      const snap = await computeStatuslineSnapshot(opts?.dataDir, configPath);
      return {
        content: [{ type: 'text', text: snap.textSummary }],
        structuredContent: snap.structuredContent,
      };
    }

    if (toolName === 'update_statusline_config') {
      const current = readEditableConfig(configPath);
      if (typeof args.theme === 'string') {
        current.theme = args.theme as ThemeName;
      }
      if (Array.isArray(args.lines)) {
        current.lines = args.lines as string[][];
      }
      if (args.usageOptions && typeof args.usageOptions === 'object') {
        current.trackerOptions = {
          ...(current.trackerOptions ?? {}),
          usage: {
            ...(current.trackerOptions?.usage ?? {}),
            ...(args.usageOptions as UsageTrackerOptions),
          },
        };
      }
      writeEditableConfig(current, configPath);
      const snap = await computeStatuslineSnapshot(opts?.dataDir, configPath);
      return {
        content: [{ type: 'text', text: `Updated Statusline Kit config.\n${snap.textSummary}` }],
        structuredContent: snap.structuredContent,
      };
    }

    if (toolName === 'add_custom_tracker') {
      const id = String(args.id ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const type = String(args.type ?? 'command');
      if (!id) {
        throw { code: -32602, message: 'Tracker id is required' };
      }

      const current = readEditableConfig(configPath);
      const existing = current.customTrackers ?? [];
      const filtered = existing.filter((t) => t.id !== id);

      if (type === 'command') {
        const command = String(args.command ?? '').trim();
        if (!command) throw { code: -32602, message: 'command is required for type="command"' };
        filtered.push({
          type: 'command',
          id,
          command,
          icon: typeof args.icon === 'string' ? args.icon : '◆',
          color: (typeof args.color === 'string' ? args.color : 'cyan') as AnsiColor,
        });
      } else {
        const modPath = String(args.path ?? '').trim();
        if (!modPath) throw { code: -32602, message: 'path is required for type="module"' };
        filtered.push({ type: 'module', id, path: modPath });
      }

      current.customTrackers = filtered;
      const lines =
        Array.isArray(current.lines) && current.lines.length > 0
          ? current.lines.map((r) => [...r])
          : [
              ['state', 'model', 'workspace'],
              ['usage', 'activity'],
            ];
      if (!lines.flat().includes(id)) {
        lines[lines.length - 1]!.push(id);
      }
      current.lines = lines;
      writeEditableConfig(current, configPath);

      const snap = await computeStatuslineSnapshot(opts?.dataDir, configPath);
      return {
        content: [{ type: 'text', text: `Added custom tracker "${id}".\n${snap.textSummary}` }],
        structuredContent: snap.structuredContent,
      };
    }

    throw { code: -32601, message: `Unknown tool: ${toolName}` };
  }

  throw { code: -32601, message: `Method not found: ${method}` };
}

export function startMcpStdioServer(argv = process.argv.slice(2)): void {
  const dataDirIdx = argv.indexOf('--data-dir');
  const dataDir =
    dataDirIdx !== -1 && argv[dataDirIdx + 1]
      ? argv[dataDirIdx + 1]
      : process.env.PLUGIN_DATA ?? DEFAULT_CONFIG_DIR;

  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      return;
    }

    const isNotification = req.id === undefined || req.id === null;
    try {
      const result = await handleMcpRequest(req, { dataDir });
      if (!isNotification && result !== null) {
        process.stdout.write(
          `${JSON.stringify({ jsonrpc: '2.0', id: req.id, result })}\n`
        );
      }
    } catch (err) {
      if (!isNotification) {
        const errorObj =
          err && typeof err === 'object' && 'code' in err && 'message' in err
            ? err
            : { code: -32603, message: err instanceof Error ? err.message : 'Internal error' };
        process.stdout.write(
          `${JSON.stringify({ jsonrpc: '2.0', id: req.id, error: errorObj })}\n`
        );
      }
    }
  });
}
