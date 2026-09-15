# Commentary Room Replay Harness — Phase 0

Replay Harness is an isolated, local-only test module. It does not call Supabase, production Edge Functions, the narrative chain, or the website.

## ReplayFrame

Each historical source row becomes:

```text
timestamp
source_id
raw_payload
source_freshness
metadata.session_date
metadata.sequence
metadata.replay_speed
metadata.replay_started_at
```

The future Data Adapter can consume this frame exactly as it can consume a realtime frame. Replay does not implement a separate market logic path.

## Speeds and controls

Supported speeds: `1x`, `4x`, `12x`, `30x`, `MAX`.

`ReplayRunner` exposes `pause()`, `resume()`, `step()`, `jumpToTime(timestamp)`, and `setSpeed(speed)`.

## Run sample

```bash
node commentary-room/replay/cli.mjs --file commentary-room/replay/fixtures/2026-09-15-sample.json --speed MAX --from 14:39 --to 14:44 --output commentary-room/replay/output/replay-2026-09-15.json
```

Run tests:

```bash
node --test commentary-room/replay/tests/*.test.mjs
```

## Safety boundary

Phase 0 source modules contain no network calls. They only read local fixture/archive files and optionally write a local replay log. No production commentary table or narrative endpoint is referenced.
