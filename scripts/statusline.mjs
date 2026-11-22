#!/usr/bin/env node
import { main } from '../src/cli.ts';

main().catch(() => {
  // Exit cleanly on unexpected error so Antigravity CLI does not disable the status line.
});
