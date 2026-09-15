const FRESH_SECONDS = 60;
const DELAYED_SECONDS = 180;

function asIso(value, field) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid timestamp`);
  return d.toISOString();
}

function vietnamDate(iso) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(iso));
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function deriveSourceFreshness(timestamp, sourceUpdatedAt = null) {
  const captured = new Date(asIso(timestamp, 'timestamp')).getTime();
  if (!sourceUpdatedAt) return { status: 'UNKNOWN', age_seconds: null, source_updated_at: null };
  const sourceIso = asIso(sourceUpdatedAt, 'source_updated_at');
  const ageSeconds = Math.max(0, (captured - new Date(sourceIso).getTime()) / 1000);
  return {
    status: ageSeconds <= FRESH_SECONDS ? 'FRESH' : ageSeconds <= DELAYED_SECONDS ? 'DELAYED' : 'STALE',
    age_seconds: Math.round(ageSeconds * 1000) / 1000,
    source_updated_at: sourceIso
  };
}

export function createReplayFrame(snapshot, metadata = {}) {
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('snapshot must be an object');
  const timestamp = asIso(snapshot.timestamp ?? snapshot.captured_at, 'timestamp');
  const sourceId = String(snapshot.source_id ?? snapshot.id ?? `${snapshot.source || 'snapshot'}:${timestamp}`);
  const rawPayload = structuredClone(snapshot.raw_payload ?? snapshot.payload ?? snapshot);
  const replayStartedAt = metadata.replay_started_at ? asIso(metadata.replay_started_at, 'replay_started_at') : new Date().toISOString();
  return {
    timestamp,
    source_id: sourceId,
    raw_payload: rawPayload,
    source_freshness: snapshot.source_freshness ?? deriveSourceFreshness(timestamp, snapshot.source_updated_at),
    metadata: {
      session_date: metadata.session_date || vietnamDate(timestamp),
      sequence: Number.isInteger(metadata.sequence) ? metadata.sequence : null,
      replay_speed: metadata.replay_speed || 'MAX',
      replay_started_at: replayStartedAt
    }
  };
}

export function isReplayFrame(value) {
  return Boolean(value && typeof value === 'object' && value.timestamp && value.source_id && 'raw_payload' in value && value.metadata);
}
