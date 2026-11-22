import {
  colorize,
  styleSegment,
  truncateText,
  visibleWidth,
} from './ansi.ts';
import type { TrackerRegistry } from './registry.ts';
import type {
  ResolvedStatusLineConfig,
  StatusLinePayload,
  Tracker,
  TrackerContext,
  TrackerResult,
  TrackerSegment,
} from './types.ts';

interface RenderedSegment {
  rendered: string;
  width: number;
  priority: number;
  order: number;
}

function normalizeResult(
  result: TrackerResult,
  defaultPriority: number
): TrackerSegment[] {
  if (result === null || result === undefined) return [];
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (!trimmed) return [];
    return [{ text: trimmed, priority: defaultPriority }];
  }
  const items = Array.isArray(result) ? result : [result];
  return items
    .filter((item) => item && typeof item.text === 'string' && item.text.length > 0)
    .map((item) => ({
      ...item,
      priority: item.priority ?? defaultPriority,
    }));
}

async function runTrackerWithTimeout(
  tracker: Tracker,
  ctx: TrackerContext,
  timeoutMs: number
): Promise<TrackerSegment[]> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race<TrackerResult>([
      Promise.resolve().then(() => tracker.render(ctx)),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    return normalizeResult(result, tracker.defaultPriority ?? 50);
  } catch {
    // Fault isolation: a broken tracker never crashes the status line
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function fitSegmentsToWidth(
  segments: RenderedSegment[],
  separator: string,
  maxWidth: number
): string {
  if (segments.length === 0) return '';

  const sepWidth = visibleWidth(separator);
  const kept = [...segments];

  const totalWidth = (items: RenderedSegment[]): number =>
    items.reduce((sum, s) => sum + s.width, 0) +
    Math.max(0, items.length - 1) * sepWidth;

  // Drop lowest-priority segments (rightmost tie-breaker) until the line fits
  while (kept.length > 1 && totalWidth(kept) > maxWidth) {
    let dropIdx = 0;
    for (let i = 1; i < kept.length; i++) {
      const cur = kept[i]!;
      const best = kept[dropIdx]!;
      if (
        cur.priority < best.priority ||
        (cur.priority === best.priority && cur.order > best.order)
      ) {
        dropIdx = i;
      }
    }
    kept.splice(dropIdx, 1);
  }

  if (kept.length === 1 && kept[0]!.width > maxWidth) {
    return truncateText(kept[0]!.rendered, maxWidth);
  }

  return kept.map((s) => s.rendered).join(separator);
}

export interface RenderOptions {
  now?: number;
  forceColor?: boolean;
}

/**
 * Renders the full multi-line status line string for an Antigravity CLI JSON payload.
 */
export async function renderStatusLine(
  payload: StatusLinePayload,
  registry: TrackerRegistry,
  config: ResolvedStatusLineConfig,
  opts?: RenderOptions
): Promise<string> {
  const terminalWidth =
    typeof payload.terminal_width === 'number' && payload.terminal_width > 0
      ? payload.terminal_width
      : process.stdout.columns || 120;

  const noColorEnv =
    process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
  const colorEnabled =
    opts?.forceColor !== undefined
      ? opts.forceColor
      : config.theme !== 'no-color' && !noColorEnv;

  const now = opts?.now ?? Date.now();
  const isPowerline = config.theme === 'powerline';
  const styledSeparator =
    isPowerline
      ? config.separator
      : colorize(config.separator, 'gray', colorEnabled, { dim: true });

  // Collect all unique tracker IDs referenced across all lines and execute them in parallel
  const uniqueIds = new Set<string>();
  for (const line of config.lines) {
    for (const id of line) {
      uniqueIds.add(id);
    }
  }

  const resultsById = new Map<string, TrackerSegment[]>();
  await Promise.all(
    Array.from(uniqueIds).map(async (id) => {
      const tracker = registry.get(id);
      if (!tracker) {
        resultsById.set(id, []);
        return;
      }
      const ctx: TrackerContext = {
        payload,
        config,
        options: config.trackerOptions[id] ?? {},
        terminalWidth,
        colorEnabled,
        now,
      };
      const segments = await runTrackerWithTimeout(
        tracker,
        ctx,
        config.trackerTimeoutMs
      );
      resultsById.set(id, segments);
    })
  );

  // Assemble each line in declared order, filtering by minWidth and fitting to terminalWidth
  const renderedLines: string[] = [];
  for (const lineIds of config.lines) {
    const lineSegments: RenderedSegment[] = [];
    let order = 0;

    for (const id of lineIds) {
      const segments = resultsById.get(id) ?? [];
      for (const seg of segments) {
        if (typeof seg.minWidth === 'number' && terminalWidth < seg.minWidth) {
          continue;
        }
        const rendered = styleSegment(seg, colorEnabled, isPowerline);
        lineSegments.push({
          rendered,
          width: visibleWidth(rendered),
          priority: seg.priority ?? 50,
          order: order++,
        });
      }
    }

    const line = fitSegmentsToWidth(lineSegments, styledSeparator, terminalWidth);
    if (line.length > 0) {
      renderedLines.push(line);
    }
  }

  return renderedLines.join('\n');
}
