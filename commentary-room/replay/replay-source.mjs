import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { createReplayFrame, isReplayFrame } from './replay-frame.mjs';

function parseRows(text, extension) {
  if (extension === '.ndjson' || extension === '.jsonl') {
    return text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).map((line) => JSON.parse(line));
  }
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.snapshots)) return parsed.snapshots;
  if (Array.isArray(parsed?.frames)) return parsed.frames;
  throw new TypeError('fixture must be an array or contain snapshots[]/frames[]');
}

export async function loadReplaySource(filePath, options = {}) {
  const text = await readFile(filePath, 'utf8');
  const rows = parseRows(text, extname(filePath).toLowerCase());
  const replayStartedAt = options.replay_started_at || new Date().toISOString();
  const speed = options.speed || 'MAX';
  const normalized = rows.map((row, originalIndex) => {
    const frame = isReplayFrame(row)
      ? structuredClone(row)
      : createReplayFrame(row, { replay_started_at: replayStartedAt, replay_speed: speed });
    return { frame, originalIndex };
  });
  normalized.sort((a, b) => {
    const dt = new Date(a.frame.timestamp).getTime() - new Date(b.frame.timestamp).getTime();
    if (dt) return dt;
    const byId = String(a.frame.source_id).localeCompare(String(b.frame.source_id));
    return byId || a.originalIndex - b.originalIndex;
  });
  const frames = normalized.map(({ frame }, index) => ({
    ...frame,
    metadata: { ...frame.metadata, sequence: index + 1, replay_speed: speed, replay_started_at: replayStartedAt }
  }));
  return { frames, source_text: text };
}

export function filterReplayFrames(frames, { from = null, to = null } = {}) {
  const fromMs = from ? new Date(from).getTime() : -Infinity;
  const toMs = to ? new Date(to).getTime() : Infinity;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) throw new TypeError('from/to must be valid timestamps');
  return frames.filter((f) => {
    const t = new Date(f.timestamp).getTime();
    return t >= fromMs && t <= toMs;
  }).map((f, i) => ({ ...f, metadata: { ...f.metadata, sequence: i + 1 } }));
}
