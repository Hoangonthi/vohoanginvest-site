# COMMENTARY DATA INVENTORY — PHASE 1A

Audit date: 2026-09-15. Scope: survey and contract design only. No production write, migration, deploy, legacy modification, AmiBroker change, Market State/Event/Story/AI implementation.

## 0. Audit evidence and limitations

This inventory is based on direct read-only inspection of production data and the current bridge source that constructs the payload.

Directly inspected production sources:
- `market_live_current` actual row (`id=vietnam`).
- `market_live_snapshots` actual historical rows at approximately 09:46, 10:30, 11:28, 13:29 and 14:40 Vietnam time on 2026-09-15.
- `market_realtime_snapshot` actual current payload containing index rows and VN30 stock rows.
- `market_derivatives_snapshot` actual current payload.
- `market_hot_stocks_snapshot` actual current payload, used only as supporting evidence for fields already present elsewhere.
- `ami-bridge/push-live-commentary-v3.ps1` actual production bridge source, including the CSV reader, local `/stock/{symbol}` projection, Watch List aggregation, local raw archive writer and cloud payload builder.

Not directly readable from this cloud execution environment:
- `C:\Users\USER\Desktop\AMIBRO\vh_market_live_snapshot.csv` on the user's Windows machine.
- `ami-bridge/live-data/YYYY-MM-DD/market-live.ndjson` on the user's Windows machine.
- `http://127.0.0.1:8765/stock/{symbol}` on the user's Windows machine.

For those three local-only sources, this document does **not** claim unseen fields. It only records fields that are (a) explicitly consumed by the running bridge source and/or (b) corroborated in persisted production payloads. A future local read-only audit can add fields only if they are actually observed.

Historical coverage note: `market_live_snapshots` on 2026-09-15 begins at about 09:46 VN, so true 09:00–09:45 cloud history was not available for this audit. Five available intraday checkpoints were inspected instead.

Technical availability note for 2026-09-15: 274 stored live snapshots; 167 had `technical_available=true`, 107 had it false. First stored technical-true row was about 13:09:58 VN. Therefore early/mid-morning technical fields cannot be treated as historically complete on this date.

---

## 1. Classification legend

Every capability is classified as exactly one of:
- `RAW_AVAILABLE` — present directly in an inspected source/payload.
- `DERIVABLE_NOW` — not present as a direct field but can be calculated exactly from currently available data/history without new Ami input.
- `NEEDS_NEW_INPUT` — requires an additional source or an Ami/local bridge extension to be exact.
- `NOT_NEEDED_YET` — useful later but not required for Commentary Room V1.

Quality:
- `EXACT` — direct source value.
- `DERIVED_EXACT` — deterministic calculation from exact inputs.
- `APPROXIMATE` — only an approximation is possible; must never be presented as exact.
- `UNAVAILABLE` — cannot currently be produced reliably.

Update frequency below means the observed/production target cadence, not a guarantee that every upstream source actually changes at that cadence.

---

## 2. Detailed data inventory

