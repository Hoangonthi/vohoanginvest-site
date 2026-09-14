import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIDGE_KEY = Deno.env.get("VH_BRIDGE_KEY") || "";

const ALLOWED_ORIGINS = new Set([
  "https://vohoanginvest.com",
  "https://www.vohoanginvest.com",
  "https://hoangonthi.github.io",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://www.vohoanginvest.com",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-bridge-key",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}
function serviceHeaders(extra: Record<string, string> = {}) {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, ...extra };
}
function n(value: unknown): number | null {
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}
function first(obj: any, keys: string[]) {
  for (const key of keys) {
    const value = key.split(".").reduce((a, b) => a?.[b], obj);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}
function round(value: number, digits = 2) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}
function vnDate(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function marketIndex(context: any, symbol: string) {
  return Array.isArray(context?.indexes)
    ? context.indexes.find((x: any) => String(x?.symbol || "").toUpperCase() === symbol.toUpperCase()) || null
    : null;
}
function compactStock(row: any) {
  return {
    symbol: String(row?.symbol || row?.code || "").toUpperCase(),
    price: n(first(row, ["price", "close", "last"])),
    change: n(row?.change),
    change_pct: n(first(row, ["change_pct", "changePct", "pct"])),
    volume: n(row?.volume),
  };
}
function normalizeWatchlistSectors(input: any, fallback: any[]) {
  const raw = Array.isArray(input?.sector_watchlists) ? input.sector_watchlists : [];
  if (!raw.length) return fallback;
  return raw
    .map((x: any) => ({
      key: String(x?.key || ""),
      symbol: String(x?.key || ""),
      name: String(x?.name || x?.key || "Nhóm ngành"),
      change_pct: n(x?.change_pct),
      adv: n(x?.adv),
      flat: n(x?.flat),
      dec: n(x?.dec),
      member_count: n(x?.member_count),
      valid_count: n(x?.valid_count),
      coverage: n(x?.coverage),
      breadth_balance: n(x?.breadth_balance),
      top_gainers: Array.isArray(x?.top_gainers) ? x.top_gainers.map(compactStock).filter((s: any) => s.symbol) : [],
      top_losers: Array.isArray(x?.top_losers) ? x.top_losers.map(compactStock).filter((s: any) => s.symbol) : [],
      source: "AmiBroker Watch Lists",
    }))
    .filter((x: any) => x.name && x.change_pct !== null);
}

function normalize(input: any) {
  const t = input?.technical || {};
  const ctx = input?.market_context || {};
  const idx = marketIndex(ctx, "VN-INDEX") || {};
  const mi = ctx?.market_intelligence || {};

  const reference = n(first(t, ["reference", "ref", "prev_close"])) ?? n(first(idx, ["reference", "ref", "prev_close"]));
  const value = n(first(t, ["value", "last", "close"])) ?? n(first(idx, ["value", "close", "last"]));
  const change = n(first(t, ["change", "change_point"])) ?? n(first(idx, ["change", "change_point"]));
  let pct = n(first(t, ["change_pct", "pct"])) ?? n(first(idx, ["change_pct", "pct"]));
  if (pct === null && value !== null && reference !== null && reference !== 0) pct = (value / reference - 1) * 100;

  const high = n(first(t, ["high", "session_high"])) ?? n(idx?.high);
  const low = n(first(t, ["low", "session_low"])) ?? n(idx?.low);
  const rebound = n(t?.rebound_from_low) ?? (value !== null && low !== null ? value - low : null);
  const drop = n(t?.drop_from_high) ?? (value !== null && high !== null ? high - value : null);

  const adv = n(idx?.adv) ?? n(first(mi, ["breadth.adv"]));
  const flat = n(idx?.flat) ?? n(first(mi, ["breadth.flat"]));
  const dec = n(idx?.dec) ?? n(first(mi, ["breadth.dec"]));
  const total = [adv, flat, dec].every((x) => x !== null) ? adv! + flat! + dec! : null;
  const balance = total && total > 0 ? (adv! - dec!) / total : n(first(mi, ["breadth.balance"]));

  const indexSectors = Array.isArray(mi?.sectors) ? mi.sectors : [];
  const sectors = normalizeWatchlistSectors(input, indexSectors);
  const vn30Stocks = Array.isArray(ctx?.vn30_stocks)
    ? ctx.vn30_stocks.map(compactStock).filter((x: any) => x.symbol)
    : Array.isArray(ctx?.vn30?.stocks)
      ? ctx.vn30.stocks.map(compactStock).filter((x: any) => x.symbol)
      : [];

  return {
    technical: t,
    technical_available: Boolean(input?.technical_available ?? Object.keys(t).length),
    local_first: Boolean(input?.local_first),
    market: {
      vnindex: {
        value,
        reference,
        change,
        change_pct: pct,
        high,
        low,
        rebound_from_low: rebound,
        drop_from_high: drop,
        adv,
        flat,
        dec,
        breadth_balance: balance,
        value_b: n(first(idx, ["value_b", "total_value_b"])) ?? n(first(mi, ["flow.value_b"])),
      },
      state: mi?.state || null,
      breadth: mi?.breadth || null,
      flow: mi?.flow || null,
      sectors,
      alerts: Array.isArray(mi?.alerts) ? mi.alerts : [],
    },
    watchlist_sectors: sectors,
    vn30_stocks: vn30Stocks,
    context_received_at: first(ctx, ["relay_received_at", "received_at", "updated_at"]),
  };
}

function metrics(payload: any) {
  const v = payload?.market?.vnindex || {};
  const t = payload?.technical || {};
  return {
    value: n(v.value), reference: n(v.reference), change: n(v.change), pct: n(v.change_pct),
    high: n(v.high), low: n(v.low), rebound: n(v.rebound_from_low), drop: n(v.drop_from_high),
    adv: n(v.adv), flat: n(v.flat), dec: n(v.dec), breadth: n(v.breadth_balance), valueB: n(v.value_b),
    ma10: n(t.ma10), ma20: n(t.ma20), ma50: n(t.ma50), vwap: n(t.vwap), rsi14: n(t.rsi14),
    macd: n(t.macd), signal: n(t.macd_signal), support: n(t.support_near), resistance: n(t.resistance_near),
  };
}
function sign(x: number | null) {
  if (x === null || Math.abs(x) < 0.01) return 0;
  return x > 0 ? 1 : -1;
}
function crossedUp(cur: number | null, prev: number | null, prev2: number | null, l0: number | null, l1: number | null, l2: number | null) {
  return cur !== null && prev !== null && prev2 !== null && l0 !== null && l1 !== null && l2 !== null && cur >= l0 && prev >= l1 && prev2 < l2;
}
function crossedDown(cur: number | null, prev: number | null, prev2: number | null, l0: number | null, l1: number | null, l2: number | null) {
  return cur !== null && prev !== null && prev2 !== null && l0 !== null && l1 !== null && l2 !== null && cur <= l0 && prev <= l1 && prev2 > l2;
}

type Candidate = { type: string; key: string; severity: number; tone: string; title: string; facts: any };

function findPast(rows: any[], capturedAt: string, minutes: number) {
  const target = new Date(capturedAt).getTime() - minutes * 60_000;
  let best: any = null;
  let bestDiff = Infinity;
  for (const row of rows) {
    const diff = Math.abs(new Date(row.captured_at).getTime() - target);
    if (diff < bestDiff && diff <= 180_000) { best = row; bestDiff = diff; }
  }
  return best;
}
function sectorRows(payload: any) {
  return Array.isArray(payload?.market?.sectors) ? payload.market.sectors : [];
}
function topSector(payload: any) {
  return [...sectorRows(payload)]
    .filter((x: any) => n(x?.change_pct) !== null && (n(x?.coverage) === null || Number(x.coverage) >= 0.35))
    .sort((a: any, b: any) => Number(b.change_pct) - Number(a.change_pct))[0] || null;
}
function sectorByKey(payload: any, key: string) {
  return sectorRows(payload).find((x: any) => String(x?.key || x?.symbol || x?.name || "") === key) || null;
}

function detect(payload: any, previousRows: any[], capturedAt: string): Candidate[] {
  const cur = metrics(payload);
  const p1 = previousRows[0] ? metrics(previousRows[0].payload) : null;
  const p2 = previousRows[1] ? metrics(previousRows[1].payload) : null;
  const c: Candidate[] = [];

  if (!p1) {
    c.push({ type: "SESSION_BASELINE", key: "baseline", severity: 1, tone: "neutral", title: "Bắt đầu theo dõi diễn biến trong phiên", facts: { current: cur } });
    return c;
  }

  if (p2) {
    const s0 = sign(cur.change ?? (cur.value !== null && cur.reference !== null ? cur.value - cur.reference : null));
    const s1 = sign(p1.change ?? (p1.value !== null && p1.reference !== null ? p1.value - p1.reference : null));
    const s2 = sign(p2.change ?? (p2.value !== null && p2.reference !== null ? p2.value - p2.reference : null));
    if (s0 > 0 && s1 > 0 && s2 < 0) c.push({ type: "RED_TO_GREEN", key: "red-to-green", severity: 4, tone: "positive", title: "VN-Index quay lại sắc xanh", facts: { current: cur, previous: p1 } });
    if (s0 < 0 && s1 < 0 && s2 > 0) c.push({ type: "GREEN_TO_RED", key: "green-to-red", severity: 4, tone: "danger", title: "VN-Index chuyển lại sắc đỏ", facts: { current: cur, previous: p1 } });

    for (const [name, label] of [["ma10", "MA10"], ["ma20", "MA20"], ["vwap", "VWAP"]] as const) {
      if (crossedUp(cur.value, p1.value, p2.value, cur[name], p1[name], p2[name])) c.push({ type: `CROSS_${name.toUpperCase()}_UP`, key: `${name}-up`, severity: name === "ma20" ? 4 : 3, tone: "positive", title: `VN-Index lấy lại ${label}`, facts: { current: cur, level_name: label, level: cur[name] } });
      if (crossedDown(cur.value, p1.value, p2.value, cur[name], p1[name], p2[name])) c.push({ type: `CROSS_${name.toUpperCase()}_DOWN`, key: `${name}-down`, severity: name === "ma20" ? 4 : 3, tone: "warning", title: `VN-Index mất ${label}`, facts: { current: cur, level_name: label, level: cur[name] } });
    }
  }

  for (const threshold of [10, 7, 4]) {
    if (cur.rebound !== null && p1.rebound !== null && cur.rebound >= threshold && p1.rebound < threshold) {
      c.push({ type: "REBOUND_FROM_LOW", key: `rebound-${threshold}`, severity: threshold >= 7 ? 4 : 3, tone: "positive", title: `VN-Index hồi ${threshold} điểm từ đáy phiên`, facts: { current: cur, threshold } });
      break;
    }
  }
  for (const threshold of [10, 7, 4]) {
    if (cur.drop !== null && p1.drop !== null && cur.drop >= threshold && p1.drop < threshold) {
      c.push({ type: "DROP_FROM_HIGH", key: `drop-${threshold}`, severity: threshold >= 7 ? 4 : 3, tone: "warning", title: `VN-Index lùi ${threshold} điểm từ đỉnh phiên`, facts: { current: cur, threshold } });
      break;
    }
  }

  const past15 = findPast(previousRows, capturedAt, 15);
  if (past15) {
    const m15 = metrics(past15.payload);
    if (cur.breadth !== null && m15.breadth !== null) {
      const delta = cur.breadth - m15.breadth;
      if (delta >= 0.16) c.push({ type: "BREADTH_IMPROVE", key: "breadth-improve", severity: 3, tone: "positive", title: "Độ rộng thị trường cải thiện rõ", facts: { current: cur, before: m15, delta: round(delta, 3) } });
      if (delta <= -0.16) c.push({ type: "BREADTH_WORSEN", key: "breadth-worsen", severity: 3, tone: "warning", title: "Độ rộng thị trường xấu đi", facts: { current: cur, before: m15, delta: round(delta, 3) } });
    }

    const topNow = topSector(payload);
    const topBefore = topSector(past15.payload);
    if (topNow && topBefore && String(topNow.key || topNow.name) !== String(topBefore.key || topBefore.name) && Number(topNow.change_pct) >= 0.45) {
      c.push({ type: "SECTOR_LEADER_CHANGE", key: `leader-${String(topNow.key || topNow.name)}`, severity: 2, tone: "neutral", title: `${topNow.name} vươn lên nhóm nổi bật`, facts: { current: cur, sector: topNow, previous_sector: topBefore } });
    }

    if (topNow) {
      const beforeSame = sectorByKey(past15.payload, String(topNow.key || topNow.symbol || topNow.name));
      const nowPct = n(topNow.change_pct);
      const beforePct = n(beforeSame?.change_pct);
      if (nowPct !== null && beforePct !== null && nowPct >= 0.65 && nowPct - beforePct >= 0.35) {
        c.push({ type: "SECTOR_ACCELERATE", key: `sector-accelerate-${String(topNow.key || topNow.name)}`, severity: 3, tone: "positive", title: `${topNow.name} đang mạnh lên rõ trong 15 phút`, facts: { current: cur, sector: topNow, before_sector: beforeSame } });
      }
    }
  }

  if (cur.pct !== null && cur.breadth !== null) {
    const prevCondition = p1.pct !== null && p1.breadth !== null && p1.pct >= 0 && p1.breadth <= -0.12;
    if (cur.pct >= 0 && cur.breadth <= -0.12 && !prevCondition) c.push({ type: "INDEX_GREEN_BREADTH_WEAK", key: "green-breadth-weak", severity: 4, tone: "warning", title: "Chỉ số xanh nhưng độ rộng vẫn yếu", facts: { current: cur } });
  }

  const pace = n(first(payload, ["market.flow.pace_ratio_15m"]));
  const prevPace = n(first(previousRows[0]?.payload, ["market.flow.pace_ratio_15m"]));
  if (pace !== null && pace >= 1.35 && (prevPace === null || prevPace < 1.2)) c.push({ type: "LIQUIDITY_ACCELERATE", key: "liquidity-accelerate", severity: 2, tone: "neutral", title: "Dòng tiền trong phiên đang tăng tốc", facts: { current: cur, pace_ratio: round(pace, 2) } });

  return c.sort((a, b) => b.severity - a.severity);
}

function fmt(x: number | null, digits = 2) {
  if (x === null) return "—";
  return new Intl.NumberFormat("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
}
function signed(x: number | null, digits = 2) {
  if (x === null) return "—";
  return `${x > 0 ? "+" : ""}${fmt(x, digits)}`;
}
function breadthSentence(cur: any) {
  if (cur.adv === null || cur.dec === null) return "";
  if (cur.adv > cur.dec * 1.25) return `Độ rộng nghiêng tích cực với ${Math.round(cur.adv)} mã tăng so với ${Math.round(cur.dec)} mã giảm.`;
  if (cur.dec > cur.adv * 1.25) return `Độ rộng còn yếu với ${Math.round(cur.dec)} mã giảm so với ${Math.round(cur.adv)} mã tăng.`;
  return `Độ rộng khá cân bằng: ${Math.round(cur.adv)} mã tăng và ${Math.round(cur.dec)} mã giảm.`;
}
function topSectorDetail(payload: any) {
  const s = topSector(payload);
  if (!s) return "";
  const pct = n(s.change_pct);
  const adv = n(s.adv), dec = n(s.dec);
  const leaders = Array.isArray(s.top_gainers) ? s.top_gainers.map((x: any) => x.symbol).filter(Boolean).slice(0, 3) : [];
  let text = `${s.name} đang là nhóm nổi bật, bình quân ${signed(pct)}%`;
  if (adv !== null && dec !== null) text += ` với ${Math.round(adv)} mã tăng/${Math.round(dec)} mã giảm`;
  text += ".";
  if (leaders.length) text += ` Nổi bật trong nhóm: ${leaders.join(", ")}.`;
  return text;
}
function supportText(payload: any) {
  const cur = metrics(payload);
  if (cur.resistance !== null && cur.value !== null && cur.resistance > cur.value && (cur.resistance / cur.value - 1) <= 0.012) return `Theo dõi phản ứng của chỉ số khi tiến gần vùng cản ${fmt(cur.resistance, 1)} điểm, đồng thời nhìn xem độ rộng và dòng tiền có tiếp tục cải thiện hay không.`;
  if (cur.support !== null && cur.value !== null && cur.support < cur.value && (cur.value / cur.support - 1) <= 0.012) return `Theo dõi khả năng giữ vùng hỗ trợ ${fmt(cur.support, 1)} điểm cùng diễn biến độ rộng và nhóm dẫn dắt.`;
  return "Theo dõi tiếp độ rộng, dòng tiền và sức mạnh của các nhóm dẫn dắt để xem thay đổi hiện tại có được duy trì hay không.";
}
function makeComment(candidate: Candidate, payload: any) {
  const cur = metrics(payload);
  const breadth = breadthSentence(cur);
  const sector = topSectorDetail(payload);
  const vn30 = Array.isArray(payload?.vn30_stocks)
    ? [...payload.vn30_stocks].filter((x: any) => (n(x?.change_pct) ?? 0) > 0).sort((a: any, b: any) => Number(b.change_pct) - Number(a.change_pct)).slice(0, 3)
    : [];

  let lead = `VN-Index hiện ở ${fmt(cur.value, 2)} điểm, ${signed(cur.change, 2)} điểm (${signed(cur.pct, 2)}%).`;
  if (candidate.type === "RED_TO_GREEN") lead = `VN-Index đã quay lại sắc xanh sau nhịp yếu trước đó và hiện ở ${fmt(cur.value, 2)} điểm.`;
  if (candidate.type === "GREEN_TO_RED") lead = `VN-Index đã chuyển lại sắc đỏ và hiện ở ${fmt(cur.value, 2)} điểm.`;
  if (candidate.type === "REBOUND_FROM_LOW" && cur.rebound !== null) lead = `VN-Index đã hồi khoảng ${fmt(cur.rebound, 1)} điểm từ đáy phiên và hiện ở ${fmt(cur.value, 2)} điểm.`;
  if (candidate.type === "DROP_FROM_HIGH" && cur.drop !== null) lead = `VN-Index đã lùi khoảng ${fmt(cur.drop, 1)} điểm từ đỉnh phiên và hiện ở ${fmt(cur.value, 2)} điểm.`;
  if (candidate.type.startsWith("CROSS_")) lead = `${candidate.title} quanh ${fmt(n(candidate.facts?.level), 1)} điểm. VN-Index hiện ở ${fmt(cur.value, 2)} điểm.`;
  if (candidate.type === "INDEX_GREEN_BREADTH_WEAK") lead = `VN-Index vẫn giữ sắc xanh, nhưng độ rộng chưa xác nhận sức mạnh của chỉ số.`;
  if (candidate.type === "BREADTH_IMPROVE") lead = `Độ rộng thị trường đang cải thiện rõ so với khoảng 15 phút trước.`;
  if (candidate.type === "BREADTH_WORSEN") lead = `Độ rộng thị trường đang yếu đi rõ so với khoảng 15 phút trước.`;
  if (candidate.type === "SECTOR_ACCELERATE" || candidate.type === "SECTOR_LEADER_CHANGE") lead = `${candidate.title}.`;

  const body = [lead, breadth, sector].filter(Boolean).join(" ");
  const top = topSector(payload);
  const evidence = {
    vnindex: { ...cur },
    top_sector: top || null,
    sector_leaders: top?.top_gainers || [],
    vn30_gainers: vn30,
    source: "AmiBroker technical + AmiBroker Watch Lists + market-feed",
  };
  return { tone: candidate.tone, headline: candidate.title, body, watch_next: supportText(payload), evidence };
}

async function restGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: serviceHeaders() });
  if (!r.ok) return [];
  try { return await r.json(); } catch { return []; }
}
async function upsertCurrent(row: any) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/market_live_current?on_conflict=id`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(row),
  });
  return r.ok;
}
async function insertSnapshot(row: any) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/market_live_snapshots`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json", "Prefer": "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!r.ok) return null;
  try { return (await r.json())?.[0] || null; } catch { return null; }
}
async function insertEvent(row: any) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/market_live_events`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json", "Prefer": "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!r.ok) return null;
  try { return (await r.json())?.[0] || null; } catch { return null; }
}
async function insertComment(row: any) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/market_live_comments`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json", "Prefer": "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!r.ok) return null;
  try { return (await r.json())?.[0] || null; } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (!BRIDGE_KEY || req.headers.get("x-bridge-key") !== BRIDGE_KEY) return json(req, { ok: false, error: "UNAUTHORIZED" }, 401);

  let input: any;
  try { input = await req.json(); } catch { return json(req, { ok: false, error: "INVALID_JSON" }, 400); }
  if (!input?.ok) return json(req, { ok: false, error: "INVALID_PAYLOAD" }, 400);

  const capturedAt = typeof input?.captured_at === "string" && !Number.isNaN(new Date(input.captured_at).getTime())
    ? new Date(input.captured_at).toISOString()
    : new Date().toISOString();
  const marketDate = vnDate(capturedAt);
  const payload = normalize(input);
  const source = String(input?.source || "amibroker-live");
  const sourceUpdatedAt = typeof input?.source_updated_at === "string" && !Number.isNaN(new Date(input.source_updated_at).getTime())
    ? new Date(input.source_updated_at).toISOString()
    : null;

  const previousRows = await restGet(`market_live_snapshots?market_date=eq.${encodeURIComponent(marketDate)}&select=id,captured_at,payload&order=captured_at.desc&limit=20`);
  const candidates = detect(payload, previousRows, capturedAt);

  let chosen: Candidate | null = null;
  for (const candidate of candidates) {
    const recent = await restGet(`market_live_events?market_date=eq.${encodeURIComponent(marketDate)}&event_key=eq.${encodeURIComponent(candidate.key)}&select=id,detected_at&order=detected_at.desc&limit=1`);
    if (!recent.length) { chosen = candidate; break; }
    const ageMs = new Date(capturedAt).getTime() - new Date(recent[0].detected_at).getTime();
    const cooldownMs = candidate.severity >= 4 ? 3 * 60_000 : 5 * 60_000;
    if (ageMs >= cooldownMs) { chosen = candidate; break; }
  }

  const currentStored = await upsertCurrent({
    id: "vietnam",
    market_date: marketDate,
    captured_at: capturedAt,
    source_updated_at: sourceUpdatedAt,
    source,
    payload,
    updated_at: new Date().toISOString(),
  });

  const lastHistoryAt = previousRows.length ? new Date(previousRows[0].captured_at).getTime() : 0;
  const dueHistory = !lastHistoryAt || (new Date(capturedAt).getTime() - lastHistoryAt) >= 55_000;
  const mustStoreSnapshot = dueHistory || Boolean(chosen);

  let snapshot: any = null;
  if (mustStoreSnapshot) {
    snapshot = await insertSnapshot({
      market_date: marketDate,
      captured_at: capturedAt,
      source_updated_at: sourceUpdatedAt,
      source,
      payload,
    });
  }

  let publishedComment: any = null;
  let eventRow: any = null;
  if (chosen && snapshot) {
    eventRow = await insertEvent({
      market_date: marketDate,
      detected_at: capturedAt,
      snapshot_id: snapshot.id,
      event_type: chosen.type,
      event_key: chosen.key,
      severity: chosen.severity,
      tone: chosen.tone,
      title: chosen.title,
      facts: chosen.facts,
    });

    if (eventRow) {
      const comment = makeComment(chosen, payload);
      publishedComment = await insertComment({
        market_date: marketDate,
        published_at: capturedAt,
        event_id: eventRow.id,
        snapshot_id: snapshot.id,
        tone: comment.tone,
        headline: comment.headline,
        body: comment.body,
        watch_next: comment.watch_next,
        evidence: comment.evidence,
        source_mode: "rule-template-local-first-v2",
      });
    }
  }

  return json(req, {
    ok: true,
    current_stored: currentStored,
    history_stored: Boolean(snapshot),
    history_mode: "about-1-minute-plus-events",
    watchlist_sector_count: Array.isArray(payload.watchlist_sectors) ? payload.watchlist_sectors.length : 0,
    published_comment: publishedComment,
    event: eventRow ? { id: eventRow.id, type: eventRow.event_type, title: eventRow.title } : null,
  });
});
