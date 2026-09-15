# COMMENTARY DATA INVENTORY — PHASE 1A

Status: **AUDIT / DESIGN ONLY**  
Audit date: **2026-09-15**  
Scope: existing Vietnam market data, technical data, Watch Lists, local stock bridge, derivatives and already-existing context sources. No production write, no migration, no legacy modification.

## 0. Evidence rule used in this audit

The audit does **not** infer a field from its name. Each row below is based on one of these evidence classes:

- **DIRECT_DB_SAMPLE** — value was read directly from the current/historical Supabase payload.
- **CODE_VERIFIED_SOURCE** — the producing source code was inspected and the field is explicitly emitted by that source.
- **CLOUD_CORROBORATED** — the field emitted by a local source is also visible in stored production snapshots.
- **NOT_OBSERVED** — the field was not found in any audited payload/source.

Important local-access limitation: this audit environment cannot open the user's `C:\Users\USER\...` files or call `127.0.0.1:8765` on the trading PC. Therefore the raw CSV, local NDJSON archive and localhost response are marked **CODE_VERIFIED_SOURCE** unless the same values are corroborated by cloud snapshots. This is an audit-access limitation, not proof that the local source is absent.

## 1. Real samples actually inspected

`market_live_snapshots` contains **274 rows for 2026-09-15**, first at **09:46:57 VN** and last at **15:01:46 VN**. There is no cloud snapshot covering 08:45–09:15, so Phase 1A cannot truthfully claim an opening sample from cloud history.

| SESSION SAMPLE | SNAPSHOT | ACTUAL OBSERVATION |
|---|---:|---|
| Early available cloud sample ~09:50 | id 5 | VN-Index 1798.6801, +10.4501, +0.5844%; breadth 179/49/76; technical_available=false; high/low/reference invalid or unavailable |
| Mid-morning ~10:30 | id 45 | VN-Index 1805.8101, +0.9831%; breadth 183/54/93; value_b 4209.475; technical_available=false |
| Near lunch ~11:24 | id 99 | VN-Index 1801.74, +0.7555%; breadth 173/54/117; value_b 5851.594; technical_available=false |
| Afternoon ~13:29 | id 127 | technical_available=true; O/H/L 1795.12/1806.02/1794.76; MA10 1820.974; VWAP 1801.6349; m5/m15 history valid |
| ATC ~14:44:55 | id 236 | VN-Index 1811.30, +1.2901%; O/H/L 1795.12/1812.0699/1794.76; breadth 220/54/88; value_b 15099.064 |
| Near close ~14:59:54 | id 270 | VN-Index 1811.15, +1.2817%; breadth 222/53/86; value_b 16649.022 |

Observed `market_live_snapshots` storage cadence for this day: median ~56.7s, average ~69.2s excluding no special lunch treatment; local bridge intent is 15s, while sector/context refresh is 45s. Cloud snapshot history therefore must not be described as a guaranteed 15-second archive.

## 2. Source inventory

### 2.1 Ami AFL technical CSV

Producer: `amibroker/VH-Market-Live-Snapshot.afl`. It explicitly writes one CSV row with:

`symbol,value,reference,change,change_pct,open,high,low,rebound_from_low,drop_from_high,ma10,ma20,ma50,vwap,rsi14,macd,macd_signal,prev_high,prev_low,high20,low20,support_near,resistance_near,updated_at`

Refresh request: 5 seconds. The live bridge considers the technical file fresh for 60 seconds. On 15/09, full technical fields appear in 167/274 stored snapshots; earlier snapshots contain only value/change/change_pct because the AFL source was unavailable at that time.

### 2.2 Local stock endpoint

Producer: `ami-bridge/start-bridge.ps1`, read-only MetaStock DAT/MWD reader.

Actual source fields emitted by `Get-Quote`:

`symbol,description,date,open,high,low,close,prev_close,change,change_pct,volume,source_file,source_format,source_updated_at`

`fundamentals` is explicitly `null`. The current commentary bridge compresses this source before cloud storage, so cloud sector top-stock objects normally retain only `symbol,price,change,change_pct,volume`.

### 2.3 Watch Lists — 21 groups

The current production payload contains all 21 configured groups:

