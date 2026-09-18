import { supabaseClient } from './assets/js/supabase-client.js';
import { esc,sourceLabel,parseSource,leadStatusLabel,formatDateTime } from './assets/js/admin-humanize.js';

const $=s=>document.querySelector(s);
const loginBox=$('#loginBox'),app=$('#app'),loginForm=$('#loginForm'),googleLogin=$('#googleLogin'),loginMsg=$('#loginMsg'),logout=$('#logout');
const search=$('#search'),status=$('#status'),channel=$('#channel'),refresh=$('#refresh'),exportCsv=$('#exportCsv'),list=$('#list'),count=$('#count');
let rows=[];

function zaloPhone(phone=''){
  let p=String(phone).replace(/\D/g,'');
  if(p.startsWith('0'))p='84'+p.slice(1);
  return p;
}

function channelLabel(v=''){
  return ({ZALO:'Zalo',PHONE:'Điện thoại',EMAIL:'Email'})[String(v||'').toUpperCase()]||v||'—';
}

function visibleRows(){
  const q=String(search.value||'').trim().toLowerCase();
  const ch=channel.value||'';
  return rows.filter(r=>{
    if(ch&&r.channel!==ch)return false;
    if(!q)return true;
    return [r.full_name,r.phone,r.email,sourceLabel(r.source),r.channel,leadStatusLabel(r.status)].some(v=>String(v||'').toLowerCase().includes(q));
  });
}

function updateStats(){
  $('#statTotal').textContent=rows.length;
  $('#statActive').textContent=rows.filter(r=>r.status==='ACTIVE').length;
  $('#statContacted').textContent=rows.filter(r=>r.status==='CONTACTED').length;
  $('#statConverted').textContent=rows.filter(r=>r.status==='CONVERTED').length;
}

function renderFunnel(f={}){
  $('#funnelViews').textContent=f.market_reader_views??'—';
  $('#funnelLeads').textContent=f.new_market_leads??'—';
  $('#funnelRate').textContent=f.view_to_lead_pct===null||f.view_to_lead_pct===undefined?'—':f.view_to_lead_pct+'%';
  $('#funnelCta').textContent=f.market_reader_cta_sessions??'—';
  $('#funnelMeetings').textContent=f.market_attributed_meetings??'—';
}

function statusClass(v){
  return v==='ACTIVE'?'is-high':v==='CONTACTED'?'is-mid':'is-low';
}

function render(){
  const filtered=visibleRows();
  count.textContent=filtered.length+' người';
  if(!filtered.length){
    list.innerHTML='<div class="admin-card admin-empty">Không có người phù hợp bộ lọc.</div>';
    updateStats();
    return;
  }

  list.innerHTML=filtered.map(r=>{
    const s=parseSource(r.source);
    const phone=r.phone||'';
    return '<article class="admin-card person-card" style="grid-template-columns:170px 1.05fr 1.15fr auto">'
      +'<div><span class="admin-badge '+statusClass(r.status)+'">'+esc(leadStatusLabel(r.status))+'</span><div class="person-meta" style="margin-top:8px"><span>Đăng ký: '+esc(formatDateTime(r.created_at))+'</span><span>Gần nhất: '+esc(formatDateTime(r.last_seen_at))+'</span><span>Đăng ký lại: '+Number(r.subscribe_count||1)+' lần</span></div></div>'
      +'<div class="person-contact"><h3>'+esc(r.full_name||'Chưa có tên')+'</h3><div class="person-meta">'
        +(phone?'<a href="tel:'+esc(phone)+'"><strong>'+esc(phone)+'</strong></a>':'<span>Chưa có số điện thoại</span>')
        +(r.email?'<a href="mailto:'+esc(r.email)+'">'+esc(r.email)+'</a>':'<span>Chưa có email</span>')
        +'<span>Kênh muốn nhận: '+esc(channelLabel(r.channel))+'</span>'
      +'</div></div>'
      +'<div class="admin-source"><strong>'+esc(s.sourceLabel)+'</strong>'
        +(r.metadata?.page?'<span>Trang để lại thông tin: '+esc(r.metadata.page)+'</span>':'')
        +(s.campaign?'<span>Chiến dịch: '+esc(s.campaign)+'</span>':'')
        +'<details class="admin-tech"><summary>Xem thông tin kỹ thuật</summary><code>'+esc(r.source||'')+(r.session_id?' | phiên='+esc(r.session_id):'')+'</code></details>'
      +'</div>'
      +'<div class="admin-actions">'
        +(r.customer_id?'<a class="is-main" href="khach-hang.html?id='+encodeURIComponent(r.customer_id)+'">Hồ sơ khách</a>':'')
        +(phone?'<a href="tel:'+esc(phone)+'">Gọi</a><a target="_blank" rel="noopener" href="https://zalo.me/'+esc(zaloPhone(phone))+'">Zalo</a>':'')
        +'<button class="is-done" data-id="'+esc(r.id)+'" data-st="CONTACTED">Đã liên hệ</button>'
        +'<button data-id="'+esc(r.id)+'" data-st="CONVERTED">Đã chuyển đổi</button>'
        +'<button data-id="'+esc(r.id)+'" data-st="UNSUBSCRIBED">Dừng nhận</button>'
        +'<button data-id="'+esc(r.id)+'" data-st="INVALID">Không hợp lệ</button>'
      +'</div>'
    +'</article>';
  }).join('');
  updateStats();
}

