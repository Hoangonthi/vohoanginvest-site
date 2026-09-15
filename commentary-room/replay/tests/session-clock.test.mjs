import test from 'node:test';
import assert from 'node:assert/strict';
import { getSessionPhase } from '../session-clock.mjs';

const iso = (time) => `2026-09-15T${time}+07:00`;
const cases = [
  ['08:44:00','AFTER_HOURS'], ['08:45:00','PRE_MARKET'], ['08:55:00','PRE_MARKET'], ['08:59:59','PRE_MARKET'],
  ['09:00:00','OPENING'], ['09:15:00','EARLY_CONFIRMATION'], ['11:29:59','MORNING_CLOSE'], ['11:30:00','LUNCH_ANALYSIS'],
  ['12:45:00','AFTERNOON_PREVIEW'], ['13:00:00','AFTERNOON_REOPEN'], ['14:25:00','ATC_PHASE'], ['14:45:00','MARKET_CLOSE'],
  ['15:00:00','FLASH_RECAP'], ['15:20:00','AFTER_HOURS']
];

test('Session Clock boundary times are deterministic', () => {
  for (const [time, expected] of cases) assert.equal(getSessionPhase(iso(time)).phase, expected, time);
});

test('same timestamp always returns same phase object', () => {
  assert.deepEqual(getSessionPhase(iso('13:15:00')), getSessionPhase(iso('13:15:00')));
});
