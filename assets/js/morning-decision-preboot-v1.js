(()=>{
  const ENDPOINTS=new Set([
    'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test',
    'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public',
    'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed'
  ]);

  // 1) Dedupe ba nguồn dữ liệu dùng chung. Các engine phía sau nhận cùng một snapshot,
  // không gọi lại cùng endpoint 3-4 lần trong một lần tải trang.
  if(!window.__vhMorningFetchDedupeV1){
    window.__vhMorningFetchDedupeV1=true;
    const nativeFetch=window.fetch.bind(window);
    const pool=new Map();
    window.fetch=async function(input,init={}){
      const url=typeof input==='string'?input:input?.url;
      const method=String(init?.method||input?.method||'GET').toUpperCase();
      if(method!=='GET'||!ENDPOINTS.has(String(url))) return nativeFetch(input,init);
      const key=String(url);
      if(!pool.has(key)){
        pool.set(key,(async()=>{
          try{
            const r=await nativeFetch(input,init);
            const body=await r.text();
            return {body,status:r.status,statusText:r.statusText,headers:[...r.headers.entries()]};
          }catch(err){pool.delete(key);throw err}
        })());
      }
      const x=await pool.get(key);
      return new Response(x.body,{status:x.status,statusText:x.statusText,headers:x.headers});
    };
  }

  // 2) Không cho layout V5 trung gian xuất hiện trước layout cuối.
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
      if(t==='tại điểm đáng chú ý') return el.closest('.card,.section,.split-card');
    }
    for(const el of document.querySelectorAll('h2,h3')){
      if(el.textContent.trim().toLowerCase().includes('những biến số có thể làm thay đổi quyết định hôm nay')) return el.closest('.card,.section,.split-card');
    }
    return null;
  };

  const mountLoading=()=>{
    if(document.getElementById('vhMorningDecisionLoading'))return;
    const anchor=findOld();
    if(anchor) anchor.style.display='none';
    const loading=document.createElement('section');
    loading.id='vhMorningDecisionLoading';
    loading.setAttribute('aria-label','Đang cập nhật hệ thống ra quyết định');
    loading.innerHTML=`<div class="vh-load-head"><div class="vh-load-kicker"></div><div class="vh-load-title"></div><div class="vh-load-sub"></div></div><div class="vh-load-verdict"><div class="vh-load-box"></div><div class="vh-load-box"></div></div><div class="vh-load-grid"><div class="vh-load-card"></div><div class="vh-load-card"></div><div class="vh-load-card"></div></div>`;
    if(anchor?.parentNode) anchor.parentNode.insertBefore(loading,anchor);
    else document.querySelector('main .wrap')?.appendChild(loading);
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mountLoading,{once:true});
  else mountLoading();
})();
