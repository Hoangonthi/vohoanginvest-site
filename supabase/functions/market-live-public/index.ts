import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = new Set([
  "https://vohoanginvest.com",
  "https://www.vohoanginvest.com",
  "https://hoangonthi.github.io",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://www.vohoanginvest.com",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" } });
}
function headers() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
}
function vnDate(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function first(obj: any, keys: string[]) {
  for (const key of keys) {
    const v = key.split(".").reduce((a, b) => a?.[b], obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}
function compactSector(row: any) {
  return {
    key: row?.key || row?.symbol || "",
    name: row?.name || row?.symbol || "Nhóm ngành",
    change_pct: n(row?.change_pct),
    adv: n(row?.adv),
    flat: n(row?.flat),
    dec: n(row?.dec),
    member_count: n(row?.member_count),
    valid_count: n(row?.valid_count),
    coverage: n(row?.coverage),
    top_gainers: Array.isArray(row?.top_gainers) ? row.top_gainers.slice(0, 3) : [],
    top_losers: Array.isArray(row?.top_losers) ? row.top_losers.slice(0, 3) : [],
  };
}
function compactSnapshot(row: any) {
  if (!row) return null;
  const p = row.payload || {};
  const v = p?.market?.vnindex || {};
  const t = p?.technical || {};
  const rawSectors = Array.isArray(p?.watchlist_sectors) && p.watchlist_sectors.length
    ? p.watchlist_sectors
    : Array.isArray(p?.market?.sectors) ? p.market.sectors : [];
  const sectors = rawSectors.map(compactSector).filter((x: any) => n(x.change_pct) !== null);
  const sorted = [...sectors].sort((a: any, b: any) => Number(b.change_pct) - Number(a.change_pct));
  const stocks = Array.isArray(p?.vn30_stocks) ? p.vn30_stocks : [];
  const stockRows = [...stocks]
    .filter((x: any) => n(first(x, ["change_pct", "changePct", "pct"])) !== null)
    .sort((a: any, b: any) => Number(first(b, ["change_pct", "changePct", "pct"])) - Number(first(a, ["change_pct", "changePct", "pct"])));

  return {
    id: row.id,
    captured_at: row.captured_at,
    technical_available: Boolean(p.technical_available),
    local_first: Boolean(p.local_first),
    vnindex: {
      value: n(v.value), change: n(v.change), change_pct: n(v.change_pct), high: n(v.high), low: n(v.low),
      rebound_from_low: n(v.rebound_from_low), drop_from_high: n(v.drop_from_high), adv: n(v.adv), flat: n(v.flat), dec: n(v.dec), value_b: n(v.value_b),
    },
    technical: {
      ma10: n(t.ma10), ma20: n(t.ma20), ma50: n(t.ma50), vwap: n(t.vwap), rsi14: n(t.rsi14),
      macd: n(t.macd), macd_signal: n(t.macd_signal), support_near: n(t.support_near), resistance_near: n(t.resistance_near),
    },
    state: p?.market?.state || null,
    breadth: p?.market?.breadth || null,
    flow: p?.market?.flow || null,
    sectors: { strongest: sorted.slice(0, 4), weakest: sorted.slice(-4).reverse(), all: sorted },
    vn30: {
      gainers: stockRows.filter((x: any) => Number(first(x, ["change_pct", "changePct", "pct"])) > 0).slice(0, 3),
      losers: [...stockRows].reverse().filter((x: any) => Number(first(x, ["change_pct", "changePct", "pct"])) < 0).slice(0, 3),
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "GET") return json(req, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(40, Number(url.searchParams.get("limit") || 20)));
  const after = Math.max(0, Number(url.searchParams.get("after_id") || 0));
  const today = vnDate(new Date());

  const currentResp = await fetch(`${SUPABASE_URL}/rest/v1/market_live_current?id=eq.vietnam&market_date=eq.${today}&select=id,captured_at,payload&limit=1`, { headers: headers() });
  let currentRows: any[] = [];
  if (currentResp.ok) { try { currentRows = await currentResp.json(); } catch {} }

  // Tương thích ngày đầu / dữ liệu cũ: nếu current chưa có thì lấy snapshot gần nhất.
  if (!currentRows.length) {
    const snapshotResp = await fetch(`${SUPABASE_URL}/rest/v1/market_live_snapshots?market_date=eq.${today}&select=id,captured_at,payload&order=captured_at.desc&limit=1`, { headers: headers() });
    if (snapshotResp.ok) { try { currentRows = await snapshotResp.json(); } catch {} }
  }

  let commentPath = `market_live_comments?market_date=eq.${today}`;
  if (after > 0) commentPath += `&id=gt.${after}&order=id.asc&limit=${limit}`;
  else commentPath += `&order=published_at.desc,id.desc&limit=${limit}`;
  commentPath += `&select=id,published_at,tone,headline,body,watch_next,evidence,source_mode,event_id,snapshot_id`;

  const commentsResp = await fetch(`${SUPABASE_URL}/rest/v1/${commentPath}`, { headers: headers() });
  let comments: any[] = [];
  if (commentsResp.ok) { try { comments = await commentsResp.json(); } catch {} }

  const latest = compactSnapshot(currentRows[0] || null);
  return json(req, {
    ok: true,
    market_date: today,
    latest,
    comments,
    latest_comment_id: comments.length ? Math.max(...comments.map((x: any) => Number(x.id) || 0)) : after,
    polling_seconds: 10,
    storage_mode: "local-first",
    note: "Dữ liệu thô được giữ trên máy; cloud giữ current + history thưa + event/comment.",
  });
});
