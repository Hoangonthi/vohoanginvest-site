export const SESSION_PHASES = Object.freeze([
  { phase: 'PRE_MARKET', start: '08:45:00', end: '09:00:00' },
  { phase: 'OPENING', start: '09:00:00', end: '09:15:00' },
  { phase: 'EARLY_CONFIRMATION', start: '09:15:00', end: '09:30:00' },
  { phase: 'MORNING_STRUCTURE', start: '09:30:00', end: '10:30:00' },
  { phase: 'MORNING_LATE', start: '10:30:00', end: '11:25:00' },
  { phase: 'MORNING_CLOSE', start: '11:25:00', end: '11:30:00' },
  { phase: 'LUNCH_ANALYSIS', start: '11:30:00', end: '12:45:00' },
  { phase: 'AFTERNOON_PREVIEW', start: '12:45:00', end: '13:00:00' },
  { phase: 'AFTERNOON_REOPEN', start: '13:00:00', end: '13:15:00' },
  { phase: 'AFTERNOON_MAIN', start: '13:15:00', end: '14:00:00' },
  { phase: 'DECISION_PHASE', start: '14:00:00', end: '14:25:00' },
  { phase: 'ATC_PHASE', start: '14:25:00', end: '14:45:00' },
  { phase: 'MARKET_CLOSE', start: '14:45:00', end: '15:00:00' },
  { phase: 'FLASH_RECAP', start: '15:00:00', end: '15:05:00' },
  { phase: 'POST_MARKET', start: '15:05:00', end: '15:20:00' }
]);

function toSecondOfDay(clock) {
  const [h, m, s] = clock.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function vietnamParts(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) throw new TypeError('timestamp must be valid');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    session_date: `${get('year')}-${get('month')}-${get('day')}`,
    local_time: `${get('hour')}:${get('minute')}:${get('second')}`,
    second_of_day: Number(get('hour')) * 3600 + Number(get('minute')) * 60 + Number(get('second'))
  };
}

export function getSessionPhase(timestamp) {
  const local = vietnamParts(timestamp);
  const match = SESSION_PHASES.find((x) => local.second_of_day >= toSecondOfDay(x.start) && local.second_of_day < toSecondOfDay(x.end));
  if (!match) {
    return {
      phase: 'AFTER_HOURS', session_date: local.session_date, local_time: local.local_time,
      phase_started_at: null, phase_ends_at: null, seconds_to_next_phase: null
    };
  }
  return {
    phase: match.phase,
    session_date: local.session_date,
    local_time: local.local_time,
    phase_started_at: match.start,
    phase_ends_at: match.end,
    seconds_to_next_phase: Math.max(0, toSecondOfDay(match.end) - local.second_of_day)
  };
}
