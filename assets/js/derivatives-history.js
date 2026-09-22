import { supabaseClient } from './supabase-client.js';

const nfPrice = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nfPoint = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const PS_URL = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/derivatives-feed';
const EXPECTED_SYMBOL = 'VN30F1M';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const fmtPrice = (v) => {
  const n = num(v);
  return n === null ? '—' : nfPrice.format(n);
};
const fmtPoint = (v, signed=false) => {
  const n = num(v);
  if (n === null) return '—';
  return `${signed && n > 0 ? '+' : ''}${nfPoint.format(n)} điểm`;
};
const fmtDate = (v) => {
  if (!v) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone:'Asia/Ho_Chi_Minh',
    day:'2-digit',month:'2-digit',year:'numeric'
  }).format(new Date(v));
};
const fmtTime = (v) => {
  if (!v) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone:'Asia/Ho_Chi_Minh',
    hour:'2-digit',minute:'2-digit',second:'2-digit',
    hour12:false
  }).format(new Date(v));
};
const fmtHold = (seconds) => {
  const s = Math.max(0, Number(seconds)||0);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  if (h > 0) return `${h}h ${m}p`;
  return `${m}p`;
};
const resultClass = (v) => {
  const n = num(v);
  if (n === null || n === 0) return 'is-flat';
  return n > 0 ? 'is-up' : 'is-down';
};

function renderState(data){
  const s = data?.state || {};
  const confirmed = s.confirmed_direction || null;
  const candidate = s.candidate_direction || null;
  const elapsed = Math.max(0, Number(s.candidate_elapsed_seconds)||0);
  const remain = Math.max(0, Number(s.candidate_remaining_seconds)||0);

  let main = 'CHỜ TÍN HIỆU';
  let sub = 'Bộ ghi nhận đang chờ dữ liệu xác nhận.';
  let tone = 'neutral';

  if (confirmed && candidate && candidate !== confirmed){
    main = `ĐANG XÁC NHẬN ${candidate}`;
    sub = `${Math.min(120,elapsed)} / 120 giây · còn khoảng ${remain} giây`;
    tone = 'pending';
  } else if (!confirmed && candidate){
    main = `ĐANG XÁC NHẬN ${candidate}`;
    sub = `${Math.min(120,elapsed)} / 120 giây · chưa tính là lệnh chính thức`;
    tone = 'pending';
  } else if (confirmed){
    main = `${confirmed} ĐÃ XÁC NHẬN`;
    sub = `Giá hệ thống hiện tại: ${fmtPrice(s.raw_system_price)}`;
    tone = confirmed === 'LONG' ? 'up' : 'down';
  }

  const box=$('liveState');
  if (box){
    box.className=`live-state ${tone}`;
    $('liveStateMain').textContent=main;
    $('liveStateSub').textContent=sub;
  }
}

function renderSummary(data){
  const s=data?.summary||{};
  $('totalNet').textContent=fmtPoint(s.total_net_points,true);
  $('closedTrades').textContent=String(s.closed_trades ?? 0);
  $('totalFees').textContent=fmtPoint(s.total_fee_points,false);
}

function renderRows(data){
  const rows=Array.isArray(data?.rows)?data.rows:[];
  const body=$('historyBody');
  if(!body)return;

  if(!rows.length){
    body.innerHTML=`<tr><td colspan="10" class="empty">Chưa có lệnh phái sinh nào được xác nhận kể từ khi bộ ghi nhận lịch sử được kích hoạt.</td></tr>`;
    return;
  }

  body.innerHTML=rows.map(r=>{
    const closed=String(r.status||'').toUpperCase()==='CLOSED';
    const direction=String(r.direction||'').toUpperCase();
    const status=closed?'ĐÃ ĐÓNG':'ĐANG MỞ';
    return `
      <tr>
        <td>${esc(fmtDate(r.confirmed_at))}</td>
        <td><span class="dir ${direction==='LONG'?'long':'short'}">${esc(direction)}</span></td>
        <td>${esc(fmtTime(r.confirmed_at))}</td>
        <td class="num">${esc(fmtPrice(r.entry_price))}</td>
        <td class="num">${closed?esc(fmtPrice(r.reversal_price)):'—'}</td>
        <td>${closed?esc(fmtHold(r.hold_seconds)):'—'}</td>
        <td class="num ${closed?resultClass(r.gross_points):''}">${closed?esc(fmtPoint(r.gross_points,true)):'—'}</td>
        <td class="num">${closed?esc(fmtPoint(r.total_fee_points,false)):'—'}</td>
        <td class="num ${closed?resultClass(r.net_points):''}"><strong>${closed?esc(fmtPoint(r.net_points,true)):'—'}</strong></td>
        <td><span class="status ${closed?'closed':'open'}">${status}</span></td>
      </tr>`;
  }).join('');
}

async function loadRealtimePrice(){
  const el=$('currentRealtimePrice');
  if(!el)return;
  try{
    const r=await fetch(`${PS_URL}?history=1&t=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    if(String(d?.symbol||'').toUpperCase()!==EXPECTED_SYMBOL)throw new Error('Unexpected symbol');
    el.textContent=fmtPrice(d?.last_price);
  }catch(_){
    el.textContent='—';
  }
}

async function load(){
  try{
    const {data,error}=await supabaseClient.rpc('derivatives_advisory_public_v1',{p_limit:200});
    if(error) throw error;
    renderSummary(data);
    renderState(data);
    renderRows(data);
    $('updatedAt').textContent = data?.generated_at ? `Cập nhật ${fmtTime(data.generated_at)}` : 'Đang cập nhật';
  }catch(error){
    console.error('Derivatives history:',error);
    $('updatedAt').textContent='Chưa tải được dữ liệu';
  }
}

load();
loadRealtimePrice();
window.setInterval(()=>{ if(document.visibilityState==='visible') load(); },5000);
window.setInterval(()=>{ if(document.visibilityState==='visible') loadRealtimePrice(); },2000);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    load();
    loadRealtimePrice();
  }
});