Dầu khí, Giáo dục, Phân bón, Thép, Cảng biển, Thương mại, Ngân hàng, Chứng khoán, Xây dựng, Cao su, Năng lượng điện khí, Bảo hiểm, Thủy sản, Thực phẩm, Bất động sản, Hàng không, Công nghệ viễn thông, Đầu tư phát triển, Vật liệu xây dựng, Khoáng sản, Dịch vụ công ích.

Per-sector fields actually stored:

`key,name,source,coverage,member_count,valid_count,adv,flat,dec,breadth_balance,change_pct,top_gainers,top_losers`

Important semantic note: `change_pct` is currently the **simple average of valid member `change_pct`**, not an official capitalization-weighted sector index return. `coverage` must travel with this metric.

Examples at the latest audited snapshot:

- Dầu khí: 20/33 valid, coverage 0.606, +3.776%, breadth 17/1/2.
- Ngân hàng: 22/22 valid, coverage 1.000, +1.227%, breadth 18/3/1.
- Giáo dục: 9/26 valid, coverage 0.346, +3.386% — useful as a partial proxy, not a full-sector exact statement.

### 2.4 Realtime index source

Current `market_realtime_snapshot(id='vietnam')` contains 23 indexes. Core examples:

- VN-INDEX: 1811.15; +22.92; +1.2817%; volume 523,088,288; value 16,649.022 bn; breadth 222/53/86.
- VN30: 1951.14; +22.5701; +1.1703%; volume 244,055,616; value 10,047.625 bn; breadth 23/0/5.
- HNX-INDEX: 274.13; +2.19; +0.8053%; volume 33,442,712; value 728.065 bn; breadth 82/54/46.
- UPCOM-INDEX: 126.76; +0.95; +0.7551%; volume 22,824,988; value 358.169 bn; breadth 112/80/62.

The current index payload does **not** contain O/H/L/reference. Those exist for symbols in the local MetaStock quote reader but are not propagated into this cloud index summary.

### 2.5 Derivatives

Actual `market_derivatives_snapshot(id='psvn_trend')` sample:

`symbol=VN30F1M`, `last_price=1948.1`, `trend=GIAM`, `system_price=1945.5`, `reversal_price=1955.14`, targets `1935.77 / 1923.71 / 1904.26`, with source and received timestamps.

Not observed in this payload: basis, change, change_pct, volume, OI, premium/discount.

### 2.6 Existing external context — separate from live-market core

`morning_intelligence_snapshot` already contains an experimental/test context stream with global equity, DXY, US10Y, gold, WTI, USD/VND, U.S. macro, Fed expectation proxy, Vietnam macro, RSS/news, and selected Ami T+ stocks. This is **EXTENDED context**, not evidence that those fields belong in the realtime live-market packet.

No P/E or P/B field was observed in the current context snapshot.

---

## 3. Detailed Data Inventory

Legend for `CLASSIFICATION`:

- `RAW_AVAILABLE` — direct from an existing source.
- `DERIVABLE_NOW` — exact or explicitly bounded derivation from existing data.
- `NEEDS_NEW_INPUT` — cannot be produced correctly from current audited inputs.
- `NOT_NEEDED_YET` — useful later but not required for Commentary Room V1.

