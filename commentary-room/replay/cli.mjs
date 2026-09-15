#!/usr/bin/env node
import { resolve } from 'node:path';
import { loadReplaySource, filterReplayFrames } from './replay-source.mjs';
import { ReplayRunner, REPLAY_SPEEDS } from './replay-runner.mjs';
import { getSessionPhase } from './session-clock.mjs';

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    out[name] = !next || next.startsWith('--') ? true : argv[++i];
  }
  return out;
}

function vietnamIso(sessionDate, clock) {
  if (!clock) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(clock)) return new Date(clock).toISOString();
  const normalized = /^\d{2}:\d{2}$/.test(clock) ? `${clock}:00` : clock;
  return new Date(`${sessionDate}T${normalized}+07:00`).toISOString();
}

const args = argsOf(process.argv.slice(2));
if (!args.file) {
  console.error('Usage: node commentary-room/replay/cli.mjs --file <json|ndjson> [--speed 1x|4x|12x|30x|MAX] [--from HH:mm] [--to HH:mm] [--output path]');
  process.exit(2);
}
const speed = String(args.speed || 'MAX');
if (!(speed in REPLAY_SPEEDS)) throw new RangeError(`Unsupported speed: ${speed}`);
const replayStartedAt = new Date().toISOString();
const source = await loadReplaySource(resolve(String(args.file)), { speed, replay_started_at: replayStartedAt });
const sessionDate = source.frames[0]?.metadata?.session_date;
if (!sessionDate) throw new Error('Replay source is empty');
const frames = filterReplayFrames(source.frames, {
  from: args.from ? vietnamIso(sessionDate, String(args.from)) : null,
  to: args.to ? vietnamIso(sessionDate, String(args.to)) : null
});
if (!frames.length) throw new Error('No frames remain after time filter');
const output = args.output ? resolve(String(args.output)) : null;
const runner = new ReplayRunner(frames, {
  speed,
  logPath: output,
  onFrame: async (frame) => {
    const clock = getSessionPhase(frame.timestamp);
    const v = frame.raw_payload?.market?.vnindex || {};
    console.log(`[${String(frame.metadata.sequence).padStart(3, '0')}] ${clock.local_time} ${clock.phase} source=${frame.source_id} VNIndex=${v.value ?? '—'}`);
    return { session_phase: clock.phase };
  }
});
const log = await runner.start();
console.log(`REPLAY PASS run_id=${log.run_id} frames=${log.frames_processed}/${log.frames_total} errors=${log.errors.length}`);
if (output) console.log(`Log: ${output}`);
