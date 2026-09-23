import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIDGE_KEY = Deno.env.get("VH_BRIDGE_KEY") || "";
const DERIVATIVES_SYMBOL = "VN30F1M";
const ALLOWED_SOURCES = new Set([
  "AmiBroker PSVN Trend",
  "DATATICK_PSVN_SUPERTREND_V1"
]);

const ALLOWED_ORIGINS = new Set([
  "https://hoangonthi.github.io",
  "https://vohoanginvest.com",
  "https://www.vohoanginvest.com"
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://hoangonthi.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-bridge-key",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type":"application/json; charset=utf-8" }
  });
}

function serviceHeaders(extra: Record<string,string> = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra
  };
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIso(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status:204, headers:cors(req) });

  if (req.method === "POST") {
    if (!BRIDGE_KEY || req.headers.get("x-bridge-key") !== BRIDGE_KEY) {
      return json(req, { ok:false, error:"UNAUTHORIZED" }, 401);
    }

    let body: any;
    try { body = await req.json(); }
    catch { return json(req, { ok:false, error:"INVALID_JSON" }, 400); }

    const symbol = String(body?.symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,20);
    const trend = String(body?.trend || "").toUpperCase();
    const source = String(body?.source || "AmiBroker PSVN Trend").trim();

    // This endpoint is dedicated to the VN30F1M derivatives card only.
    // Never allow VN-Index, VN30 cash or another symbol to overwrite psvn_trend.
    if (symbol !== DERIVATIVES_SYMBOL) {
      return json(req, { ok:false, error:"DERIVATIVES_SYMBOL_NOT_ALLOWED", expected_symbol:DERIVATIVES_SYMBOL }, 422);
    }
    if (!["TANG","GIAM"].includes(trend)) {
      return json(req, { ok:false, error:"INVALID_PAYLOAD" }, 400);
    }
    if (!ALLOWED_SOURCES.has(source)) {
      return json(req, { ok:false, error:"DERIVATIVES_SOURCE_NOT_ALLOWED" }, 422);
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/derivatives_ingest_internal_v2`, {
      method:"POST",
      headers:serviceHeaders({ "Content-Type":"application/json" }),
      body:JSON.stringify({
        p_symbol:symbol,
        p_trend:trend,
        p_system_price:num(body?.system_price),
        p_t1:num(body?.t1),
        p_t2:num(body?.t2),
        p_t3:num(body?.t3),
        p_reversal_price:num(body?.reversal_price),
        p_last_price:num(body?.last_price),
        p_source:source,
        p_source_updated_at:toIso(body?.source_updated_at)
      })
    });

    const text = await r.text();
    if (!r.ok) return json(req, { ok:false, error:"STORE_FAILED", status:r.status, detail:text }, 500);
    try { return json(req, JSON.parse(text), 200); }
    catch { return json(req, { ok:true }, 200); }
  }

  if (req.method === "GET") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/derivatives_public_v1`, {
      method:"POST",
      headers:serviceHeaders({ "Content-Type":"application/json" }),
      body:"{}"
    });
    const text = await r.text();
    if (!r.ok) return json(req, { ok:false, error:"READ_FAILED", status:r.status, detail:text }, 500);

    try {
      const payload = JSON.parse(text);
      if (String(payload?.symbol || "").toUpperCase() !== DERIVATIVES_SYMBOL) {
        return json(req, {
          title:"Xu hướng phái sinh",
          symbol:null,
          trend:null,
          system_price:null,
          targets:{ t1:null, t2:null, t3:null },
          reversal_price:null,
          last_price:null,
          source_updated_at:null,
          received_at:null,
          age_seconds:null,
          fresh:false
        }, 200);
      }
      return json(req, payload, 200);
    }
    catch { return json(req, { ok:false, error:"READ_PARSE_FAILED" }, 500); }
  }

  return json(req, { ok:false, error:"METHOD_NOT_ALLOWED" }, 405);
});