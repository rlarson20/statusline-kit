import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_DIR,
  DEFAULT_CONFIG_PATH,
  DEFAULT_TRACKERS_DIR,
  resolveConfig,
} from './config.ts';
import { TrackerRegistry } from './registry.ts';
import { renderStatusLine } from './renderer.ts';
import type { StatusLinePayload, ThemeName } from './types.ts';

const SAMPLE_PAYLOAD: StatusLinePayload = {
  cwd: process.cwd(),
  session_id: 'preview-session-001',
  conversation_id: 'preview-session-001',
  conversation_title: 'Statusline Kit Preview',
  model: {
    id: 'Gemini 4 Argon (Medium)',
    display_name: 'Gemini 4 Argon (Medium)',
    effort: 'medium',
  },
  workspace: {
    current_dir: process.cwd(),
    project_dir: process.cwd(),
  },
  version: '1.4.5',
  context_window: {
    total_input_tokens: 88244,
    total_output_tokens: 61074,
    context_window_size: 1048576,
    used_percentage: 14.24,
    remaining_percentage: 85.76,
    current_usage: {
      input_tokens: 63382,
      output_tokens: 346,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 20857,
    },
  },
  exceeds_200k_tokens: false,
  product: 'antigravity',
  quota: {
    'gemini-weekly': {
      remaining_fraction: 0.9378,
      reset_time: '2026-07-06T07:50:32Z',
      reset_in_seconds: 560580,
    },
  },
  agent_state: 'idle',
  vcs: { type: 'git', branch: 'main' },
  cycle_mode: 'plan',
  sandbox: { enabled: false },
  subagents: [{ name: 'research', role: 'Codebase Researcher', status: 'running' }],
  artifact_count: 2,
  plan_tier: 'Pro',
  task_count: 1,
  terminal_width: process.stdout.columns || 110,
  cost: {
    total_usd: 0.4213,
    subagent_usd: 0.0812,
    estimated: false,
  },
};

function readStdinWithTimeout(timeoutMs = 500): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    let data = '';
    let settled = false;

    const finish = (): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        process.stdin.removeAllListeners('data');
        process.stdin.removeAllListeners('end');
        process.stdin.removeAllListeners('error');
        try {
          process.stdin.pause();
        } catch {
          // ignore
        }
        resolve(data);
      }
    };

    const timer = setTimeout(finish, timeoutMs);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });
}

function getArgValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function printHelp(): void {
  process.stdout.write(
    [
      'statusline-kit — Customizable, tracker-extensible status line for Google Antigravity CLI',
      '',
      'Usage:',
      '  <payload.json> | node scripts/statusline.mjs [options]',
      '  node scripts/statusline.mjs --preview [--theme default|minimal|powerline|no-color]',
      '  node scripts/statusline.mjs --install [--stack]',
      '  node scripts/statusline.mjs --list-trackers',
      '  node scripts/statusline.mjs --init-tracker <id>',
      '',
      'Options:',
      '  --preview            Render a sample Antigravity CLI payload in your terminal',
      '  --install            Wire statusLine into ~/.gemini/antigravity-cli/settings.json and init config',
      '  --stack              Used with --install to set stack_with_default: true',
      '  --list-trackers      List all built-in and loaded custom trackers',
      '  --init-tracker <id>  Scaffold a drop-in tracker module in ~/.gemini/statusline-kit/trackers/',
      '  --config <path>      Use a custom config.json path',
      '  --theme <name>       Override theme (default, minimal, powerline, no-color)',
      '  --help, -h           Show this help text',
      '',
    ].join('\n')
  );
}

function runInstall(argv: string[]): void {
  const stackWithDefault = argv.includes('--stack');
  const cliSettingsDir = path.join(os.homedir(), '.gemini', 'antigravity-cli');
  const cliSettingsPath = path.join(cliSettingsDir, 'settings.json');

  // Resolve the absolute path to scripts/statusline.mjs relative to this file
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot =
    path.basename(path.dirname(thisDir)) === 'dist'
      ? path.resolve(thisDir, '..', '..')
      : path.resolve(thisDir, '..');
  const entryScript = path.join(pluginRoot, 'scripts', 'statusline.mjs');

  fs.mkdirSync(cliSettingsDir, { recursive: true });
  fs.mkdirSync(DEFAULT_CONFIG_DIR, { recursive: true });
  fs.mkdirSync(DEFAULT_TRACKERS_DIR, { recursive: true });

  // Merge safely into ~/.gemini/antigravity-cli/settings.json without overwriting user permissions
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(cliSettingsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(cliSettingsPath, 'utf8')) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        settings = parsed as Record<string, unknown>;
      }
    } catch {
      process.stderr.write(
        `Warning: Could not parse existing ${cliSettingsPath}; refusing to overwrite.\n`
      );
      process.exitCode = 1;
      return;
    }
  }

  settings.statusLine = {
    type: 'command',
    command: `node "${entryScript}"`,
    enabled: true,
    stack_with_default: stackWithDefault,
  };

  fs.writeFileSync(cliSettingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

  if (!fs.existsSync(DEFAULT_CONFIG_PATH)) {
    const starterConfig = {
      theme: DEFAULT_CONFIG.theme,
      lines: DEFAULT_CONFIG.lines,
      trackerOptions: DEFAULT_CONFIG.trackerOptions,
      customTrackers: [],
    };
    fs.writeFileSync(
      DEFAULT_CONFIG_PATH,
      `${JSON.stringify(starterConfig, null, 2)}\n`,
      'utf8'
    );
  }

  process.stdout.write(
    [
      `✓ Updated Antigravity CLI settings: ${cliSettingsPath}`,
      `✓ Statusline Kit config ready:      ${DEFAULT_CONFIG_PATH}`,
      `✓ Drop-in trackers directory:       ${DEFAULT_TRACKERS_DIR}`,
      '',
      'Run `/statusline on` in Antigravity CLI (or restart `agy`) to see your new status line.',
      '',
    ].join('\n')
  );
}

