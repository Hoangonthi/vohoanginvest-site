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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const body = await req.text();
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") || "application/json; charset=utf-8",
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
    return new Response(JSON.stringify({ ok: false, error: "NARRATIVE_V3_UNAVAILABLE", detail: String((error as Error)?.message || error).slice(0, 240) }), {
      status: 502,
      headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
    });
  }
});
