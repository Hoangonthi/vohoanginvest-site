# UPDATED DATA GAPS — PHASE 1B

Status: cloud-visible adapter implementation complete. **Local Windows source probe has not yet been run by the user**, therefore fields that depend on the actual local `/stock/{symbol}` response remain `UNKNOWN`, not guessed.

## What Phase 1B resolved without changing Ami/legacy

The read-only adapter proves the following can be calculated exactly from existing historical frames when coverage is adequate:

- VN-Index movement 1m / 5m / 15m / 30m;
- breadth balance delta 5m / 15m;
- traded value interval 5m / 15m / 30m;
- traded volume interval when cumulative volume exists;
- 15m liquidity pace/acceleration from adjacent exact cumulative intervals;
- sector rank and rank change 5m / 15m;
- sector relative strength vs VN-Index;
- distance from VN-Index to support/resistance;
- session high/low time only when history is complete from the open;
- derivatives basis only when aligned VN30 spot + future input are present.

These are `DERIVED_EXACT`, not approximations.

## Important gaps after adapter implementation

| Priority | Gap | Phase 1B status | Needs Ami/bridge change now? |
|---|---|---|---|
| P0 | Stock `reference` | **UNKNOWN pending Local Probe** | Do not conclude yet |
| P0 | Stock `ceiling` / `floor` | **UNKNOWN pending Local Probe** | Do not conclude yet |
| P0 | Stock `open/high/low` | **UNKNOWN pending Local Probe** | Do not conclude yet |
| P0 | Stock exact traded `value` | **UNKNOWN pending Local Probe** | Do not conclude yet |
| P0 | Full stock source timestamp semantics | **UNKNOWN pending Local Probe** | Do not conclude yet |
| P0 | Full-session history from market open | Cloud snapshot 15/09 starts ~09:46 VN; local archive may solve this | Probe archive first |
| P1 | Exact VN-Index point contribution by stock | UNAVAILABLE | Need an exact contribution source/methodology; do not approximate |
| P1 | Ceiling/floor counts / cluster capability | BLOCKED by stock limit fields | Wait for probe |
| P1 | Derivatives volume / OI | UNAVAILABLE in audited derivative payload | New exact input required if wanted |
| P1 | Foreign buy/sell/net intraday series | UNAVAILABLE | New source required, not core blocker |
| P1 | Other index O/H/L/reference | Not consistently observed | Not Core V1 blocker |
| P2 | Breadth above MA10/20/50/100/200 | UNAVAILABLE | Requires computation universe/technical input later |
| P2 | Sector exact aggregate volume/value | UNAVAILABLE in current Watch List packet | Could derive only if complete per-stock exact data becomes available |
| P2 | Full per-stock technical indicators | UNAVAILABLE | Not required for V1 commentary core |
| P3 | MA100/MA200 VN-Index in current AFL CSV | UNKNOWN until probe confirms headers | Not Core blocker |
| P3 | Global/macro/news/commodity/FX context | Reserved only | Future Context Engine, not Phase 1B |

## Known cloud-history quality issue

Historical `local_memory.m5/m15/m30` cannot be trusted merely because the fields exist. Some morning 15/09 snapshots contain the current timestamp/value copied into all horizons. Phase 1B now rejects such points as `INVALID_HORIZON` and can derive the horizon from real history instead when enough frames exist.

## Technical availability rule

15/09 cloud history contains 274 snapshots, of which 167 have `technical_available=true` and 107 false. A current snapshot with `technical_available=false` produces `technical.current = UNAVAILABLE`; an older technical value is never promoted to current/fresh. A future explicit `last_known` channel can be added only with its own timestamp/freshness.

## Contribution guardrail

`contributions.exact_available=false` remains mandatory. The adapter never creates `VCB +X points` or equivalent from percentage movement, volume, VN30 membership, or qualitative co-movement.

## Local Probe questions still open

Until `commentary-local-source-audit.json` is returned, these remain unanswered:

1. Does `/stock/{symbol}` actually expose `reference`?
2. Does it expose `ceiling` and `floor`?
3. Does it expose `open/high/low`?
4. Does it expose exact traded `value`?
5. What exact update timestamp fields exist?
6. Does the AFL CSV contain MA100/MA200 beyond fields currently consumed by the bridge?
7. Does the local archive provide complete-from-open history and how often are m5/m15/m30 horizons valid?

**No recommendation to modify AmiBroker or the bridge is authorized until this probe output is reviewed.**
