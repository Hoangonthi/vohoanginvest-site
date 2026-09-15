function isoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function readLegacySnapshotSource(row, options = {}) {
  if (!row || typeof row !== 'object') throw new TypeError('Legacy snapshot must be an object');
  const payload = row.payload ?? row.raw_payload ?? row;
  const timestamp = isoOrNull(row.captured_at ?? row.timestamp ?? payload.captured_at);
  if (!timestamp) throw new TypeError('Legacy snapshot requires captured_at/timestamp');
  return {
    mode: options.mode || 'REALTIME',
    timestamp,
    source_id: String(row.id ?? row.source_id ?? `legacy:${timestamp}`),
    source: options.source || 'MARKET_LIVE_SNAPSHOT',
    source_updated_at: isoOrNull(row.source_updated_at ?? payload.source_updated_at),
    received_at: isoOrNull(row.captured_at ?? row.timestamp) || timestamp,
    payload: structuredClone(payload),
    replay_run_id: options.replay_run_id || null,
    metadata: structuredClone(options.metadata || {})
  };
}
