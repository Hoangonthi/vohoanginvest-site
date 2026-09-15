# COMMENTARY DATA CONTRACT V1 — PHASE 1A

Status: design only. This document does not authorize implementation, migration, deployment or production integration.

Contract name: **`CommentaryMarketPacketV1`**

Purpose: create one stable, provenance-aware packet that a future Data Adapter can produce from either REALTIME or REPLAY input without exposing the Commentary Room to legacy payload structure.

```text
REALTIME SOURCE           REPLAY SOURCE
       \                     /
        \                   /
         -> READ-ONLY DATA ADAPTER
                   ↓
       CommentaryMarketPacketV1
                   ↓
      future Market State / Event / Memory / Story
```

The same downstream engines consume the same packet shape. Replay is not a second market-logic implementation.

---

## 1. Design principles

1. Legacy payloads remain untouched.
2. Every market value carries provenance and quality.
3. `EXACT`, `DERIVED_EXACT`, `APPROXIMATE` and unavailable are not interchangeable.
4. Every real-time value has its own source timestamp/freshness family.
5. Closed Vietnam market state and live external context use separate freshness clocks.
6. Core V1 must work even if Extended fields are absent.
7. Missing exact contribution/foreign/limit-state data must suppress those comment types, not block the whole packet.
8. The packet is compressed for commentary. Raw computation data remains queryable outside the AI prompt.
9. No text-generation rules live in the Data Contract.
10. `null` means unavailable/not valid, never silently zero.

---

## 2. Common value envelope

Every scalar/list capability that can influence commentary should expose provenance.

### Exact raw value

```json
{
  "value": 1811.3,
  "provenance": {
    "source": "AMI_AFL",
    "source_path": "technical.value",
    "source_timestamp": "2026-09-15T07:40:00.091Z",
    "received_at": "2026-09-15T07:40:00.364Z",
    "freshness_seconds": 0.273,
    "freshness_status": "FRESH",
    "quality": "EXACT",
    "derived_from": []
  }
}
```

### Derived exact value

```json
{
  "value": 0.74,
  "provenance": {
    "source": "CALCULATED",
    "source_path": "indexes.vnindex.delta_15m",
    "source_timestamp": "2026-09-15T07:40:00.364Z",
    "received_at": "2026-09-15T07:40:00.364Z",
    "freshness_seconds": 0,
    "freshness_status": "FRESH",
    "quality": "DERIVED_EXACT",
    "derived_from": [
      "frame:2026-09-15T07:40:00.364Z:index.vnindex.last",
      "frame:2026-09-15T07:25:05.420Z:index.vnindex.last"
    ]
  }
}
```

### Approximate value

```json
{
  "value": null,
  "provenance": {
    "source": "CALCULATED",
    "source_path": "contributions.qualitative",
    "source_timestamp": null,
    "received_at": null,
    "freshness_seconds": null,
    "freshness_status": "INVALID",
    "quality": "APPROXIMATE",
    "derived_from": []
  }
}
```

The AI layer must never be allowed to reinterpret `APPROXIMATE` as `EXACT`.

---

## 3. Proposed top-level structure

Actual audited data supports the following V1 shape:

```json
{
  "contract_version": "1.0",
  "meta": {},
  "session": {},
  "indexes": {},
  "breadth": {},
  "liquidity": {},
  "sectors": [],
  "stocks": {},
  "technical": {},
  "derivatives": {},
  "contributions": {},
  "context": {},
  "freshness": {},
  "provenance": {}
}
```

This resembles the desired conceptual shape, but the field set below is constrained by audited reality. Missing modules remain nullable/reserved rather than invented.

---

## 4. `meta`

```json
{
  "packet_id": "uuid-or-deterministic-id",
  "contract_version": "1.0",
  "mode": "REALTIME | REPLAY",
  "market": "VN",
  "session_date": "2026-09-15",
  "as_of": "2026-09-15T07:40:00.364Z",
  "generated_at": "...",
  "source_frame_id": "225",
  "replay_run_id": null
}
```

Rules:
- `as_of` = logical market frame time.
- In REPLAY mode, `generated_at` can be wall-clock replay time while `as_of` remains original market time.
- Deterministic engines use `as_of`, not system now.

---

## 5. `session`

Uses the deterministic Phase 0 Session Clock.

```json
{
  "phase": "ATC_PHASE",
  "is_vietnam_market_open": true,
  "vietnam_market_status": "OPEN | LUNCH | CLOSED",
  "close_snapshot_locked": false
}
```

After close:
- Vietnam market packet becomes a closed/frozen snapshot.
- `context.global/macro/news/commodities/fx` may keep updating independently later.
- This separation is mandatory from V1 contract design onward.

---

## 6. `indexes`

### `indexes.vnindex`

Core:
- `last`
- `reference`
- `open`
- `high`
- `low`
- `change`
- `change_pct`
- `delta_1m` optional
- `delta_5m`
- `delta_15m`
- `delta_30m`
- `rebound_from_low`
- `drop_from_high`
- `previous_high`
- `previous_low`
- `time_of_high` nullable
- `time_of_low` nullable

