import {
  colorize,
  formatTokens,
  formatUsd,
  renderProgressBar,
} from '../ansi.ts';
import type {
  AnsiColor,
  Tracker,
  TrackerContext,
  TrackerSegment,
  UsageTrackerOptions,
} from '../types.ts';

function getUsageColor(
  percentage: number,
  warnThreshold: number,
  criticalThreshold: number
): AnsiColor {
  if (percentage >= criticalThreshold) return 'brightRed';
  if (percentage >= warnThreshold) return 'yellow';
  return 'green';
}

function resolveUsageOptions(raw: Record<string, unknown>): Required<UsageTrackerOptions> {
  const opts = raw as UsageTrackerOptions;
  return {
    showBar: opts.showBar ?? true,
    barWidth: opts.barWidth ?? 10,
    showPercentage: opts.showPercentage ?? true,
    showTokens: opts.showTokens ?? true,
    showTokenBreakdown: opts.showTokenBreakdown ?? false,
    showCacheRate: opts.showCacheRate ?? true,
    showCost: opts.showCost ?? true,
    show200kBadge: opts.show200kBadge ?? true,
    showQuota: opts.showQuota ?? false,
    warnThreshold: opts.warnThreshold ?? 60,
    criticalThreshold: opts.criticalThreshold ?? 85,
  };
}

/**
 * Built-in Usage Tracker.
 * Displays context window utilization (bar, %, tokens, cache hit rate, >200k warning),
 * session cost (total + subagent breakdown), and optional remaining quota buckets.
 */
export const usageTracker: Tracker = {
  id: 'usage',
  name: 'Usage Tracker',
  description:
    'Tracks context window usage, token counts, prompt cache hit rate, session USD cost, and optional quota buckets.',
  defaultPriority: 90,

  render(ctx: TrackerContext): TrackerSegment[] | null {
    const { payload, colorEnabled } = ctx;
    const opts = resolveUsageOptions(ctx.options);
    const segments: TrackerSegment[] = [];

    const cw = payload.context_window;
    if (cw) {
      const totalIn = cw.total_input_tokens ?? 0;
      const totalOut = cw.total_output_tokens ?? 0;
      const totalTokens = totalIn + totalOut;
      const windowSize = cw.context_window_size ?? 0;

      let pct: number | null = null;
      if (typeof cw.used_percentage === 'number' && Number.isFinite(cw.used_percentage)) {
        pct = cw.used_percentage;
      } else if (windowSize > 0 && totalTokens > 0) {
        pct = (totalTokens / windowSize) * 100;
      }

      const usageParts: string[] = [];
      const pctColor: AnsiColor =
        pct !== null
          ? getUsageColor(pct, opts.warnThreshold, opts.criticalThreshold)
          : 'cyan';

      if (opts.showBar && pct !== null) {
        usageParts.push(renderProgressBar(pct, opts.barWidth, colorEnabled, pctColor));
      }

      if (opts.showPercentage && pct !== null) {
        const pctLabel = `${Math.round(pct)}%`;
        usageParts.push(
          colorize(pctLabel, pctColor, colorEnabled, {
            bold: pct >= opts.criticalThreshold,
          })
        );
      }

      if (opts.showTokens && (totalTokens > 0 || windowSize > 0)) {
        const tokenText =
          windowSize > 0
            ? `${formatTokens(totalTokens)}/${formatTokens(windowSize)}`
            : `${formatTokens(totalTokens)} tok`;
        usageParts.push(colorize(tokenText, 'gray', colorEnabled));
      }

      if (opts.show200kBadge && payload.exceeds_200k_tokens) {
        usageParts.push(colorize('>200k', 'brightYellow', colorEnabled, { bold: true }));
      }

      if (usageParts.length > 0) {
        segments.push({
          text: usageParts.join(' '),
          raw: true,
          priority: 95,
        });
      }

      // Optional input/output token breakdown
      if (opts.showTokenBreakdown && (totalIn > 0 || totalOut > 0)) {
        segments.push({
          text: `${formatTokens(totalIn)}↑ ${formatTokens(totalOut)}↓`,
          color: 'gray',
          priority: 55,
          minWidth: 75,
        });
      }

      // Prompt cache hit ratio from current_usage
      const cur = cw.current_usage;
      if (opts.showCacheRate && cur) {
        const cacheRead = cur.cache_read_input_tokens ?? 0;
        const freshIn = cur.input_tokens ?? 0;
        const cacheCreate = cur.cache_creation_input_tokens ?? 0;
        const denom = freshIn + cacheRead + cacheCreate;
        if (cacheRead > 0 && denom > 0) {
          const hitPct = Math.round((cacheRead / denom) * 100);
          segments.push({
            icon: '⚡',
            text: `${hitPct}% cache`,
            color: hitPct >= 50 ? 'brightCyan' : 'cyan',
            priority: 60,
            minWidth: 70,
          });
        }
      }
    }

    // Session USD cost (omitted cleanly when CLI does not report cost, e.g., Enterprise tier)
    if (opts.showCost && payload.cost && typeof payload.cost.total_usd === 'number') {
      const totalStr = formatUsd(payload.cost.total_usd, Boolean(payload.cost.estimated));
      const subUsd = payload.cost.subagent_usd ?? 0;
      const costText =
        subUsd > 0 ? `${totalStr} (+${formatUsd(subUsd)} sub)` : totalStr;

      segments.push({
        text: costText,
        color: payload.cost.total_usd >= 5 ? 'yellow' : 'brightGreen',
        bold: payload.cost.total_usd >= 5,
        priority: 88,
      });
    }

    // Optional quota buckets from payload.quota
    if (opts.showQuota && payload.quota) {
      const quotaEntries: string[] = [];
      for (const [bucketId, bucket] of Object.entries(payload.quota)) {
        if (!bucket || bucket.disabled) continue;
        const shortName = bucketId.replace(/^gemini-/, '').replace(/-weekly$/, ' 7d');
        if (typeof bucket.remaining_fraction === 'number') {
          const remPct = Math.round(bucket.remaining_fraction * 100);
          const qColor: AnsiColor =
            remPct <= 15 ? 'brightRed' : remPct <= 35 ? 'yellow' : 'green';
          quotaEntries.push(
            `${shortName} ${colorize(`${remPct}%`, qColor, colorEnabled)}`
          );
        } else if (typeof bucket.remaining_amount === 'number') {
          quotaEntries.push(`${shortName} ${bucket.remaining_amount}`);
        }
      }
      if (quotaEntries.length > 0) {
        segments.push({
          text: quotaEntries.join(' · '),
          raw: true,
          priority: 65,
          minWidth: 80,
        });
      }
    }

    return segments.length > 0 ? segments : null;
  },
};
