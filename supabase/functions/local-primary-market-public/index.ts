import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CURRENT_ID = "local-primary-web";
const ALLOWED = new Set(["https://vohoanginvest.com","https://www.vohoanginvest.com","https://hoangonthi.github.io"]);

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  return {
    "Access-Control-Allow-Origin":ALLOWED.has(origin)?origin:"https://www.vohoanginvest.com",
    "Access-Control-Allow-Methods":"GET,OPTIONS",
    "Access-Control-Allow-Headers":"content-type",
    "Cache-Control":"no-store, no-cache, must-revalidate, max-age=0",
    "Pragma":"no-cache",
    "Vary":"Origin"
  };
}
function j(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),"Content-Type":"application/json; charset=utf-8"}});}
function h(){return{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`};}
function n(v:any){if(v===null||v===undefined||v==="")return null;const x=Number(v);return Number.isFinite(x)?x:null;}
function clamp(x:number,a:number,b:number){return Math.min(b,Math.max(a,x));}
function state(score:number){
  if(score>=72)return{code:"positive",label:"TÍCH CỰC",tone:"positive",risk_level:1,score};
  if(score>=58)return{code:"constructive",label:"NGHIÊNG TÍCH CỰC",tone:"positive",risk_level:2,score};
  if(score>=46)return{code:"mixed",label:"PHÂN HÓA",tone:"neutral",risk_level:3,score};
  if(score>=32)return{code:"cautious",label:"THẬN TRỌNG",tone:"warning",risk_level:4,score};
  return{code:"risk",label:"RỦI RO CAO",tone:"danger",risk_level:5,score};
}
function breadthLabel(balance:number|null){
  if(balance===null)return{label:"Chưa đủ dữ liệu",tone:"neutral"};
  if(balance>=.25)return{label:"Lan tỏa tốt",tone:"positive"};
  if(balance>=.08)return{label:"Nghiêng tích cực",tone:"positive"};
  if(balance>-.08)return{label:"Cân bằng",tone:"neutral"};
  if(balance>-.25)return{label:"Yếu",tone:"warning"};
  return{label:"Rất yếu",tone:"danger"};
}
function vnParts(d=new Date()){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(d);
  const g=(t:string)=>p.find(x=>x.type===t)?.value||"";
  return{weekday:g("weekday"),minute:Number(g("hour"))*60+Number(g("minute"))};
}
function freshness(capturedAt:string|null){
  if(!capturedAt)return{status:"unknown",label:"Chưa xác định",age_seconds:null,tone:"neutral"};
  const age=Math.max(0,Math.round((Date.now()-new Date(capturedAt).getTime())/1000));
  const p=vnParts();
  const live=!['Sat','Sun'].includes(p.weekday)&&((p.minute>=525&&p.minute<=695)||(p.minute>=770&&p.minute<=910));
  if(!live)return{status:"closed",label:"Dữ liệu gần nhất",age_seconds:age,tone:"neutral"};
  if(age<=45)return{status:"live",label:"Realtime",age_seconds:age,tone:"positive"};
  if(age<=150)return{status:"delayed",label:"Đang cập nhật",age_seconds:age,tone:"warning"};
  return{status:"stale",label:"Dữ liệu chậm",age_seconds:age,tone:"danger"};
}
function score(payload:any){
  let s=50;
  const pct=n(payload?.index?.change_pct);
  const bal=n(payload?.breadth?.balance);
  if(pct!==null)s+=clamp(pct,-2,2)*8;
  if(bal!==null)s+=bal*30;
  return Math.round(clamp(s,0,100));
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="GET")return j(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const r=await fetch(`${SUPABASE_URL}/rest/v1/market_live_current?id=eq.${CURRENT_ID}&select=market_date,captured_at,source_updated_at,source,payload,updated_at&limit=1`,{headers:h()});
  if(!r.ok)return j(req,{ok:false,error:"CURRENT_READ_FAILED"},502);
  const rows=await r.json();
  if(!Array.isArray(rows)||!rows.length)return j(req,{ok:false,error:"NO_LOCAL_PRIMARY_DATA"},404);
  const row=rows[0],p=row.payload||{},idx=p.index||{},b=p.breadth||{};
  const adv=n(b.adv),dec=n(b.dec),flat=n(b.flat),total=n(b.total)??([adv,dec,flat].every(x=>x!==null)?adv!+dec!+flat!:null);
  const balance=n(b.balance)??(total&&adv!==null&&dec!==null?(adv-dec)/total:null);
  const marketScore=score(p),st=state(marketScore),bl=breadthLabel(balance),fresh=freshness(row.captured_at||null);
  const stocks=Array.isArray(p.stocks)?p.stocks:[];
  const indexes=[{
    symbol:"VN-INDEX",
    value:n(idx.value),reference:n(idx.reference),change:n(idx.change),change_pct:n(idx.change_pct),
    adv,flat,dec,volume:n(idx.volume),open:n(idx.open),high:n(idx.high),low:n(idx.low),
    source_updated_at:idx.source_updated_at||row.source_updated_at||null,
    source:idx.source||"AMI_ITD_INDEX_CORE_V1"
  }];
  return j(req,{
    ok:true,
    engine:"local-primary-market-public-v1",
    storage_mode:"local-primary-realtime",
    market_date:row.market_date,
    updated_at:row.updated_at,
    relay_received_at:row.updated_at,
    relay_source_updated_at:row.source_updated_at,
    captured_at:row.captured_at,
    source:row.source,
    indexes,
    stocks,
    market_intelligence:{
      state:st,
      freshness:fresh,
      breadth:{adv,dec,flat,total,balance,label:bl.label,tone:bl.tone},
      flow:{value_b:null,same_time_ratio:null,label:"Chưa có chuẩn GTGD xác minh",tone:"neutral"},
      leadership:{leader:null,source:"sector_metadata_not_verified"},
      movers:p.movers||{leaders:[],laggards:[]},
      markets:p.markets||[],
      sectors:Array.isArray(p.sectors)?p.sectors:[],
      provenance:{cash:"DATATICK_EOD_RAW",index:"AMI_ITD_INDEX_CORE_V1",cloud:"SUPABASE_RELAY_ONLY", ...(p.provenance||{})}
    },
    vn30_stocks:[]
  });
});
