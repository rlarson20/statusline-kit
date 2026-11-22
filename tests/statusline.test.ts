import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  formatTokens,
  formatUsd,
  renderProgressBar,
  stripAnsi,
  visibleWidth,
} from '../src/ansi.ts';
import { resolveConfig } from '../src/config.ts';
import { TrackerRegistry } from '../src/registry.ts';
import { renderStatusLine } from '../src/renderer.ts';
import type { StatusLinePayload, Tracker } from '../src/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'sample-payload.json');
const SAMPLE_PAYLOAD = JSON.parse(
  fs.readFileSync(FIXTURE_PATH, 'utf8')
) as StatusLinePayload;

describe('ANSI & formatting helpers', () => {
  it('formats token counts across scales', () => {
    assert.equal(formatTokens(420), '420');
    assert.equal(formatTokens(14250), '14.3k');
    assert.equal(formatTokens(149318), '149k');
    assert.equal(formatTokens(1048576), '1.0M');
  });

  it('formats USD amounts with optional estimated prefix', () => {
    assert.equal(formatUsd(0.0042), '$0.004');
    assert.equal(formatUsd(0.4213), '$0.42');
    assert.equal(formatUsd(1.25, true), '~$1.25');
  });

  it('strips ANSI sequences and calculates visible width', () => {
    const bar = renderProgressBar(50, 10, true, 'green');
    assert.equal(stripAnsi(bar), '[█████░░░░░]');
    assert.equal(visibleWidth(bar), 12);
  });
});

describe('Built-in Usage Tracker', () => {
  it('renders context bar, percentage, tokens, cache rate, and session cost', async () => {
    const registry = new TrackerRegistry(true);
    const config = resolveConfig({
      theme: 'no-color',
      lines: [['usage']],
    });

    const out = await renderStatusLine(SAMPLE_PAYLOAD, registry, config);
    assert.match(out, /\[█░░░░░░░░░\] 14% 149k\/1\.0M/);
    assert.match(out, /⚡ 25% cache/);
    assert.match(out, /\$0\.42 \(\+\$0\.08 sub\)/);
  });

  it('supports token breakdown, >200k warning, estimated cost, and quota buckets', async () => {
    const registry = new TrackerRegistry(true);
    const config = resolveConfig({
      theme: 'no-color',
      lines: [['usage']],
      trackerOptions: {
        usage: {
          showTokenBreakdown: true,
          showQuota: true,
        },
      },
    });

    const highUsagePayload: StatusLinePayload = {
      ...SAMPLE_PAYLOAD,
      exceeds_200k_tokens: true,
      context_window: {
        ...SAMPLE_PAYLOAD.context_window,
        used_percentage: 88,
      },
      cost: {
        total_usd: 6.5,
        subagent_usd: 0,
        estimated: true,
      },
    };

    const out = await renderStatusLine(highUsagePayload, registry, config);
    assert.match(out, /88%/);
    assert.match(out, />200k/);
    assert.match(out, /88\.2k↑ 61\.1k↓/);
    assert.match(out, /~\$6\.50/);
    assert.match(out, /weekly 94%/);
  });

  it('omits cost cleanly when CLI does not report cost (e.g. Enterprise tier)', async () => {
    const registry = new TrackerRegistry(true);
    const config = resolveConfig({
      theme: 'no-color',
      lines: [['usage']],
    });

    const { cost: _omitted, ...noCostPayload } = SAMPLE_PAYLOAD;
    const out = await renderStatusLine(noCostPayload, registry, config);
    assert.match(out, /14%/);
    assert.doesNotMatch(out, /\$/);
  });
});