### A. INDEX

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | RAW FIELD / DERIVATION | EXAMPLE VALUE | FRESHNESS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| vnindex.last | INDEX | YES | AFL + market-feed | `technical.value` / index `value` | 1811.15 | realtime | AFL ~5s; cloud ~minute | NO in healthy session | RAW | EXACT | CORE | RAW_AVAILABLE | Two independent existing paths |
| vnindex.open | INDEX | YES when AFL active | AFL CSV | `open` | 1795.12 | realtime technical | ~5s source | YES | RAW | EXACT | CORE | RAW_AVAILABLE | Missing in early cloud rows on 15/09 |
| vnindex.high | INDEX | YES when AFL active | AFL CSV | `high` | 1812.0699 | realtime technical | ~5s source | YES | RAW | EXACT | CORE | RAW_AVAILABLE | Session high |
| vnindex.low | INDEX | YES when AFL active | AFL CSV | `low` | 1794.76 | realtime technical | ~5s source | YES | RAW | EXACT | CORE | RAW_AVAILABLE | Session low |
| vnindex.change | INDEX | YES | AFL / market-feed | `change` | 22.92 | realtime | 5–60s paths | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| vnindex.change_pct | INDEX | YES | AFL / market-feed | `change_pct` | 1.2817 | realtime | 5–60s paths | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| vnindex.reference | INDEX | YES when AFL active | AFL | `reference` | 1788.23 | session | daily + intraday packet | YES | RAW | EXACT | CORE | RAW_AVAILABLE | Earlier rows had null/0 when AFL absent |
| vnindex.delta_1m | INDEX_HISTORY | CONDITIONAL | snapshots/archive | current - nearest ~1m frame | — | historical alignment | source dependent | YES | CALC | DERIVED_EXACT if aligned | CORE | DERIVABLE_NOW | Cloud cadence is not guaranteed 1m; enforce tolerance |
| vnindex.delta_5m | INDEX_HISTORY | YES after memory available | local memory / snapshots | current - m5.value | -0.72 at 13:29 sample | rolling | ~15s local | YES | CALC | DERIVED_EXACT | CORE | DERIVABLE_NOW | Do not trust old morning same-current bug rows |
| vnindex.delta_15m | INDEX_HISTORY | YES after memory available | local memory / snapshots | current - m15.value | +2.20 at 13:29 sample | rolling | ~15s local | YES | CALC | DERIVED_EXACT | CORE | DERIVABLE_NOW |  |
| vnindex.delta_30m | INDEX_HISTORY | PARTIAL | snapshots/archive | current - nearest 30m | null in afternoon/ATC sample | rolling | source dependent | YES | CALC | DERIVED_EXACT when frame exists | CORE | DERIVABLE_NOW | Current local_memory m30 often null; adapter can use timeline if present |
| vnindex.time_of_high | INDEX_HISTORY | NO exact | none | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT | Can infer approximate first-observed high from frames, not exact bar time |
| vnindex.time_of_low | INDEX_HISTORY | NO exact | none | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT | Same limitation |
| vnindex.previous_close | INDEX | YES | AFL | `reference` | 1788.23 | daily | daily | NO when AFL active | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| vnindex.previous_high | INDEX | YES | AFL | `prev_high` | 1799.10 | daily | daily | YES | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| vnindex.previous_low | INDEX | YES | AFL | `prev_low` | 1776.85 | daily | daily | YES | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| vn30.last/change/pct | INDEX | YES | market-feed | `value/change/change_pct` | 1951.14 / +22.5701 / +1.1703% | realtime | ~45–60s | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| vn30.open/high/low/reference | INDEX | SOURCE EXISTS, not cloud packet | local `/stock/VN30` | quote O/H/L/prev_close | not directly sampled here | realtime file | local cache ~1.5s | YES | RAW | CODE-VERIFIED | CORE | RAW_AVAILABLE | Must be read by adapter; do not infer from cloud payload |
| hnx.last/change/pct | INDEX | YES | market-feed | index row | 274.13 / +2.19 / +0.8053% | realtime | ~45–60s | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| hnx.open/high/low/reference | INDEX | SOURCE EXISTS, not cloud packet | local `/stock/HNXINDEX` | quote O/H/L/prev_close | not directly sampled here | realtime file | local cache ~1.5s | YES | RAW | CODE-VERIFIED | CORE | RAW_AVAILABLE |  |
| upcom.last/change/pct | INDEX | YES | market-feed | index row | 126.76 / +0.95 / +0.7551% | realtime | ~45–60s | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| upcom.open/high/low/reference | INDEX | SOURCE EXISTS, not cloud packet | local `/stock/UPCOMINDEX` | quote O/H/L/prev_close | not directly sampled here | realtime file | local cache ~1.5s | YES | RAW | CODE-VERIFIED | CORE | RAW_AVAILABLE |  |

