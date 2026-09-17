const ENDPOINT='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/local-primary-market-public';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const nn=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fmt=(v,d=1)=>{const n=nn(v);return n==null?'—':n.toLocaleString('vi-VN',{maximumFractionDigits:d})};
const pct=(v,d=1)=>{const n=nn(v);return n==null?'—':`${n>0?'+':''}${fmt(n,d)}%`};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function addStyle(){if(q('#vhLocalPrimaryStyle'))return;const s=document.createElement('style');s.id='vhLocalPrimaryStyle';s.textContent=`
#vhDecisionBoardV5 .vh-live-updated{transition:background-color .45s ease,box-shadow .45s ease;background-color:rgba(84,205,164,.07)!important;box-shadow:inset 0 0 0 1px rgba(84,205,164,.10)}
#vhDecisionBoardV5 .vh-live-stamp{display:inline-flex;align-items:center;gap:5px;color:#7fd9b8}
#vhDecisionBoardV5 .vh-live-stamp:before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
`;document.head.appendChild(s)}
function flash(el){if(!el)return;el.classList.remove('vh-live-updated');void el.offsetWidth;el.classList.add('vh-live-updated');setTimeout(()=>el.classList.remove('vh-live-updated'),650)}
function setText(el,text){if(!el||text==null||el.textContent===String(text))return;el.textContent=String(text);flash(el)}
function setHtml(el,html){if(!el||el.innerHTML===html)return;el.innerHTML=html;flash(el)}
function section(host,name){return qa('.vh5-section',host).find(x=>q('.vh5-sec-title',x)?.textContent?.toLowerCase().includes(name.toLowerCase()))||null}
function marketState(mi){const s=nn(mi?.state?.score)??50;if(s<=25)return{score:s,label:'PHÒNG THỦ CAO',action:'Ưu tiên giảm rủi ro danh mục, hạn chế mở vị thế mới.'};if(s<40)return{score:s,label:'THẬN TRỌNG',action:'Giữ tỷ trọng an toàn và chỉ chọn mã khỏe hơn thị trường.'};if(s<55)return{score:s,label:'TRUNG TÍNH / CHỌN LỌC',action:'Chờ độ rộng và dòng tiền xác nhận trước khi tăng mạnh tỷ trọng.'};if(s<70)return{score:s,label:'TÍCH CỰC CÓ ĐIỀU KIỆN',action:'Có thể nâng mức chủ động từng bước ở cổ phiếu có tín hiệu riêng.'};return{score:s,label:'TÍCH CỰC',action:'Có thể duy trì tỷ trọng chủ động nhưng vẫn giữ kỷ luật quản trị rủi ro.'}}
function breadthText(mi){const b=mi?.breadth||{},a=nn(b.adv),d=nn(b.dec),f=nn(b.flat)||0;if(a==null||d==null)return'Dữ liệu độ rộng đang cập nhật.';return`${Math.round(a)} mã tăng · ${Math.round(f)} tham chiếu · ${Math.round(d)} mã giảm.`}
function flowText(mi){const r=nn(mi?.flow?.same_time_ratio);if(r==null)return'Dữ liệu GTGD cùng thời điểm chưa có chuẩn xác minh; tạm không suy diễn thanh khoản.';return`Thanh khoản khoảng ${Math.round(r*100)}% mức chuẩn cùng thời điểm.`}
function moverRows(raw){const rows=raw?.market_intelligence?.movers?.leaders;return Array.isArray(rows)?rows.filter(x=>x?.symbol&&nn(x?.change_pct)!=null).slice(0,3):[]}
function patchMovers(raw){const host=q('#vhDecisionBoardV5');if(!host)return;const rows=moverRows(raw);if(!rows.length)return;const act=section(host,'Hành động hôm nay');if(!act)return;let box=q('.vh5-stock-mini',act);if(!box)return;setHtml(box,rows.map(x=>`<div class="vh5-stock-chip"><b>${esc(x.symbol)}</b><span>${esc(pct(x.change_pct,1))}</span></div>`).join(''))}
function patch(raw){const host=q('#vhDecisionBoardV5');if(!host||!raw?.ok)return;const mi=raw.market_intelligence||{},m=marketState(mi),short=q('.vhb-lane.short',host);
  setText(q('.vhb-top .vh5-verdict-main',host),m.label);
  setText(q('.vhb-top .vh5-verdict-sub',host),m.action);
  const badges=qa('.vhb-badge',host);if(badges[0])setText(q('b',badges[0]),m.label);
  setText(q('.vhb-lane.short .vhb-lane-status',host),m.label);
  if(short){setText(q('.vhb-cell.c1 p',short),`${m.label} · Điểm trạng thái ${Math.round(m.score)}/100. ${m.action}`);const lines=qa('.vhb-cell.c2 .vhb-mini-lines div',short);if(lines[0])setHtml(lines[0],`<b>Độ lan tỏa:</b> ${esc(breadthText(mi))}`);if(lines[1])setHtml(lines[1],`<b>Dòng tiền:</b> ${esc(flowText(mi))}`)}
  patchMovers(raw);
  const foot=q('.vh5-foot span',host),fresh=mi?.freshness?.label||'Dữ liệu gần nhất';if(foot){const now=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());setHtml(foot,`<span class="vh-live-stamp">${esc(fresh)}</span> · nguồn DataTick + AmiBroker · ${esc(now)} (GMT+7)`)}
}
async function get(){const r=await fetch(`${ENDPOINT}?t=${Date.now()}`,{headers:{Accept:'application/json'},cache:'no-store'});const j=await r.json();if(!r.ok||!j?.ok)throw new Error(j?.error||`HTTP ${r.status}`);return j}
function inSession(){const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).reduce((a,x)=>(a[x.type]=x.value,a),{});if(['Sat','Sun'].includes(p.weekday))return false;const m=Number(p.hour)*60+Number(p.minute);return(m>=525&&m<=695)||(m>=770&&m<=910)}
let busy=false;
async function cycle(){if(busy||document.hidden)return;busy=true;try{patch(await get())}catch(e){console.warn('[local-primary-market]',e?.message||e)}finally{busy=false}}
addStyle();
cycle();
setInterval(cycle,()=>inSession()?15000:60000);
// setInterval requires a fixed delay; use 15s and skip most closed-session ticks.
let closedTick=0;clearInterval();
setInterval(()=>{if(inSession()){cycle();closedTick=0}else if(++closedTick>=4){closedTick=0;cycle()}},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)cycle()});
