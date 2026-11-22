import type { AnsiColor, Tracker, TrackerContext, TrackerSegment } from '../types.ts';

const STATE_STYLES: Record<string, { label: string; icon: string; color: AnsiColor }> = {
  idle: { label: 'READY', icon: '●', color: 'green' },
  working: { label: 'THINKING', icon: '◐', color: 'brightYellow' },
  tool_use: { label: 'TOOL', icon: '⚙', color: 'brightBlue' },
  reviewing: { label: 'REVIEW', icon: '◎', color: 'magenta' },
  authenticating: { label: 'AUTH', icon: '🔑', color: 'yellow' },
  initializing: { label: 'INIT', icon: '◌', color: 'gray' },
  error: { label: 'ERROR', icon: '✖', color: 'brightRed' },
};

export const stateTracker: Tracker = {
  id: 'state',
  name: 'Agent State Tracker',
  description: 'Shows agent lifecycle state, cycle mode (plan/auto/accept-edits), Vim mode, and sandbox badge.',
  defaultPriority: 92,

  render(ctx: TrackerContext): TrackerSegment[] | null {
    const { agent_state, cycle_mode, vim, sandbox } = ctx.payload;
    const segments: TrackerSegment[] = [];

    if (agent_state) {
      const style = STATE_STYLES[agent_state] ?? {
        label: agent_state.toUpperCase(),
        icon: '●',
        color: 'white' as AnsiColor,
      };
      segments.push({
        icon: style.icon,
        text: style.label,
        color: style.color,
        bold: true,
        priority: 92,
      });
    }

    if (cycle_mode) {
      const modeColor: AnsiColor =
        cycle_mode === 'plan'
          ? 'magenta'
          : cycle_mode === 'auto'
            ? 'brightYellow'
            : 'cyan';
      segments.push({
        text: cycle_mode.toUpperCase(),
        color: modeColor,
        priority: 75,
      });
    }

    if (vim?.mode) {
      const vimColor: AnsiColor =
        vim.mode === 'INSERT'
          ? 'brightGreen'
          : vim.mode.startsWith('VISUAL')
            ? 'brightMagenta'
            : 'brightBlue';
      segments.push({
        text: `VIM:${vim.mode}`,
        color: vimColor,
        bold: true,
        priority: 80,
      });
    }

    if (sandbox?.enabled) {
      segments.push({
        icon: '🛡',
        text: 'SANDBOX',
        color: 'cyan',
        priority: 50,
        minWidth: 85,
      });
    }

    return segments.length > 0 ? segments : null;
  },
};