### B. TECHNICAL INDEX

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | RAW FIELD | EXAMPLE VALUE | FRESHNESS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| MA10 | TECHNICAL | YES | AFL | `ma10` | 1821.594 | realtime packet / daily calc | ~5s export | YES | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| MA20 | TECHNICAL | YES | AFL | `ma20` | 1793.3309 | same | ~5s | YES | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| MA50 | TECHNICAL | YES | AFL | `ma50` | 1778.8656 | same | ~5s | YES | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| MA100 | TECHNICAL | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET | No need to block V1 |
| MA200 | TECHNICAL | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| VWAP | TECHNICAL | YES | AFL | `vwap` | 1804.7954 | realtime | ~5s | YES | RAW | EXACT | CORE | RAW_AVAILABLE | Intraday VNIndex VWAP from chart volume |
| RSI14 | TECHNICAL | YES | AFL | `rsi14` | 53.7645 | realtime export | ~5s | YES | RAW | EXACT | CORE | RAW_AVAILABLE | Daily indicator exported intraday |
| MACD | TECHNICAL | YES | AFL | `macd` | 11.8851 | same | ~5s | YES | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| MACD signal | TECHNICAL | YES | AFL | `macd_signal` | 13.1608 | same | ~5s | YES | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| support_near | TECHNICAL | YES | AFL | `support_near` | 1804.7954 | realtime | ~5s | YES | RAW from AFL rule | EXACT_TO_RULE | CORE | RAW_AVAILABLE | Nearest among predefined MA/VWAP/prev/20D levels, not discretionary support |
| resistance_near | TECHNICAL | YES | AFL | `resistance_near` | 1821.594 | realtime | ~5s | YES | RAW from AFL rule | EXACT_TO_RULE | CORE | RAW_AVAILABLE | Same semantic caveat |
| high20 | TECHNICAL | YES | AFL | `high20` | 1874.48 | daily | ~5s export | YES | RAW | EXACT | CORE | RAW_AVAILABLE | Prior 20D high |
| low20 | TECHNICAL | YES | AFL | `low20` | 1715.91 | daily | ~5s export | YES | RAW | EXACT | CORE | RAW_AVAILABLE | Prior 20D low |
| high50/low50 | TECHNICAL | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| 52w high/low | TECHNICAL | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| distance_to_support | TECHNICAL | YES derived | current + support | `(last-support)/support` or point distance | ~6.35 points at close | same as inputs | packet calc | YES | CALC | DERIVED_EXACT | CORE | DERIVABLE_NOW | Contract must state points vs percent explicitly |
| distance_to_resistance | TECHNICAL | YES derived | current + resistance | resistance-current | ~10.44 points | same | packet calc | YES | CALC | DERIVED_EXACT | CORE | DERIVABLE_NOW |  |

### C. MARKET BREADTH

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | RAW FIELD / DERIVATION | EXAMPLE VALUE | FRESHNESS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| advance | BREADTH | YES | market-feed | `adv` | 222 | realtime | ~45–60s | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| decline | BREADTH | YES | market-feed | `dec` | 86 | realtime | ~45–60s | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| unchanged | BREADTH | YES | market-feed | `flat` | 53 | realtime | ~45–60s | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| breadth_balance | BREADTH | YES | live payload | `(adv-dec)/(adv+flat+dec)` | 0.377 | same as counters | packet update | NO | CALC | DERIVED_EXACT | CORE | DERIVABLE_NOW | Also already materialized in legacy payload |
| ceiling count | BREADTH | NOT OBSERVED CURRENT | enrichment code can try it | current index rows had no `ceiling` | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT | Do not say “X mã trần” from current audited payload |
| floor count | BREADTH | NOT OBSERVED CURRENT | enrichment code can try it | current index rows had no `floor` | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| % above MA10 | BREADTH_TECH | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| % above MA20 | BREADTH_TECH | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| % above MA50 | BREADTH_TECH | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| % above MA100 | BREADTH_TECH | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| % above MA200 | BREADTH_TECH | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| breadth change 5m | BREADTH_HISTORY | YES if prior frame | snapshots/local memory | current balance - 5m balance | e.g. values stored in m5/current | rolling | source dependent | YES | CALC | DERIVED_EXACT | CORE | DERIVABLE_NOW | Must enforce timestamp tolerance |
| breadth change 15m | BREADTH_HISTORY | YES if prior frame | snapshots/local memory | current balance - 15m balance | — | rolling | source dependent | YES | CALC | DERIVED_EXACT | CORE | DERIVABLE_NOW |  |
| new intraday highs/lows | BREADTH | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT | Requires full-universe high/low history or feed metric |
| new 20D highs/lows | BREADTH | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |

