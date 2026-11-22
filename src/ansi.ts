import type { AnsiColor, TrackerSegment } from './types.ts';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const FG_CODES: Record<AnsiColor, string> = {
  default: '',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

const BG_CODES: Record<AnsiColor, string> = {
  default: '',
  black: '\x1b[40m',
  red: '\x1b[41m',
  green: '\x1b[42m',
  yellow: '\x1b[43m',
  blue: '\x1b[44m',
  magenta: '\x1b[45m',
  cyan: '\x1b[46m',
  white: '\x1b[47m',
  gray: '\x1b[100m',
  brightRed: '\x1b[101m',
  brightGreen: '\x1b[102m',
  brightYellow: '\x1b[103m',
  brightBlue: '\x1b[104m',
  brightMagenta: '\x1b[105m',
  brightCyan: '\x1b[106m',
  brightWhite: '\x1b[107m',
};

// Matches ANSI CSI/OSC escape sequences
const ANSI_REGEX = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g;

export function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, '');
}

/**
 * Computes approximate terminal cell width after stripping ANSI escape codes.
 */
export function visibleWidth(input: string): number {
  const plain = stripAnsi(input);
  let width = 0;
  for (const ch of plain) {
    const code = ch.codePointAt(0) ?? 0;
    // Skip zero-width variation selectors and combining marks
    if (
      (code >= 0xfe00 && code <= 0xfe0f) ||
      (code >= 0x0300 && code <= 0x036f) ||
      code === 0x200d
    ) {
      continue;
    }
    // Wide emoji / CJK ranges take 2 columns
    if (
      (code >= 0x1f300 && code <= 0x1faff) ||
      (code >= 0x2600 && code <= 0x27bf && code !== 0x2726 && code !== 0x2727) ||
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

export function colorize(
  text: string,
  color: AnsiColor | undefined,
  enabled: boolean,
  opts?: { bold?: boolean; dim?: boolean; bgColor?: AnsiColor }
): string {
  if (!enabled) {
    return stripAnsi(text);
  }
  const codes: string[] = [];
  if (opts?.bold) codes.push(BOLD);
  if (opts?.dim) codes.push(DIM);
  if (color && FG_CODES[color]) codes.push(FG_CODES[color]);
  if (opts?.bgColor && BG_CODES[opts.bgColor]) codes.push(BG_CODES[opts.bgColor]);
  if (codes.length === 0) return text;
  return `${codes.join('')}${text}${RESET}`;
}

export function styleSegment(
  segment: TrackerSegment,
  colorEnabled: boolean,
  isPowerline = false
): string {
  const content = segment.icon ? `${segment.icon} ${segment.text}` : segment.text;
  if (segment.raw) {
    return colorEnabled ? content : stripAnsi(content);
  }
  if (isPowerline && colorEnabled) {
    const bg = segment.bgColor ?? 'gray';
    const fg = segment.color ?? 'brightWhite';
    return colorize(` ${content} `, fg, true, {
      bold: segment.bold,
      dim: segment.dim,
      bgColor: bg,
    });
  }
  return colorize(content, segment.color, colorEnabled, {
    bold: segment.bold,
    dim: segment.dim,
    bgColor: segment.bgColor,
  });
}

/**
 * Renders a compact Unicode progress bar, e.g. `[███░░░░░░░]`.
 */
export function renderProgressBar(
  percentage: number,
  width = 10,
  colorEnabled = true,
  color: AnsiColor = 'green'
): string {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));
  const safeWidth = Math.max(4, Math.min(30, Math.round(width)));
  const filled = Math.round((clamped / 100) * safeWidth);
  const empty = safeWidth - filled;
  const filledStr = colorize('█'.repeat(filled), color, colorEnabled);
  const emptyStr = colorize('░'.repeat(empty), 'gray', colorEnabled, { dim: true });
  return `[${filledStr}${emptyStr}]`;
}

/**
 * Formats large token counts cleanly (e.g. 850 -> "850", 14200 -> "14.2k", 1048576 -> "1.0M").
 */
export function formatTokens(count: number): string {
  if (!Number.isFinite(count) || count < 0) return '0';
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    return `${val >= 10 ? val.toFixed(0) : val.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)}k`;
  }
  return String(Math.round(count));
}

/**
 * Formats USD session cost (e.g. 0.0042 -> "$0.004", 0.4213 -> "$0.42", 12.5 -> "$12.50").
 */
export function formatUsd(amount: number, estimated = false): string {
  if (!Number.isFinite(amount) || amount < 0) return '$0.00';
  const prefix = estimated ? '~$' : '$';
  if (amount > 0 && amount < 0.01) {
    return `${prefix}${amount.toFixed(3)}`;
  }
  return `${prefix}${amount.toFixed(2)}`;
}

/**
 * Truncates plain text (or ANSI-stripped fallback) cleanly with an ellipsis.
 */
export function truncateText(input: string, maxCols: number): string {
  if (maxCols <= 0) return '';
  if (visibleWidth(input) <= maxCols) return input;
  const plain = stripAnsi(input);
  let acc = '';
  let w = 0;
  for (const ch of plain) {
    const cw = visibleWidth(ch);
    if (w + cw > Math.max(1, maxCols - 1)) break;
    acc += ch;
    w += cw;
  }
  return `${acc}…`;
}
