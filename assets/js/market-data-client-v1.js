const CANONICAL='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-context-public-v1';
const LEGACY='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed';

async function getJson(url,ms=7000){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),ms);
  try{
    const r=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'},signal:ctl.signal});
    const j=await r.json().catch(()=>null);
    if(!r.ok||!j)throw new Error(j?.error||`HTTP ${r.status}`);
    return j;
  }finally{clearTimeout(timer)}
}
function usable(x){
  const vn=Array.isArray(x?.indexes)?x.indexes.find(r=>String(r?.symbol||'')==='VN-INDEX')||x.indexes[0]:null;
  return Boolean(x?.market_intelligence&&vn&&Number.isFinite(Number(vn?.value)));
}

export async function getMarketContext({allowLegacy=true}={}){
  try{
    const x=await getJson(CANONICAL);
    if(!usable(x))throw new Error('CANONICAL_MARKET_INCOMPLETE');
    x.__vh_market_source='CANONICAL';
    return x;
  }catch(error){
    if(!allowLegacy)throw error;
    const x=await getJson(LEGACY);
    x.__vh_market_source='LEGACY_FALLBACK';
    x.__vh_market_fallback_reason=String(error?.message||error).slice(0,160);
    return x;
  }
}