### D. LIQUIDITY

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | RAW FIELD / DERIVATION | EXAMPLE VALUE | FRESHNESS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| total volume VN-Index | LIQUIDITY | YES | market_realtime_snapshot | `volume` | 523,088,288 | realtime | ~45–60s | YES | RAW | EXACT | CORE | RAW_AVAILABLE | Not currently copied into `market_live.market.vnindex` |
| total value VN-Index | LIQUIDITY | YES | market-feed/live | `value_b` | 16,649.022 bn | realtime | ~45–60s | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| 5m volume | LIQUIDITY_HISTORY | NOT RAW | cumulative snapshots | current volume - 5m volume | — | rolling | history dependent | YES | CALC | DERIVED_EXACT if aligned | CORE | DERIVABLE_NOW | Requires adapter to retain index volume history |
| 15m volume | LIQUIDITY_HISTORY | NOT RAW | cumulative snapshots | current - 15m | — | rolling | history dependent | YES | CALC | DERIVED_EXACT if aligned | CORE | DERIVABLE_NOW |  |
| 30m volume | LIQUIDITY_HISTORY | NOT RAW | cumulative snapshots | current - 30m | — | rolling | history dependent | YES | CALC | DERIVED_EXACT if aligned | EXTENDED | DERIVABLE_NOW |  |
| value 5m | LIQUIDITY_HISTORY | NOT RAW | cumulative value snapshots | current value_b - 5m | — | rolling | history dependent | YES | CALC | DERIVED_EXACT | CORE | DERIVABLE_NOW |  |
| value 15m | LIQUIDITY_HISTORY | NOT RAW | cumulative value snapshots | current value_b - 15m | — | rolling | history dependent | YES | CALC | DERIVED_EXACT | CORE | DERIVABLE_NOW |  |
| turnover acceleration | LIQUIDITY_HISTORY | LOGIC EXISTS, baseline incomplete | market-feed/snapshots | latest 15m delta / previous 15m delta | current `pace_ratio_15m=null` | rolling | ~minute history | YES | CALC | DERIVED_EXACT when history exists | CORE | DERIVABLE_NOW | `market_realtime_history` had 0 rows for 15/09 at audit; adapter should not depend on it blindly |
| same time yesterday | LIQUIDITY_BASELINE | NO usable baseline now | history | same minute prior day | — | daily baseline | daily | YES | CALC | UNAVAILABLE CURRENTLY | EXTENDED | NEEDS_NEW_INPUT | Only one `market_live_snapshots` date exists at audit |
| same time 5-day average | LIQUIDITY_BASELINE | NO | history | mean of prior 5 sessions | — | daily baseline | daily | YES | CALC | UNAVAILABLE CURRENTLY | EXTENDED | NEEDS_NEW_INPUT | Need retained multi-day history, not Ami indicator change |
| same time 20-day average | LIQUIDITY_BASELINE | NO | history | mean prior 20 sessions | — | daily baseline | daily | YES | CALC | UNAVAILABLE CURRENTLY | EXTENDED | NEEDS_NEW_INPUT | Legacy flow baseline reports 0/20 days |

