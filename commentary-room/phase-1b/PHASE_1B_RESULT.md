# PHASE 1B RESULT — READ-ONLY DATA ADAPTER + LOCAL SOURCE PROBE

Status: **ADAPTER/TEST IMPLEMENTATION PASS; FINAL LOCAL-SOURCE AUDIT PENDING USER PROBE RUN.**

Phase 1B remains isolated from production. No legacy file, Edge Function, database schema, production API or UI was modified.

## 1. Implemented architecture

```text
REALTIME-LIKE LEGACY ROW          REPLAY FRAME
            |                         |
   legacy source reader       replay source reader
             \                       /
                 source envelope
                        |
                   HistoryBuffer
                        |
                     normalizer
                        |
     deterministic derivation layer
                        |
          freshness + provenance
                        |
          CommentaryMarketPacketV1
                        |
           validation + quality
                  /          \
        computation_view   commentary_view
```

The adapter is deterministic with respect to input + history. No downstream Market State, Event, Story or AI engine is included.

## 2. Safety boundary

Phase 1B code contains no production publish path. Safety tests scan the new source for production narrative/ingest/comment-write references and mutation methods.

Not changed:
- AmiBroker AFL;
- `ami-bridge/push-live-commentary-v3.ps1`;
- `market-live-ingest`;
- narrative V3/V4/V5/V6;
- `market-live-public`;
- frontend;
- production database/schema;
- `market_live_comments`.

No migration and no deploy were performed.

## 3. Adapter behavior

Supported input modes:
1. Phase 0 `ReplayFrame`;
2. realtime-style legacy snapshot object containing `captured_at/source_updated_at/payload`.

Missing data remains `null + quality=UNAVAILABLE`. No missing market value is silently converted to zero.

Provenance is attached to important metrics with:
- source;
- source_path;
- source_timestamp;
- received_at;
- freshness_seconds;
- freshness_status;
- quality;
- derived_from.

Allowed quality is exactly `EXACT / DERIVED_EXACT / APPROXIMATE / UNAVAILABLE`.

## 4. Technical availability

`technical_available=false` is authoritative for the current frame. Current technical metrics are `UNAVAILABLE`; stale/last-known data is not masqueraded as fresh current data.

## 5. Memory horizon validation

Legacy m5/m15/m30 is validated before use:
- m5 accepted only 210–450 seconds behind current;
- m15 accepted only 660–1140 seconds;
- m30 accepted only 1440–2160 seconds.

Same-current timestamp/value behavior observed in old snapshots is rejected as `INVALID_HORIZON`. Exact horizon metrics are derived from `HistoryBuffer` where possible.

## 6. Real historical derivation proof

A read-only real snapshot fixture from 14:10–14:40 on 15/09/2026 proves the adapter derives, at 14:40:
- VN-Index 5m move: 0.0000 points;
- VN-Index 15m move: +0.7399 points;
- VN-Index 30m move: +1.8601 points;
- value 5m: +103.553 billion VND cumulative difference;
- value 15m: +1,618.205 billion;
- value 30m: +3,100.818 billion;
- pace ratio 15m vs previous 15m: ~1.0915 (`STABLE`).

All are marked `DERIVED_EXACT` and include the source frame IDs used.

## 7. Freshness

Implemented by source family rather than one global timeout:
- realtime index/breadth;
- AFL technical;
- Watch List/local stock;
- derivatives;
- external context reserved separately.

After the Vietnam market closes, Vietnam market fields become `CLOSED_SNAPSHOT`, not falsely `STALE`. Absent external context remains `INVALID`; it is not marked closed because it has an independent future freshness clock.

## 8. Core completeness

The approved Phase 1A JSON Schema does not contain `core_completeness`, so Phase 1B does **not mutate the contract schema**. `buildAdapterResult()` returns a separate weighted quality object:

```text
quality.core_completeness
quality.missing_core_fields
quality.degraded_core_fields
```

A real 14:40 derivation fixture scores 84/100; missing in that deliberately compact fixture are stocks, derivatives, exact contribution and other indexes.

## 9. Computation vs commentary boundary

- `computation_view`: full `CommentaryMarketPacketV1` for deterministic engines.
- `commentary_view`: compressed market context (index/breadth/liquidity/top sectors/selected stocks/technical/derivatives) and no raw universe.

This prepares the future AI boundary without calling AI in Phase 1B.

## 10. Fixtures

Real:
- `historical-multi-phase-2026-09-15.json` — available cloud phases. It intentionally documents that cloud history starts around 09:46 VN, so an actual 09:00 OPENING fixture cannot be honestly produced from this source.
- `historical-atc-window-2026-09-15.json` — real dense history 14:10–14:40.

Synthetic:
- `synthetic-derivation.json` — explicitly test-only for deterministic math/boundary behavior.

No fake market values were added to fill missing historical periods.

## 11. Tests

Latest local run:

```text
tests 21
pass  21
fail  0
```

Coverage includes ReplayFrame→Packet, deterministic output, technical unavailable/stale behavior, invalid horizons, exact 5m/15m/30m derivations, breadth, sector rank, liquidity, provenance, freshness families, CLOSED market, completeness, legacy-style input, computation/commentary separation, safety scanning, and real historical ATC-window derivation.

## 12. Local Source Probe

Created a Windows PowerShell read-only tool that audits:
- AFL CSV headers/sample/types/nulls;
- one NDJSON archive session, frame cadence/field stability/technical coverage/memory horizon validity/sector+stock structures;
- GET-only `/stock/{symbol}` probes for VCB/VIC/FPT/HPG/SSI/PVD and all returned quote fields.

It writes only `commentary-local-source-audit.json`; it does not call Supabase or push production.

The cloud environment cannot execute it against `127.0.0.1` or the user's Windows files. Therefore `/stock` reference/ceiling/floor/OHL/value mappings remain `UNKNOWN` until the user runs the probe and returns the JSON.

## 13. Phase status

Everything that can be completed from cloud-visible/historical data in Phase 1B is implemented and tests pass.

**Do not mark the local-source audit as verified until the Windows probe has actually run.** Once its JSON is returned, only `UPDATED_DATA_GAPS.md`/mapping decisions should be updated; no automatic move to Market State/Event/Story is authorized.
