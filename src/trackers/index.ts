import type { Tracker } from '../types.ts';
import { activityTracker } from './activity.ts';
import { modelTracker } from './model.ts';
import { stateTracker } from './state.ts';
import { usageTracker } from './usage.ts';
import { workspaceTracker } from './workspace.ts';

export {
  usageTracker,
  modelTracker,
  stateTracker,
  workspaceTracker,
  activityTracker,
};

export const BUILTIN_TRACKERS: readonly Tracker[] = [
  usageTracker,
  modelTracker,
  stateTracker,
  workspaceTracker,
  activityTracker,
];