### E. SECTOR — 21 Watch Lists

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | RAW FIELD / DERIVATION | EXAMPLE VALUE | FRESHNESS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| sector.change_pct | SECTOR | YES | Watch Lists + local quotes | average(valid member change_pct) | Dầu khí +3.776% | near realtime | refresh 45s | NO if valid members | CALC in bridge | DERIVED_PROXY | CORE | DERIVABLE_NOW | Must carry coverage; not official weighted sector index |
| sector.adv/flat/dec | SECTOR_BREADTH | YES | Watch Lists + local quotes | member sign counts | Dầu khí 17/1/2 | ~45s | 45s | NO if valid members | CALC | DERIVED_EXACT_OVER_VALID | CORE | DERIVABLE_NOW |  |
| sector.breadth_balance | SECTOR_BREADTH | YES | Watch Lists | `(adv-dec)/valid_count` | 0.75 | ~45s | 45s | NO | CALC | DERIVED_EXACT_OVER_VALID | CORE | DERIVABLE_NOW |  |
| sector.coverage | SECTOR_QUALITY | YES | Watch Lists | valid/member | 0.606 | ~45s | 45s | NO | CALC | EXACT | CORE | DERIVABLE_NOW | Required guardrail |
| sector.volume | SECTOR_LIQUIDITY | PARTIAL DERIVABLE | local member quotes | sum valid member volume | — | ~45s | 45s | YES | CALC | DERIVED_EXACT_PARTIAL | EXTENDED | DERIVABLE_NOW | Exact only for observed/valid members; coverage matters |
| sector.value | SECTOR_LIQUIDITY | NO exact | no stock turnover field | last*volume would be approximation | — | — | — | YES | CALC | APPROXIMATE_ONLY | EXTENDED | NEEDS_NEW_INPUT | Do not label approximation as exact turnover |
| sector.volume_speed | SECTOR_LIQUIDITY | CONDITIONAL | sector volume history | interval sector volume deltas | — | rolling | history dependent | YES | CALC | DERIVED_EXACT_PARTIAL | EXTENDED | DERIVABLE_NOW | Needs retained member/sector volume history |
| sector.relative_strength_vs_vnindex | SECTOR | YES | sector proxy + VNIndex | sector pct - VNIndex pct | Dầu khí roughly +2.49 pp at close | ~45s | 45s | YES | CALC | DERIVED_PROXY | CORE | DERIVABLE_NOW | Relative to current simple-average sector proxy |
| sector.top_stocks | SECTOR_STOCK | YES | bridge | `top_gainers` | PVC +8.197% | ~45s | 45s | YES | RAW compressed | EXACT quote / proxy selection | CORE | RAW_AVAILABLE | Top 3 only in cloud packet |
| sector.weak_stocks | SECTOR_STOCK | YES | bridge | `top_losers` | — | ~45s | 45s | YES | RAW compressed | EXACT quote / proxy selection | CORE | RAW_AVAILABLE |  |
| sector.ceiling_count | SECTOR | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| sector.floor_count | SECTOR | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| sector.intraday_high/low | SECTOR | NO literal official level | snapshots can track proxy pct extrema | proxy only | — | rolling | ~45s | YES | CALC | APPROXIMATE/PROXY | EXTENDED | NOT_NEEDED_YET | Name must say proxy if used |
| leadership_rank | SECTOR | YES | sector array | sort current proxy change_pct | Dầu khí rank 1 | ~45s | 45s | NO | CALC | DERIVED_EXACT_TO_PROXY | CORE | DERIVABLE_NOW |  |
| leadership_rank_change_5m | SECTOR_HISTORY | YES with prior frame | sector history | current rank - prior rank | — | rolling | history dependent | YES | CALC | DERIVED_EXACT_TO_PROXY | CORE | DERIVABLE_NOW |  |
| leadership_rank_change_15m | SECTOR_HISTORY | YES with prior frame | sector history | current rank - prior rank | — | rolling | history dependent | YES | CALC | DERIVED_EXACT_TO_PROXY | CORE | DERIVABLE_NOW |  |