async function load(){
  list.innerHTML='<div class="admin-card admin-panel">Đang tải danh sách...</div>';
  const [leadResult,funnelResult]=await Promise.all([
    supabaseClient.rpc('admin_list_market_brief_leads_v1',{p_status:status.value||null,p_limit:500}),
    supabaseClient.rpc('admin_growth_funnel_v1',{p_days:7})
  ]);
  if(funnelResult.error)renderFunnel({});else renderFunnel(funnelResult.data||{});
  if(leadResult.error){list.innerHTML='<div class="admin-card admin-panel">Không tải được dữ liệu: '+esc(leadResult.error.message)+'</div>';return;}
  rows=leadResult.data||[];
  render();
}

async function showApp(){loginBox.classList.add('hidden');app.classList.remove('hidden');logout.classList.remove('hidden');await load();}
function showLogin(){loginBox.classList.remove('hidden');app.classList.add('hidden');logout.classList.add('hidden');}

loginForm.addEventListener('submit',async e=>{e.preventDefault();loginMsg.textContent='Đang đăng nhập...';const {error}=await supabaseClient.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error){loginMsg.textContent='Không đăng nhập được. Có thể dùng Google.';return;}loginMsg.textContent='';await showApp();});
googleLogin?.addEventListener('click',async()=>{loginMsg.textContent='Đang chuyển sang Google...';const redirectTo=window.location.origin+window.location.pathname;const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});if(error)loginMsg.textContent='Không mở được Google: '+error.message;});
logout.addEventListener('click',async()=>{await supabaseClient.auth.signOut();showLogin();});
status.addEventListener('change',load);
channel.addEventListener('change',render);
search.addEventListener('input',render);
refresh.addEventListener('click',load);

list.addEventListener('click',async e=>{
  const b=e.target.closest('button[data-id]');
  if(!b)return;
  b.disabled=true;
  const note=prompt('Ghi chú ngắn (có thể bỏ trống):','')||null;
  const {error}=await supabaseClient.rpc('admin_update_market_brief_lead_v1',{p_id:b.dataset.id,p_status:b.dataset.st,p_note:note});
  b.disabled=false;
  if(error){alert('Không cập nhật được: '+error.message);return;}
  await load();
});

exportCsv.addEventListener('click',()=>{
  const data=visibleRows();if(!data.length)return;
  const headers=['Họ tên','Số điện thoại','Email','Kênh nhận','Trạng thái','Nguồn khách','Số lần đăng ký','Ngày đăng ký','Lần gần nhất'];
  const rowsCsv=data.map(r=>[r.full_name,r.phone,r.email,channelLabel(r.channel),leadStatusLabel(r.status),sourceLabel(r.source),r.subscribe_count,r.created_at,r.last_seen_at]);
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv='\ufeff'+[headers.map(quote).join(','),...rowsCsv.map(row=>row.map(quote).join(','))].join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='khach-quan-tam-thi-truong-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});

const {data}=await supabaseClient.auth.getSession();
data.session?showApp():showLogin();
