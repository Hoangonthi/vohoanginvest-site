# PHASE 1B IMPLEMENTATION PLAN — DESIGN ONLY

This is a planning deliverable produced by Phase 1A. **Do not implement Phase 1B automatically.**

## 1. Goal

Build a read-only Data Adapter that converts existing REALTIME or REPLAY sources into `CommentaryMarketPacketV1` without changing legacy producers, payloads, tables, narrative functions or production UI.

```text
LEGACY DATA (READ ONLY)
        ↓
Commentary Data Adapter
        ↓
CommentaryMarketPacketV1
        ↓
Future engines
```

No legacy cutover is part of the first implementation step.

---

## 2. Non-negotiable protections

Phase 1B implementation must begin with these constraints:
- no changes to `ami-bridge/push-live-commentary-v3.ps1` unless separately approved later;
- no changes to Ami AFL unless a directly audited P1/P0 field truly has no other source;
- no changes to `market-live-ingest`;
- no changes to `market-live-public`;
- no changes to V3/V4/V5/V6 narrative chain;
- no changes to production frontend;
- no schema changes to legacy tables;
- no production commentary writes;
- no migration by default;
- no V7;
- no AI/Event/Story implementation inside Data Adapter;
- no Global News Radar implementation.

Rollback must remain: stop/remove new adapter module; legacy production continues unchanged.

---

## 3. Proposed new-module layout

All paths are proposals only for future approval.

```text
commentary-room/
  adapter/
    commentary-data-adapter.mjs
    sources/
      replay-source-adapter.mjs
      market-live-source-adapter.mjs
      market-realtime-source-adapter.mjs
      derivatives-source-adapter.mjs
      local-archive-source-adapter.mjs
    normalizers/
      index-normalizer.mjs
      breadth-normalizer.mjs
      liquidity-normalizer.mjs
      sector-normalizer.mjs
      stock-normalizer.mjs
      technical-normalizer.mjs
      derivatives-normalizer.mjs
    calculations/
      history-window.mjs
      liquidity-calculations.mjs
      sector-rank.mjs
      technical-distance.mjs
      derivative-basis.mjs
    provenance/
      provenance.mjs
      freshness-policy.mjs
      quality-policy.mjs
    compression/
      commentary-packet-selector.mjs
    validation/
      commentary-contract-validator.mjs
    tests/
      fixtures/
      *.test.mjs
```

No existing path must be modified to create these files.

---

## 4. Implementation sequence

### Step 1 — Contract validator only
- Load `commentary-data-contract-v1.schema.json`.
- Create local validation tests.
- No source connection yet.

Exit gate:
- valid packet fixture passes;
- invalid null/zero/timestamp/quality examples fail as expected.

### Step 2 — Replay Adapter first
Input:
- Phase 0 `ReplayFrame`.

Output:
- `CommentaryMarketPacketV1`.

Why first:
- deterministic;
- safe;
- repeatable;
- no production dependency;
- same adapter interface can later accept realtime source frames.

Exit gate:
- same replay frame sequence produces byte-stable logical packet values excluding intentionally variable `generated_at` if configured;
- no network/write path.

### Step 3 — Normalize audited legacy live payload read-only
Read from an externally supplied frame/object rather than calling production inside core adapter.

Normalize:
- VN-Index;
- technical;
- breadth;
- 21 sectors;
- selected stocks;
- local memory.

Exit gate:
- actual 2026-09-15 fixtures at morning/afternoon/ATC map correctly;
- technical false does not synthesize O/H/L/MA data;
- null never becomes zero.

### Step 4 — Historical window calculator
Implement exact lookup:
- 1m;
- 5m;
- 15m;
- 30m.

Rules:
- nearest timestamp tolerance explicitly configured;
- same session/date required;
- memory object accepted only if its timestamp proves requested horizon;
- otherwise history lookup fallback;
- if no valid prior frame: null + `UNAVAILABLE`, never current=current fallback.

Exit gate:
- early-session duplicate-memory fixture is rejected;
- afternoon valid 5m/15m fixture passes.

### Step 5 — Market realtime source adapter
Read-only projection of:
- VN-Index/VN30/HNX/UPCoM values;
- market total volume/value;
- index breadth;
- VN30 stock list when needed.

Do not pass raw provider payload downstream.

Exit gate:
- source timestamp and received timestamp retained;
- index source family freshness policy tested.

### Step 6 — Liquidity calculation layer
Calculate only when sufficient history exists:
- value 5m/15m/30m;
- volume 5m/15m/30m where cumulative volume history is available;
- pace ratio;
- acceleration/slowdown;
- same-time 5d/20d ratios when baseline count threshold is met.

Exit gate:
- no baseline claim when fewer than required sessions exist;
- cumulative series reset/session discontinuities rejected.

### Step 7 — Sector calculation layer
From audited 21-sector data:
- rank;
- rank change 5m/15m;
- relative performance vs VN-Index;
- coverage guard;
- top leaders/laggards compression.

Optional local-only calculation, if source data is supplied:
- aggregate sector volume from Watch List membership + existing stock cumulative volume.