Each numeric field uses `MetricNumber` envelope.

### `indexes.vn30`, `indexes.hnx`, `indexes.upcom`

Audited Core/Extended fields:
- `last`
- `change`
- `change_pct`
- `volume`
- `value_b`
- `breadth.adv/dec/flat` where source provides them

Do not invent O/H/L/reference for these indexes until observed.

---

## 7. `breadth`

Core:

```json
{
  "advance": {},
  "decline": {},
  "unchanged": {},
  "total": {},
  "balance": {},
  "delta_5m": {},
  "delta_15m": {},
  "ceiling_count": null,
  "floor_count": null
}
```

Extended reserved:
- `above_ma10_pct`
- `above_ma20_pct`
- `above_ma50_pct`
- `above_ma100_pct`
- `above_ma200_pct`
- `new_intraday_highs`
- `new_intraday_lows`
- `new20d_highs`
- `new20d_lows`

These Extended fields remain absent/null until exact sources exist.

---

## 8. `liquidity`

Core/near-Core:

```json
{
  "total_volume": {},
  "total_value_b": {},
  "volume_5m": {},
  "volume_15m": {},
  "volume_30m": {},
  "value_5m_b": {},
  "value_15m_b": {},
  "value_30m_b": {},
  "pace_ratio_15m": {},
  "same_time_ratio_5d": {},
  "same_time_ratio_20d": {},
  "acceleration_state": "ACCELERATING | STABLE | SLOWING | UNKNOWN",
  "history_coverage": {
    "days_available": 0,
    "current_session_from": null,
    "is_complete_from_open": false
  }
}
```

Important:
- interval volume/value uses difference of cumulative exact fields;
- never use `last_price × volume` as exact traded value;
- baseline ratios are nullable until enough historical sessions exist.

---

## 9. `sectors`

One object per current 21 Ami Watch Lists.

```json
{
  "key": "DAUKHI",
  "name": "Dầu khí",
  "member_count": {},
  "valid_count": {},
  "coverage": {},
  "change_pct": {},
  "advance": {},
  "decline": {},
  "unchanged": {},
  "breadth_balance": {},
  "relative_to_vnindex_pct": {},
  "rank": {},
  "rank_change_5m": {},
  "rank_change_15m": {},
  "top_gainers": [],
  "top_losers": [],
  "volume": null,
  "value_b": null,
  "ceiling_count": null,
  "floor_count": null
}
```

`change_pct` semantics must be explicit: current bridge uses an equal-weight average across valid Watch List member `change_pct`, not an official capitalization-weighted sector index.

Top-stock objects should contain only current V1 fields actually supported:
- `symbol`
- `last`
- `change`
- `change_pct`
- `volume`
- optional `source_timestamp`

---

## 10. `stocks`

Do **not** put the full universe in the compressed Commentary packet.

```json
{
  "leaders": [],
  "laggards": [],
  "top_liquidity": [],
  "unusual_movers": [],
  "story_symbols": [],
  "raw_universe_ref": "local://... or computation-store key"
}
```

Each selected stock can expose:
- `symbol`
- `last`
- `change`
- `change_pct`
- `volume`
- `reference` nullable
- `ceiling` nullable
- `floor` nullable
- `open/high/low` nullable
- `value_b` nullable
- `reasons[]` deterministic tags such as `SECTOR_LEADER`, `HIGH_VOLUME`, `MATERIAL_REVERSAL`.

Raw full-market data belongs in computation storage/query layer, not the AI context packet.

---

## 11. `technical`

VN-Index technical Core:
- `ma10`
- `ma20`
- `ma50`
- `vwap`
- `rsi14`
- `macd`
- `macd_signal`
- `support_near`
- `resistance_near`
- `distance_to_support_pct`
- `distance_to_resistance_pct`
- `previous_high`
- `previous_low`
- `high20`
- `low20`

Reserved Extended:
- `ma100`
- `ma200`
- `high50/low50`
- `high52w/low52w`

When `technical_available=false`, the whole technical block remains valid structurally but its unavailable fields are null/INVALID. No synthetic technical number is allowed.

---

## 12. `derivatives`

Audited current source supports:

```json
{
  "primary": {
    "symbol": "VN30F1M",
    "last": {},
    "trend": {},
    "system_price": {},
    "reversal_price": {},
    "targets": {
      "t1": {},
      "t2": {},
      "t3": {}
    },
    "basis": {},
    "premium_discount_pct": {},
    "volume": null,
    "open_interest": null
  }
}
```

`basis` may be `DERIVED_EXACT` only when VN30 spot and future timestamps pass alignment guard.

---

## 13. `contributions`

V1 shape deliberately represents the absence of exact data.

```json
{
  "exact_available": false,
  "positive": [],
  "negative": [],
  "qualitative_drivers": []
}
```

