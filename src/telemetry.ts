import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG_DIR } from './config.ts';
import type { AgentState, StatusLinePayload } from './types.ts';

export interface LiveSessionState {
  sessionId?: string;
  cwd?: string;
  modelName?: string;
  agentState: AgentState;
  turnCount: number;
  toolCallCount: number;
  lastToolName?: string;
  transcriptPath?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  contextWindowSize: number;
  estimatedCostUsd: number;
  updatedAt: number;
  startedAt: number;
}

export function getLiveStatePath(dataDir?: string): string {
  const dir = dataDir ?? process.env.PLUGIN_DATA ?? DEFAULT_CONFIG_DIR;
  return path.join(dir, 'live-state.json');
}

export function readLiveState(dataDir?: string): LiveSessionState {
  const filePath = getLiveStatePath(dataDir);
  const now = Date.now();
  const fallback: LiveSessionState = {
    cwd: process.cwd(),
    agentState: 'idle',
    turnCount: 0,
    toolCallCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    contextWindowSize: 1_048_576,
    estimatedCostUsd: 0,
    updatedAt: now,
    startedAt: now,
  };

  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<LiveSessionState>;
    return { ...fallback, ...raw };
  } catch {
    return fallback;
  }
}

export function writeLiveState(state: LiveSessionState, dataDir?: string): void {
  const filePath = getLiveStatePath(dataDir);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  } catch {
    // Best-effort persistence; never fail hooks
  }
}

/**
 * Best-effort scan of an Antigravity conversation transcript.jsonl to extract
 * cumulative token counts when present in logged steps.
 */
function parseTranscriptUsage(transcriptPath: string): {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
} | null {
  try {
    if (!fs.existsSync(transcriptPath)) return null;
    const stat = fs.statSync(transcriptPath);
    // Avoid reading huge transcripts synchronously; read up to the last 256 KiB
    const maxBytes = 256 * 1024;
    const start = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);

    const lines = buf.toString('utf8').split(/\r?\n/).filter(Boolean);
    let totalIn = 0;
    let totalOut = 0;
    let totalCache = 0;
    let found = false;

    for (const line of lines) {
      if (!line.includes('token')) continue;
      try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        const usage = (obj.usage ?? obj.token_usage ?? obj.metadata) as
          | Record<string, unknown>
          | undefined;
        if (usage && typeof usage === 'object') {
          const inp = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
          const out = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
          const cache = Number(usage.cache_read_input_tokens ?? usage.cache_read_tokens ?? 0);
          if (inp > 0 || out > 0) {
            totalIn += inp;
            totalOut += out;
            totalCache += cache;
            found = true;
          }
        }
      } catch {
        // ignore partial/non-JSON lines
      }
    }

    return found
      ? { inputTokens: totalIn, outputTokens: totalOut, cacheReadTokens: totalCache }
      : null;
  } catch {
    return null;
  }
}

/**
 * Updates live-state.json from an Antigravity App lifecycle hook event.
 */
