import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { Tracker, TrackerContext, TrackerSegment } from '../types.ts';

function detectGitBranch(cwd: string): string | null {
  try {
    const out = execFileSync(
      'git',
      ['--no-optional-locks', 'rev-parse', '--abbrev-ref', 'HEAD'],
      {
        cwd,
        timeout: 250,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
      }
    )
      .toString('utf8')
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

export const workspaceTracker: Tracker = {
  id: 'workspace',
  name: 'Workspace & VCS Tracker',
  description: 'Shows the current workspace folder name and active Git/VCS branch.',
  defaultPriority: 70,

  render(ctx: TrackerContext): TrackerSegment | null {
    const dir =
      ctx.payload.workspace?.current_dir ??
      ctx.payload.workspace?.project_dir ??
      ctx.payload.cwd;
    if (!dir) return null;

    const folderName = path.basename(dir) || dir;
    const showBranch = (ctx.options.showBranch as boolean | undefined) ?? true;

    let branch: string | null = null;
    if (showBranch) {
      if (ctx.payload.vcs?.branch) {
        branch = ctx.payload.vcs.branch;
      } else if (ctx.payload.vcs?.type === 'git') {
        branch = detectGitBranch(dir);
      }
    }

    const text = branch ? `${folderName} (${branch})` : folderName;
    return {
      icon: '📁',
      text,
      color: 'blue',
      priority: 70,
      minWidth: 50,
    };
  },
};