| FIELD | CATEGORY | STATUS | REAL SOURCE | RAW FIELD / DERIVATION | EXAMPLE VALUE | FRESHNESS BASIS | UPDATE FREQUENCY | NULLABLE? | RAW/CALC | QUALITY | COMMENTARY NEED | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `vnindex.last` | INDEX | RAW_AVAILABLE | AFL technical when fresh; fallback market feed | `technical.value` / `market.vnindex.value` | `1811.30` | source timestamp | 15s bridge; market feed ~45s | No in valid frame | RAW | EXACT | CORE | Two source paths; provenance must identify which one won. |
| `vnindex.open` | INDEX | RAW_AVAILABLE | AFL snapshot | `technical.open` | `1795.12` | AFL file timestamp | ~5s AFL, 15s bridge | Yes if AFL unavailable | RAW | EXACT | CORE | Missing in morning cloud rows when `technical_available=false`. |
| `vnindex.high` | INDEX | RAW_AVAILABLE | AFL snapshot | `technical.high` | `1812.0699` | AFL file timestamp | ~5s AFL, 15s bridge | Yes | RAW | EXACT | CORE | Do not use fallback `0`/null as real high. |
| `vnindex.low` | INDEX | RAW_AVAILABLE | AFL snapshot | `technical.low` | `1794.76` | AFL file timestamp | ~5s AFL, 15s bridge | Yes | RAW | EXACT | CORE | Same caveat as high. |
| `vnindex.reference` | INDEX | RAW_AVAILABLE | AFL snapshot | `technical.reference` | `1788.23` | AFL file timestamp | daily/session | Yes if AFL absent | RAW | EXACT | CORE | Market feed current row does not expose reference directly. |
| `vnindex.change` | INDEX | RAW_AVAILABLE | AFL or market feed | `technical.change` / index `change` | `23.0701` | source timestamp | 15–45s | No in valid frame | RAW | EXACT | CORE | |
| `vnindex.change_pct` | INDEX | RAW_AVAILABLE | AFL or market feed | `technical.change_pct` / index `change_pct` | `1.2901` | source timestamp | 15–45s | No in valid frame | RAW | EXACT | CORE | |
| `vnindex.previous_close` | INDEX | DERIVABLE_NOW | AFL | `reference` | `1788.23` | session-static | daily | Yes if no reference | CALC alias | DERIVED_EXACT | CORE | Previous close = reference for normal session use. |
| `vnindex.previous_high` | INDEX | RAW_AVAILABLE | AFL | `technical.prev_high` | `1799.10` | daily-static | daily | Yes | RAW | EXACT | CORE | |
| `vnindex.previous_low` | INDEX | RAW_AVAILABLE | AFL | `technical.prev_low` | `1776.85` | daily-static | daily | Yes | RAW | EXACT | CORE | |
| `vnindex.delta_1m` | INDEX_INTRADAY | DERIVABLE_NOW | `market_live_snapshots` | nearest snapshot now - ~1m | — | newest two snapshots | ~60s cloud history | Yes | CALC | DERIVED_EXACT | EXTENDED | Cloud history cadence is around 1m, not true tick-level 1m. Local 15s archive is better. |
| `vnindex.delta_5m` | INDEX_INTRADAY | RAW_AVAILABLE / DERIVABLE_NOW | local memory / snapshots | `local_memory.m5.value`; or snapshot lookup | current 1811.30 vs 5m 1811.30 in ATC sample | timestamps of both frames | 15s local / ~60s cloud | Yes | RAW/CALC | EXACT or DERIVED_EXACT | CORE | Early rows showed m5/m15/m30 equal to current, so timestamp validity must be checked. |
| `vnindex.delta_15m` | INDEX_INTRADAY | RAW_AVAILABLE / DERIVABLE_NOW | local memory / snapshots | `local_memory.m15.value`; or snapshot lookup | 1811.30 vs 1810.5601 | timestamps | 15s local / ~60s cloud | Yes | RAW/CALC | EXACT or DERIVED_EXACT | CORE | |
| `vnindex.delta_30m` | INDEX_INTRADAY | DERIVABLE_NOW | snapshots/local archive | timestamp lookup | null in inspected ATC local-memory row | timestamps | ~60s cloud / 15s local | Yes | CALC | DERIVED_EXACT | CORE | Do not trust current `m30` blindly; derive when needed. |
| `vnindex.time_of_high` | INDEX | NEEDS_NEW_INPUT | none observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | Could be derived only if sufficiently complete timestamped index history exists from session open; 2026-09-15 cloud history does not. |
| `vnindex.time_of_low` | INDEX | NEEDS_NEW_INPUT | none observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | Same. |
| `vn30.last` | INDEX | RAW_AVAILABLE | `market_realtime_snapshot` | index `value` | `1951.14` | index source timestamp | market feed | No | RAW | EXACT | CORE | |
| `vn30.change` | INDEX | RAW_AVAILABLE | market realtime | `change` | `22.5701` | source timestamp | market feed | No | RAW | EXACT | CORE | |
| `vn30.change_pct` | INDEX | RAW_AVAILABLE | market realtime | `change_pct` | `1.1703` | source timestamp | market feed | No | RAW | EXACT | CORE | |
| `vn30.adv/dec/flat` | INDEX_BREADTH | RAW_AVAILABLE | market realtime | `adv/dec/flat` | `23/5/0` | source timestamp | market feed | Yes | RAW | EXACT | EXTENDED | |
| `hnx.last/change/change_pct` | INDEX | RAW_AVAILABLE | market realtime | `value/change/change_pct` | `274.13 / +2.19 / +0.8053%` | source timestamp | market feed | No | RAW | EXACT | EXTENDED | No O/H/L observed. |
| `upcom.last/change/change_pct` | INDEX | RAW_AVAILABLE | market realtime | `value/change/change_pct` | `126.76 / +0.95 / +0.7551%` | source timestamp | market feed | No | RAW | EXACT | EXTENDED | No O/H/L observed. |
| `other_index.open/high/low/reference` | INDEX | NEEDS_NEW_INPUT | none observed in market realtime rows | — | — | — | — | Yes | — | UNAVAILABLE | NOT_NEEDED_YET | Not required for V1 realtime commentary. |
| `technical.ma10` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `ma10` | `1821.609` | AFL timestamp | ~5s/15s | Yes | RAW | EXACT | CORE | |
| `technical.ma20` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `ma20` | `1793.3385` | AFL timestamp | ~5s/15s | Yes | RAW | EXACT | CORE | |
| `technical.ma50` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `ma50` | `1778.8687` | AFL timestamp | ~5s/15s | Yes | RAW | EXACT | CORE | |
| `technical.ma100` | TECHNICAL_INDEX | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `technical.ma200` | TECHNICAL_INDEX | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `technical.vwap` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `vwap` | `1804.0491` | AFL timestamp | ~5s/15s | Yes | RAW | EXACT | CORE | |
| `technical.rsi14` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `rsi14` | `53.797` | AFL timestamp | ~5s/15s | Yes | RAW | EXACT | CORE | |
| `technical.macd` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `macd` | `11.8971` | AFL timestamp | ~5s/15s | Yes | RAW | EXACT | CORE | |
| `technical.macd_signal` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `macd_signal` | `13.1632` | AFL timestamp | ~5s/15s | Yes | RAW | EXACT | CORE | |
| `technical.support_near` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `support_near` | `1804.0491` | AFL timestamp | ~5s/15s | Yes | RAW | EXACT | CORE | Existing value may resolve to VWAP; contract records source, not meaning beyond source. |
| `technical.resistance_near` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `resistance_near` | `1821.609` | AFL timestamp | ~5s/15s | Yes | RAW | EXACT | CORE | Existing value may resolve to MA10. |
| `technical.high20` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `high20` | `1874.48` | AFL timestamp | daily/intraday calc | Yes | RAW | EXACT | EXTENDED | |
| `technical.low20` | TECHNICAL_INDEX | RAW_AVAILABLE | AFL | `low20` | `1715.91` | AFL timestamp | daily/intraday calc | Yes | RAW | EXACT | EXTENDED | |
| `technical.high50/low50` | TECHNICAL_INDEX | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | Could be added locally later; not V1 blocker. |
| `technical.high52w/low52w` | TECHNICAL_INDEX | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | NOT_NEEDED_YET | |
| `technical.distance_to_support` | TECHNICAL_INDEX | DERIVABLE_NOW | current + support | `(last-support)/support` | about `+0.40%` at inspected ATC snapshot | same frame | each frame | Yes | CALC | DERIVED_EXACT | CORE | |
| `technical.distance_to_resistance` | TECHNICAL_INDEX | DERIVABLE_NOW | current + resistance | `(resistance-last)/last` | about `+0.57%` | same frame | each frame | Yes | CALC | DERIVED_EXACT | CORE | |
| `breadth.advance` | MARKET_BREADTH | RAW_AVAILABLE | market feed / live packet | `adv` | `220` at ATC sample | market/context timestamp | ~45s | No | RAW | EXACT | CORE | |
| `breadth.decline` | MARKET_BREADTH | RAW_AVAILABLE | market feed / live packet | `dec` | `88` | source timestamp | ~45s | No | RAW | EXACT | CORE | |
| `breadth.unchanged` | MARKET_BREADTH | RAW_AVAILABLE | market feed / live packet | `flat` | `54` | source timestamp | ~45s | No | RAW | EXACT | CORE | |
| `breadth.total` | MARKET_BREADTH | RAW_AVAILABLE | live packet | `total` | `362` | source timestamp | ~45s | No | RAW | EXACT | CORE | Can also sum adv+dec+flat. |
| `breadth.balance` | MARKET_BREADTH | RAW_AVAILABLE / DERIVABLE_NOW | live packet | `balance` | `0.365` | source timestamp | ~45s | No | RAW/CALC | EXACT | CORE | `(adv-dec)/total`. |
| `breadth.delta_5m` | MARKET_BREADTH | DERIVABLE_NOW | snapshots/local memory | current balance - prior balance | — | two timestamps | 15–60s | Yes | CALC | DERIVED_EXACT | CORE | |
| `breadth.delta_15m` | MARKET_BREADTH | RAW_AVAILABLE / DERIVABLE_NOW | world model / snapshots | `world_model.match.breadth.delta_15m` or recalc | `0.033` in ATC sample | two timestamps | 15–60s | Yes | RAW/CALC | DERIVED_EXACT | CORE | Prefer adapter recalc with provenance. |
| `breadth.ceiling_count` | MARKET_BREADTH | NEEDS_NEW_INPUT | no ceiling state observed | — | — | — | — | Yes | — | UNAVAILABLE | P1 | |
| `breadth.floor_count` | MARKET_BREADTH | NEEDS_NEW_INPUT | no floor state observed | — | — | — | — | Yes | — | UNAVAILABLE | P1 | |
| `breadth.above_ma10_pct` | MARKET_BREADTH | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `breadth.above_ma20_pct` | MARKET_BREADTH | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `breadth.above_ma50_pct` | MARKET_BREADTH | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `breadth.above_ma100_pct` | MARKET_BREADTH | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `breadth.above_ma200_pct` | MARKET_BREADTH | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `breadth.new_intraday_highs/lows` | MARKET_BREADTH | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `breadth.new20d_highs/lows` | MARKET_BREADTH | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | NOT_NEEDED_YET | |
| `liquidity.total_volume` | LIQUIDITY | RAW_AVAILABLE | market realtime index row | `VN-INDEX.volume` | `523,088,288` | index source timestamp | market feed | Yes | RAW | EXACT | CORE | Current live normalized packet does not always carry it; read-only adapter can. |
| `liquidity.total_value_b` | LIQUIDITY | RAW_AVAILABLE | market realtime / live packet | `value_b` | `16,649.022` bn at close snapshot; `14,956.465` in ATC live sample | source timestamp | ~45s | No | RAW | EXACT | CORE | Source timing differs; provenance required. |
| `liquidity.volume_5m` | LIQUIDITY | DERIVABLE_NOW | cumulative volume history | current total volume - 5m total volume | — | two snapshots | snapshot cadence | Yes | CALC | DERIVED_EXACT | EXTENDED | Requires persisted market-realtime history or local archive; current `market_realtime_history` had no 2026-09-15 rows during audit, so local/archive or live snapshots are needed. |
| `liquidity.volume_15m` | LIQUIDITY | DERIVABLE_NOW | cumulative volume history | difference | — | two snapshots | history cadence | Yes | CALC | DERIVED_EXACT | Same coverage caveat. |
| `liquidity.volume_30m` | LIQUIDITY | DERIVABLE_NOW | cumulative volume history | difference | — | two snapshots | history cadence | Yes | CALC | DERIVED_EXACT | |
| `liquidity.value_5m` | LIQUIDITY | DERIVABLE_NOW | `market_live_snapshots.market.vnindex.value_b` | difference | — | two timestamps | ~60s cloud | Yes | CALC | DERIVED_EXACT | Available for period where snapshots exist. |
| `liquidity.value_15m` | LIQUIDITY | DERIVABLE_NOW | snapshot history | difference | — | two timestamps | ~60s cloud | Yes | CALC | DERIVED_EXACT | |
| `liquidity.pace_ratio_15m` | LIQUIDITY | DERIVABLE_NOW | snapshot history | latest 15m increment / prior 15m increment | currently null in sample | three timestamps | ~60s cloud | Yes | CALC | DERIVED_EXACT | Legacy flow field exists but baseline was not ready. Adapter can compute when history coverage is sufficient. |
| `liquidity.same_time_yesterday` | LIQUIDITY | DERIVABLE_NOW | historical snapshots if available | nearest same minute prior session | — | historical | session | Yes | CALC | DERIVED_EXACT | Data retention/coverage must be validated per date. |
| `liquidity.same_time_5d_avg` | LIQUIDITY | DERIVABLE_NOW | historical snapshots | average nearest same minute over 5 sessions | — | historical | session | Yes | CALC | DERIVED_EXACT | Requires 5 complete days. |
| `liquidity.same_time_20d_avg` | LIQUIDITY | DERIVABLE_NOW | historical snapshots | average nearest same minute over 20 sessions | — | historical | session | Yes | CALC | DERIVED_EXACT | Existing sample reported `baseline_days=0`; current database history may not yet have 20 usable days. |
| `liquidity.acceleration` | LIQUIDITY | DERIVABLE_NOW | 5/15m increments | compare recent interval with previous interval | — | history | per frame | Yes | CALC | DERIVED_EXACT | CORE once history coverage is sufficient. |
| `sector.key/name` | SECTOR_21 | RAW_AVAILABLE | Ami Watch Lists | `key/name` | `DAUKHI / Dầu khí` | sector refresh timestamp | 45s | No | RAW | EXACT | CORE | 21 groups observed. |
| `sector.member_count` | SECTOR_21 | RAW_AVAILABLE | Watch List file | `member_count` | `33` for Dầu khí | watch list + refresh | 45s | No | RAW | EXACT | EXTENDED | |
| `sector.valid_count` | SECTOR_21 | RAW_AVAILABLE | bridge quote coverage | `valid_count` | `20` | refresh timestamp | 45s | No | RAW | EXACT | CORE quality | Needed to judge sector confidence. |
| `sector.coverage` | SECTOR_21 | RAW_AVAILABLE | bridge | `coverage` | `0.606` | refresh timestamp | 45s | No | RAW | EXACT | CORE quality | |
| `sector.change_pct` | SECTOR_21 | RAW_AVAILABLE | bridge average of member `change_pct` | `change_pct` | `3.552` Dầu khí | refresh timestamp | 45s | No | CALC in bridge | DERIVED_EXACT relative to valid members | CORE | This is equal-weight mean of valid members, not a capitalization-weighted official sector index. |
| `sector.adv/dec/flat` | SECTOR_21 | RAW_AVAILABLE | bridge | `adv/dec/flat` | `17/2/1` | refresh timestamp | 45s | No | CALC in bridge | DERIVED_EXACT | CORE | |
| `sector.breadth_balance` | SECTOR_21 | RAW_AVAILABLE | bridge | `breadth_balance` | `0.75` | refresh timestamp | 45s | No | CALC in bridge | DERIVED_EXACT | CORE | |
| `sector.top_gainers` | SECTOR_21 | RAW_AVAILABLE | bridge | top 3 valid members | PVC +7.377%, PXL +7.143%, BSR +6.842% | refresh timestamp | 45s | Yes | CALC selection | DERIVED_EXACT | CORE | Each row has symbol, price, change, change_pct, volume. |
| `sector.top_losers` | SECTOR_21 | RAW_AVAILABLE | bridge | bottom 3 valid members | PGS -2.763% etc. | refresh timestamp | 45s | Yes | CALC selection | DERIVED_EXACT | CORE | |
| `sector.volume` | SECTOR_21 | DERIVABLE_NOW | local full stock snapshot + Watch List membership | sum member cumulative volume | — | quote refresh | 45s | Yes | CALC | DERIVED_EXACT | P1 | Needs adapter local-side access to membership and full stock snapshot; not in cloud sector object. |
| `sector.value` | SECTOR_21 | NEEDS_NEW_INPUT | no exact per-stock traded value in `/stock` projection | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | `last × volume` would only be approximation and must not be labelled exact value traded. |
| `sector.volume_speed` | SECTOR_21 | DERIVABLE_NOW | sector volume history | volume delta per interval | — | time series | 45s+ | Yes | CALC | DERIVED_EXACT | EXTENDED | Depends on sector.volume availability locally. |
| `sector.relative_strength_vs_vnindex` | SECTOR_21 | DERIVABLE_NOW | sector pct + VNIndex pct | sector change_pct - VNIndex change_pct | e.g. Dầu khí +3.552 vs VNIndex +1.2901 | same-time frames | 45s | Yes | CALC | DERIVED_EXACT | CORE | Relative-performance measure, not formal RS indicator unless named accordingly. |
| `sector.ceiling_count/floor_count` | SECTOR_21 | NEEDS_NEW_INPUT | no ceiling/floor quotes observed | — | — | — | — | Yes | — | UNAVAILABLE | P1 | |
| `sector.intraday_high/low` | SECTOR_21 | DERIVABLE_NOW | sector history | max/min observed `change_pct` over complete session | — | history coverage | 45s+ | Yes | CALC | DERIVED_EXACT if complete | EXTENDED | Only valid when session history coverage is complete. |
| `sector.leadership_rank` | SECTOR_21 | DERIVABLE_NOW | sector current list | sort `change_pct` | Dầu khí rank 1 in ATC sample | same frame | 45s | No | CALC | DERIVED_EXACT | CORE | |
| `sector.rank_change_5m/15m` | SECTOR_21 | DERIVABLE_NOW | sector history/local memory | rank(now)-rank(past) | — | two timestamps | 45s+ | Yes | CALC | DERIVED_EXACT | CORE | |
| `stock.symbol` | STOCK | RAW_AVAILABLE | local `/stock` projection / persisted leaders | `symbol` | `BSR` | quote timestamp | sector refresh 45s | No | RAW | EXACT | CORE | Full local universe exists in local raw archive writer; cloud live packet keeps selected names. |
| `stock.last` | STOCK | RAW_AVAILABLE | local `/stock` projection | bridge maps `quote.close -> price` | `30.45` | `quote.source_updated_at` | local quote + 45s sector refresh | No for valid quote | RAW | EXACT | CORE | |
| `stock.change` | STOCK | RAW_AVAILABLE | local `/stock` projection | `quote.change` | `+1.95` | quote timestamp | 45s aggregation | No | RAW | EXACT | CORE | |
| `stock.change_pct` | STOCK | RAW_AVAILABLE | local `/stock` projection | `quote.change_pct` | `+6.842%` | quote timestamp | 45s aggregation | No | RAW | EXACT | CORE | |
| `stock.volume` | STOCK | RAW_AVAILABLE | local `/stock` projection | `quote.volume` | `23,488,200` BSR | quote timestamp | 45s aggregation | Yes | RAW | EXACT | CORE | |
| `stock.reference` | STOCK | NEEDS_NEW_INPUT | not consumed/observed in `/stock` projection | — | — | — | — | Yes | — | UNAVAILABLE | P1 | Local endpoint may contain more fields, but they were not directly observed and are not claimed. |
| `stock.ceiling` | STOCK | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | P1 | Required before asserting exact ceiling state. |
| `stock.floor` | STOCK | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | P1 | Required before asserting exact floor state. |
| `stock.open/high/low` | STOCK | NEEDS_NEW_INPUT | not observed in current stock projection | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `stock.value_traded` | STOCK | RAW_AVAILABLE for hot-stock subsystem only; unavailable in general live stock projection | `market_hot_stocks_snapshot` | `valueTradedBn` | BSR `723.18` bn | separate source timestamp | separate feed | Yes | RAW | EXACT only for that subsystem | EXTENDED | Do not assume this field exists for the raw live stock universe. |
| `stock.vwap/ma/technical` | STOCK | NEEDS_NEW_INPUT | not observed in live stock projection | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | Not needed for all 594 names in V1. |
| `stock.projected_volume_ratio` | STOCK | RAW_AVAILABLE for hot-stock subsystem | `projectedVolRatio` | BSR `43.10` | separate subsystem timestamp | separate | Yes | RAW | EXACT per source | NOT_NEEDED_YET | Optional enrichment only, not baseline market truth. |
| `contribution.vnindex.points_by_symbol` | INDEX_CONTRIBUTION | NEEDS_NEW_INPUT | no exact contribution feed/weights observed | — | — | — | — | Yes | — | UNAVAILABLE | P1 | **Do not publish “VCB +X points”** from price move alone. |
| `contribution.directional_driver` | INDEX_CONTRIBUTION | DERIVABLE_NOW only as non-point qualitative context | price move + index membership | “VCB tăng cùng chiều” | VCB +2.56% | same-time | 45s | Yes | CALC | APPROXIMATE | EXTENDED | Allowed wording: supports/pressures only if rules explicitly mark qualitative; never numeric point contribution. |
| `foreign.market_buy/sell/net` | FOREIGN_FLOW | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | P1 | |
| `foreign.stock_buy/sell/net` | FOREIGN_FLOW | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | P1 | |
| `foreign.sector_net` | FOREIGN_FLOW | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `foreign.intraday_series` | FOREIGN_FLOW | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `derivatives.symbol` | DERIVATIVES | RAW_AVAILABLE | `market_derivatives_snapshot` | `symbol` | `VN30F1M` | derivative source timestamp | ~2s producer | No | RAW | EXACT | CORE | |
| `derivatives.last_price` | DERIVATIVES | RAW_AVAILABLE | derivative snapshot | `last_price` | `1948.10` | source timestamp | ~2s producer | No | RAW | EXACT | CORE | |
| `derivatives.trend` | DERIVATIVES | RAW_AVAILABLE | derivative snapshot | `trend` | `GIAM` | source timestamp | ~2s | No | RAW | EXACT per system | CORE | This is system trend, not market fact derived by Commentary Room. |
| `derivatives.system_price` | DERIVATIVES | RAW_AVAILABLE | derivative snapshot | `system_price` | `1945.50` | source timestamp | ~2s | Yes | RAW | EXACT per source | EXTENDED | |
| `derivatives.reversal_price` | DERIVATIVES | RAW_AVAILABLE | derivative snapshot | `reversal_price` | `1955.14` | source timestamp | ~2s | Yes | RAW | EXACT per source | EXTENDED | |
| `derivatives.targets` | DERIVATIVES | RAW_AVAILABLE | derivative snapshot | `targets.t1/t2/t3` | `1935.77 / 1923.71 / 1904.26` | source timestamp | ~2s | Yes | RAW | EXACT per source | EXTENDED | |
| `derivatives.change` | DERIVATIVES | NEEDS_NEW_INPUT / DERIVABLE if prior reference becomes available | no reference observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | Could derive from time series but not session change vs reference without reference. |
| `derivatives.basis` | DERIVATIVES | DERIVABLE_NOW | VN30 spot + VN30F last | `future.last - vn30.last` | about `-3.04` using inspected close values | same-time alignment required | per derivative frame | Yes | CALC | DERIVED_EXACT | CORE | Only if spot/future timestamps are acceptably aligned. |
| `derivatives.premium_discount` | DERIVATIVES | DERIVABLE_NOW | basis + VN30 spot | `basis / spot` | — | same-time | per derivative frame | Yes | CALC | DERIVED_EXACT | EXTENDED | |
| `derivatives.volume` | DERIVATIVES | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `derivatives.oi` | DERIVATIVES | NEEDS_NEW_INPUT | not observed | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `context.pe` | CONTEXT | NEEDS_NEW_INPUT | not in inspected live commentary sources | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | Could come from another existing subsystem later; not currently part of live contract evidence. |
| `context.pb` | CONTEXT | NEEDS_NEW_INPUT | not in inspected live commentary sources | — | — | — | — | Yes | — | UNAVAILABLE | EXTENDED | |
| `context.global` | CONTEXT | NOT_NEEDED_YET | reserved contract boundary | — | — | separate freshness | future | Yes | — | UNAVAILABLE | EXTENDED | Do not build crawler in 1A. |
| `context.fx` | CONTEXT | NOT_NEEDED_YET | reserved | — | — | separate freshness | future | Yes | — | UNAVAILABLE | EXTENDED | |
| `context.rates` | CONTEXT | NOT_NEEDED_YET | reserved | — | — | separate freshness | future | Yes | — | UNAVAILABLE | EXTENDED | |
| `context.commodities` | CONTEXT | NOT_NEEDED_YET | reserved | — | — | separate freshness | future | Yes | — | UNAVAILABLE | EXTENDED | |
| `context.macro` | CONTEXT | NOT_NEEDED_YET | reserved | — | — | separate freshness | future | Yes | — | UNAVAILABLE | EXTENDED | |
| `context.news` | CONTEXT | NOT_NEEDED_YET | reserved | — | — | separate freshness | future | Yes | — | UNAVAILABLE | EXTENDED | No Global News Radar implementation in Phase 1A. |

