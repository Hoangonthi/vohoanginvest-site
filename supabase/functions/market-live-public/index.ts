import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = new Set(["https://vohoanginvest.com","https://www.vohoanginvest.com","https://hoangonthi.github.io"]);

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  return {
    "Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://www.vohoanginvest.com",
    "Access-Control-Allow-Methods":"GET,OPTIONS",
    "Access-Control-Allow-Headers":"content-type",
    "Cache-Control":"no-store",
    "Vary":"Origin"
  };
}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),"Content-Type":"application/json; charset=utf-8"}});}
function headers(extra:Record<string,string>={}){return{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,...extra};}
function vnDate(value:string|Date){const d=value instanceof Date?value:new Date(value);const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const get=(t:string)=>p.find(x=>x.type===t)?.value||"";return`${get("year")}-${get("month")}-${get("day")}`;}
function n(v:unknown){if(v===null||v===undefined||v==="")return null;const x=Number(v);return Number.isFinite(x)?x:null;}
function price(v:unknown){const x=n(v);return x!==null&&x>0?x:null;}
function first(obj:any,keys:string[]){for(const key of keys){const v=key.split(".").reduce((a,b)=>a?.[b],obj);if(v!==undefined&&v!==null&&v!=="")return v;}return null;}
function compactStock(x:any){return{symbol:x?.symbol||x?.code||"",price:price(first(x,["price","close","last"])),change_pct:n(first(x,["change_pct","changePct","pct"]))};}
function compactSector(row:any){return{key:row?.key||row?.symbol||"",name:row?.name||row?.symbol||"Nhóm ngành",role:row?.role||null,change_pct:n(row?.change_pct),adv:n(row?.adv),flat:n(row?.flat),dec:n(row?.dec),breadth_balance:n(row?.breadth_balance),member_count:n(row?.member_count),valid_count:n(row?.valid_count),coverage:n(row?.coverage),top_gainers:Array.isArray(row?.top_gainers)?row.top_gainers.slice(0,3).map(compactStock):[],top_losers:Array.isArray(row?.top_losers)?row.top_losers.slice(0,3).map(compactStock):[]};}
function compactWorld(w:any){if(!w)return null;const d=w?.driver||null;return{ball:w?.ball||null,match:{label:w?.match?.label||null,breadth:w?.match?.breadth||null,flow:w?.match?.flow||null},driver:d?{direction:d.direction||null,delta_15m:n(d.delta_15m),confidence:d.confidence||null,confidence_score:n(d.confidence_score),sector:d.sector?compactSector(d.sector):null,players:Array.isArray(d.players)?d.players.slice(0,3).map(compactStock):[]}:null,zones:w?.zones||null,lines:{strongest:Array.isArray(w?.lines?.strongest)?w.lines.strongest.slice(0,4).map(compactSector):[],weakest:Array.isArray(w?.lines?.weakest)?w.lines.weakest.slice(0,4).map(compactSector):[]},technical:w?.technical||null};}
function compactSnapshot(row:any){
  if(!row)return null;
  const p=row.payload||{},v=p?.market?.vnindex||{},t=p?.technical||{};
  const raw=Array.isArray(p?.watchlist_sectors)&&p.watchlist_sectors.length?p.watchlist_sectors:Array.isArray(p?.market?.sectors)?p.market.sectors:[];
  const sectors=raw.map(compactSector).filter((x:any)=>n(x.change_pct)!==null),sorted=[...sectors].sort((a:any,b:any)=>Number(b.change_pct)-Number(a.change_pct));
  const stocks=Array.isArray(p?.vn30_stocks)?p.vn30_stocks:[],stockRows=[...stocks].filter((x:any)=>n(first(x,["change_pct","changePct","pct"]))!==null).sort((a:any,b:any)=>Number(first(b,["change_pct","changePct","pct"]))-Number(first(a,["change_pct","changePct","pct"])));
  const value=price(v.value),high=price(v.high),low=price(v.low);
  const rebound=value!==null&&low!==null?Math.max(0,value-low):null;
  const drop=value!==null&&high!==null?Math.max(0,high-value):null;
  return {
    id:row.id,
    captured_at:row.captured_at,
    technical_available:Boolean(p.technical_available),
    local_first:Boolean(p.local_first),
    engine_version:p.engine_version||null,
    vnindex:{value,reference:price(v.reference),change:n(v.change),change_pct:n(v.change_pct),high,low,rebound_from_low:rebound,drop_from_high:drop,adv:n(v.adv),flat:n(v.flat),dec:n(v.dec),value_b:n(v.value_b)},
    technical:{ma10:price(t.ma10),ma20:price(t.ma20),ma50:price(t.ma50),vwap:price(t.vwap),rsi14:n(t.rsi14),macd:n(t.macd),macd_signal:n(t.macd_signal),support_near:price(t.support_near),resistance_near:price(t.resistance_near)},
    state:p?.market?.state||null,
    breadth:p?.market?.breadth||null,
    flow:p?.market?.flow||null,
    sectors:{strongest:sorted.slice(0,4),weakest:sorted.slice(-4).reverse(),all:sorted},
    vn30:{gainers:stockRows.filter((x:any)=>Number(first(x,["change_pct","changePct","pct"]))>0).slice(0,4).map(compactStock),losers:[...stockRows].reverse().filter((x:any)=>Number(first(x,["change_pct","changePct","pct"]))<0).slice(0,4).map(compactStock)},
    world:compactWorld(p?.world_model)
  };
}