describe('Built-in State, Model, Workspace & Activity Trackers', () => {
  it('renders full multi-line default layout cleanly', async () => {
    const registry = new TrackerRegistry(true);
    const config = resolveConfig({ theme: 'no-color' });

    const out = await renderStatusLine(
      {
        ...SAMPLE_PAYLOAD,
        vim: { mode: 'NORMAL' },
        tool_confirmation_pending: true,
      },
      registry,
      config
    );

    const lines = out.split('\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0]!, /● READY/);
    assert.match(lines[0]!, /PLAN/);
    assert.match(lines[0]!, /VIM:NORMAL/);
    assert.match(lines[0]!, /✦ Gemini 4 Argon \(Medium\)/);
    assert.match(lines[0]!, /my-project \(feat\/statusline\)/);
    assert.match(lines[1]!, /⚠ CONFIRM TOOL/);
    assert.match(lines[1]!, /1\/1 agents/);
    assert.match(lines[1]!, /1 task/);
  });
});

describe('Extensibility: Custom Trackers', () => {
  it('supports programmatic tracker registration', async () => {
    const registry = new TrackerRegistry(true);
    const customTracker: Tracker = {
      id: 'sprint',
      name: 'Sprint Tracker',
      render: (ctx) => ({
        icon: '🏃',
        text: `Sprint ${String(ctx.options.number ?? 1)}`,
        color: 'cyan',
      }),
    };
    registry.register(customTracker);

    const config = resolveConfig({
      theme: 'no-color',
      lines: [['model', 'sprint', 'usage']],
      trackerOptions: {
        sprint: { number: 42 },
      },
    });

    const out = await renderStatusLine(SAMPLE_PAYLOAD, registry, config);
    assert.match(out, /🏃 Sprint 42/);
  });

  it('auto-discovers drop-in ESM trackers from trackersDir', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-kit-test-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'env-badge.mjs'),
        `export default {
          id: 'env-badge',
          name: 'Env Badge',
          render(ctx) {
            return { icon: '★', text: 'TIER:' + (ctx.payload.plan_tier ?? 'Free') };
          }
        };\n`,
        'utf8'
      );

      const config = resolveConfig({
        theme: 'no-color',
        trackersDir: tmpDir,
        lines: [['env-badge']],
      });
      const registry = new TrackerRegistry(true);
      await registry.loadFromConfig(config);

      assert.equal(registry.has('env-badge'), true);
      const out = await renderStatusLine(SAMPLE_PAYLOAD, registry, config);
      assert.equal(out, '★ TIER:Pro');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('executes shell-command trackers and pipes JSON payload to stdin', async () => {
    const config = resolveConfig({
      theme: 'no-color',
      lines: [['shell-ping']],
      customTrackers: [
        {
          type: 'command',
          id: 'shell-ping',
          command: `node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('ver:' + d.version)"`,
          icon: '⚙',
          color: 'cyan',
        },
      ],
    });

    const registry = new TrackerRegistry(true);
    await registry.loadFromConfig(config);

    const out = await renderStatusLine(SAMPLE_PAYLOAD, registry, config);
    assert.equal(out, '⚙ ver:1.4.5');
  });
});

describe('Resilience & Terminal Width Adaptation', () => {
  it('isolates throwing and timed-out trackers without failing other trackers', async () => {
    const registry = new TrackerRegistry(true);
    registry.register({
      id: 'broken',
      name: 'Broken',
      render() {
        throw new Error('boom');
      },
    });
    registry.register({
      id: 'slow',
      name: 'Slow',
      async render() {
        await new Promise((r) => setTimeout(r, 500));
        return 'too-late';
      },
    });

    const config = resolveConfig({
      theme: 'no-color',
      trackerTimeoutMs: 50,
      lines: [['broken', 'slow', 'model']],
    });

    const out = await renderStatusLine(SAMPLE_PAYLOAD, registry, config);
    assert.equal(out, '✦ Gemini 4 Argon (Medium)');
  });

  it('drops lower-priority segments on narrow terminals', async () => {
    const registry = new TrackerRegistry(false);
    registry.register({
      id: 'hi',
      name: 'High',
      render: () => ({ text: 'IMPORTANT_SEGMENT', priority: 95 }),
    });
    registry.register({
      id: 'lo',
      name: 'Low',
      render: () => ({ text: 'OPTIONAL_EXTRA_INFO', priority: 20 }),
    });

    const config = resolveConfig({
      theme: 'no-color',
      lines: [['hi', 'lo']],
    });

    const out = await renderStatusLine(
      { ...SAMPLE_PAYLOAD, terminal_width: 25 },
      registry,
      config
    );
    assert.equal(out, 'IMPORTANT_SEGMENT');
    assert.ok(visibleWidth(out) <= 25);
  });
});

