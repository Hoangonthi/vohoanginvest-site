# COMMENTARY ROOM — PRODUCTION BASELINE (PHASE 0)

Frozen: 2026-09-15. Purpose: document the current stable production path before building the new Commentary Room engines. Phase 0 is additive and read-only with respect to production.

## A. Current production flow

```text
AmiBroker
  -> local Ami bridge (127.0.0.1:8765)
  -> ami-bridge/push-live-commentary-v3.ps1
  -> market-live-ingest
  -> market-live-narrative-v6
      -> market-live-narrative-v5
          -> market-live-narrative-v4
              -> market-live-narrative-v3
  -> Supabase market_live_current / snapshots / events / comments
  -> market-live-public
  -> assets/js/market-live.js + auxiliary live modules
  -> binh-luan-thi-truong-truc-tiep.html
```

The bridge is local-first: Ami technical CSV + Watch Lists + local stock endpoint, local 5/15/30 minute memory, local archive, then compact cloud push. `market-live-ingest` is the authenticated production ingress/fallback path and currently targets V6.

## B. Critical production components

### Local / repository
- `amibroker/VH-Market-Live-Snapshot.afl` — VN-Index technical CSV exporter.
- `ami-bridge/push-live-commentary-v3.ps1` — reads AFL snapshot, 21 sector Watch Lists, local stock quotes, local memory/archive, pushes live payload.
- Local endpoint `http://127.0.0.1:8765/stock/{symbol}` — stock quote source used by bridge.
- Local archive: `ami-bridge/live-data/YYYY-MM-DD/market-live.ndjson` and `latest.json` on the user's machine.

### Production Edge Functions
- `market-live-ingest` — authenticated ingress, cloud-memory hydration, fallback storage; target is V6.
- `market-live-narrative-v6` — second-chance/session-phase/ATC/end-session layer.
- `market-live-narrative-v5` — focused one-story commentary and >=200,000 share stock eligibility.
- `market-live-narrative-v4` — rotation/dedup/quiet-period topic layer.
- `market-live-narrative-v3` — normalize/world model/event detection/storage layer.
- `market-live-public` — public read API for current state, comments, derivatives.

### Production tables
- `market_live_current`
- `market_live_snapshots`
- `market_live_events`
- `market_live_comments`
- `market_live_commentary_state`
- `market_live_background_topics`
- `market_live_ecosystems`
- `market_live_ecosystem_relations`
- `market_live_admin_notes`
- `market_live_comment_revisions`
- `market_live_user_comments`

### Production frontend
- `binh-luan-thi-truong-truc-tiep.html`
- `assets/js/market-live.js`
- `assets/js/market-live-dual-stream.js`
- `assets/js/market-live-layout-community.js`
- live additions inside `assets/js/site-header.js`

## C. DO_NOT_TOUCH_PHASE_0_TO_8

The following are frozen unless a later approved phase explicitly changes the boundary:

- `amibroker/VH-Market-Live-Snapshot.afl`
- `ami-bridge/push-live-commentary-v3.ps1`
- `market-live-ingest`
- `market-live-narrative-v3`
- `market-live-narrative-v4`
- `market-live-narrative-v5`
- `market-live-narrative-v6`
- `market-live-public`
- all existing `market_live_*` production table schemas
- `market_live_comments` production write path
- `assets/js/market-live.js`
- `assets/js/market-live-dual-stream.js`
- `assets/js/market-live-layout-community.js`
- `assets/js/site-header.js`
- `binh-luan-thi-truong-truc-tiep.html`

No refactor, cutover, schema mutation, or production publish is part of Phase 0.

## D. Rollback boundary

Phase 0 introduces only `commentary-room/` files. The replay harness has no production network path and no database write capability.

Rollback is therefore:
1. stop any local replay process;
2. delete or ignore `commentary-room/`;
3. legacy production continues unchanged because no production file, Edge Function, route, table, or UI is modified.

No data rollback is required for Phase 0.

## E. Baseline verification on 2026-09-15

Read-only production checks at the freeze point:
- `market_live_snapshots`: 274 rows for 2026-09-15; first `02:46:57Z` (~09:46 VN), last `08:01:46Z` (~15:01 VN).
- `market_live_comments`: 48 rows for 2026-09-15; latest observed `07:59:21Z` (~14:59 VN).
- A stored segment from ~14:39–14:44 VN contains current VN-Index, breadth, flow, technical fields and sector Watch List data and is replayable in timestamp order.
- Production current snapshot and commentary were still updating while the Phase 0 source was read. Phase 0 performs no write against these tables.
- `market-live-public` remains the production read boundary and the existing page remains the production render boundary. Neither is modified by Phase 0.

## Replay source assessment

### 1. Local archive — highest raw temporal fidelity, preferred when available on the user's machine
Known from the existing bridge: `ami-bridge/live-data/YYYY-MM-DD/market-live.ndjson`, raw cadence around 15 seconds, retention configured by the legacy bridge. This archive is local to the trading machine and is not required for the Phase 0 fixture in GitHub.

### 2. `market_live_snapshots` — preferred shared Phase 0 replay source
Reasons:
- immutable historical rows with `id`, `captured_at`, `source`, `source_updated_at`, `payload`;
- already ordered by market time;
- accessible read-only without changing production;
- enough data to prove replay sequencing and future adapter plumbing.

### 3. `market_live_current` — not a replay source
It is only the latest state, useful for realtime but insufficient for historical sequence reconstruction.

## Known source gaps for a complete future replay

The current cloud snapshots are sufficient for Phase 0 plumbing, but not yet a complete Phase 1+ market data contract. Depending on snapshot vintage, the cloud payload does not consistently contain:
- complete per-symbol reference / ceiling / floor / open / high / low / last for every stock;
- full-market stock list (cloud sector payload mainly carries top gainers/losers, not all ~594 symbols);
- per-stock technical levels/indicators for all symbols;
- top volume / top value list across the whole market independent of sector top-3;
- exact top positive/negative VN-Index contribution values;
- foreign-flow change series;
- MA100 / MA200 breadth and per-symbol technical state;
- exact timestamp when session high/low was first made;
- complete 1m/5m/15m volume buckets and same-time historical baseline on all stored rows;
- reference/ceiling/floor state required to assert AT_CEILING/AT_FLOOR for each stock.

These gaps are documented only. Phase 0 does not change AmiBroker, the bridge, or production schemas.

## Phase 0 isolation rule

The Replay Harness consumes only local JSON/NDJSON files. It has no HTTP client path to production. Future engines must receive the same `ReplayFrame`/realtime frame interface through a Data Adapter; replay must never become a second copy of market logic.