### F. STOCK

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | RAW FIELD | EXAMPLE VALUE | FRESHNESS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| symbol | STOCK | YES | local bridge | `symbol` | PVC | file update | local cache ~1.5s | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| reference | STOCK | YES at local source | local bridge | `prev_close` | code-verified | daily | source file | YES | RAW | CODE-VERIFIED | CORE | RAW_AVAILABLE | Current commentary compression drops it |
| ceiling | STOCK | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT | Cannot call “trần” safely |
| floor | STOCK | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT | Cannot call “sàn” safely |
| open | STOCK | YES at local source | local bridge | `open` | code-verified | file update | local cache ~1.5s | YES | RAW | CODE-VERIFIED | CORE | RAW_AVAILABLE | Dropped by commentary compression |
| high | STOCK | YES at local source | local bridge | `high` | code-verified | file update | local cache ~1.5s | YES | RAW | CODE-VERIFIED | CORE | RAW_AVAILABLE |  |
| low | STOCK | YES at local source | local bridge | `low` | code-verified | file update | local cache ~1.5s | YES | RAW | CODE-VERIFIED | CORE | RAW_AVAILABLE |  |
| last | STOCK | YES | local bridge/cloud top stocks | `close` -> `price` | PVC 13.2 | file update / ~45s cloud selection | local 1.5s cache | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| change | STOCK | YES | local bridge | `change` | PVC +1.0 | same | same | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| change_pct | STOCK | YES | local bridge | `change_pct` | PVC +8.197% | same | same | NO | RAW | EXACT | CORE | RAW_AVAILABLE |  |
| volume | STOCK | YES | local bridge | `volume` | PVC 2,184,500 | file update | same | YES | RAW | EXACT | CORE | RAW_AVAILABLE | VN30 compact list currently omits volume |
| traded_value | STOCK | SELECTED ONLY / not universal | Ami T+ context for selected symbols | `value_traded_bn` | BSR 723.18 bn | separate source | separate schedule | YES | RAW selected | EXACT_TO_SOURCE | EXTENDED | NEEDS_NEW_INPUT | `last*volume` is only an approximation to true turnover |
| volume_vs_average | STOCK | SELECTED ONLY | Ami T+ context | previous/projected volume ratios | e.g. BSR ratios | separate | separate | YES | RAW selected | EXACT_TO_SOURCE | EXTENDED | NEEDS_NEW_INPUT | Not full-universe live quote field |
| VWAP | STOCK_TECH | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| MA / technical | STOCK_TECH | NO general source | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |

### G. INDEX CONTRIBUTION

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | RAW FIELD | EXAMPLE VALUE | FRESHNESS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| exact stock contribution points to VNIndex | CONTRIBUTION | NO | none audited | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED/HIGH VALUE | NEEDS_NEW_INPUT | **Do not publish “VCB +X points”** |
| qualitative large-cap co-movement | CONTRIBUTION_PROXY | YES | VN30 stock moves | stock change_pct + index move | VCB +2.56%, VNIndex +1.28% | realtime-ish | ~45s | YES | RAW comparison | NOT_CONTRIBUTION | CORE optional | DERIVABLE_NOW | Safe wording: “đang đi cùng/hỗ trợ”, never point contribution |

### H. FOREIGN FLOW

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | RAW FIELD | EXAMPLE VALUE | FRESHNESS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| market foreign buy | FOREIGN | NO | none audited | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| market foreign sell | FOREIGN | NO | none audited | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| market foreign net | FOREIGN | NO | none audited | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| stock foreign flow | FOREIGN | NO | none audited | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| sector foreign flow | FOREIGN | NO | none audited | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| intraday foreign series | FOREIGN | NO | none audited | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |

### I. DERIVATIVES

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | RAW FIELD / DERIVATION | EXAMPLE VALUE | FRESHNESS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| symbol | DERIVATIVES | YES | market_derivatives_snapshot | `symbol` | VN30F1M | realtime source | current derivative push | NO | RAW | EXACT | CORE optional | RAW_AVAILABLE |  |
| last_price | DERIVATIVES | YES | same | `last_price` | 1948.1 | realtime | current derivative push | NO | RAW | EXACT | CORE optional | RAW_AVAILABLE |  |
| trend | DERIVATIVES | YES | same | `trend` | GIAM | realtime | current derivative push | YES | RAW/strategy output | EXACT_TO_RULE | CORE optional | RAW_AVAILABLE |  |
| system_price | DERIVATIVES | YES | same | `system_price` | 1945.5 | realtime | same | YES | RAW/strategy | EXACT_TO_RULE | EXTENDED | RAW_AVAILABLE |  |
| reversal_price | DERIVATIVES | YES | same | `reversal_price` | 1955.14 | realtime | same | YES | RAW/strategy | EXACT_TO_RULE | EXTENDED | RAW_AVAILABLE |  |
| targets | DERIVATIVES | YES | same | `targets` | 1935.77/1923.71/1904.26 | realtime | same | YES | RAW/strategy | EXACT_TO_RULE | EXTENDED | RAW_AVAILABLE |  |
| basis | DERIVATIVES | NO exact raw | derivative + time-aligned VN30 spot | future - spot | — | needs aligned clocks | — | YES | CALC | APPROXIMATE if timestamps differ | CORE optional | DERIVABLE_NOW | Only expose EXACT when timestamp alignment rule passes |
| change/change_pct | DERIVATIVES | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| volume | DERIVATIVES | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| OI | DERIVATIVES | NO | — | — | — | — | — | YES | — | UNAVAILABLE | EXTENDED | NEEDS_NEW_INPUT |  |
| premium/discount | DERIVATIVES | CONDITIONAL | basis | sign of basis | — | aligned | — | YES | CALC | follows basis quality | CORE optional | DERIVABLE_NOW |  |