Do not create exact sector traded value unless an exact source exists.

### Step 8 — Derivatives adapter
Map existing:
- VN30F1M last;
- trend;
- system/reversal/targets.

Derive:
- basis;
- premium/discount.

Guard:
- spot/future timestamp alignment threshold.

No OI/volume claim until source exists.

### Step 9 — Provenance and freshness enforcement
Every metric gets:
- source;
- source path;
- source timestamp;
- received time;
- age;
- freshness status;
- quality;
- derived_from.

Quality guard tests must prove:
- approximate contribution cannot pass an exact-contribution requirement;
- stale derivative cannot be described as realtime;
- technical false invalidates technical metrics only, not entire packet.

### Step 10 — Compression selector
Input: full computation packet.

Output: bounded AI/context projection containing only:
- current market core;
- relevant 5m/15m changes;
- top sector leaders/laggards;
- material stocks;
- nearest technical zones;
- fresh derivatives;
- enabled external context later.

The selector must not produce prose.

### Step 11 — Shadow-only realtime harness
Only after replay tests pass.

A future shadow runner may:
- read current legacy sources;
- generate packet;
- log packet locally/test storage;
- compare realtime vs replay behavior.

It must **not** publish commentary or call production narrative chain.

### Step 12 — Audit gaps before touching local producer
Only after adapter proves what is still impossible:
- directly inspect `/stock/{symbol}` actual response on the user's machine;
- directly inspect current CSV/local archive sample;
- confirm whether reference/ceiling/floor/OHL already exist upstream but are discarded.

Only then propose any local producer/Ami change.

---

## 5. Proposed data-source priority

### VN-Index technical truth
1. fresh `AMI_AFL` technical snapshot;
2. market realtime value for current last/change/pct if AFL unavailable;
3. no synthetic technical field.

### Index current/breadth/liquidity
1. `MARKET_REALTIME` for index/value/volume/breadth;
2. live normalized snapshot if realtime source unavailable and fresh enough.

### Intraday history
1. local 15s archive when running locally/replay source available;
2. `market_live_snapshots` cloud history;
3. local-memory shortcut only if timestamp validates requested horizon.

### Sector/stock
1. 21 Watch List aggregation/current local quote snapshot;
2. persisted selected sector data for replay/cloud fallback.

### Derivatives
1. `market_derivatives_snapshot` / local derivative producer.

No source may silently overwrite a higher-priority source without provenance recording.

---

## 6. Proposed read-only interfaces

### Generic realtime frame

```js
{
  timestamp,
  source_id,
  raw_payload,
  source_freshness
}
```

Same conceptual shape as Phase 0 `ReplayFrame`.

### Adapter interface

```js
await adapter.buildPacket(frame, {
  historyProvider,
  auxiliarySources,
  sessionClock
})
```

Realtime and replay differ only in source providers, not market logic.

---

## 7. Required Phase 1B tests

Minimum future test gate:

1. Replay and realtime fixture of same raw state normalize to same market values.
2. No legacy mutation.
3. No production write.
4. No call to narrative chain.
5. Schema validation PASS.
6. Null does not become zero.
7. `technical_available=false` invalidates technical block correctly.
8. Duplicate m5/m15/m30 timestamp is rejected.
9. Valid 5m/15m historical calculation deterministic.
10. Sector rank/rank change deterministic.
11. Liquidity delta deterministic.
12. Insufficient 5d/20d baseline remains unavailable.
13. Derivative basis requires timestamp alignment.
14. Exact contribution remains unavailable with current fixtures.
15. Stock ceiling/floor comment capability remains disabled without exact fields.
16. Closed Vietnam snapshot stays frozen while external context clock may advance.
17. Compression packet has bounded stock/sector counts.
18. Existing production can continue while adapter/replay runs independently.

---

## 8. No-migration strategy

Phase 1B should initially use:
- local files;
- replay fixtures;
- in-memory history provider;
- read-only production queries/source calls;
- temporary local output/logs.

Do not create a new database table unless a later need is demonstrated.

If persistence becomes necessary, first propose schema and retention separately. Do not apply it automatically.

---

## 9. Gap-routing rule

For every missing field:

```text
Is it already exact in an existing source?
  YES → Adapter maps it.
  NO
   ↓
Can it be derived exactly from existing history/current data?
  YES → deterministic calculation.
  NO
   ↓
Is it required for V1 safety/quality?
  NO → leave Extended/null.
  YES
   ↓
Propose smallest new input source.
```

AmiBroker should be the last step, not the default answer.

---

## 10. Proposed Phase 1B PASS condition

Phase 1B should not be considered PASS unless:
- `CommentaryMarketPacketV1` can be built from replay fixtures;
- same adapter can build it from read-only realtime input;
- provenance/freshness/quality are present;
- core 5m/15m/breadth/sector/liquidity/technical behavior is deterministic;
- missing exact fields correctly disable dependent comment types;
- no legacy code/schema/payload changed;
- no production comment was published;
- replay and production remain independent;
- rollback is delete/stop the adapter module.

After Phase 1B implementation, stop for review before Market State/Event/Memory/Story work.
