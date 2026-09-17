import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIDGE_KEY = Deno.env.get("VH_BRIDGE_KEY") || "";
const CURRENT_ID = "local-primary-web";
const HISTORY_MIN_MS = 55_000;

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
function h(extra: Record<string,string> = {}) {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, ...extra };
}
function validIso(v: unknown) {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}
function validDate(v: unknown) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function n(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v); return Number.isFinite(x) ? x : null;
}
function compactStock(x: any) {
  const symbol = String(x?.symbol || "").trim().toUpperCase();
  if (!symbol) return null;
  return {
    symbol,
    price: n(x?.price ?? x?.close),
    close: n(x?.close ?? x?.price),
    reference: n(x?.reference),
    change: n(x?.change),
    change_pct: n(x?.change_pct),
    open: n(x?.open), high: n(x?.high), low: n(x?.low),
    volume: n(x?.volume), date: x?.date || null,
    source_updated_at: x?.source_updated_at || null,
    source: x?.source || "DATATICK_EOD_RAW"
  };
}
function compactFrame(input: any) {
  const idx = Array.isArray(input?.market_context?.indexes)
    ? input.market_context.indexes.find((x:any)=>String(x?.symbol||"").toUpperCase()==="VNINDEX")
    : null;
  const breadth = input?.market_context?.market_intelligence?.breadth || {};
  const stocks = Array.isArray(input?.stocks) ? input.stocks.map(compactStock).filter(Boolean) : [];
  const movers = input?.market_context?.market_intelligence?.movers || { leaders: [], laggards: [] };
  return {
    schema: "VOHOANG_LOCAL_PRIMARY_WEB_FRAME_V1",
    captured_at: input.captured_at,
    market_date: input.market_date,
    source_updated_at: input.source_updated_at || null,
    source: "local-primary-datatick-eod+ami-itd-index-core-v1",
    technical_available: input.technical_available === true,
    technical: input.technical || {},
    index: idx ? {
      symbol: "VNINDEX", value: n(idx.value), reference: n(idx.reference), change: n(idx.change),
      change_pct: n(idx.change_pct), adv: n(idx.adv), dec: n(idx.dec), flat: n(idx.flat),
      volume: n(idx.volume), open: n(idx.open), high: n(idx.high), low: n(idx.low),
      source_updated_at: idx.source_updated_at || null, source: idx.source || "AMI_ITD_INDEX_CORE_V1"
    } : null,
    breadth: {
      total: n(breadth.total), adv: n(breadth.adv), dec: n(breadth.dec), flat: n(breadth.flat), balance: n(breadth.balance)
    },
    movers,
    markets: input?.market_context?.market_intelligence?.markets || [],
    sectors: Array.isArray(input?.sector_watchlists) ? input.sector_watchlists : [],
    stocks,
    collector_health: input?.collector_health || null,
    provenance: input?.market_context?.market_intelligence?.provenance || null
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return j({ ok:false, error:"METHOD_NOT_ALLOWED" }, 405);
  if (!BRIDGE_KEY || req.headers.get("x-bridge-key") !== BRIDGE_KEY) return j({ ok:false, error:"UNAUTHORIZED" }, 401);
  let input: any;
  try { input = await req.json(); } catch { return j({ ok:false, error:"INVALID_JSON" }, 400); }

  const capturedAt = validIso(input?.captured_at);
  const marketDate = validDate(input?.market_date);
  const source = String(input?.source || "");
  if (!capturedAt || !marketDate) return j({ ok:false, error:"INVALID_FRAME_TIME" }, 400);
  if (source !== "local-primary-datatick-eod+ami-itd-index-core-v1") return j({ ok:false, error:"INVALID_SOURCE", source }, 400);
  if (!Array.isArray(input?.stocks) || input.stocks.length < 1) return j({ ok:false, error:"EMPTY_STOCKS" }, 400);
  if (!Array.isArray(input?.market_context?.indexes)) return j({ ok:false, error:"MISSING_INDEXES" }, 400);

  const payload = compactFrame(input);
  if (!payload.index?.value) return j({ ok:false, error:"MISSING_VNINDEX" }, 400);

  const current = await fetch(`${SUPABASE_URL}/rest/v1/market_live_current?on_conflict=id`, {
    method:"POST",
    headers:h({ "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" }),
    body:JSON.stringify({
      id:CURRENT_ID,
      market_date:marketDate,
      captured_at:capturedAt,
      source_updated_at:validIso(input?.source_updated_at),
      source:"local-primary-web-v1",
      payload,
      updated_at:new Date().toISOString()
    })
  });
  if (!current.ok) return j({ ok:false, error:"CURRENT_UPSERT_FAILED", detail:(await current.text()).slice(0,500) }, 500);

  let historyStored = false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/market_live_snapshots?market_date=eq.${marketDate}&source=eq.local-primary-web-v1&select=captured_at&order=captured_at.desc&limit=1`, { headers:h() });
    const rows = r.ok ? await r.json() : [];
    const last = Array.isArray(rows) && rows[0]?.captured_at ? new Date(rows[0].captured_at).getTime() : 0;
    if (!last || new Date(capturedAt).getTime() - last >= HISTORY_MIN_MS) {
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/market_live_snapshots`, {
        method:"POST",
        headers:h({ "Content-Type":"application/json", Prefer:"return=minimal" }),
        body:JSON.stringify({ market_date:marketDate, captured_at:capturedAt, source_updated_at:validIso(input?.source_updated_at), source:"local-primary-web-v1", payload })
      });
      historyStored = ins.ok;
    }
  } catch {}

  return j({
    ok:true,
    engine:"local-primary-market-ingest-v1",
    market_date:marketDate,
    captured_at:capturedAt,
    stocks:payload.stocks.length,
    current_stored:true,
    history_stored:historyStored
  });
});
