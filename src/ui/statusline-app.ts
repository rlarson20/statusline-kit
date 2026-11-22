/**
 * Generates the self-contained single-file HTML MCP App (`ui://statusline-kit/statusline.html`)
 * rendered inside the Google Antigravity App (Side Panel `aux_pane`, Full Page `global`, or Inline Card).
 */
export function buildStatuslineAppHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Statusline Kit</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f172a;
      --surface: #1e293b;
      --surface-2: #0b1120;
      --border: #334155;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --green: #34d399;
      --yellow: #fbbf24;
      --red: #f87171;
      --magenta: #c084fc;
      --blue: #60a5fa;
      --cyan: #22d3ee;
      --pill-bg: rgba(148, 163, 184, 0.12);
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --surface: #ffffff;
        --surface-2: #f1f5f9;
        --border: #cbd5e1;
        --text: #0f172a;
        --muted: #475569;
        --accent: #0284c7;
        --green: #059669;
        --yellow: #d97706;
        --red: #dc2626;
        --magenta: #9333ea;
        --blue: #2563eb;
        --cyan: #0891b2;
        --pill-bg: rgba(15, 23, 42, 0.06);
      }
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      line-height: 1.4;
    }

    .hud-shell {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      overflow: hidden;
    }

    .hud-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
      gap: 8px;
    }

    .hud-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.02em;
    }

    .pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.25);
    }

    .hud-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    button {
      font: inherit;
      font-size: 11px;
      padding: 4px 9px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      transition: background 0.12s ease, border-color 0.12s ease;
    }

    button:hover {
      border-color: var(--accent);
    }

    button.primary {
      background: var(--accent);
      color: #0b1120;
      border-color: var(--accent);
      font-weight: 600;
    }

    .statusline-preview {
      padding: 10px 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: var(--surface-2);
    }

    .statusline-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .segment {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 7px;
      border-radius: 6px;
      background: var(--pill-bg);
      white-space: nowrap;
    }

    .theme-minimal .segment {
      background: transparent;
      padding: 1px 4px;
    }

    .theme-powerline .segment {
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--surface);
    }

    .sep {
      color: var(--muted);
      opacity: 0.55;
      user-select: none;
    }

    .c-green, .c-brightGreen { color: var(--green); }
    .c-yellow, .c-brightYellow { color: var(--yellow); }
    .c-red, .c-brightRed { color: var(--red); }
    .c-magenta, .c-brightMagenta { color: var(--magenta); }
    .c-blue, .c-brightBlue { color: var(--blue); }
    .c-cyan, .c-brightCyan { color: var(--cyan); }
    .c-gray { color: var(--muted); }
    .bold { font-weight: 700; }

    .usage-card {
      padding: 10px 12px;
      border-top: 1px solid var(--border);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 8px;
    }

    .metric {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 7px 9px;
    }

    .metric-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }

    .metric-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14px;
      font-weight: 700;
      margin-top: 2px;
    }

    .meter-track {
      height: 5px;
      border-radius: 999px;
      background: var(--border);
      margin-top: 6px;
      overflow: hidden;
    }

    .meter-fill {
      height: 100%;
      border-radius: 999px;
      background: var(--green);
      transition: width 0.25s ease;
    }

    .drawer {
      border-top: 1px solid var(--border);
      padding: 12px;
      display: none;
      flex-direction: column;
      gap: 12px;
    }

    .drawer.open { display: flex; }

    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .chip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    }

    .chip input { margin: 0; accent-color: var(--accent); }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 2fr auto;
      gap: 6px;
    }

    input[type="text"], select {
      font: inherit;
      font-size: 12px;
      padding: 5px 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
    }

    .footer-note {
      padding: 6px 12px;
      border-top: 1px solid var(--border);
      font-size: 11px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="hud-shell" id="shell">
    <div class="hud-header">
      <div class="hud-title">
        <span class="pulse" id="pulse"></span>
        <span>STATUSLINE KIT</span>
      </div>
      <div class="hud-actions">
        <select id="themeSelect" title="Statusline theme">
          <option value="default">Default</option>
          <option value="minimal">Minimal</option>
          <option value="powerline">Powerline</option>
          <option value="no-color">Plain</option>
        </select>
        <button id="refreshBtn" type="button">Refresh</button>
        <button id="customizeBtn" type="button">Customize</button>
      </div>
    </div>

    <div class="statusline-preview" id="statuslineRows">
      <div class="statusline-row"><span class="segment c-gray">Loading live trackers…</span></div>
    </div>

    <div class="usage-card" id="usageMetrics"></div>

    <div class="drawer" id="drawer">
      <div>
        <div class="section-title">Active Trackers</div>
        <div class="chip-grid" id="trackerToggles"></div>
      </div>

      <div>
        <div class="section-title">Usage Tracker Options</div>
        <div class="chip-grid" id="usageOptionToggles"></div>
      </div>

      <div>
        <div class="section-title">Add Shell Command Tracker</div>
        <form class="form-grid" id="addTrackerForm">
          <input type="text" id="newTrackerId" placeholder="id (e.g. git-sha)" required />
          <input type="text" id="newTrackerCmd" placeholder="command (e.g. git rev-parse --short HEAD)" required />
          <button type="submit" class="primary">+ Add</button>
        </form>
      </div>
    </div>

    <div class="footer-note">
      <span id="statusMsg">Live HUD synced with Antigravity hooks</span>
      <span id="updatedAt"></span>
    </div>
  </div>

  <script>
    (function () {
      let rpcId = 1;
      const pending = new Map();
      let hostReady = false;
      let latestState = null;

      function postRpc(message) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(message, '*');
        }
      }

      function sendRequest(method, params) {
        return new Promise((resolve, reject) => {
          const id = rpcId++;
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error('Host RPC timeout: ' + method));
          }, 5000);
          pending.set(id, { resolve, reject, timer });
          postRpc({ jsonrpc: '2.0', id, method, params: params || {} });
        });
      }

      function notifySize() {
        const h = Math.min(800, Math.max(140, document.documentElement.scrollHeight));
        postRpc({
          jsonrpc: '2.0',
          method: 'ui/notifications/size-changed',
          params: { height: h },
        });
      }

      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.id !== undefined && pending.has(msg.id)) {
          const entry = pending.get(msg.id);
          pending.delete(msg.id);
          clearTimeout(entry.timer);
          if (msg.error) entry.reject(msg.error);
          else entry.resolve(msg.result);
          return;
        }
        if (msg.method === 'ui/notifications/tool-result' && msg.params?.structuredContent) {
          renderState(msg.params.structuredContent);
        }
      });

      function escapeHtml(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function formatTokens(n) {
        if (!n || n < 0) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(Math.round(n));
      }

      function renderState(data) {
        if (!data) return;
        latestState = data;

        const shell = document.getElementById('shell');
        const theme = data.config?.theme || 'default';
        shell.className = 'hud-shell theme-' + theme;
        document.getElementById('themeSelect').value = theme;

        // Render rows
        const rowsEl = document.getElementById('statuslineRows');
        const rows = Array.isArray(data.rows) ? data.rows : [];
        if (rows.length === 0) {
          rowsEl.innerHTML = '<div class="statusline-row"><span class="segment c-gray">No active tracker output yet</span></div>';
        } else {
          rowsEl.innerHTML = rows.map((row) => {
            const items = row.map((seg, idx) => {
              const cls = ['segment', seg.color ? 'c-' + seg.color : '', seg.bold ? 'bold' : ''].filter(Boolean).join(' ');
              const icon = seg.icon ? '<span>' + escapeHtml(seg.icon) + '</span>' : '';
              const sep = idx > 0 && theme !== 'powerline' ? '<span class="sep">│</span>' : '';
              return sep + '<span class="' + cls + '">' + icon + '<span>' + escapeHtml(seg.plainText) + '</span></span>';
            }).join('');
            return '<div class="statusline-row">' + items + '</div>';
          }).join('');
        }

        // Render built-in Usage Tracker summary metrics
        const u = data.usageSummary || {};
        const pct = Math.min(100, Math.max(0, Math.round(u.usedPercentage || 0)));
        const barColor = pct >= 85 ? 'var(--red)' : pct >= 60 ? 'var(--yellow)' : 'var(--green)';
        const usageEl = document.getElementById('usageMetrics');
        usageEl.innerHTML = [
          '<div class="metric">' +
            '<div class="metric-label">Context Window</div>' +
            '<div class="metric-value">' + pct + '%</div>' +
            '<div class="meter-track"><div class="meter-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
          '</div>',
          '<div class="metric">' +
            '<div class="metric-label">Tokens</div>' +
            '<div class="metric-value">' + formatTokens(u.totalTokens) + ' / ' + formatTokens(u.windowSize || 1048576) + '</div>' +
          '</div>',
          '<div class="metric">' +
            '<div class="metric-label">Session Cost</div>' +
            '<div class="metric-value">' + (u.costDisplay || '$0.00') + '</div>' +
          '</div>',
          '<div class="metric">' +
            '<div class="metric-label">Turns / Tools</div>' +
            '<div class="metric-value">' + (u.turnCount || 0) + ' / ' + (u.toolCallCount || 0) + '</div>' +
          '</div>',
        ].join('');

        // Render tracker toggles
        const activeIds = new Set((data.config?.lines || []).flat());
        const togglesEl = document.getElementById('trackerToggles');
        togglesEl.innerHTML = (data.availableTrackers || []).map((t) => {
          const checked = activeIds.has(t.id) ? 'checked' : '';
          return '<label class="chip"><input type="checkbox" data-tracker-id="' + escapeHtml(t.id) + '" ' + checked + ' />' + escapeHtml(t.id) + '</label>';
        }).join('');

        // Render usage option toggles
        const uOpts = data.config?.trackerOptions?.usage || {};
        const optLabels = [
          ['showBar', 'Progress Bar'],
          ['showTokens', 'Token Count'],
          ['showTokenBreakdown', 'In/Out Split'],
          ['showCacheRate', 'Cache Hit %'],
          ['showCost', 'Session Cost'],
          ['showQuota', 'Quota'],
        ];
        document.getElementById('usageOptionToggles').innerHTML = optLabels.map(([key, label]) => {
          const checked = uOpts[key] ? 'checked' : '';
          return '<label class="chip"><input type="checkbox" data-usage-opt="' + key + '" ' + checked + ' />' + label + '</label>';
        }).join('');

        document.getElementById('updatedAt').textContent = 'Updated ' + new Date().toLocaleTimeString();
        requestAnimationFrame(notifySize);
      }

      async function callTool(name, args) {
        if (!hostReady) return null;
        const res = await sendRequest('tools/call', { name, arguments: args || {} });
        if (res && res.structuredContent) {
          renderState(res.structuredContent);
        }
        return res;
      }

      async function refresh() {
        try {
          await callTool('get_statusline_state', {});
        } catch (err) {
          document.getElementById('statusMsg').textContent = 'Refresh paused: ' + (err?.message || 'disconnected');
        }
      }

      async function saveConfigPatch(patch) {
        document.getElementById('statusMsg').textContent = 'Saving configuration…';
        try {
          await callTool('update_statusline_config', patch);
          document.getElementById('statusMsg').textContent = 'Configuration saved';
        } catch (err) {
          document.getElementById('statusMsg').textContent = 'Save failed: ' + (err?.message || 'error');
        }
      }

      // Wire UI interactions
      document.getElementById('customizeBtn').addEventListener('click', () => {
        document.getElementById('drawer').classList.toggle('open');
        requestAnimationFrame(notifySize);
      });

      document.getElementById('refreshBtn').addEventListener('click', refresh);

      document.getElementById('themeSelect').addEventListener('change', (e) => {
        saveConfigPatch({ theme: e.target.value });
      });

      document.getElementById('trackerToggles').addEventListener('change', (e) => {
        const input = e.target;
        if (!input || !input.dataset.trackerId || !latestState) return;
        const id = input.dataset.trackerId;
        const lines = (latestState.config?.lines || [['state', 'model', 'workspace'], ['usage', 'activity']]).map((r) => [...r]);
        if (input.checked) {
          if (!lines.flat().includes(id)) {
            lines[lines.length - 1].push(id);
          }
        } else {
          for (let i = 0; i < lines.length; i++) {
            lines[i] = lines[i].filter((x) => x !== id);
          }
        }
        saveConfigPatch({ lines: lines.filter((r) => r.length > 0) });
      });

      document.getElementById('usageOptionToggles').addEventListener('change', (e) => {
        const input = e.target;
        if (!input || !input.dataset.usageOpt) return;
        saveConfigPatch({ usageOptions: { [input.dataset.usageOpt]: Boolean(input.checked) } });
      });

      document.getElementById('addTrackerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('newTrackerId').value.trim();
        const command = document.getElementById('newTrackerCmd').value.trim();
        if (!id || !command) return;
        await callTool('add_custom_tracker', { type: 'command', id, command, icon: '◆', color: 'cyan' });
        document.getElementById('newTrackerId').value = '';
        document.getElementById('newTrackerCmd').value = '';
      });

      // Initialize MCP Apps host bridge
      async function boot() {
        try {
          await sendRequest('ui/initialize', {
            appInfo: { name: 'statusline-kit', version: '1.0.0' },
            appCapabilities: {},
            protocolVersion: '2026-01-26',
          });
          hostReady = true;
          postRpc({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} });
          await refresh();
          setInterval(refresh, 3000);
        } catch {
          // Standalone browser preview fallback
          renderState({
            config: { theme: 'default', lines: [['state', 'model', 'workspace'], ['usage', 'activity']], trackerOptions: { usage: { showBar: true, showTokens: true, showCacheRate: true, showCost: true } } },
            availableTrackers: [{ id: 'state' }, { id: 'model' }, { id: 'workspace' }, { id: 'usage' }, { id: 'activity' }],
            usageSummary: { usedPercentage: 14, totalTokens: 149318, windowSize: 1048576, costDisplay: '$0.42', turnCount: 4, toolCallCount: 9 },
            rows: [
              [
                { icon: '●', plainText: 'READY', color: 'green', bold: true },
                { icon: '✦', plainText: 'Gemini 4 Argon (Medium)', color: 'brightCyan', bold: true },
                { icon: '📁', plainText: 'my-project (main)', color: 'blue' },
              ],
              [
                { plainText: '[█░░░░░░░░░] 14% 149k/1.0M', color: 'green' },
                { icon: '⚡', plainText: '25% cache', color: 'cyan' },
                { plainText: '$0.42', color: 'brightGreen' },
              ],
            ],
          });
        }
      }

      boot();
    })();
  </script>
</body>
</html>
`;
}