export function recordHookEvent(
  eventName: string,
  hookPayload: Record<string, unknown>,
  dataDir?: string
): LiveSessionState {
  const state = readLiveState(dataDir);
  const now = Date.now();

  const sessionId =
    typeof hookPayload.session_id === 'string'
      ? hookPayload.session_id
      : typeof hookPayload.conversation_id === 'string'
        ? hookPayload.conversation_id
        : undefined;

  if (sessionId && sessionId !== state.sessionId) {
    state.sessionId = sessionId;
    state.turnCount = 0;
    state.toolCallCount = 0;
    state.inputTokens = 0;
    state.outputTokens = 0;
    state.cacheReadTokens = 0;
    state.estimatedCostUsd = 0;
    state.startedAt = now;
  }

  if (typeof hookPayload.cwd === 'string' && hookPayload.cwd) {
    state.cwd = hookPayload.cwd;
  }
  if (typeof hookPayload.transcript_path === 'string' && hookPayload.transcript_path) {
    state.transcriptPath = hookPayload.transcript_path;
  }
  if (typeof hookPayload.model === 'string' && hookPayload.model) {
    state.modelName = hookPayload.model;
  }

  switch (eventName) {
    case 'SessionStart':
      state.agentState = 'idle';
      break;
    case 'PreInvocation':
      state.agentState = 'working';
      state.turnCount += 1;
      break;
    case 'PostToolUse':
      state.agentState = 'tool_use';
      state.toolCallCount += 1;
      if (typeof hookPayload.tool_name === 'string') {
        state.lastToolName = hookPayload.tool_name;
      }
      break;
    case 'PostInvocation':
    case 'Stop':
      state.agentState = 'idle';
      break;
  }

  // Extract token/cost fields if provided directly by hook payload
  const usage = hookPayload.usage as Record<string, unknown> | undefined;
  if (usage && typeof usage === 'object') {
    const inp = Number(usage.input_tokens ?? 0);
    const out = Number(usage.output_tokens ?? 0);
    const cache = Number(usage.cache_read_input_tokens ?? usage.cache_read_tokens ?? 0);
    if (inp > 0) state.inputTokens = inp;
    if (out > 0) state.outputTokens = out;
    if (cache > 0) state.cacheReadTokens = cache;
  } else if (state.transcriptPath) {
    const parsed = parseTranscriptUsage(state.transcriptPath);
    if (parsed) {
      state.inputTokens = parsed.inputTokens ?? state.inputTokens;
      state.outputTokens = parsed.outputTokens ?? state.outputTokens;
      state.cacheReadTokens = parsed.cacheReadTokens ?? state.cacheReadTokens;
    }
  }

  // Approximate estimated USD cost (list-price estimate: $1.25/1M input, $5.00/1M output)
  if (state.inputTokens > 0 || state.outputTokens > 0) {
    const nonCachedIn = Math.max(0, state.inputTokens - state.cacheReadTokens);
    state.estimatedCostUsd =
      (nonCachedIn / 1_000_000) * 1.25 +
      (state.cacheReadTokens / 1_000_000) * 0.3125 +
      (state.outputTokens / 1_000_000) * 5.0;
  }

  state.updatedAt = now;
  writeLiveState(state, dataDir);
  return state;
}

/**
 * Converts LiveSessionState (recorded by App hooks) into a standard StatusLinePayload
 * so all built-in and custom trackers work identically in both the Antigravity App GUI and CLI.
 */
export function buildGuiStatusLinePayload(
  dataDir?: string,
  overrides?: Partial<StatusLinePayload>
): StatusLinePayload {
  const state = readLiveState(dataDir);
  const cwd = overrides?.cwd ?? state.cwd ?? process.cwd();
  const totalTokens = state.inputTokens + state.outputTokens;
  const windowSize = state.contextWindowSize || 1_048_576;
  const usedPct = windowSize > 0 ? Math.min(100, (totalTokens / windowSize) * 100) : 0;

  const isGitRepo = fs.existsSync(path.join(cwd, '.git'));

  return {
    cwd,
    session_id: state.sessionId ?? 'antigravity-app',
    conversation_id: state.sessionId ?? 'antigravity-app',
    transcript_path: state.transcriptPath,
    model: state.modelName
      ? { id: state.modelName, display_name: state.modelName }
      : { id: 'Antigravity', display_name: 'Antigravity' },
    workspace: {
      current_dir: cwd,
      project_dir: cwd,
    },
    context_window: {
      total_input_tokens: state.inputTokens,
      total_output_tokens: state.outputTokens,
      context_window_size: windowSize,
      used_percentage: usedPct,
      remaining_percentage: Math.max(0, 100 - usedPct),
      current_usage:
        state.inputTokens > 0 || state.cacheReadTokens > 0
          ? {
              input_tokens: state.inputTokens,
              output_tokens: state.outputTokens,
              cache_read_input_tokens: state.cacheReadTokens,
            }
          : null,
    },
    exceeds_200k_tokens: totalTokens > 200_000,
    product: 'antigravity',
    agent_state: state.agentState,
    vcs: isGitRepo ? { type: 'git' } : undefined,
    terminal_width: 140,
    cost:
      state.estimatedCostUsd > 0
        ? {
            total_usd: state.estimatedCostUsd,
            subagent_usd: 0,
            estimated: true,
          }
        : undefined,
    ...overrides,
  };
}

export function getHomeDir(): string {
  return os.homedir();
}
