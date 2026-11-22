import type { Tracker, TrackerContext, TrackerSegment } from '../types.ts';

export const activityTracker: Tracker = {
  id: 'activity',
  name: 'Activity Tracker',
  description: 'Shows tool confirmation alerts, running subagents, background tasks, artifacts, and queued messages.',
  defaultPriority: 65,

  render(ctx: TrackerContext): TrackerSegment[] | null {
    const {
      tool_confirmation_pending,
      subagents,
      task_count,
      artifact_count,
      pending_input_count,
    } = ctx.payload;

    const segments: TrackerSegment[] = [];

    if (tool_confirmation_pending) {
      segments.push({
        icon: '⚠',
        text: 'CONFIRM TOOL',
        color: 'brightYellow',
        bold: true,
        priority: 100,
      });
    }

    if (Array.isArray(subagents) && subagents.length > 0) {
      const running = subagents.filter((s) => s.status === 'running').length;
      const label =
        running > 0
          ? `${running}/${subagents.length} agents`
          : `${subagents.length} ${subagents.length === 1 ? 'agent' : 'agents'}`;
      segments.push({
        icon: '🤖',
        text: label,
        color: running > 0 ? 'brightMagenta' : 'gray',
        priority: 68,
      });
    }

    if (typeof task_count === 'number' && task_count > 0) {
      segments.push({
        icon: '⚡',
        text: `${task_count} ${task_count === 1 ? 'task' : 'tasks'}`,
        color: 'cyan',
        priority: 64,
      });
    }

    if (typeof artifact_count === 'number' && artifact_count > 0) {
      segments.push({
        icon: '📄',
        text: `${artifact_count} ${artifact_count === 1 ? 'artifact' : 'artifacts'}`,
        color: 'gray',
        priority: 45,
        minWidth: 85,
      });
    }

    if (typeof pending_input_count === 'number' && pending_input_count > 0) {
      segments.push({
        icon: '💬',
        text: `${pending_input_count} queued`,
        color: 'yellow',
        priority: 72,
      });
    }

    return segments.length > 0 ? segments : null;
  },
};