---

## 3. Actual checkpoint observations

### Earliest cloud-live snapshot available — ~09:46:57 VN
- `technical_available=false`.
- VN-Index value `1798.47`, change `+10.24`, change pct `+0.5726%`.
- breadth `177 adv / 75 dec / 48 flat`.
- 21 sector Watch Lists and 30 VN30 names present.
- `local_memory.m5/m15/m30` all pointed to the current frame at this earliest stored moment; this is not valid historical separation.

### Mid-morning — ~10:30:22 VN
- `technical_available=false`.
- VN-Index `1805.8101`, `+17.5801`, `+0.9831%`.
- breadth `183 / 93 / 54`.
- 21 sectors present.
- local memory fields again showed same-current values in the inspected row; adapter must validate memory timestamp before use.

### Pre-lunch — ~11:28:48 VN
- `technical_available=false`.
- VN-Index `1801.9399`, `+13.71`, `+0.7667%`.
- breadth `171 / 116 / 57`.
- market value `6013.695` bn.

### Afternoon — ~13:29:26 VN
- `technical_available=true`.
- VN-Index `1804.95`; O/H/L `1795.12 / 1806.02 / 1794.76`.
- MA10/20/50, VWAP, RSI14, MACD, 20D high/low, previous high/low present.
- local memory had distinct m5 and m15 timestamps; m30 was null in this row.

