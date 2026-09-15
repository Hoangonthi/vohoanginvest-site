# Commentary Room Data Adapter — Phase 1B

Status: **READ ONLY / NOT CONNECTED TO PRODUCTION**.

This module turns either a Phase 0 `ReplayFrame` or a realtime-style legacy `market_live_snapshots` row into `CommentaryMarketPacketV1`. It does not call Supabase, does not invoke the legacy narrative chain, does not publish comments, and does not modify legacy payloads.

## Flow

```text
ReplayFrame                    Legacy snapshot row
    |                                  |
replay-frame-source            legacy-snapshot-source
    \                                  /
             source envelope
                    |
             HistoryBuffer
                    |
               normalizer
                    |
        deterministic derivations
                    |
       freshness + provenance
                    |
       CommentaryMarketPacketV1
                    |
        validation + quality
             /              \
   computation_view      commentary_view
```

The same adapter is used for replay and realtime-like data. There is no second market-logic implementation for replay.

## Quality

Only these quality labels are emitted:

- `EXACT`
- `DERIVED_EXACT`
- `APPROXIMATE`
- `UNAVAILABLE`

Missing values remain `null` with `quality=UNAVAILABLE`; they are never replaced by zero.

## History rules

`HistoryBuffer` is source-agnostic and provides:

- `getFrameAtOrBefore(timestamp)`
- `getPreviousFrame(timestamp)`
- `getWindow(from,to)`
- `getSessionFrames(sessionDate)`
- `getNearestAtOrBefore(timestamp,targetSecondsAgo,toleranceSeconds)`

Legacy `local_memory.m5/m15/m30` is validated rather than trusted. Current tolerances are:

- m5: 210–450 seconds behind current
- m15: 660–1140 seconds
- m30: 1440–2160 seconds

A same-current timestamp is `INVALID_HORIZON`. Deterministic derivations prefer actual history frames.

## Implemented DERIVED_EXACT metrics

- VN-Index move 1m / 5m / 15m / 30m when a valid historical frame exists;
- breadth balance delta 5m / 15m;
- cumulative traded value/volume interval differences 5m / 15m / 30m;
- liquidity pace ratio using latest 15m vs previous 15m;
- sector rank, rank change 5m / 15m, relative strength vs VN-Index;
- distance to support/resistance;
- derivatives basis/premium-discount only when both future and VN30 spot are available/aligned;
- session high/low time only when history is complete from the open.

No approximate index contribution is generated.

## Computation vs commentary view

`computation_view` is the full normalized contract packet needed by deterministic engines.

`commentary_view` is deliberately compressed and contains only the data likely to be relevant to a future language layer. It never contains the raw full universe.

## Core completeness

`buildAdapterResult()` returns a weighted quality object separately from the approved V1 packet schema:

```text
quality.core_completeness
quality.missing_core_fields
quality.degraded_core_fields
```

This is kept outside `CommentaryMarketPacketV1` in Phase 1B because the approved Phase 1A JSON Schema does not contain these fields and Phase 1B is not authorized to alter that schema.

## Fixtures

- `historical-multi-phase-2026-09-15.json` — read-only projections from real stored snapshots across available morning/afternoon/ATC/close phases. Cloud history begins around 09:46 VN, so no fake OPENING market fixture was created.
- `historical-atc-window-2026-09-15.json` — real 14:10–14:40 snapshot window for 5m/15m/30m derivation tests.
- `synthetic-derivation.json` — explicitly `SYNTHETIC_TEST_ONLY`; used only for deterministic math/boundary behavior.

## Run tests

From repository root:

```bash
node --test commentary-room/data/tests/*.test.mjs
```

The adapter has no production runner in Phase 1B by design.