### J. CONTEXT — currently existing but not part of live core

| FIELD | CATEGORY | EXISTS? | REAL SOURCE | EXAMPLE VALUE | FRESHNESS | NULLABLE? | RAW/CALC | QUALITY | NEEDED? | CLASSIFICATION | NOTES |
|---|---|---|---|---:|---|---|---|---|---|---|---|
| P/E | VALUATION | NO observed | — | — | slow | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| P/B | VALUATION | NO observed | — | — | slow | YES | — | UNAVAILABLE | EXTENDED | NOT_NEEDED_YET |  |
| S&P 500 / Nasdaq | GLOBAL | YES separate | morning intelligence TEST | S&P 500 7619.98, -1.19% | market-dependent | YES | RAW external | EXPERIMENTAL | EXTENDED | RAW_AVAILABLE | Keep out of core freshness |
| DXY | FX | YES separate | morning intelligence TEST | 99.652, +0.66% | market-dependent | YES | RAW external | EXPERIMENTAL | EXTENDED | RAW_AVAILABLE |  |
| USD/VND | FX | YES separate | morning intelligence TEST | 25984 | source-dependent | YES | RAW external | EXPERIMENTAL | EXTENDED | RAW_AVAILABLE |  |
| US10Y | RATES | YES separate | morning intelligence TEST | 4.961% | market-dependent | YES | RAW external | EXPERIMENTAL | EXTENDED | RAW_AVAILABLE |  |
| WTI / Gold | COMMODITY | YES separate | morning intelligence TEST | WTI 103.73 | market-dependent | YES | RAW external | EXPERIMENTAL | EXTENDED | RAW_AVAILABLE |  |
| U.S. CPI/jobs | MACRO | YES separate | BLS path in morning system | CPI 3.4% YoY | release-cycle | YES | RAW external | SOURCE_SPECIFIC | EXTENDED | RAW_AVAILABLE |  |
| Vietnam macro | MACRO | YES separate | monthly snapshot | as_of 2026-08-31 | monthly/release-cycle | YES | curated facts | SOURCE_SPECIFIC | EXTENDED | RAW_AVAILABLE |  |
| news/events | NEWS | YES separate | existing news intelligence/RSS | multiple events | event-specific | YES | structured facts | SOURCE_SPECIFIC | EXTENDED | RAW_AVAILABLE | Do not wire into live core in Phase 1A |

## 4. What the current cloud packet really contains

Across all 274 audited live snapshots, top-level keys observed were:

`context_received_at`, `engine_version`, `local_first`, `local_memory`, `market`, `technical`, `technical_available`, `vn30_stocks`, `watchlist_sectors`, `world_model`.

`market` contained: `alerts`, `breadth`, `flow`, `sectors`, `state`, `vnindex`.

The full technical set was only present in 167/274 rows. Therefore the contract must permit technical fields to be null/unavailable and must carry source freshness/quality rather than silently reusing stale values.

## 5. Core audit conclusion

The system already has enough factual material for a strong V1 commentator around:

- VN-Index state and intraday movement;
- breadth and breadth changes;
- cumulative liquidity plus interval deltas;
- 21-sector leadership/breadth/coverage and rotation from history;
- stock leaders/laggards with price/change/volume;
- VN-Index technical zones and indicators when the AFL source is healthy;
- VN30/HNX/UPCoM current state;
- derivatives trend/last-price context.

The main deficiencies are not “lack of hundreds of indicators”; they are **history continuity, source provenance/freshness, selected exact fields (contribution, foreign flow, ceiling/floor, derivatives volume/OI), and making existing local raw fields available to the new read-only adapter without changing legacy payloads**.
