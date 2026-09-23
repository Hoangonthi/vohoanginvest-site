import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});

const ALLOWED=new Set([
  "https://www.vohoanginvest.com",
  "https://vohoanginvest.com",
  "https://hoangonthi.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

function cors(req:Request){
  const o=req.headers.get("origin")||"";
  return {
    "access-control-allow-origin":ALLOWED.has(o)?o:"https://www.vohoanginvest.com",
    "vary":"Origin",
    "access-control-allow-methods":"GET,OPTIONS",
    "access-control-allow-headers":"content-type",
    "content-type":"application/json; charset=utf-8",
    "cache-control":"public, max-age=30, s-maxage=60"
  };
}
function respond(req:Request,body:any,status=200){
  return new Response(JSON.stringify(body),{status,headers:cors(req)});
}
const clean=(v:any)=>String(v??"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const upper=(v:any)=>String(v??"").trim().toUpperCase();
const score=(v:any)=>Number.isFinite(Number(v))?Number(v):0;

function classifyEvent(e:any,symbol:string,sectorCode:string|null,sectorName:string|null){
  const tickers=(Array.isArray(e.primary_tickers)?e.primary_tickers:[]).map(upper);
  const sectors=(Array.isArray(e.sectors)?e.sectors:[]).map((x:any)=>upper(x));
  const direct=tickers.includes(symbol);
  const sectorKeys=[sectorCode,sectorName].filter(Boolean).map(upper);
  const sector=!direct && sectorKeys.some(k=>sectors.includes(k));
  const broad=!direct&&!sector&&tickers.length===0&&sectors.length===0&&
    (score(e.action_relevance_score)>=70||score(e.impact_score)>=70);
  if(direct)return "DIRECT_SYMBOL";
  if(sector)return "SECTOR";
  if(broad)return "MARKET";
  return null;
}
function rankEvent(e:any,directness:string){
  const base=directness==="DIRECT_SYMBOL"?300:directness==="SECTOR"?200:100;
  return base+
    Math.min(100,score(e.action_relevance_score))+
    Math.min(100,score(e.impact_score))+
    Math.min(100,score(e.confidence_score))*0.5+
    Math.min(100,score(e.evidence_quality_score))*0.25;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(req.method!=="GET")return respond(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);

  try{
    const url=new URL(req.url);
    const symbol=upper(url.searchParams.get("symbol"));
    const hours=Math.max(6,Math.min(168,Number(url.searchParams.get("hours")||72)));
    if(!/^[A-Z0-9]{2,12}$/.test(symbol)){
      return respond(req,{ok:false,error:"INVALID_SYMBOL"},400);
    }

    const {data:tax,error:taxErr}=await db
      .from("stock_symbol_taxonomy_v1")
      .select("symbol,fullname,market,asset_type,sector_code,sector_name,industry_code,industry_name,is_vietnam_equity,is_active,mapping_quality,source_updated_at")
      .eq("symbol",symbol)
      .eq("is_vietnam_equity",true)
      .maybeSingle();
    if(taxErr)throw taxErr;
    if(!tax)return respond(req,{ok:false,error:"SYMBOL_NOT_VIETNAM_EQUITY",symbol},404);

    const since=new Date(Date.now()-hours*3600000).toISOString();
    const {data:events,error:eventErr}=await db
      .from("news_intelligence_events")
      .select("id,event_title,event_type,canonical_news_item_id,primary_tickers,sectors,article_count,independent_source_count,impact_score,confidence_score,action_relevance_score,action_label,action_reason,direction,data_quality_score,evidence_quality_score,verification,market_confirmation,vietnam_transmission,last_seen_at,last_scored_at,status")
      .eq("status","ACTIVE")
      .gte("last_seen_at",since)
      .order("last_seen_at",{ascending:false})
      .limit(500);
    if(eventErr)throw eventErr;

    const related=(events||[])
      .map((e:any)=>{
        const directness=classifyEvent(e,symbol,tax.sector_code??null,tax.sector_name??null);
        return directness?{...e,directness,rank:rankEvent(e,directness)}:null;
      })
      .filter(Boolean)
      .sort((a:any,b:any)=>b.rank-a.rank||new Date(b.last_seen_at||0).getTime()-new Date(a.last_seen_at||0).getTime())
      .slice(0,18);

    const itemIds=[...new Set(related.map((e:any)=>e.canonical_news_item_id).filter(Boolean))];
    let rawMap=new Map<string,any>();
    if(itemIds.length){
      const {data:raw}=await db
        .from("news_items_raw")
        .select("id,title,summary,source_url,published_at,source_id")
        .in("id",itemIds);
      rawMap=new Map((raw||[]).map((x:any)=>[String(x.id),x]));
    }

    const news=related.map((e:any)=>{
      const raw=rawMap.get(String(e.canonical_news_item_id))||{};
      return {
        id:e.id,
        title:clean(raw.title||e.event_title),
        summary:clean(raw.summary||"").slice(0,420),
        event_type:e.event_type||null,
        directness:e.directness,
        tickers:e.primary_tickers||[],
        sectors:e.sectors||[],
        direction:e.direction||"UNKNOWN",
        impact_score:e.impact_score??null,
        confidence_score:e.confidence_score??null,
        action_relevance_score:e.action_relevance_score??null,
        action_label:e.action_label??null,
        action_reason:e.action_reason??null,
        evidence_quality_score:e.evidence_quality_score??null,
        data_quality_score:e.data_quality_score??null,
        verification:e.verification??null,
        market_confirmation:e.market_confirmation??null,
        vietnam_transmission:e.vietnam_transmission??null,
        article_count:e.article_count??1,
        independent_source_count:e.independent_source_count??1,
        published_at:raw.published_at||e.last_seen_at||null,
        last_seen_at:e.last_seen_at||null,
        source_url:raw.source_url||null,
        source_id:raw.source_id||null
      };
    });

    const {data:dcRows,error:dcErr}=await db
      .from("dc_live_decision_current_v1")
      .select("symbol,time_horizon,decision_policy_version,generated_at,received_at,source_mode,market_decision_state,decision_state,action,confidence,evidence_alignment,evidence_alignment_score,stock_state,sector_state,fundamental_state,hard_guard_codes,conflict_keys,missing_capabilities,degraded_capabilities,provider_health,official,authority,read_only")
      .eq("symbol",symbol)
      .order("generated_at",{ascending:false})
      .limit(1);
    if(dcErr)throw dcErr;
    const dc=dcRows?.[0]||null;
    const safeDc=dc&&dc.official===false&&dc.authority===false&&dc.read_only===true?dc:null;

    const counts={
      direct:news.filter((x:any)=>x.directness==="DIRECT_SYMBOL").length,
      sector:news.filter((x:any)=>x.directness==="SECTOR").length,
      market:news.filter((x:any)=>x.directness==="MARKET").length
    };

    return respond(req,{
      ok:true,
      engine:"VÕ HOÀNG STOCK INTELLIGENCE V1",
      version:"1.0-shadow-readonly",
      generated_at:new Date().toISOString(),
      symbol,
      window_hours:hours,
      taxonomy:tax,
      news:{
        counts,
        total:news.length,
        events:news,
        note:"Tin được xếp theo mức liên quan trực tiếp → ngành → thị trường. Không tự suy diễn quan hệ nhân quả ngoài dữ liệu đã xác minh."
      },
      decision_core:safeDc?{
        available:true,
        ...safeDc
      }:{
        available:false,
        reason:dc?"SHADOW_SAFETY_FLAGS_MISMATCH":"NO_CURRENT_DECISION"
      },
      safety:{
        official:false,
        authority:false,
        read_only:true
      }
    });
  }catch(error){
    return respond(req,{ok:false,error:"STOCK_INTELLIGENCE_FAILED",detail:String((error as any)?.message||error).slice(0,500)},500);
  }
});
