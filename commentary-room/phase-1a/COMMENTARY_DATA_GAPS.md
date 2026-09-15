# COMMENTARY DATA GAPS — PHASE 1A

Scope: identify what is missing, what is exactly derivable now, what truly needs new input, and what can wait. No production change is authorized by this document.

## 1. Priority model

- **P0** — required so Commentary Room V1 can operate safely and consistently.
- **P1** — high-value improvement; strongly useful but not a launch blocker if wording is constrained.
- **P2** — useful enrichment after V1 is stable.
- **P3** — nice-to-have / later research layer.

A gap is not automatically an AmiBroker task. Preferred order:
1. reuse exact existing raw source;
2. derive deterministically in read-only adapter/local computation;
3. add a new input only if exact output cannot otherwise be produced and the field is important enough.

---

## 2. P0 gaps

| GAP | WHY IT MATTERS | CURRENT STATE | BEST FIX LOCATION | AMI CHANGE? |
|---|---|---|---|---|
| Historical validity of 5m/15m/30m memory | Prevents false “unchanged”/acceleration comments | Some early 2026-09-15 snapshots had m5/m15/m30 equal to current; later m5/m15 were valid; m30 often null | Adapter must validate source timestamp and fall back to snapshot/archive lookup | **No** |
| Technical availability continuity | O/H/L/zones were absent from 107/274 cloud snapshots on audited day | AFL technical became available only around 13:09 in stored history | Adapter must treat technical as optional and select fallback facts; root operational reliability can be addressed separately later | **Not in 1A**; likely operational, not contract blocker |
| Provenance per value | AI must distinguish exact vs derived vs approximate | Legacy values do not share one normalized provenance structure | Read-only Adapter/Contract | **No** |
| Type-specific freshness | Prevents stale derivatives/index/technical from being treated equally | Legacy has heterogeneous timestamps | Adapter | **No** |
| Full deterministic fallback for intraday deltas | Commentary needs 5m/15m movement even if local memory missing | `market_live_snapshots` can reconstruct during covered periods | Adapter/history lookup | **No** |
| Time alignment for derivative basis | Basis is only exact when VN30 spot and VN30F timestamps are close enough | Both values exist, timestamps differ by source | Adapter freshness/alignment guard | **No** |
| Reliable session-open history coverage | Needed for exact time-of-high/low and complete replay | Cloud live snapshots began ~09:46 on audited day | Prefer local archive for computation/replay; improve history persistence later if needed | **No immediate Ami change** |

Conclusion: there is **no P0 field that requires changing AmiBroker** to start Commentary Room V1. P0 is mostly adapter correctness, timestamp validation and fallback logic.

---

## 3. P1 gaps

| GAP | CURRENT CLASS | VALUE | BEST FUTURE SOURCE | AMI CHANGE? |
|---|---|---|---|---|
| Exact VN-Index point contribution by stock | NEEDS_NEW_INPUT | Very high for professional commentary | Official/exact contribution feed or exact index methodology + full constituent free-float/weights | Prefer external/exact source; **do not approximate** |
| Stock reference / ceiling / floor | NEEDS_NEW_INPUT | High for ceiling/floor and limit-state commentary | First inspect actual local `/stock/{symbol}` response on trading machine; expose only if already there; otherwise DataTick/Ami local source | Maybe; only after local audit |
| Market ceiling/floor counts | NEEDS_NEW_INPUT | High | Derive from stock reference/ceiling/floor once available | No extra Ami if stock fields exist |
| Sector ceiling/floor counts | NEEDS_NEW_INPUT | High | Same as above + Watch List membership | No extra Ami if stock fields exist |
| Foreign market net buy/sell | NEEDS_NEW_INPUT | High contextual value | Existing broker/market data feed if available; otherwise separate provider | No need to put in AFL |
| Foreign stock-level flow | NEEDS_NEW_INPUT | High for driver comments | Data provider | No |
| Exact sector aggregate value traded for 21 Watch Lists | NEEDS_NEW_INPUT | Medium-high | Exact per-stock traded value field + membership | Maybe local bridge field, not necessarily AFL |
| Per-stock reference state for unusual movers | NEEDS_NEW_INPUT | High | Local quote endpoint | Maybe, after endpoint audit |

Important: exact index contribution is currently **not permitted** as a numeric commentary type. Qualitative “đang hỗ trợ/gây áp lực” may be used only when the wording and data quality rules explicitly mark it non-contribution and non-causal.

---

## 4. P2 gaps

