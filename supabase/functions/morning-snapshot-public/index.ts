import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED = new Set([
  "https://www.vohoanginvest.com",
  "https://vohoanginvest.com",
  "https://hoangonthi.github.io"
]);

function cors(req: Request){
  const origin=req.headers.get("origin")||"";
  return {
    "Access-Control-Allow-Origin": ALLOWED.has(origin)?origin:"https://www.vohoanginvest.com",
    "Access-Control-Allow-Methods":"GET,OPTIONS",
    "Access-Control-Allow-Headers":"content-type",
    "Vary":"Origin",
    "Cache-Control":"public, max-age=10, stale-while-revalidate=50"
  };
}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),"Content-Type":"application/json; charset=utf-8"}})}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="GET")return json(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/morning_intelligence_snapshot?id=eq.current&select=id,version,payload,generated_at,source_decision_at,source_macro_at,source_hot_at,updated_at&limit=1`,{
      headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`}
    });
    if(!r.ok)throw new Error(`REST ${r.status}`);
    const rows=await r.json();
    const row=rows?.[0];
    if(!row)return json(req,{ok:false,error:"SNAPSHOT_NOT_READY"},404);
    return json(req,{ok:true,version:row.version,generated_at:row.generated_at,updated_at:row.updated_at,source_decision_at:row.source_decision_at,source_macro_at:row.source_macro_at,source_hot_at:row.source_hot_at,...row.payload});
  }catch(e){return json(req,{ok:false,error:"SNAPSHOT_READ_FAILED",detail:String((e as Error)?.message||e).slice(0,240)},500)}
});