Rules:
- numeric point contribution requires `quality=EXACT` or `DERIVED_EXACT` from a provably exact methodology;
- current system does not meet this threshold;
- qualitative drivers must not be expressed as exact point contribution or causal certainty.

---

## 14. `context`

Reserved boundary from day one:

```json
{
  "valuation": {
    "pe": null,
    "pb": null
  },
  "global": [],
  "macro": [],
  "news": [],
  "commodities": [],
  "fx": [],
  "rates": []
}
```

No crawler/news implementation is part of Phase 1A.

After 15:00:
- Vietnam market fields become a closed snapshot.
- context fields can update using their own freshness model later.
- the contract must never refresh the closed Vietnam index fields merely because external context changed.

---

## 15. Freshness model

Do not use one timeout globally.

### A. VN real-time indexes / breadth
Active trading session:
- `FRESH`: age <= 20s for direct fast feed; <= 60s for bridge-normalized context.
- `AGING`: >20/60s up to 90s.
- `STALE`: >90s up to 180s.
- `INVALID`: >180s or source timestamp impossible/future/invalid.

Adapter should assign policy by source family, not by field name only.

### B. AFL technical
- `FRESH`: <=60s.
- `AGING`: 61–120s.
- `STALE`: 121–300s.
- `INVALID`: >300s or `technical_available=false`.

### C. 21-sector Watch Lists / local stock aggregation
Current refresh target is ~45s.
- `FRESH`: <=60s.
- `AGING`: 61–120s.
- `STALE`: 121–300s.
- `INVALID`: >300s / wrong trading date.

### D. Derivatives
Producer is much faster.
- `FRESH`: <=10s.
- `AGING`: 11–30s.
- `STALE`: 31–120s.
- `INVALID`: >120s during active session.

Lunch/closed exception: store as `CLOSED_SNAPSHOT` semantics rather than falsely calling final known state live.

### E. Historical-derived deltas
Freshness = worst freshness of the current endpoint frame plus history-coverage validity.
A perfect 15m historical point cannot make a stale current point fresh.

### F. Valuation P/E/P/B
Future policy:
- fresh same trading day / latest official session;
- aging after 1–3 trading days depending provider;
- stale beyond policy.

### G. Macro/news/global/commodity/FX
Each context item carries its own event/source timestamp and domain-specific TTL. It must never inherit VN market realtime TTL.

---

## 16. Quality model

Allowed values:
- `EXACT`
- `DERIVED_EXACT`
- `APPROXIMATE`
- `UNAVAILABLE`

Suggested guardrail hierarchy:

```text
EXACT
  > DERIVED_EXACT
      > APPROXIMATE
          > UNAVAILABLE
```

Comment rules can require a minimum quality. Example:
- `INDEX_CONTRIBUTION_EXACT` requires `EXACT`/`DERIVED_EXACT` with exact methodology.
- `SECTOR_ROTATION` accepts `DERIVED_EXACT` rank calculation.
- AI must not promote approximate contribution to exact.

---

## 17. Provenance source enum recommendation

Initial source IDs:
- `AMI_AFL`
- `AMI_LOCAL_STOCK`
- `AMI_WATCHLIST`
- `MARKET_REALTIME`
- `MARKET_LIVE_SNAPSHOT`
- `MARKET_LIVE_CURRENT`
- `DERIVATIVES_LOCAL`
- `HOT_STOCKS_AMI`
- `CALCULATED`
- `REPLAY_FRAME`
- future reserved: `GLOBAL_CONTEXT`, `MACRO_CONTEXT`, `NEWS_CONTEXT`, `FX_CONTEXT`, `COMMODITY_CONTEXT`

A derived field still lists concrete `derived_from` references.

---

## 18. Compression rule: computation packet vs AI packet

### Full computation object
May include:
- full raw universe reference;
- all 21 sector rows;
- current + historical frames;
- exact source metadata;
- candidate calculations.

### AI context projection
Should generally include only:
- VN-Index current + 5m/15m context;
- breadth current + deltas;
- liquidity state;
- top 3–5 leaders and laggards;
- at most the relevant stocks for the active story;
- nearest technical zones;
- fresh derivatives summary;
- relevant context only.

The future Story Engine should request extra computation detail when needed instead of receiving a permanent “data monster.”

---

## 19. Required contract guards

Before downstream use:
1. reject invalid timestamps;
2. never coerce null to zero;
3. validate sector coverage;
4. validate memory frame is truly older by requested horizon;
5. require same-session/date for intraday comparisons;
6. require timestamp alignment for derivatives basis;
7. suppress exact contribution field when source absent;
8. preserve closed snapshot semantics after Vietnam market close;
9. keep external context freshness independent;
10. retain source/quality metadata through Replay and Realtime identically.

---

## 20. Core V1 readiness

The current source set is sufficient to design a viable `CORE_COMMENTARY_DATA` packet today. Missing Extended modules should be represented as nullable/unavailable and should disable only the comment types that require them.

This contract intentionally does **not** require MA200 breadth, foreign flow or exact contribution before the Commentary Room can proceed to a future Adapter phase.