async function readJson(url:string,init?:RequestInit){try{const r=await fetch(url,init);if(!r.ok)return null;return await r.json();}catch{return null;}}
async function derivatives(){
  const data=await readJson(`${SUPABASE_URL}/rest/v1/rpc/derivatives_public_v1`,{method:"POST",headers:headers({"Content-Type":"application/json"}),body:"{}"});
  if(!data)return null;
  const age=n(data.age_seconds);
  if(data.fresh!==true&&(age===null||age>45))return null;
  const raw=String(data.trend||"").toUpperCase();
  const direction=raw.includes("TĂNG")||raw==="TANG"?"TANG":raw.includes("GIẢM")||raw==="GIAM"?"GIAM":null;
  return direction?{symbol:data.symbol||null,direction,label:direction==="TANG"?"Nghiêng tăng":"Nghiêng giảm",last_price:price(data.last_price),system_price:price(data.system_price),reversal_price:price(data.reversal_price),source_updated_at:data.source_updated_at||null,age_seconds:age,fresh:age!==null&&age<=45}:null;
}
async function editorialContext(today:string){
  const data=await readJson(`${SUPABASE_URL}/rest/v1/market_live_admin_notes?market_date=eq.${today}&is_active=eq.true&select=id,note,created_at&order=created_at.desc&limit=1`,{headers:headers()});
  const row=Array.isArray(data)?data[0]:null;
  if(!row)return null;
  const age=Math.max(0,(Date.now()-new Date(row.created_at).getTime())/1000);
  if(!Number.isFinite(age)||age>3*3600)return null;
  return{id:row.id,text:String(row.note||"").slice(0,1200),created_at:row.created_at,age_seconds:Math.round(age)};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="GET")return json(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const url=new URL(req.url),limit=Math.max(1,Math.min(40,Number(url.searchParams.get("limit")||20))),after=Math.max(0,Number(url.searchParams.get("after_id")||0)),today=vnDate(new Date());

  const currentResp=await fetch(`${SUPABASE_URL}/rest/v1/market_live_current?id=eq.vietnam&market_date=eq.${today}&select=id,captured_at,payload&limit=1`,{headers:headers()});
  let currentRows:any[]=[];
  if(currentResp.ok){try{currentRows=await currentResp.json()}catch{}}
  if(!currentRows.length){const r=await fetch(`${SUPABASE_URL}/rest/v1/market_live_snapshots?market_date=eq.${today}&select=id,captured_at,payload&order=captured_at.desc&limit=1`,{headers:headers()});if(r.ok){try{currentRows=await r.json()}catch{}}}

  let path=`market_live_comments?market_date=eq.${today}`;
  if(after>0)path+=`&id=gt.${after}&order=id.asc&limit=${limit}`;else path+=`&order=published_at.desc,id.desc&limit=${limit}`;
  path+=`&select=id,published_at,tone,headline,body,watch_next,evidence,source_mode,event_id,snapshot_id,is_final,admin_edited_at`;

  const [commentsRaw,derivativeState,editorial]=await Promise.all([
    readJson(`${SUPABASE_URL}/rest/v1/${path}`,{headers:headers()}),
    derivatives(),
    editorialContext(today)
  ]);
  const comments=Array.isArray(commentsRaw)?commentsRaw:[];

  return json(req,{
    ok:true,
    market_date:today,
    latest:compactSnapshot(currentRows[0]||null),
    derivatives:derivativeState,
    editorial_context:editorial,
    comments,
    latest_comment_id:comments.length?Math.max(...comments.map((x:any)=>Number(x.id)||0)):after,
    polling_seconds:10,
    storage_mode:"local-first",
    engine:"narrative-world-v3",
    note:"AmiBroker giữ raw; cloud giữ current + history thưa + event/comment."
  });
});
