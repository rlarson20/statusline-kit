#!/usr/bin/env node
import { recordHookEvent } from '../src/telemetry.ts';

async function run() {
  const eventName = process.argv[2] ?? 'Unknown';
  let raw = '';
  if (!process.stdin.isTTY) {
    for await (const chunk of process.stdin) {
      raw += chunk.toString('utf8');
    }
  }
  let payload = {};
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        payload = parsed;
      }
    } catch {
      // ignore malformed hook stdin
    }
  }
  recordHookEvent(eventName, payload);
  process.stdout.write('{}\n');
}

run().catch(() => {
  process.stdout.write('{}\n');
});
