import { isReplayFrame } from '../../replay/replay-frame.mjs';

export function readReplayFrameSource(frame) {
  if (!isReplayFrame(frame)) throw new TypeError('Expected ReplayFrame');
  return {
    mode: 'REPLAY',
    timestamp: new Date(frame.timestamp).toISOString(),
    source_id: String(frame.source_id),
    source: 'REPLAY_FRAME',
    source_updated_at: frame.source_freshness?.source_updated_at || null,
    received_at: new Date(frame.timestamp).toISOString(),
    payload: structuredClone(frame.raw_payload),
    replay_run_id: frame.metadata?.replay_run_id || null,
    metadata: structuredClone(frame.metadata || {})
  };
}
