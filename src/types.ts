/**
 * Official Google Antigravity CLI status line JSON payload schema.
 * Reference: https://antigravity.google/docs/cli/statusline/
 */
export interface StatusLineModel {
  id?: string;
  display_name?: string;
  effort?: 'low' | 'medium' | 'high' | 'max' | string;
}

export interface StatusLineWorkspace {
  current_dir?: string;
  project_dir?: string;
}

export interface StatusLineCurrentUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface StatusLineContextWindow {
  total_input_tokens?: number;
  total_output_tokens?: number;
  context_window_size?: number;
  used_percentage?: number;
  remaining_percentage?: number;
  current_usage?: StatusLineCurrentUsage | null;
}

export interface StatusLineQuotaBucket {
  remaining_fraction?: number;
  remaining_amount?: number;
  reset_time?: string;
  reset_in_seconds?: number;
  disabled?: boolean;
}

export interface StatusLineSubagent {
  name?: string;
  role?: string;
  status?: 'running' | 'completed' | string;
}

export interface StatusLineCost {
  total_usd?: number;
  subagent_usd?: number;
  estimated?: boolean;
}

export type AgentState =
  | 'idle'
  | 'working'
  | 'tool_use'
  | 'reviewing'
  | 'authenticating'
  | 'initializing'
  | 'error'
  | string;

export interface StatusLinePayload {
  cwd?: string;
  session_id?: string;
  conversation_id?: string;
  conversation_title?: string;
  transcript_path?: string;
  model?: StatusLineModel | null;
  workspace?: StatusLineWorkspace;
  version?: string;
  context_window?: StatusLineContextWindow;
  exceeds_200k_tokens?: boolean | null;
  agent?: { name?: string };
  product?: string;
  quota?: Record<string, StatusLineQuotaBucket>;
  agent_state?: AgentState;
  vcs?: { type?: 'git' | 'jj' | 'hg' | string; branch?: string };
  cycle_mode?: 'accept-edits' | 'auto' | 'plan' | string;
  sandbox?: { enabled?: boolean };
  subagents?: StatusLineSubagent[];
  artifact_count?: number;
  plan_tier?: string;
  email?: string;
  pending_input_count?: number;
  tool_confirmation_pending?: boolean;
  task_count?: number;
  terminal_width?: number;
  vim?: { mode?: 'NORMAL' | 'INSERT' | 'VISUAL' | 'VISUAL LINE' | string };
  cost?: StatusLineCost;
}

export type AnsiColor =
  | 'default'
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite';

export type ThemeName = 'default' | 'minimal' | 'powerline' | 'no-color';

export interface TrackerSegment {
  /** Rendered text (may include ANSI sequences if `raw` is true). */
  text: string;
  /** Optional leading icon/glyph. */
  icon?: string;
  /** Foreground color name applied when `raw` is not set. */
  color?: AnsiColor;
  /** Background color name (used by powerline theme or badge styling). */
  bgColor?: AnsiColor;
  /** Bold styling. */
  bold?: boolean;
  /** Dim styling. */
  dim?: boolean;
  /** If true, `text` is treated as pre-styled ANSI and not wrapped in color codes. */
  raw?: boolean;
  /**
   * Priority for narrow terminal widths (higher = kept longer).
   * Defaults to 50.
   */
  priority?: number;
  /** Minimum terminal width required to show this segment. */
  minWidth?: number;
}

export type TrackerResult =
  | null
  | undefined
  | string
  | TrackerSegment
  | TrackerSegment[];

export interface TrackerContext {
  /** Parsed Antigravity CLI status line JSON payload. */
  payload: StatusLinePayload;
  /** Active status line configuration. */
  config: ResolvedStatusLineConfig;
  /** Tracker-specific options from `config.trackerOptions[tracker.id]`. */
  options: Record<string, unknown>;
  /** Effective terminal width in columns. */
  terminalWidth: number;
  /** Whether ANSI colors are enabled for this render pass. */
  colorEnabled: boolean;
  /** Current timestamp in milliseconds (injectable for deterministic testing). */
  now: number;
}

