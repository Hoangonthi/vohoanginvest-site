const VH_BRAIN='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test';
const VH_HOT='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed';

const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nn=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const fmt=(v,d=1)=>{const x=nn(v);return x==null?'—':x.toLocaleString('vi-VN',{maximumFractionDigits:d})};
const pct=(v,d=1)=>{const x=nn(v);return x==null?'—':(x>0?'+':'')+fmt(x,d)+'%'};

function addStyle(){
  if(q('#vhLivePatchStyle'))return;
  const s=document.createElement('style');
  s.id='vhLivePatchStyle';
  s.textContent='#vhDecisionBoardV5 .vh-live-updated{transition:background-color .45s ease;background-color:rgba(84,205,164,.07)!important}#vhDecisionBoardV5 .vh-live-stamp{color:#7fd9b8}';
  document.head.appendChild(s);
}
function flash(el){if(!el)return;el.classList.remove('vh-live-updated');void el.offsetWidth;el.classList.add('vh-live-updated');setTimeout(()=>el.classList.remove('vh-live-updated'),650)}
function setText(el,text){if(!el||text==null||el.textContent===String(text))return false;el.textContent=String(text);flash(el);return true}
function setHtml(el,html){if(!el||el.innerHTML===html)return false;el.innerHTML=html;flash(el);return true}
function section(host,name){return qa('.vh5-section',host).find(x=>q('.vh5-sec-title',x)?.textContent?.toLowerCase().includes(name.toLowerCase()))||null}
function toneClass(x){return x?.direction==='negative'?'redish':x?.direction==='positive'?'greenish':'warn'}
function signalHeadline(x){return String(x?.title||x?.summary||'Tín hiệu đáng chú ý')}
function signalImpact(x){return String(x?.action_effect||x?.summary||'Đọc cùng giá, độ rộng và dòng tiền trước khi thay đổi hành động.')}
function shortBrainLabel(d){const raw=d?.brain?.conclusion?.label_short||d?.brain?.conclusion?.label||d?.evaluation?.decision||'CHỜ XÁC NHẬN';const s=String(raw).trim(),u=s.toUpperCase();if(u.includes('PHÒNG THỦ'))return'PHÒNG THỦ';if(u.includes('THẬN TRỌNG'))return'THẬN TRỌNG';if(u.includes('TÍCH CỰC'))return'TÍCH CỰC';if(u.includes('CHỌN LỌC'))return'CHỌN LỌC';if(u.includes('THEO DÕI')||u.includes('QUAN SÁT'))return'QUAN SÁT';if(u.includes('TRUNG TÍNH'))return'TRUNG TÍNH';return s.split(/[·:–—]/)[0].trim().split(/\s+/).slice(0,3).join(' ').toUpperCase()}
function shortMacroStatus(raw){
  const s=String(raw||'').trim(),u=s.toUpperCase();
  if(u.includes('KÉM THUẬN LỢI'))return'TIỀN TỆ CHẶT HƠN';
  if(u.includes('RỦI RO TIỀN TỆ'))return'THEO DÕI TIỀN TỆ';
  if(u.includes('TIỀN TỆ THUẬN LỢI'))return'TIỀN TỆ THUẬN LỢI';
  return s;
}