- % stocks above MA10/20/50.
- % stocks above MA100/MA200.
- new intraday highs/lows count.
- new 20D highs/lows count.
- per-stock O/H/L for full market.
- per-stock VWAP and technical indicators for all names.
- VN-Index MA100/MA200.
- VN-Index 50D high/low.
- derivative session change, volume and OI.
- exact sector intraday high/low with complete session history.
- full 5-day/20-day same-time liquidity baseline once enough historical sessions accumulate.

Most of these should be calculated in a deterministic computation layer, not copied blindly into the AI prompt.

---

## 5. P3 gaps

- 52-week index high/low.
- full technical stack for 594 stocks.
- valuation P/E/P/B inside realtime commentary packet.
- global indices, FX, rates, commodities, macro and news streams.
- sophisticated relative-strength indicators beyond simple same-time relative performance.

Contract reserves boundaries for these, but Phase 1A does not implement them.

---

## 6. What can be calculated now without Ami changes

The following are exact deterministic calculations given adequate timestamp coverage:

1. VN-Index 1m/5m/15m/30m point and pct movement from snapshots/archive.
2. breadth 5m/15m change.
3. liquidity value 5m/15m/30m from cumulative traded value differences.
4. liquidity acceleration/slowdown by comparing consecutive equal-duration increments.
5. same-time liquidity ratios when enough prior sessions exist.
6. sector relative performance vs VN-Index.
7. sector leadership rank and rank change 5m/15m.
8. sector intraday max/min observed state if full-session history is complete.
9. technical distance to support/resistance.
10. derivative basis and premium/discount if spot/futures timestamps align.
11. sector cumulative volume locally by summing valid Watch List member volume, provided the adapter reads the existing full stock snapshot/member mapping.
12. previous close from VN-Index reference.

None of these justify changing AFL.

---

## 7. What truly may require new local/Ami input

Only propose Ami/local-source work after directly inspecting the actual local endpoint and CSV on the user's machine.

Potential additions if absent everywhere else:
- stock reference;
- stock ceiling;
- stock floor;
- stock O/H/L;
- exact per-stock traded value;
- market/sector ceiling-floor counts derived from those fields;
- breadth above MA10/20/50/100/200 if no existing batch computation can produce it efficiently;
- new high/new low flags if not derivable from existing historical database.

Even here, preferred implementation is **local deterministic export/adapter**, not expanding the single VN-Index AFL snapshot into a giant 594-stock × indicators payload.

---

## 8. Minimum data by comment type

| COMMENT TYPE | REQUIRED DATA | OPTIONAL DATA | CANNOT COMMENT IF MISSING |
|---|---|---|---|
| `INDEX_ACCELERATION` | index current, index 5m/15m prior, timestamps | breadth delta, sector rank changes | valid historical frame pair |
| `INDEX_REVERSAL_FROM_LOW` | current, session low | breadth, sector leaders | trustworthy session low |
| `INDEX_FADE_FROM_HIGH` | current, session high | breadth deterioration | trustworthy session high |
| `RESISTANCE_TEST` | current index, exact resistance level, freshness | RSI/MACD, breadth | resistance or current stale |
| `SUPPORT_TEST` | current index, exact support level, freshness | breadth, VWAP | support/current missing |
| `VWAP_RECLAIM_LOSS` | current index, VWAP | 5m movement | fresh VWAP/current |
| `BREADTH_EXPANSION` | current breadth + prior breadth | index change | prior breadth unavailable |
| `BREADTH_DIVERGENCE` | index current/prior + breadth current/prior | sectors | either time series missing |
| `SECTOR_LEADERSHIP` | current sector ranking, coverage | top stocks | sector coverage too low/invalid |
| `SECTOR_ROTATION` | sector current rank + prior rank | sector breadth delta, top stocks | no prior rank/history |
| `STOCK_UNUSUAL_MOVE` | symbol, last/change_pct, volume, timestamp | sector context | quote stale or invalid |
| `STOCK_CEILING_FLOOR` | exact ceiling/floor/reference + last | volume | **exact limit fields absent** |
| `LIQUIDITY_ACCELERATION` | cumulative value at 3 aligned timestamps | same-time baseline | insufficient history |
| `LIQUIDITY_VS_BASELINE` | current value + >=5 valid same-time historical sessions | 20-day avg | valid baseline not available |
| `DERIVATIVE_BASIS` | VN30 spot + VN30F1M last + aligned timestamps | trend | timestamps outside alignment tolerance |
| `DERIVATIVE_TREND` | fresh derivative trend/last | reversal/targets | derivative stale |
| `INDEX_CONTRIBUTION_EXACT` | exact contribution points per symbol | sector context | **exact contribution data absent** |
| `FOREIGN_FLOW` | fresh buy/sell/net | stock/sector breakdown | foreign data absent |
| `ATC_STATE` | current index, breadth, sectors, session phase | derivatives | core market state stale |
| `AFTER_HOURS_MARKET_CLOSE` | final closed Vietnam snapshot | external context | final close snapshot absent |
| `AFTER_HOURS_GLOBAL_CONTEXT` | independent fresh global/macro/news source | Vietnam close snapshot | external context source absent |

