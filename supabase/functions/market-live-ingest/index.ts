import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const TARGET = `${SUPABASE_URL}/functions/v1/market-live-narrative-v3`;
const ALLOWED = new Set([
  "https://vohoanginvest.com",
  "https://www.vohoanginvest.com",
  "https://hoangonthi.github.io",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://www.vohoanginvest.com",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-bridge-key",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function price(v: unknown): number | null {
  const x = num(v);
  return x !== null && x > 0 ? x : null;
}

function first(obj: any, keys: string[]) {
  for (const key of keys) {
    const value = key.split(".").reduce((a, b) => a?.[b], obj);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function vnIndex(context: any) {
  const indexes = Array.isArray(context?.indexes) ? context.indexes : [];
  return indexes.find((x: any) => String(x?.symbol || "").toUpperCase() === "VN-INDEX") || null;
}

function bootstrapPayload(input: any) {
  if (!input || typeof input !== "object") return input;

  const ctx = input.market_context || {};
  const idx = vnIndex(ctx) || {};
  const t = input.technical && typeof input.technical === "object" ? { ...input.technical } : {};

  const priceFallback: Record<string, unknown> = {
    value: first(idx, ["value", "close", "last"]),
    reference: first(idx, ["reference", "ref", "prev_close"]),
    high: first(idx, ["high", "session_high"]),
    low: first(idx, ["low", "session_low"]),
  };
  for (const [key, value] of Object.entries(priceFallback)) {
    const existing = price(t[key]);
    const fallback = price(value);
    if (existing === null && fallback !== null) t[key] = fallback;
    else if (existing === null) delete t[key];
  }

  const numericFallback: Record<string, unknown> = {
    change: first(idx, ["change", "change_point"]),
    change_pct: first(idx, ["change_pct", "pct"]),
  };
  for (const [key, value] of Object.entries(numericFallback)) {
    if (num(t[key]) === null && num(value) !== null) t[key] = value;
  }

  // A level of 0 is not a valid VN-Index price. Remove stale AFL placeholders
  // so Narrative V3 can fall back safely instead of calculating a fake +1,800 point rebound.
  for (const key of ["reference","high","low","ma10","ma20","ma50","vwap","support_near","resistance_near","prev_high","prev_low","high20","low20"]) {
    if (key in t && price(t[key]) === null) delete t[key];
  }

  const current = {
    captured_at: input.captured_at || new Date().toISOString(),
    value: price(first(t, ["value", "close", "last"])),
    change: num(first(t, ["change", "change_point"])),
    pct: num(first(t, ["change_pct", "pct"])),
    breadth_balance: num(first(ctx, ["market_intelligence.breadth.balance"])),
    sectors: Array.isArray(input.sector_watchlists)
      ? input.sector_watchlists.map((s: any) => ({
          key: s?.key ?? null,
          name: s?.name ?? null,
          change_pct: num(s?.change_pct),
          breadth_balance: num(s?.breadth_balance),
        }))
      : [],
  };

  if (current.breadth_balance === null) {
    const adv = num(first(idx, ["adv"]));
    const flat = num(first(idx, ["flat"]));
    const dec = num(first(idx, ["dec"]));
    if (adv !== null && flat !== null && dec !== null && adv + flat + dec > 0) {
      current.breadth_balance = (adv - dec) / (adv + flat + dec);
    }
  }

  const memory = input.local_memory && typeof input.local_memory === "object"
    ? { ...input.local_memory }
    : {};

  for (const key of ["m5", "m15", "m30"]) {
    if (!memory[key]) memory[key] = current;
  }

  return {
    ...input,
    technical: t,
    local_memory: memory,
    ingest_bootstrap: true,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
    });
  }

  let body: string;
  try {
    const input = await req.json();
    body = JSON.stringify(bootstrapPayload(input));
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "INVALID_JSON" }), {
      status: 400,
      headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };
  const bridgeKey = req.headers.get("x-bridge-key");
  if (bridgeKey) headers["x-bridge-key"] = bridgeKey;

  try {
    const upstream = await fetch(TARGET, { method: "POST", headers, body });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: "NARRATIVE_V3_UNAVAILABLE",
      detail: String((error as Error)?.message || error).slice(0, 240),
    }), {
      status: 502,
      headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
    });
  }
});
