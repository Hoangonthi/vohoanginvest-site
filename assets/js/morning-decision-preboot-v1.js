(()=>{
  const SNAPSHOT_URL='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-snapshot-public';
  const SOURCE_URLS={
    decision:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test',
    macro:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public',
    hot:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed'
  };
  const CACHE_KEY='vh_morning_baked_snapshot_v1';
  const nativeFetch=window.fetch.bind(window);
  window.__vhMorningPerf=window.__vhMorningPerf||{startedAt:performance.now(),snapshot:'none'};

  const vnDay=v=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v))}catch{return''}};
  const validSnapshot=x=>!!(x?.ok&&x?.decision?.ok);
  const readLocal=()=>{try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!validSnapshot(x))return null;const stamp=x.updated_at||x.generated_at;return vnDay(stamp)===vnDay(Date.now())?x:null}catch{return null}};
  const writeLocal=x=>{try{if(validSnapshot(x))localStorage.setItem(CACHE_KEY,JSON.stringify(x))}catch{}};
  const responseFor=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

  let baked=readLocal();
  if(baked)window.__vhMorningPerf.snapshot='local';

  const fetchSnapshot=async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),3500);
    try{
      const r=await nativeFetch(SNAPSHOT_URL,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
      const j=await r.json();
      if(!r.ok||!validSnapshot(j))throw new Error(j?.error||`snapshot ${r.status}`);
      const prev=baked?.version||0;
      baked=j;writeLocal(j);window.__vhMorningSnapshot=j;window.__vhMorningPerf.snapshot='server';
      if(Number(j.version||0)!==Number(prev||0))window.dispatchEvent(new CustomEvent('vh:morning-snapshot',{detail:j}));
      return j;
    } finally {
      clearTimeout(timer);
    }
  };

  const snapshotPromise=fetchSnapshot().catch(()=>null);
  window.__vhMorningSnapshotPromise=snapshotPromise;

  window.fetch=async function(input,init={}){
    const url=String(typeof input==='string'?input:input?.url||'');
    const method=String(init?.method||input?.method||'GET').toUpperCase();
    if(method!=='GET')return nativeFetch(input,init);
    let key=null;
    if(url===SOURCE_URLS.decision)key='decision';
    else if(url===SOURCE_URLS.macro)key='macro';
    else if(url===SOURCE_URLS.hot)key='hot';
    if(!key)return nativeFetch(input,init);

    if(validSnapshot(baked)&&baked[key])return responseFor(baked[key]);
    const fresh=await snapshotPromise;
    if(validSnapshot(fresh)&&fresh[key])return responseFor(fresh[key]);
    return nativeFetch(input,init);
  };

  const refreshLoop=()=>{
    if(document.visibilityState==='visible')fetchSnapshot().catch(()=>{});
    setTimeout(refreshLoop,5*60*1000);
  };
  setTimeout(refreshLoop,5*60*1000);

  // Bản tin sáng phải luôn hiển thị ngay. Không dựng màn hình chờ chặn nội dung.
  document.getElementById('vhMorningDecisionLoading')?.remove();
  document.getElementById('vhMorningDecisionPrebootStyle')?.remove();
  const host=document.getElementById('vhDecisionBoardV5');
  if(host)host.classList.add('vh-final-ready');
})();
