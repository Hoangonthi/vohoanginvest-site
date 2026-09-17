// Morning page source router: preserve the proven V5 UI while replacing legacy VN market sources.
// Only two Supabase function routes are rewritten; all other fetches are untouched.
const VH_LOCAL_MARKET='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/local-primary-market-public';
const VH_LOCAL_DECISION='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-local-primary';
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
  let url='';
  if(typeof input==='string') url=input;
  else if(input instanceof URL) url=input.href;
  else if(input&&typeof input.url==='string') url=input.url;
  let next=url;
  if(/\/functions\/v1\/market-feed(?:\?|$)/.test(url)) next=url.replace(/\/functions\/v1\/market-feed/, '/functions/v1/local-primary-market-public');
  else if(/\/functions\/v1\/morning-decision-test(?:\?|$)/.test(url)) next=url.replace(/\/functions\/v1\/morning-decision-test/, '/functions/v1/morning-decision-local-primary');
  if(next===url) return nativeFetch(input,init);
  if(typeof input==='string'||input instanceof URL) return nativeFetch(next,init);
  return nativeFetch(new Request(next,input),init);
};
window.__VH_MORNING_SOURCE__={market:VH_LOCAL_MARKET,decision:VH_LOCAL_DECISION,mode:'DATATICK_AMI_LOCAL_PRIMARY'};
