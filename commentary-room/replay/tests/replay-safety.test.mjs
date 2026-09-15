import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const files = ['../replay-frame.mjs','../session-clock.mjs','../replay-source.mjs','../replay-runner.mjs','../cli.mjs'];
const forbidden = ['market_live_comments', 'market-live-narrative', 'market-live-ingest', 'supabase.co/functions', 'fetch('];

test('Phase 0 replay code has no production write/publish/network path', async () => {
  for (const rel of files) {
    const text = await readFile(resolve(here, rel), 'utf8');
    for (const token of forbidden) assert.equal(text.includes(token), false, `${rel} contains forbidden token ${token}`);
  }
});