### ATC — ~14:40:00 VN
- `technical_available=true`.
- VN-Index `1811.30`, +23.0701, +1.2901%; high `1812.0699`, low `1794.76`.
- breadth `220 / 88 / 54`.
- 21 sectors present; Dầu khí example: +3.552%, adv 17, dec 2, flat 1, coverage 0.606.
- local m15 VN-Index value `1810.5601` vs current `1811.30`.

---

## 4. Computation data vs AI context data

### COMPUTATION DATA
Keep detailed raw/history outside the AI prompt:
- complete local stock quote universe available to the bridge;
- Watch List membership;
- 15s local archive;
- cloud snapshot history;
- index cumulative volume/value;
- 21-sector time series;
- technical snapshot;
- derivative raw state;
- historical frames needed for 1m/5m/15m/30m calculations.

### AI CONTEXT DATA
Pass only a compressed commentary packet:
- current index state + 5m/15m movement;
- breadth current + change;
- total liquidity + acceleration state;
- top sector leaders/laggards + rank change;
- a small set of relevant stock leaders/laggards/unusual movers;
- nearest technical zones;
- derivative basis/trend if fresh;
- exact contributors only when exact feed exists;
- context/news only when independently fresh and relevant.

The Commentary Room should never send 594 stocks × hundreds of indicators to AI every 15 seconds.