---

## 9. Commentary types already safe with current data

Current system can support well, with freshness/provenance guards:
- VN-Index acceleration/deceleration over 5m/15m.
- recovery from session low / fade from session high when AFL high/low is fresh.
- MA10/20/50, VWAP, support/resistance tests.
- breadth expansion/contraction/divergence.
- sector leadership and 5m/15m rotation.
- stock leader/laggard mention with symbol/change/volume.
- liquidity acceleration/slowdown for periods where historical cumulative values exist.
- VN30/HNX/UPCoM relative state.
- derivatives trend and timestamp-aligned basis.
- ATC state commentary.
- closed-session recap using final Vietnam snapshot.

---

## 10. Commentary types NOT YET PERMITTED

Until exact required input exists, the engine must not emit:
- “VCB đóng góp +4.2 điểm VN-Index” or any exact stock point contribution.
- “X mã trần / Y mã sàn” market/sector counts.
- “Mã A đang chạm trần/sàn” unless exact ceiling/floor/reference is present.
- exact foreign net-buy/sell commentary.
- derivative OI/volume claims.
- full-market % above MA100/MA200 claims.
- exact time of session high/low unless full-session history proves it.
- exact 21-sector traded value from `last × volume` approximation.
- causal claims (“VN-Index tăng vì VCB”) based solely on co-movement.

---

## 11. Ten most important current gaps

1. Exact index contribution by stock.
2. Stock reference/ceiling/floor.
3. Market/sector ceiling-floor counts.
4. Foreign market/stock flow.
5. Robust full-session historical coverage from open.
6. Exact 21-sector traded value.
7. Full reliable 30m memory fallback in legacy payload.
8. Per-stock O/H/L where needed.
9. Breadth above MA10/20/50/100/200.
10. Derivative volume/OI.

Only items 2/6/8 might eventually need local data export changes; none should be assumed to require AFL changes until the local endpoint is directly inspected.

---

## 12. Seven Phase 1A answers

### 1. How much V1 data already exists?
Approximately **78% of capability-weighted CORE V1 requirements** are already `RAW_AVAILABLE` or `DERIVABLE_NOW`.

### 2. Ten most important fields/capabilities already available
1. VN-Index current value/change/change_pct.
2. VN-Index O/H/L/reference when AFL is fresh.
3. 5m/15m market memory/history path.
4. breadth adv/dec/flat/balance.
5. total traded value.
6. 21-sector change/breadth/coverage.
7. sector top gainers/losers with volume.
8. MA10/20/50 + VWAP.
9. RSI14 + MACD/signal + support/resistance.
10. VN30/HNX/UPCoM state + VN30F1M derivative state.

### 3. Ten most important gaps
See section 11.

### 4. Which gaps require Ami changes?
**None are proven to require AmiBroker changes yet.** First inspect the actual local `/stock/{symbol}` response and other local sources. If reference/ceiling/floor/OHL are truly absent, a local export/source extension may be justified. The VN-Index AFL should remain narrow unless no better source exists.

### 5. Which gaps can be calculated from existing snapshots/archive?
5m/15m/30m movement, breadth deltas, liquidity interval deltas, liquidity acceleration, same-time baselines, sector rank/rank change, relative sector performance, observed sector intraday extrema, distance to zones, and derivative basis.

### 6. What commentary is already good enough?
Index movement, technical-zone tests, breadth changes/divergence, sector leadership/rotation, stock leader/laggard mentions, liquidity pace where history exists, derivatives trend/basis, ATC/close state.

### 7. What commentary is not yet allowed?
Exact index contribution, ceiling/floor claims/counts, foreign flow, derivative OI/volume, full-market MA breadth claims, exact high/low timestamps without full history, and causal driver claims unsupported by exact contribution/event evidence.