describe('CLI End-to-End & Antigravity Plugin Manifest Compliance', () => {
  it('renders piped JSON via scripts/statusline.mjs and exits 0 on malformed stdin', () => {
    const entry = path.join(PLUGIN_ROOT, 'scripts', 'statusline.mjs');

    const okOut = execFileSync(process.execPath, [entry, '--theme', 'no-color'], {
      input: JSON.stringify(SAMPLE_PAYLOAD),
      encoding: 'utf8',
    });
    assert.match(okOut, /Gemini 4 Argon/);
    assert.match(okOut, /14%/);
    assert.match(okOut, /\$0\.42/);

    const badOut = execFileSync(process.execPath, [entry], {
      input: '{not-valid-json',
      encoding: 'utf8',
    });
    assert.equal(badOut, '');
  });

  it('validates plugin.json against the official Antigravity plugin schema rules', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(PLUGIN_ROOT, 'plugin.json'), 'utf8')
    ) as Record<string, unknown>;

    const allowedKeys = new Set([
      '$schema',
      'name',
      'displayName',
      'description',
      'version',
      'disabled',
      'logo',
      'suggestedPrompts',
      'skills',
      'author',
      'homepage',
      'repository',
      'license',
      'keywords',
      'extensions',
    ]);

    for (const key of Object.keys(manifest)) {
      assert.ok(allowedKeys.has(key), `Unexpected plugin.json key: ${key}`);
    }

    assert.match(String(manifest.name), /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(
      !String(manifest.displayName).match(/^(Antigravity|Gemini|Claude|Cursor)/i),
      'displayName must not lead with Antigravity/Gemini/Claude/Cursor'
    );
    assert.ok(
      Array.isArray(manifest.suggestedPrompts) &&
        manifest.suggestedPrompts.length <= 3
    );

    // Logo asset exists
    assert.ok(fs.existsSync(path.join(PLUGIN_ROOT, String(manifest.logo))));

    // Every skill directory name matches its SKILL.md frontmatter `name`
    const skillsDir = path.join(PLUGIN_ROOT, 'skills');
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = fs.readFileSync(
        path.join(skillsDir, entry.name, 'SKILL.md'),
        'utf8'
      );
      const nameMatch = skillMd.match(/^name:\s*(.+)$/m);
      assert.ok(nameMatch, `Missing frontmatter name in skills/${entry.name}/SKILL.md`);
      assert.equal(nameMatch[1]!.trim(), entry.name);
    }

    // Entry scripts are executable (0755)
    for (const rel of [
      'scripts/statusline.mjs',
      'scripts/mcp-server.mjs',
      'scripts/hook-telemetry.mjs',
    ]) {
      const stat = fs.statSync(path.join(PLUGIN_ROOT, rel));
      assert.ok((stat.mode & 0o111) !== 0, `${rel} must be executable`);
    }

    // mcp_config.json uses "command": "node" with PLUGIN_ROOT / PLUGIN_DATA
    const mcpConfig = JSON.parse(
      fs.readFileSync(path.join(PLUGIN_ROOT, 'mcp_config.json'), 'utf8')
    ) as { mcpServers: Record<string, { command: string; args: string[] }> };
    assert.equal(mcpConfig.mcpServers.statusline?.command, 'node');
    assert.ok(
      mcpConfig.mcpServers.statusline?.args.some((a) => a.includes('${PLUGIN_ROOT}'))
    );

    // hooks.json uses named hook group & relative script paths
    const hooksConfig = JSON.parse(
      fs.readFileSync(path.join(PLUGIN_ROOT, 'hooks.json'), 'utf8')
    ) as Record<string, Record<string, unknown>>;
    assert.ok(hooksConfig['statusline-telemetry']);
    assert.ok(Array.isArray(hooksConfig['statusline-telemetry']!.SessionStart));
    assert.ok(Array.isArray(hooksConfig['statusline-telemetry']!.PostToolUse));
  });
});

