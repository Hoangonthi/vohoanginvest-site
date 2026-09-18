(()=>{
  const SNAPSHOT_URL='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-snapshot-public';
  const SOURCE_URLS={
    decision:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test',
    macro:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public',
    hot:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed'
  };
  const CACHE_KEY='vh_morning_baked_snapshot_v2';
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
    const r=await nativeFetch(SNAPSHOT_URL,{headers:{Accept:'application/json'},cache:'no-store'});
    const j=await r.json();
    if(!r.ok||!validSnapshot(j))throw new Error(j?.error||`snapshot ${r.status}`);
    const prev=baked?.version||0;
    baked=j;writeLocal(j);window.__vhMorningSnapshot=j;window.__vhMorningPerf.snapshot='server';
    if(Number(j.version||0)!==Number(prev||0))window.dispatchEvent(new CustomEvent('vh:morning-snapshot',{detail:j}));
    return j;
  };
  let snapshotPromise=fetchSnapshot().catch(()=>null);
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

  // Sau khi bánh đã được dọn, chỉ kiểm tra phiên bản snapshot mới ở nền.
  const refreshLoop=()=>{
    if(document.visibilityState==='visible')fetchSnapshot().catch(()=>{});
    setTimeout(refreshLoop,5*60*1000);
  };
  setTimeout(refreshLoop,5*60*1000);

  // Không cho layout cũ lóe lên trước layout cuối.
  if(!document.getElementById('vhMorningDecisionPrebootStyle')){
    const s=document.createElement('style');s.id='vhMorningDecisionPrebootStyle';s.textContent=`
      #vhDecisionBoardV5:not(.vh-final-ready){display:none!important}
      #vhMorningDecisionLoading{position:relative;margin-top:20px;border:1px solid rgba(242,204,99,.22);border-radius:24px;background:linear-gradient(180deg,#071b2e,#051522);overflow:hidden;min-height:250px}
      #vhMorningDecisionLoading .vh-load-head{padding:22px 28px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
      #vhMorningDecisionLoading .vh-load-kicker{width:300px;max-width:68%;height:11px;border-radius:999px;background:rgba(242,204,99,.14)}
      #vhMorningDecisionLoading .vh-load-title{width:480px;max-width:78%;height:30px;margin-top:12px;border-radius:10px;background:rgba(226,236,245,.08)}
      #vhMorningDecisionLoading .vh-load-verdict{margin:14px 18px;border:1px solid rgba(242,204,99,.22);border-radius:16px;padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #vhMorningDecisionLoading .vh-load-box{height:74px;border-radius:11px;background:rgba(13,48,75,.43);border:1px solid rgba(255,255,255,.05)}
      #vhMorningDecisionLoading .vh-load-kicker,#vhMorningDecisionLoading .vh-load-title,#vhMorningDecisionLoading .vh-load-box{animation:vhLoadPulse .9s ease-in-out infinite alternate}
      @keyframes vhLoadPulse{from{opacity:.46}to{opacity:.82}}
      @media(max-width:720px){#vhMorningDecisionLoading{min-height:220px}#vhMorningDecisionLoading .vh-load-head{padding:18px}#vhMorningDecisionLoading .vh-load-verdict{grid-template-columns:1fr;margin:12px}.vh-load-box:nth-child(2){display:none}}
    `;document.head.appendChild(s);
  }
  const findOld=()=>{
    for(const el of document.querySelectorAll('.overline,.section-kicker,.kicker'))if(el.textContent.trim().toLowerCase()==='tại điểm đáng chú ý')return el.closest('.card,.section,.split-card');
    for(const el of document.querySelectorAll('h2,h3'))if(el.textContent.trim().toLowerCase().includes('những biến số có thể làm thay đổi quyết định hôm nay'))return el.closest('.card,.section,.split-card');
    return null;
  };
  const mountLoading=()=>{
    if(document.getElementById('vhMorningDecisionLoading'))return;
    const anchor=findOld();if(anchor)anchor.style.display='none';
    const loading=document.createElement('section');loading.id='vhMorningDecisionLoading';loading.setAttribute('aria-label','Đang mở bản phân tích gần nhất');loading.innerHTML='<div class="vh-load-head"><div class="vh-load-kicker"></div><div class="vh-load-title"></div></div><div class="vh-load-verdict"><div class="vh-load-box"></div><div class="vh-load-box"></div></div>';
    if(anchor?.parentNode)anchor.parentNode.insertBefore(loading,anchor);else document.querySelector('main .wrap')?.appendChild(loading);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountLoading,{once:true});else mountLoading();
})();
