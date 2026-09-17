const VH_ACTUAL_MACRO_ENDPOINT='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public';

const vhEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function vhWaitDecisionBoard(){
  for(let i=0;i<120;i++){
    const host=document.getElementById('vhDecisionBoardV5');
    if(host)return host;
    await new Promise(r=>setTimeout(r,100));
  }
  return null;
}

function vhApplyActualMacro(host,m){
  const ev=m?.policy_event;
  if(!host||!ev?.ok)return false;
  const sections=[...host.querySelectorAll('.vh5-section')];
  const macroSec=sections[1];
  if(!macroSec)return false;

  const cards=[...macroSec.querySelectorAll('.vh5-card')];
  const policy=cards.find(c=>(c.querySelector('h3')?.textContent||'').toLowerCase().includes('tiền tệ'))||cards[2];
  const policyModel=(m?.cards||[]).find(x=>x?.id==='policy');
  if(policy&&policyModel){
    const cat=policy.querySelector('.vh5-cat');
    const evidence=policy.querySelector('.vh5-evidence');
    if(cat){
      cat.textContent='RỦI RO TIỀN TỆ TĂNG';
      cat.className='vh5-cat vh2-status-negative';
    }
    if(evidence)evidence.textContent=(policyModel.evidence||[]).slice(0,3).join(' · ');
  }

  const sum=macroSec.querySelector('.vh5-macro-regime');
  if(sum){
    const html=`<ul class="vh2-list"><li><b>Đánh giá:</b> ${vhEsc(m.regime||ev.label||'RỦI RO BÊN NGOÀI TĂNG')}</li><li><b>Sự kiện đã công bố:</b> ${vhEsc(ev.text||'')}</li><li><b>Ý nghĩa 3–12 tháng:</b> ${vhEsc(m.thesis||'')}</li><li><b>Khi nào thay đổi quan điểm?</b> Hạ đánh giá thêm nếu DXY, lợi suất trái phiếu Mỹ, USD/VND và lãi suất trong nước cùng xấu đi sau quyết định Fed. Giảm mức cảnh báo nếu phản ứng quốc tế hạ nhiệt trong khi điều kiện tiền tệ trong nước vẫn ổn định.</li></ul>`;
    if(sum.innerHTML!==html)sum.innerHTML=html;
  }
  host.dataset.vhActualMacroEvent=ev.event_id||'active';
  return true;
}

async function vhInitActualMacro(){
  const host=await vhWaitDecisionBoard();
  if(!host)return;
  try{
    const sep=VH_ACTUAL_MACRO_ENDPOINT.includes('?')?'&':'?';
    const r=await fetch(`${VH_ACTUAL_MACRO_ENDPOINT}${sep}fresh=${Date.now()}`,{headers:{Accept:'application/json'},cache:'no-store'});
    const m=await r.json();
    if(!r.ok||!m?.ok||!m?.policy_event?.ok)return;
    let applying=false;
    const apply=()=>{
      if(applying)return;
      applying=true;
      try{vhApplyActualMacro(host,m)}finally{applying=false}
    };
    apply();
    const obs=new MutationObserver(()=>requestAnimationFrame(apply));
    obs.observe(host,{childList:true,subtree:true,characterData:true});
    setTimeout(()=>obs.disconnect(),15000);
  }catch(e){console.warn('morning-macro-actual-event-v1',e)}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',vhInitActualMacro,{once:true});else vhInitActualMacro();