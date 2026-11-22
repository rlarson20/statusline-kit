import { execFileSync } from 'node:child_process';

/**
 * Example custom drop-in tracker: Git Diff Stats
 * Copy to ~/.gemini/statusline-kit/trackers/git-diff.mjs and add "git-diff" to `lines` in config.json.
 */
export default {
  id: 'git-diff',
  name: 'Git Diff Tracker',
  description: 'Shows uncommitted line insertions and deletions in the current Git workspace.',
  defaultPriority: 45,

  render(ctx) {
    const cwd = ctx.payload.workspace?.current_dir ?? ctx.payload.cwd;
    if (!cwd || ctx.payload.vcs?.type !== 'git') return null;

    try {
      const out = execFileSync('git', ['--no-optional-locks', 'diff', '--shortstat'], {
        cwd,
        timeout: 250,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
      })
        .toString('utf8')
        .trim();

      if (!out) return null;

      const ins = out.match(/(\d+) insertion/)?.[1];
      const del = out.match(/(\d+) deletion/)?.[1];
      const parts = [];
      if (ins) parts.push(`+${ins}`);
      if (del) parts.push(`-${del}`);
      if (parts.length === 0) return null;

      return {
        icon: '±',
        text: parts.join(' '),
        color: 'yellow',
        priority: 45,
        minWidth: 75,
      };
    } catch {
      return null;
    }
  },
};
