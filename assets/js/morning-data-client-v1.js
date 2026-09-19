const SNAPSHOT_URL='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-snapshot-public';
const DIRECT={
  decision:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test',
  macro:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public',
  hot:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed'
};

let inflight=null;

const goodSnapshot=x=>Boolean(x?.ok&&x?.decision?.ok);

async function getJson(url){
  const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j?.ok)throw new Error(j?.error||j?.detail||`HTTP ${r.status}`);
  return j;
}

function asBundle(s){
  return {
    decision:s?.decision,
    macro:s?.macro?.ok?s.macro:{ok:false,cards:[]},
    hot:s?.hot?.ok?s.hot:{ok:false,stocks:[]},
    source:'MORNING_SNAPSHOT_PUBLIC',
    snapshot_version:s?.version??null,
    generated_at:s?.generated_at??null
  };
}

async function load(){
  if(goodSnapshot(window.__vhMorningSnapshot))return asBundle(window.__vhMorningSnapshot);
  if(window.__vhMorningSnapshotPromise){
    try{
      const s=await window.__vhMorningSnapshotPromise;
      if(goodSnapshot(s))return asBundle(s);
    }catch{}
  }
  try{
    const s=await getJson(SNAPSHOT_URL);
    if(goodSnapshot(s)){
      window.__vhMorningSnapshot=s;
      return asBundle(s);
    }
  }catch{}
  const [decision,macro,hot]=await Promise.all([
    getJson(DIRECT.decision),
    getJson(DIRECT.macro).catch(()=>({ok:false,cards:[]})),
    getJson(DIRECT.hot).catch(()=>({ok:false,stocks:[]}))
  ]);
  return {decision,macro,hot,source:'DIRECT_PROVIDER_FALLBACK',snapshot_version:null,generated_at:decision?.generated_at??null};
}

export function getMorningBundle({refresh=false}={}){
  if(refresh)inflight=null;
  if(!inflight)inflight=load().finally(()=>{setTimeout(()=>{inflight=null},15000)});
  return inflight;
}