describe('Antigravity App GUI: Telemetry Hooks & MCP App Server', () => {
  it('records lifecycle hook events and serves live MCP App UI + tools', async () => {
    const { recordHookEvent } = await import('../src/telemetry.ts');
    const { handleMcpRequest, STATUSLINE_UI_URI } = await import('../src/mcp-server.ts');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-kit-mcp-'));
    const cfgPath = path.join(tmpDir, 'config.json');
    try {
      recordHookEvent(
        'PreInvocation',
        {
          session_id: 'gui-sess-1',
          cwd: PLUGIN_ROOT,
          model: 'Gemini 4 Argon',
          usage: {
            input_tokens: 50000,
            output_tokens: 12000,
            cache_read_input_tokens: 15000,
          },
        },
        tmpDir
      );
      recordHookEvent('PostToolUse', { session_id: 'gui-sess-1', tool_name: 'view_file' }, tmpDir);

      // 1. Initialize advertises Antigravity UI extensions
      const initRes = (await handleMcpRequest(
        { jsonrpc: '2.0', id: 1, method: 'initialize' },
        { dataDir: tmpDir, configPath: cfgPath }
      )) as { capabilities: { extensions: Record<string, unknown> } };
      assert.ok(initRes.capabilities.extensions['io.modelcontextprotocol/ui']);
      assert.ok(initRes.capabilities.extensions['com.google.antigravity/ui']);

      // 2. tools/list exposes aux_pane & global entrypoints on open_statusline
      const toolsRes = (await handleMcpRequest(
        { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        { dataDir: tmpDir, configPath: cfgPath }
      )) as { tools: Array<{ name: string; _meta?: Record<string, unknown> }> };
      const openTool = toolsRes.tools.find((t) => t.name === 'open_statusline');
      assert.ok(openTool);
      const agyUi = openTool._meta?.['com.google.antigravity/ui'] as {
        entrypoints: Array<{ type: string }>;
      };
      assert.deepEqual(
        agyUi.entrypoints.map((e) => e.type),
        ['aux_pane', 'global']
      );

      // 3. resources/read serves self-contained MCP App HTML
      const resRead = (await handleMcpRequest(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'resources/read',
          params: { uri: STATUSLINE_UI_URI },
        },
        { dataDir: tmpDir, configPath: cfgPath }
      )) as { contents: Array<{ mimeType: string; text: string }> };
      assert.equal(resRead.contents[0]?.mimeType, 'text/html;profile=mcp-app');
      assert.match(resRead.contents[0]!.text, /ui\/initialize/);

      // 4. open_statusline returns live usage snapshot
      const callRes = (await handleMcpRequest(
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'open_statusline', arguments: {} },
        },
        { dataDir: tmpDir, configPath: cfgPath }
      )) as {
        structuredContent: {
          usageSummary: { totalTokens: number; turnCount: number; toolCallCount: number };
        };
      };
      assert.equal(callRes.structuredContent.usageSummary.totalTokens, 62000);
      assert.equal(callRes.structuredContent.usageSummary.turnCount, 1);
      assert.equal(callRes.structuredContent.usageSummary.toolCallCount, 1);

      // 5. add_custom_tracker persists a shell tracker and immediately renders it
      const addRes = (await handleMcpRequest(
        {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'add_custom_tracker',
            arguments: {
              id: 'hello-gui',
              type: 'command',
              command: 'echo hello-from-gui',
            },
          },
        },
        { dataDir: tmpDir, configPath: cfgPath }
      )) as { content: Array<{ text: string }> };
      assert.match(addRes.content[0]!.text, /hello-from-gui/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