function runInitTracker(idRaw: string): void {
  const id = idRaw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!id) {
    process.stderr.write('Error: Please provide a valid tracker id (e.g. --init-tracker git-diff)\n');
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(DEFAULT_TRACKERS_DIR, { recursive: true });
  const targetPath = path.join(DEFAULT_TRACKERS_DIR, `${id}.mjs`);

  if (fs.existsSync(targetPath)) {
    process.stderr.write(`Tracker already exists at ${targetPath}\n`);
    process.exitCode = 1;
    return;
  }

  const template = `/**
 * Custom Statusline Kit tracker: ${id}
 * Auto-discovered from ${DEFAULT_TRACKERS_DIR}
 * Add "${id}" to \`lines\` in ${DEFAULT_CONFIG_PATH} to display it.
 */
export default {
  id: '${id}',
  name: '${id} Tracker',
  description: 'Custom status line tracker',
  defaultPriority: 50,

  /**
   * @param {import('statusline-kit').TrackerContext} ctx
   */
  render(ctx) {
    const label = ctx.options.label ?? '${id}';
    const tier = ctx.payload.plan_tier;
    return {
      icon: '◆',
      text: tier ? \`\${label}: \${tier}\` : String(label),
      color: 'cyan',
      priority: 50,
    };
  },
};
`;

  fs.writeFileSync(targetPath, template, 'utf8');
  process.stdout.write(
    [
      `✓ Created custom tracker: ${targetPath}`,
      `Next: add "${id}" to \`lines\` in ${DEFAULT_CONFIG_PATH}`,
      '',
    ].join('\n')
  );
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  if (argv.includes('--install')) {
    runInstall(argv);
    return;
  }

  const initId = getArgValue(argv, '--init-tracker');
  if (initId !== undefined) {
    runInitTracker(initId);
    return;
  }

  const configPath = getArgValue(argv, '--config');
  const themeArg = getArgValue(argv, '--theme') as ThemeName | undefined;

  if (argv.includes('--list-trackers')) {
    const config = resolveConfig(themeArg ? { theme: themeArg } : undefined, {
      configPath,
    });
    const registry = new TrackerRegistry(true);
    await registry.loadFromConfig(config);
    for (const tracker of registry.list()) {
      process.stdout.write(
        `${tracker.id.padEnd(16)} ${tracker.name}${tracker.description ? ` — ${tracker.description}` : ''}\n`
      );
    }
    return;
  }

  if (argv.includes('--preview')) {
    const config = resolveConfig(themeArg ? { theme: themeArg } : undefined, {
      configPath,
      workspaceDir: SAMPLE_PAYLOAD.workspace?.current_dir,
    });
    const registry = new TrackerRegistry(true);
    await registry.loadFromConfig(config);
    const out = await renderStatusLine(SAMPLE_PAYLOAD, registry, config);
    if (out) {
      process.stdout.write(`${out}\n`);
    }
    return;
  }

  // Standard Antigravity CLI status line execution mode: read JSON payload from stdin
  const raw = (await readStdinWithTimeout(500)).trim();
  if (!raw) {
    return;
  }

  let payload: StatusLinePayload;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return;
    }
    payload = parsed as StatusLinePayload;
  } catch {
    // Exit 0 silently on malformed stdin so Antigravity CLI never counts this as a failure
    return;
  }

  const workspaceDir =
    payload.workspace?.current_dir ?? payload.workspace?.project_dir ?? payload.cwd;
  const config = resolveConfig(themeArg ? { theme: themeArg } : undefined, {
    configPath,
    workspaceDir,
  });

  const registry = new TrackerRegistry(true);
  await registry.loadFromConfig(config);

  const output = await renderStatusLine(payload, registry, config);
  if (output) {
    process.stdout.write(`${output}\n`);
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch(() => {
    // Fail open with exit 0 so Antigravity CLI does not disable the status line
  });
}