export interface Tracker {
  /** Unique lowercase identifier referenced in `lines` layout config. */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Short description of what this tracker shows. */
  readonly description?: string;
  /** Default priority (0-100) if a returned segment omits `priority`. */
  readonly defaultPriority?: number;
  /** Render one or more status line segments, or null/undefined to hide. */
  render(ctx: TrackerContext): TrackerResult | Promise<TrackerResult>;
}

export interface UsageTrackerOptions {
  /** Show visual progress bar for context window usage. Default: true. */
  showBar?: boolean;
  /** Number of cells in the progress bar. Default: 10. */
  barWidth?: number;
  /** Show percentage of context window used. Default: true. */
  showPercentage?: boolean;
  /** Show total token count (e.g., 149.3k/1.0M). Default: true. */
  showTokens?: boolean;
  /** Show input/output token breakdown (e.g., 88.2k↑ 61.1k↓). Default: false. */
  showTokenBreakdown?: boolean;
  /** Show prompt cache hit rate when cache_read_input_tokens > 0. Default: true. */
  showCacheRate?: boolean;
  /** Show session USD cost when reported by the CLI. Default: true. */
  showCost?: boolean;
  /** Show >200k token warning badge when exceeds_200k_tokens is true. Default: true. */
  show200kBadge?: boolean;
  /** Show remaining quota buckets from payload.quota. Default: false. */
  showQuota?: boolean;
  /** Context % threshold for yellow warning color. Default: 60. */
  warnThreshold?: number;
  /** Context % threshold for red critical color. Default: 85. */
  criticalThreshold?: number;
}

export interface ModuleTrackerConfig {
  type: 'module';
  /** Optional override ID (otherwise uses the exported tracker's `id`). */
  id?: string;
  /** Path to an ESM/JS file exporting a Tracker (supports leading `~`). */
  path: string;
  enabled?: boolean;
}

export interface CommandTrackerConfig {
  type: 'command';
  /** Unique tracker ID referenced in `lines`. */
  id: string;
  /** Optional display name. */
  name?: string;
  /** Shell command to execute; receives the Antigravity JSON payload on stdin. */
  command: string;
  /** Optional icon prepended to stdout. */
  icon?: string;
  /** Optional foreground color for stdout. */
  color?: AnsiColor;
  /** Optional priority when terminal is narrow. Default: 40. */
  priority?: number;
  /** Per-command timeout in milliseconds. Default: 800. */
  timeoutMs?: number;
  enabled?: boolean;
}

export type CustomTrackerConfig = ModuleTrackerConfig | CommandTrackerConfig;

export interface StatusLineConfig {
  /** Visual theme preset. Default: "default". */
  theme?: ThemeName;
  /** Segment separator string. Default depends on theme (" │ " for default). */
  separator?: string;
  /**
   * Multi-line layout: each inner array is an ordered list of tracker IDs
   * rendered on that line.
   */
  lines?: string[][];
  /** Per-tracker timeout in milliseconds. Default: 800. */
  trackerTimeoutMs?: number;
  /** Directory scanned automatically for `*.mjs` / `*.js` drop-in trackers. */
  trackersDir?: string;
  /** Explicitly configured custom trackers (JS modules or shell commands). */
  customTrackers?: CustomTrackerConfig[];
  /** Per-tracker configuration options keyed by tracker ID. */
  trackerOptions?: Record<string, Record<string, unknown>> & {
    usage?: UsageTrackerOptions;
  };
}

export interface ResolvedStatusLineConfig {
  theme: ThemeName;
  separator: string;
  lines: string[][];
  trackerTimeoutMs: number;
  trackersDir: string;
  customTrackers: CustomTrackerConfig[];
  trackerOptions: Record<string, Record<string, unknown>> & {
    usage?: UsageTrackerOptions;
  };
}