---

## 5. Core vs Extended recommendation

### CORE_COMMENTARY_DATA
Sufficient for V1 realtime commentary:
- VN-Index last/change/pct + O/H/L/reference when AFL is fresh.
- 5m and 15m index movement; 30m derivable fallback.
- breadth adv/dec/flat/balance + 5m/15m change.
- total market value; total volume where available.
- liquidity interval deltas/acceleration when history coverage exists.
- 21 Watch List sector change/breadth/coverage/rank/rank change.
- selected stock symbol/last/change_pct/volume.
- MA10/20/50, VWAP, RSI14, MACD, support/resistance, previous high/low.
- VN30/HNX/UPCoM current state.
- derivatives last/trend and exact basis when timestamp-aligned.
- session phase and complete provenance/freshness.

### EXTENDED_COMMENTARY_DATA
Improves quality but must not block V1:
- exact VN-Index point contribution by stock.
- foreign flow at market/stock/sector level.
- ceiling/floor counts.
- % stocks above MA10/20/50/100/200.
- new high/new low statistics.
- exact 21-sector value traded.
- full per-stock O/H/L/reference/ceiling/floor/technical.
- MA100/MA200 and 50D/52W zones.
- derivative volume/OI.
- valuation P/E/P/B.
- global/macro/news/commodity/FX context.

---

## 6. V1 data coverage estimate

Using capability-weighted Core requirements rather than counting every optional field equally, the current system has approximately **78% of the data capability needed for Commentary Room V1** either `RAW_AVAILABLE` or `DERIVABLE_NOW`.

This is not “78% of all possible market data.” It means about 78% of the practical V1 commentary capabilities can already be supplied without changing AmiBroker. The largest quality gaps are exact index contribution, stock limit/reference state, ceiling/floor statistics, foreign flow, and more complete historical/time-of-extreme coverage.
