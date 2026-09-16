const ENDPOINT='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed';
let allRows=[];
let activeFilter='ALL';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fmt=(v,d=2)=>{const n=num(v);return n===null?'—':n.toLocaleString('vi-VN',{minimumFractionDigits:0,maximumFractionDigits:d})};
const pct=v=>{const n=num(v);return n===null?'—':`${n>0?'+':''}${fmt(n,2)}%`};
const signalText=v=>{const s=String(v||'').toUpperCase();if(s.includes('MANH'))return 'Mạnh';if(s.includes('THAM'))return 'Đang hình thành';return 'Theo dõi'};
const signalClass=v=>{const s=String(v||'').toUpperCase();if(s.includes('MANH'))return 'strong';if(s.includes('THAM'))return 'forming';return 'neutral'};
const baseText=v=>{const s=String(v||'').toUpperCase();if(s.includes('TICH'))return 'Tích lũy';if(s.includes('KHONG'))return 'Chưa rõ';return v||'—'};
const validStock=r=>/^[A-Z]{3}$/.test(String(r?.symbol||''));

function dateLabel(v){
  if(!v)return 'Dữ liệu gần nhất';
  const d=new Date(v);
  if(Number.isNaN(d.getTime()))return 'Dữ liệu gần nhất';
  return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
}

function filteredRows(){
  const q=String($('#searchSymbol')?.value||'').trim().toUpperCase();
  return allRows.filter(r=>{
    const sig=String(r.signal_class||'').toUpperCase();
    if(activeFilter==='MANH'&&!sig.includes('MANH'))return false;
    if(activeFilter==='THAM'&&!sig.includes('THAM'))return false;
    if(q&&!String(r.symbol||'').toUpperCase().includes(q))return false;
    return true;
  });
}

function renderSummary(rows=allRows){
  const strong=allRows.filter(r=>String(r.signal_class||'').toUpperCase().includes('MANH')).length;
  const forming=allRows.filter(r=>String(r.signal_class||'').toUpperCase().includes('THAM')).length;
  const scores=rows.map(r=>Number(r.t_score)).filter(Number.isFinite);
  const total=$('#sumTotal'),strongEl=$('#sumStrong'),formingEl=$('#sumForming'),scoreEl=$('#sumScore');
  if(total)total.textContent=allRows.length;
  if(strongEl)strongEl.textContent=strong;
  if(formingEl)formingEl.textContent=forming;
  if(scoreEl)scoreEl.textContent=scores.length?fmt(scores.reduce((a,b)=>a+b,0)/scores.length,0):'—';
}

function render(){
  const rows=filteredRows();
  renderSummary(rows);
  const out=$('#stocksBox');
  if(!out)return;
  if(!rows.length){out.className='empty';out.textContent='Chưa có mã phù hợp với bộ lọc này.';return}
  out.className='';
  out.innerHTML=`<table class="table"><thead><tr><th>Mã</th><th>Tín hiệu</th><th>Nền giá</th><th>Điểm T+</th><th>Giá</th><th>Tăng/giảm</th><th>GTGD (tỷ)</th><th>KL dự kiến</th><th>KL phiên trước</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr>
    <td class="symbol">${esc(r.symbol)}</td>
    <td><span class="pill ${signalClass(r.signal_class)}">${esc(signalText(r.signal_class))}</span></td>
    <td>${esc(baseText(r.base_type))}</td>
    <td><b>${fmt(r.t_score,0)}</b></td>
    <td>${fmt(r.price,2)}</td>
    <td class="${Number(r.change_pct)>=0?'up':'down'}">${pct(r.change_pct)}</td>
    <td>${fmt(r.value_traded_bn,2)}</td>
    <td>${fmt(r.projected_volume_ratio_pct,1)}%</td>
    <td>${fmt(r.previous_volume_ratio_pct,1)}%</td>
    <td><a class="row-action" href="watchlist.html?symbol=${encodeURIComponent(r.symbol)}">Theo dõi mã này</a></td>
  </tr>`).join('')}</tbody></table>`;
}

async function load(){
  const out=$('#stocksBox');
  const updated=$('#updatedAt');
  try{
    const r=await fetch(`${ENDPOINT}?t=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    allRows=(Array.isArray(data?.stocks)?data.stocks:[]).filter(validStock);
    if(updated)updated.textContent=`Cập nhật ${dateLabel(data?.source_updated_at||data?.received_at)} · ${allRows.length} mã`;
    render();
  }catch(e){
    console.error('Không tải được danh sách cổ phiếu đáng chú ý:',e);
    if(out){out.className='empty';out.textContent='Chưa cập nhật được danh sách. Anh/chị thử tải lại trang sau ít phút.'}
    if(updated)updated.textContent='Dữ liệu chưa sẵn sàng';
    renderSummary([]);
  }
}

$('#searchSymbol')?.addEventListener('input',render);
document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
  activeFilter=btn.dataset.filter||'ALL';
  document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===btn));
  render();
}));

load();
