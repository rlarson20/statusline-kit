import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ResolvedStatusLineConfig, StatusLineConfig, ThemeName } from './types.ts';

export const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.gemini', 'statusline-kit');
export const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, 'config.json');
export const DEFAULT_TRACKERS_DIR = path.join(DEFAULT_CONFIG_DIR, 'trackers');

const THEME_SEPARATORS: Record<ThemeName, string> = {
  default: ' │ ',
  minimal: ' · ',
  powerline: ' ',
  'no-color': ' | ',
};

export const DEFAULT_CONFIG: ResolvedStatusLineConfig = {
  theme: 'default',
  separator: THEME_SEPARATORS.default,
  lines: [
    ['state', 'model', 'workspace'],
    ['usage', 'activity'],
  ],
  trackerTimeoutMs: 800,
  trackersDir: DEFAULT_TRACKERS_DIR,
  customTrackers: [],
  trackerOptions: {
    usage: {
      showBar: true,
      barWidth: 10,
      showPercentage: true,
      showTokens: true,
      showTokenBreakdown: false,
      showCacheRate: true,
      showCost: true,
      show200kBadge: true,
      showQuota: false,
      warnThreshold: 60,
      criticalThreshold: 85,
    },
  },
};

export function expandHome(filePath: string): string {
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function readJsonSafe(filePath: string): StatusLineConfig | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as StatusLineConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveConfig(
  overrides?: StatusLineConfig,
  opts?: { configPath?: string; workspaceDir?: string }
): ResolvedStatusLineConfig {
  const globalPath =
    opts?.configPath ??
    process.env.STATUSLINE_KIT_CONFIG ??
    DEFAULT_CONFIG_PATH;

  const globalCfg = readJsonSafe(expandHome(globalPath)) ?? {};

  // Optional workspace-local override (.antigravity/statusline.json or .statusline-kit.json)
  let localCfg: StatusLineConfig = {};
  if (opts?.workspaceDir) {
    const candidates = [
      path.join(opts.workspaceDir, '.antigravity', 'statusline.json'),
      path.join(opts.workspaceDir, '.statusline-kit.json'),
    ];
    for (const candidate of candidates) {
      const parsed = readJsonSafe(candidate);
      if (parsed) {
        localCfg = parsed;
        break;
      }
    }
  }

  const merged: StatusLineConfig = {
    ...globalCfg,
    ...localCfg,
    ...overrides,
  };

  const theme: ThemeName = merged.theme ?? DEFAULT_CONFIG.theme;
  const separator =
    merged.separator ?? THEME_SEPARATORS[theme] ?? DEFAULT_CONFIG.separator;

  const mergedTrackerOptions: ResolvedStatusLineConfig['trackerOptions'] = {
    ...DEFAULT_CONFIG.trackerOptions,
    ...(globalCfg.trackerOptions ?? {}),
    ...(localCfg.trackerOptions ?? {}),
    ...(overrides?.trackerOptions ?? {}),
    usage: {
      ...DEFAULT_CONFIG.trackerOptions.usage,
      ...(globalCfg.trackerOptions?.usage ?? {}),
      ...(localCfg.trackerOptions?.usage ?? {}),
      ...(overrides?.trackerOptions?.usage ?? {}),
    },
  };

  const customTrackers = [
    ...(globalCfg.customTrackers ?? []),
    ...(localCfg.customTrackers ?? []),
    ...(overrides?.customTrackers ?? []),
  ];

  const lines =
    Array.isArray(merged.lines) && merged.lines.length > 0
      ? merged.lines
      : DEFAULT_CONFIG.lines;

  return {
    theme,
    separator,
    lines,
    trackerTimeoutMs:
      typeof merged.trackerTimeoutMs === 'number' && merged.trackerTimeoutMs > 0
        ? merged.trackerTimeoutMs
        : DEFAULT_CONFIG.trackerTimeoutMs,
    trackersDir: expandHome(merged.trackersDir ?? DEFAULT_CONFIG.trackersDir),
    customTrackers,
    trackerOptions: mergedTrackerOptions,
  };
}
