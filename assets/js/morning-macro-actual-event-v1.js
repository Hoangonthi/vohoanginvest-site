const VH_ACTUAL_MACRO_ENDPOINT='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public';
const VH_ACTUAL_REFRESH_MS=60000;

const vhEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function vhWaitDecisionBoard(){
  for(let i=0;i<120;i++){
    const host=document.getElementById('vhDecisionBoardV5');
    if(host)return host;
    await new Promise(r=>setTimeout(r,100));
  }
  return null;
}

function vhMacroSection(host){
  const sections=[...host.querySelectorAll('.vh5-section')];
  return sections.find(sec=>/vĩ mô|vi mo|macro/i.test(sec.textContent||''))||sections[1]||null;
}

function vhPolicyModel(m){
  return (m?.cards||[]).find(x=>x?.id==='policy')||null;
}

function vhApplyActualMacro(host,m){
  const ev=m?.policy_event;
  if(!host||!ev?.ok)return false;

  const macroSec=vhMacroSection(host);
  if(!macroSec)return false;

  const policyModel=vhPolicyModel(m);
  const cards=[...macroSec.querySelectorAll('.vh5-card')];
  const policy=cards.find(c=>/tiền tệ|lai suất|lãi suất|fed/i.test(c.textContent||''))||cards[2]||null;

  if(policy&&policyModel){
    const cat=policy.querySelector('.vh5-cat');
    const title=policy.querySelector('h3');
    const evidence=policy.querySelector('.vh5-evidence');

    if(cat){
      cat.textContent=policyModel.status||'RỦI RO TIỀN TỆ TĂNG';
      cat.className='vh5-cat vh2-status-negative';
    }
    if(title&&policyModel.title)title.textContent=policyModel.title;
    if(evidence)evidence.textContent=(policyModel.evidence||[]).slice(0,3).join(' · ');
  }

  const sum=macroSec.querySelector('.vh5-macro-regime');
  if(sum){
    const watch=policyModel?.watch||'Hạ đánh giá thêm nếu DXY, lợi suất trái phiếu Mỹ, USD/VND và lãi suất trong nước cùng xấu đi sau quyết định Fed. Giảm mức cảnh báo nếu phản ứng quốc tế hạ nhiệt trong khi điều kiện tiền tệ trong nước vẫn ổn định.';
    const html=`<ul class="vh2-list"><li><b>Đánh giá:</b> ${vhEsc(m.regime||ev.label||'RỦI RO BÊN NGOÀI TĂNG')}</li><li><b>Sự kiện đã công bố:</b> ${vhEsc(ev.text||'')}</li><li><b>Ý nghĩa 3–12 tháng:</b> ${vhEsc(m.thesis||'')}</li><li><b>Khi nào thay đổi quan điểm?</b> ${vhEsc(watch)}</li></ul>`;
    if(sum.innerHTML!==html)sum.innerHTML=html;
  }

  // Confirmed/actual event is authoritative. Keep a machine-readable marker so
  // later render layers can detect that pre-event expectations are obsolete.
  host.dataset.vhActualMacroEvent=ev.event_id||'active';
  host.dataset.vhMacroPrecedence='ACTUAL_EVENT';
  host.dataset.vhMacroAsOf=String(m.as_of||ev.occurred_at||m.generated_at||'');
  window.__VH_CONFIRMED_MACRO_EVENT__={
    kind:ev.kind||'ACTUAL_EVENT',
    event_id:ev.event_id||null,
    occurred_at:ev.occurred_at||null,
    direction:ev.direction||null,
    rate_move_bps:ev.rate_move_bps??null,
    hawkish_forward:ev.hawkish_forward===true,
    regime:m.regime||null,
    generated_at:m.generated_at||null
  };
  return true;
}

async function vhFetchActualMacro(){
  const sep=VH_ACTUAL_MACRO_ENDPOINT.includes('?')?'&':'?';
  const r=await fetch(`${VH_ACTUAL_MACRO_ENDPOINT}${sep}fresh=${Date.now()}`,{
    headers:{Accept:'application/json','Cache-Control':'no-cache'},
    cache:'no-store'
  });
  const m=await r.json();
  if(!r.ok||!m?.ok)throw new Error(m?.error||`HTTP ${r.status}`);
  return m;
}

async function vhInitActualMacro(){
  const host=await vhWaitDecisionBoard();
  if(!host)return;

  let latest=null;
  let applying=false;
  let fetching=false;

  const apply=()=>{
    if(applying||!latest?.policy_event?.ok)return;
    applying=true;
    try{vhApplyActualMacro(host,latest)}finally{applying=false}
  };

  const refresh=async()=>{
    if(fetching)return;
    fetching=true;
    try{
      const next=await vhFetchActualMacro();
      // A verified/confirmed actual event always outranks expectation or an
      // older baked snapshot. Never downgrade from actual-event state here.
      if(next?.policy_event?.ok){
        latest=next;
        apply();
      }
    }catch(e){
      console.warn('morning-macro-actual-event-v1',e);
    }finally{
      fetching=false;
    }
  };

  await refresh();

  // Other V5 layers may re-render the board. Re-assert confirmed-event state
  // after every mutation instead of relying on a short-lived 15s patch.
  const obs=new MutationObserver(()=>requestAnimationFrame(apply));
  obs.observe(host,{childList:true,subtree:true,characterData:true});

  // News intelligence can confirm/update an event while the page remains open.
  setInterval(refresh,VH_ACTUAL_REFRESH_MS);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',vhInitActualMacro,{once:true});else vhInitActualMacro();