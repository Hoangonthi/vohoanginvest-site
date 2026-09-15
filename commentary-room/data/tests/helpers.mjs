import { readFile } from 'node:fs/promises';
import { createReplayFrame, isReplayFrame } from '../../replay/replay-frame.mjs';

export async function loadFixture(name){
  const raw=JSON.parse(await readFile(new URL(`../fixtures/${name}`,import.meta.url),'utf8'));
  const rows=Array.isArray(raw)?raw:(raw.frames||raw.snapshots||[]);
  return rows.map((row,i)=>isReplayFrame(row)?structuredClone(row):createReplayFrame(row,{sequence:i+1,replay_speed:'MAX',replay_started_at:row.captured_at||row.timestamp,replay_run_id:'test-run'}));
}