function patchBrain(d){
  const host=q('#vhDecisionBoardV5');
  const brain=d?.brain;
  if(!host||!brain)return;

  window.__VH_LIVE_SIGNAL_ITEMS__=brain.top_signals||[];

  setText(q('.vh5-verdict-main',host),shortBrainLabel(d));

  setText(q('.vhb-top .vh5-verdict-main',host),shortBrainLabel(d));

  const badges=qa('.vhb-badge',host);
  if(badges[0])setText(q('b',badges[0]),shortBrainLabel(d));
  setText(q('.vhb-lane.short .vhb-lane-status',host),shortBrainLabel(d));
  const short=q('.vhb-lane.short',host);
  if(short){
    const score=nn(d?.market?.state?.score);
    setText(q('.vhb-cell.c1 p',short),(brain?.conclusion?.label||'')+(score!=null?' · Market Score '+Math.round(score)+'/100. ':' ')+(brain?.conclusion?.summary||''));
    const c4=q('.vhb-cell.c4 p',short);
    if(c4)setText(c4,(brain?.actions?.good||[])[0]||brain?.conclusion?.summary||'');
  }

  const sigSec=section(host,'Tín hiệu quyết định');
  const cards=sigSec?qa('.vh5-grid3 .vh5-card',sigSec):[];
  (brain.top_signals||[]).slice(0,3).forEach((x,i)=>{
    const card=cards[i];if(!card)return;
    card.classList.remove('redish','greenish','warn');
    card.classList.add(toneClass(x));
    setText(q('.vh5-cat',card),x.scope||x.kind||'TÍN HIỆU');
    setText(q('h3',card),signalHeadline(x));
    setText(q('.vh5-evidence',card),(x.evidence||[]).slice(0,2).join(' · '));
    setText(q('.vh5-impact',card),'→ '+signalImpact(x).slice(0,180));
  });

  const act=section(host,'Hành động hôm nay');
  const lists=act?qa('.vh5-action ul',act):[];
  const writeList=(ul,rows)=>{
    if(!ul)return;
    ul.innerHTML=(rows||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
    flash(ul);
  };
  writeList(lists[0],brain?.actions?.good||[]);
  writeList(lists[1],brain?.actions?.bad||[]);

  const sc=section(host,'Kịch bản 1–3 phiên');
  const scCards=sc?qa('.vh5-scenario',sc):[];
  (brain.scenarios||[]).slice(0,3).forEach((x,i)=>{
    const card=scCards[i];if(!card)return;
    setText(q('b',card),x.name||'KỊCH BẢN');
    setText(q('p',card),x.text||'');
    const tag=q('.vh5-tag',card);
    if(tag){setText(tag,x.tag||'');tag.style.display=x.tag?'inline-block':'none'}
  });

  const change=section(host,'Điều kiện đổi quan điểm');
  const changeCards=change?qa('[data-vh-change]',change):[];
  (brain.change_view||[]).slice(0,3).forEach((x,i)=>{
    const card=changeCards[i];if(!card)return;
    setText(q('h3',card),x||'');
    flash(card);
  });

  const foot=q('.vh5-foot span',host);
  if(foot){
    const t=new Date(d.generated_at||brain.generated_at||Date.now()).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
    setHtml(foot,'<span class="vh-live-stamp">Decision Brain</span> · '+esc(t)+' (GMT+7)');
  }
  requestAnimationFrame(()=>{window.__VH_CARD_EQUALIZER__?.(host);window.__VH_DASH_CARD_EQUALIZER__?.(host)});
}

function hotRows(h){
  return(h?.stocks||[]).filter(x=>nn(x.change_pct)!=null).sort((a,b)=>(nn(b.value_traded_bn)||0)-(nn(a.value_traded_bn)||0)).slice(0,3);
}
function patchHot(h){
  const host=q('#vhDecisionBoardV5');if(!host)return;
  const rows=hotRows(h);if(!rows.length)return;
  const act=section(host,'Hành động hôm nay');
  const box=act?q('.vh5-stock-mini',act):null;
  if(box)setHtml(box,rows.map(x=>'<div class="vh5-stock-chip"><b>'+esc(x.symbol)+'</b><span>'+esc(pct(x.change_pct,1))+' · '+esc(fmt(x.value_traded_bn,1))+' tỷ</span></div>').join(''));
}

function patchMacroSnapshot(s){
  const host=q('#vhDecisionBoardV5');if(!host||!s)return;
  const macro=s.macro;
  if(!macro?.ok)return;
  window.__VH_LIVE_MACRO__=macro;
  const sec=section(host,'Nền vĩ mô'),cardsDom=sec?qa('.vh5-card',sec):[];
  (macro.cards||[]).slice(0,cardsDom.length).forEach((x,i)=>{
    const card=cardsDom[i];
    setText(q('.vh5-cat',card),shortMacroStatus(x.status||'THEO DÕI'));
    setText(q('h3',card),x.title||'Vĩ mô');
    setText(q('.vh5-evidence',card),(x.evidence||[]).slice(0,3).join(' · '));
  });
  const reg=q('.vh5-macro-regime',sec);
  if(reg)setHtml(reg,'<b>'+esc(macro.regime||'NỀN VĨ MÔ')+'</b> · '+esc(macro.thesis||''));
  const badges=qa('.vhb-badge',host);
  if(badges[1])setText(q('b',badges[1]),macro.regime||'TRUNG TÍNH');
  requestAnimationFrame(()=>window.__VH_DASH_CARD_EQUALIZER__?.(host));
}

async function get(url){
  const r=await fetch(url+(url.includes('?')?'&':'?')+'brain_live=1&t='+Date.now(),{headers:{Accept:'application/json'},cache:'no-store'});
  const j=await r.json();
  if(!r.ok||!j?.ok)throw new Error(j?.error||('HTTP '+r.status));
  return j;
}
function inSession(){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).reduce((a,x)=>(a[x.type]=x.value,a),{});
  if(['Sat','Sun'].includes(p.weekday))return false;
  const m=Number(p.hour)*60+Number(p.minute);
  return(m>=525&&m<=690)||(m>=780&&m<=900);
}
async function waitHost(){
  for(let i=0;i<100;i++){
    const h=q('#vhDecisionBoardV5.vh-final-ready')||q('#vhDecisionBoardV5');
    if(h)return h;
    await new Promise(r=>setTimeout(r,60));
  }
  return null;
}
async function cycle(){
  if(document.visibilityState!=='visible')return;
  const [b,h]=await Promise.allSettled([get(VH_BRAIN),get(VH_HOT)]);
  if(b.status==='fulfilled')patchBrain(b.value);
  if(h.status==='fulfilled')patchHot(h.value);
}
async function init(){
  addStyle();
  const host=await waitHost();if(!host)return;
  if(window.__vhMorningSnapshot)patchMacroSnapshot(window.__vhMorningSnapshot);
  window.addEventListener('vh:morning-snapshot',e=>patchMacroSnapshot(e.detail));
  setTimeout(()=>cycle().catch(()=>{}),250);
  const loop=async()=>{
    await cycle().catch(()=>{});
    setTimeout(loop,inSession()?60000:180000);
  };
  setTimeout(loop,inSession()?60000:180000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
