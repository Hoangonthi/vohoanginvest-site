import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(()=>new Response(JSON.stringify({
  ok:false,
  error:"ENDPOINT_RETIRED",
  replacement:"market-live-commentary-brain-v1",
  read_api:"market-live-public"
}),{
  status:410,
  headers:{"content-type":"application/json","cache-control":"public, max-age=86400"}
}));
