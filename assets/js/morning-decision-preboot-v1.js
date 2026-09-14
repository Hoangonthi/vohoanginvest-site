(()=>{
  const ENDPOINTS=new Set([
    'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test',
    'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public',
    'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed'
  ]);

  const POLICY={
    'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test':{fresh:45000,stale:180000},
    'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public':{fresh:15*60*1000,stale:6*60*60*1000},
    'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed':{fresh:15000,stale:45000}
  };
  const CACHE_PREFIX='vh_morning_http_v2:';
  const nativeFetch=window.fetch.bind(window);
  const pool=new Map();
  const refreshPool=new Map();
  window.__vhMorningPerf=window.__vhMorningPerf||{startedAt:performance.now(),cacheHits:0,networkHits:0};

  const responseFrom=x=>new Response(x.body,{status:x.status||200,statusText:x.statusText||'OK',headers:x.headers||{'content-type':'application/json; charset=utf-8'}});
  const readCache=url=>{
    try{
      const x=JSON.parse(localStorage.getItem(CACHE_PREFIX+url)||'null');
      if(!x?.body||!x?.savedAt)return null;
      return x;
    }catch{return null}
  };
  const writeCache=(url,x)=>{
    try{localStorage.setItem(CACHE_PREFIX+url,JSON.stringify({...x,savedAt:Date.now()}))}catch{}
  };
  const fetchFresh=async(url,input,init={})=>{
    if(refreshPool.has(url))return refreshPool.get(url);
    const p=(async()=>{
      try{
        const cleanInit={...init,cache:'no-store'};
        const r=await nativeFetch(input,cleanInit);
        const body=await r.text();
        const x={body,status:r.status,statusText:r.statusText,headers:[...r.headers.entries()]};
        if(r.ok){writeCache(url,x);window.__vhMorningPerf.networkHits++}
        return x;
      }finally{refreshPool.delete(url)}
    })();
    refreshPool.set(url,p);
    return p;
  };

  // Dùng snapshot vừa có để dựng giao diện ngay; đồng thời cập nhật nền.
  // Decision chỉ cho phép stale tối đa 3 phút, hot stocks 45 giây, macro 6 giờ.
  if(!window.__vhMorningFetchDedupeV2){
    window.__vhMorningFetchDedupeV2=true;
    window.fetch=async function(input,init={}){
      const url=String(typeof input==='string'?input:input?.url||'');
      const method=String(init?.method||input?.method||'GET').toUpperCase();
      if(method!=='GET'||!ENDPOINTS.has(url))return nativeFetch(input,init);
      if(pool.has(url))return responseFrom(await pool.get(url));

      const task=(async()=>{
        const policy=POLICY[url]||{fresh:30000,stale:60000};
        const cached=readCache(url);
        const age=cached?Date.now()-Number(cached.savedAt||0):Infinity;

        // Snapshot còn mới: trả ngay, revalidate nền khi đã đi quá nửa TTL.
        if(cached&&age<=policy.fresh){
          window.__vhMorningPerf.cacheHits++;
          if(age>policy.fresh*.5)fetchFresh(url,input,init).catch(()=>{});
          return cached;
        }

        // Snapshot hơi cũ nhưng vẫn trong ngưỡng an toàn: cho mạng tối đa 550ms.
        // Nếu nguồn ngoài chậm, hiển thị snapshot cũ ngay thay vì bắt người dùng chờ 4–5 giây.
        if(cached&&age<=policy.stale){
          const freshPromise=fetchFresh(url,input,init);
          const timeout=new Promise(resolve=>setTimeout(()=>resolve(null),550));
          const fast=await Promise.race([freshPromise,timeout]);
          if(fast){window.__vhMorningPerf.networkHits++;return fast}
          window.__vhMorningPerf.cacheHits++;
          freshPromise.catch(()=>{});
          return cached;
        }

        // Lần đầu hoặc cache quá cũ: phải chờ nguồn thật để tránh hiển thị dữ liệu lỗi thời.
        return await fetchFresh(url,input,init);
      })();

      pool.set(url,task);
      try{return responseFrom(await task)}catch(err){pool.delete(url);throw err}
    };
  }

  // Không cho layout V5 trung gian xuất hiện trước layout cuối.
  if(!document.getElementById('vhMorningDecisionPrebootStyle')){
    const s=document.createElement('style');
    s.id='vhMorningDecisionPrebootStyle';
    s.textContent=`
      #vhDecisionBoardV5:not(.vh-final-ready){display:none!important}
      #vhMorningDecisionLoading{position:relative;margin-top:20px;border:1px solid rgba(242,204,99,.26);border-radius:24px;background:linear-gradient(180deg,#071b2e,#051522);overflow:hidden;min-height:330px}
      #vhMorningDecisionLoading .vh-load-head{padding:24px 28px 19px;border-bottom:1px solid rgba(255,255,255,.07)}
      #vhMorningDecisionLoading .vh-load-kicker{width:330px;max-width:70%;height:12px;border-radius:999px;background:rgba(242,204,99,.16)}
      #vhMorningDecisionLoading .vh-load-title{width:520px;max-width:78%;height:34px;margin-top:13px;border-radius:10px;background:rgba(226,236,245,.09)}
      #vhMorningDecisionLoading .vh-load-sub{width:690px;max-width:88%;height:12px;margin-top:12px;border-radius:999px;background:rgba(226,236,245,.055)}
      #vhMorningDecisionLoading .vh-load-verdict{margin:16px 18px 10px;border:1px solid rgba(242,204,99,.30);border-radius:18px;padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
      #vhMorningDecisionLoading .vh-load-box{height:96px;border-radius:12px;background:rgba(13,48,75,.50);border:1px solid rgba(255,255,255,.055)}
      #vhMorningDecisionLoading .vh-load-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 18px 18px}
      #vhMorningDecisionLoading .vh-load-card{height:84px;border-radius:12px;background:rgba(12,43,68,.44);border:1px solid rgba(255,255,255,.05)}
      #vhMorningDecisionLoading .vh-load-kicker,#vhMorningDecisionLoading .vh-load-title,#vhMorningDecisionLoading .vh-load-sub,#vhMorningDecisionLoading .vh-load-box,#vhMorningDecisionLoading .vh-load-card{animation:vhLoadPulse 1.15s ease-in-out infinite alternate}
      @keyframes vhLoadPulse{from{opacity:.48}to{opacity:.88}}
      @media(max-width:720px){#vhMorningDecisionLoading{min-height:300px}#vhMorningDecisionLoading .vh-load-head{padding:18px}#vhMorningDecisionLoading .vh-load-verdict{grid-template-columns:1fr;margin:12px}.vh-load-grid{grid-template-columns:1fr!important;margin:10px 12px 14px!important}.vh-load-card:nth-child(n+2){display:none}}
    `;
    document.head.appendChild(s);
  }

  const findOld=()=>{
    for(const el of document.querySelectorAll('.overline,.section-kicker,.kicker')){
      const t=el.textContent.trim().toLowerCase();
      if(t==='tại điểm đáng chú ý')return el.closest('.card,.section,.split-card');
    }
    for(const el of document.querySelectorAll('h2,h3')){
      if(el.textContent.trim().toLowerCase().includes('những biến số có thể làm thay đổi quyết định hôm nay'))return el.closest('.card,.section,.split-card');
    }
    return null;
  };

  const mountLoading=()=>{
    if(document.getElementById('vhMorningDecisionLoading'))return;
    const anchor=findOld();
    if(anchor)anchor.style.display='none';
    const loading=document.createElement('section');
    loading.id='vhMorningDecisionLoading';
    loading.setAttribute('aria-label','Đang cập nhật hệ thống ra quyết định');
    loading.innerHTML=`<div class="vh-load-head"><div class="vh-load-kicker"></div><div class="vh-load-title"></div><div class="vh-load-sub"></div></div><div class="vh-load-verdict"><div class="vh-load-box"></div><div class="vh-load-box"></div></div><div class="vh-load-grid"><div class="vh-load-card"></div><div class="vh-load-card"></div><div class="vh-load-card"></div></div>`;
    if(anchor?.parentNode)anchor.parentNode.insertBefore(loading,anchor);
    else document.querySelector('main .wrap')?.appendChild(loading);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountLoading,{once:true});
  else mountLoading();
})();
