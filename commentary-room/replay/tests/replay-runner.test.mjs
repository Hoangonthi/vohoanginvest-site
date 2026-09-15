import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadReplaySource } from '../replay-source.mjs';
import { ReplayRunner } from '../replay-runner.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, '../fixtures/2026-09-15-sample.json');
const sha = (x) => createHash('sha256').update(x).digest('hex');

async function source() { return loadReplaySource(fixture, { speed: 'MAX', replay_started_at: '2026-09-15T08:30:00.000Z' }); }

test('replay source is read-only and deterministic', async () => {
  const before = await readFile(fixture, 'utf8');
  const a = await source(); const b = await source();
  assert.deepEqual(a.frames.map((x) => [x.timestamp, x.source_id, x.metadata.sequence]), b.frames.map((x) => [x.timestamp, x.source_id, x.metadata.sequence]));
  const after = await readFile(fixture, 'utf8');
  assert.equal(sha(before), sha(after));
});

test('MAX replay processes a stored historical segment in order', async () => {
  const { frames } = await source();
  const seen = [];
  const runner = new ReplayRunner(frames, { speed: 'MAX', onFrame: async (f) => { seen.push(f.source_id); return null; } });
  const log = await runner.start();
  assert.equal(log.frames_processed, frames.length);
  assert.equal(log.errors.length, 0);
  assert.deepEqual(seen, frames.map((f) => f.source_id));
});

test('pause, step and resume operate without changing frame order', async () => {
  const { frames } = await source();
  const seen = [];
  const runner = new ReplayRunner(frames, { speed: 'MAX', onFrame: async (f) => { seen.push(f.source_id); } });
  assert.equal(runner.pause(), true);
  await runner.step();
  assert.equal(seen.length, 1);
  assert.equal(runner.state, 'paused');
  const completion = runner._completion;
  assert.equal(runner.resume(), true);
  const log = await completion;
  assert.equal(log.frames_processed, frames.length);
  assert.deepEqual(seen, frames.map((f) => f.source_id));
});

test('jump_to_time moves cursor to first frame at or after target', async () => {
  const { frames } = await source();
  const runner = new ReplayRunner(frames, { speed: 'MAX' });
  const cursor = runner.jumpToTime('2026-09-15T07:42:00.000Z');
  assert.equal(frames[cursor].source_id, '230');
});
