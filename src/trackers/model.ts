import type { Tracker, TrackerContext, TrackerSegment } from '../types.ts';

export const modelTracker: Tracker = {
  id: 'model',
  name: 'Model Tracker',
  description: 'Displays the active model name, effort level, and custom agent name if active.',
  defaultPriority: 85,

  render(ctx: TrackerContext): TrackerSegment | null {
    const { model, agent } = ctx.payload;
    if (!model?.display_name && !model?.id) return null;

    const name = model.display_name ?? model.id ?? '';
    const effort = model.effort;
    const showEffort =
      effort && !name.toLowerCase().includes(`(${effort.toLowerCase()})`);

    const parts: string[] = [name];
    if (showEffort) {
      parts.push(`[${effort}]`);
    }
    if (agent?.name) {
      parts.push(`@${agent.name}`);
    }

    return {
      icon: '✦',
      text: parts.join(' '),
      color: 'brightCyan',
      bold: true,
      priority: 85,
    };
  },
};
