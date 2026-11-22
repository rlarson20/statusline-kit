import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expandHome } from './config.ts';
import { BUILTIN_TRACKERS } from './trackers/index.ts';
import type {
  CommandTrackerConfig,
  CustomTrackerConfig,
  ResolvedStatusLineConfig,
  Tracker,
  TrackerContext,
  TrackerResult,
} from './types.ts';

function isDebug(): boolean {
  return process.env.STATUSLINE_KIT_DEBUG === '1';
}

function debugLog(msg: string, err?: unknown): void {
  if (isDebug()) {
    process.stderr.write(
      `[statusline-kit] ${msg}${err instanceof Error ? `: ${err.message}` : ''}\n`
    );
  }
}

function isValidTracker(candidate: unknown): candidate is Tracker {
  if (!candidate || typeof candidate !== 'object') return false;
  const obj = candidate as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.trim().length > 0 &&
    typeof obj.name === 'string' &&
    typeof obj.render === 'function'
  );
}

/**
 * Wraps a shell command definition as a standard Tracker.
 * The command receives the Antigravity CLI JSON payload on stdin and prints
 * its rendered segment text to stdout.
 */
export function createCommandTracker(def: CommandTrackerConfig): Tracker {
  return {
    id: def.id,
    name: def.name ?? def.id,
    description: `Shell command tracker: ${def.command}`,
    defaultPriority: def.priority ?? 40,

    async render(ctx: TrackerContext): Promise<TrackerResult> {
      const timeoutMs = def.timeoutMs ?? ctx.config.trackerTimeoutMs;
      const candidateCwd =
        ctx.payload.workspace?.current_dir ?? ctx.payload.cwd;
      const cwd =
        candidateCwd && fs.existsSync(candidateCwd)
          ? candidateCwd
          : process.cwd();

      const output = await runShellCommand(
        def.command,
        JSON.stringify(ctx.payload),
        cwd,
        timeoutMs
      );
      const trimmed = output.trim().split(/\r?\n/)[0]?.trim() ?? '';
      if (!trimmed) return null;

      return {
        icon: def.icon,
        text: trimmed,
        color: def.color,
        priority: def.priority ?? 40,
      };
    },
  };
}

function runShellCommand(
  command: string,
  stdinData: string,
  cwd: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'cmd.exe' : 'sh';
    const args = isWin ? ['/d', '/s', '/c', command] : ['-c', command];

    let settled = false;
    let stdout = '';

    const child = spawn(shell, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'ignore'],
      env: process.env,
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
        resolve('');
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.on('error', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve('');
      }
    });

    child.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(code === 0 ? stdout : '');
      }
    });

    child.stdin.on('error', () => {
      // ignore EPIPE when fast commands like `echo` or `date` exit without reading stdin
    });

    try {
      child.stdin.write(stdinData);
      child.stdin.end();
    } catch {
      // ignore synchronous write error
    }
  });
}

async function loadModuleTracker(
  modulePath: string,
  overrideId?: string
): Promise<Tracker | null> {
  const resolved = path.resolve(expandHome(modulePath));
  if (!fs.existsSync(resolved)) {
    debugLog(`Custom tracker module not found: ${resolved}`);
    return null;
  }

  try {
    const mod = (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
    let candidate: unknown = mod.default ?? mod.tracker;
    if (typeof candidate === 'function') {
      candidate = await (candidate as () => unknown | Promise<unknown>)();
    } else if (typeof mod.createTracker === 'function') {
      candidate = await (mod.createTracker as () => unknown | Promise<unknown>)();
    }

    if (!isValidTracker(candidate)) {
      debugLog(`Invalid tracker export in ${resolved}`);
      return null;
    }

    if (overrideId && overrideId !== candidate.id) {
      return {
        ...candidate,
        id: overrideId,
      };
    }

    return candidate;
  } catch (err) {
    debugLog(`Failed to load custom tracker ${resolved}`, err);
    return null;
  }
}

/**
 * Extensible registry managing built-in, drop-in directory, module, and shell-command trackers.
 */
export class TrackerRegistry {
  private readonly trackers = new Map<string, Tracker>();

  constructor(includeBuiltins = true) {
    if (includeBuiltins) {
      for (const tracker of BUILTIN_TRACKERS) {
        this.register(tracker);
      }
    }
  }

  register(tracker: Tracker): this {
    this.trackers.set(tracker.id, tracker);
    return this;
  }

  unregister(id: string): boolean {
    return this.trackers.delete(id);
  }

  get(id: string): Tracker | undefined {
    return this.trackers.get(id);
  }

  has(id: string): boolean {
    return this.trackers.has(id);
  }

  list(): Tracker[] {
    return Array.from(this.trackers.values());
  }

  /**
   * Loads drop-in JS/ESM trackers from `config.trackersDir` and explicit
   * `config.customTrackers` entries (module or command).
   */
  async loadFromConfig(config: ResolvedStatusLineConfig): Promise<void> {
    // 1. Auto-discover drop-in modules in trackersDir
    if (config.trackersDir && fs.existsSync(config.trackersDir)) {
      try {
        const entries = fs.readdirSync(config.trackersDir, { withFileTypes: true });
        const moduleFiles = entries
          .filter(
            (e) =>
              e.isFile() &&
              (e.name.endsWith('.mjs') || e.name.endsWith('.js')) &&
              !e.name.startsWith('_')
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of moduleFiles) {
          const tracker = await loadModuleTracker(
            path.join(config.trackersDir, entry.name)
          );
          if (tracker) {
            this.register(tracker);
          }
        }
      } catch (err) {
        debugLog(`Failed to scan trackersDir ${config.trackersDir}`, err);
      }
    }

    // 2. Register explicit customTrackers from config.json
    for (const def of config.customTrackers) {
      await this.registerCustomTracker(def);
    }
  }

  async registerCustomTracker(def: CustomTrackerConfig): Promise<void> {
    if (def.enabled === false) return;

    if (def.type === 'command') {
      if (!def.id || !def.command) return;
      this.register(createCommandTracker(def));
      return;
    }

    if (def.type === 'module') {
      const tracker = await loadModuleTracker(def.path, def.id);
      if (tracker) {
        this.register(tracker);
      }
    }
  }
}
