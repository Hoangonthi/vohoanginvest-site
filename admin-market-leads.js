import { supabaseClient } from './assets/js/supabase-client.js';

const loginBox=document.querySelector('#loginBox');
const app=document.querySelector('#app');
const loginForm=document.querySelector('#loginForm');
const googleLogin=document.querySelector('#googleLogin');
const loginMsg=document.querySelector('#loginMsg');
const logout=document.querySelector('#logout');
const search=document.querySelector('#search');
const status=document.querySelector('#status');
const channel=document.querySelector('#channel');
const refresh=document.querySelector('#refresh');
const exportCsv=document.querySelector('#exportCsv');
const list=document.querySelector('#list');
const count=document.querySelector('#count');
let rows=[];

function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function fmt(v){return v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—'}
function zaloPhone(phone=''){let p=String(phone).replace(/\D/g,'');if(p.startsWith('0'))p='84'+p.slice(1);return p}
function sourceBits(raw=''){
  const s=String(raw||'');const out=[];
  const src=s.match(/src=([^|]+)/)?.[1];const med=s.match(/med=([^|]+)/)?.[1];const ref=s.match(/ref=([^|]+)/)?.[1];const cmp=s.match(/cmp=([^|]+)/)?.[1];
  if(src)out.push(`Nguồn: ${src}`);if(med)out.push(`Kênh: ${med}`);if(ref)out.push(`Ref: ${ref}`);if(cmp)out.push(`Chiến dịch: ${cmp}`);if(!out.length&&s)out.push(s.split('|')[0]);return out;
}
function visibleRows(){
  const q=String(search.value||'').trim().toLowerCase();const ch=channel.value||'';
  return rows.filter(r=>{
    if(ch&&r.channel!==ch)return false;
    if(!q)return true;
    return [r.full_name,r.phone,r.email,r.source,r.channel,r.status].some(v=>String(v||'').toLowerCase().includes(q));
  });
}
function updateStats(){
  document.querySelector('#statTotal').textContent=rows.length;
  document.querySelector('#statActive').textContent=rows.filter(r=>r.status==='ACTIVE').length;
  document.querySelector('#statContacted').textContent=rows.filter(r=>r.status==='CONTACTED').length;
  document.querySelector('#statConverted').textContent=rows.filter(r=>r.status==='CONVERTED').length;
}
function render(){
  const filtered=visibleRows();count.textContent=`${filtered.length} lead`;
  list.innerHTML=filtered.length?filtered.map(r=>`<article class="card lead">
    <div><span class="badge ${esc(r.status)}">${esc(r.status)}</span><h3>${esc(r.full_name)}</h3><div><strong>${esc(r.phone)}</strong></div><div class="muted">${esc(r.email||'')}</div><div class="muted">Đăng ký: ${fmt(r.created_at)}</div><div class="muted">Gần nhất: ${fmt(r.last_seen_at)}</div></div>
    <div><div><strong>Kênh nhận: ${esc(r.channel)}</strong></div><div class="muted">Đăng ký lại: ${Number(r.subscribe_count||1)} lần</div><div class="muted">Consent: ${fmt(r.consent_at)}</div>${r.session_id?`<div class="muted">Session: ${esc(r.session_id)}</div>`:''}</div>
    <div class="source"><strong>Nguồn khách</strong><div>${sourceBits(r.source).map(x=>`<span class="meta-chip">${esc(x)}</span>`).join('')}</div>${r.metadata?.page?`<div class="muted">Trang: ${esc(r.metadata.page)}</div>`:''}${r.metadata?.utm_campaign?`<div class="muted">Campaign: ${esc(r.metadata.utm_campaign)}</div>`:''}</div>
    <div class="actions">${r.customer_id?`<a href="khach-hang.html?id=${encodeURIComponent(r.customer_id)}">Hồ sơ 360</a>`:''}<a href="tel:${esc(r.phone)}">Gọi</a><a target="_blank" rel="noopener" href="https://zalo.me/${esc(zaloPhone(r.phone))}">Zalo</a><button class="contacted" data-id="${r.id}" data-st="CONTACTED">Đã liên hệ</button><button class="convert" data-id="${r.id}" data-st="CONVERTED">Đã chuyển đổi</button><button data-id="${r.id}" data-st="UNSUBSCRIBED">Dừng gửi</button><button data-id="${r.id}" data-st="INVALID">Không hợp lệ</button></div>
  </article>`).join(''):'<div class="card empty">Không có lead phù hợp bộ lọc.</div>';
  updateStats();
}
async function load(){
  list.innerHTML='<div class="card">Đang tải lead...</div>';
  const {data,error}=await supabaseClient.rpc('admin_list_market_brief_leads_v1',{p_status:status.value||null,p_limit:500});
  if(error){list.innerHTML=`<div class="card">Không tải được dữ liệu: ${esc(error.message)}</div>`;return}
  rows=data||[];render();
}
async function showApp(){loginBox.classList.add('hidden');app.classList.remove('hidden');logout.classList.remove('hidden');await load()}
function showLogin(){loginBox.classList.remove('hidden');app.classList.add('hidden');logout.classList.add('hidden')}

loginForm.addEventListener('submit',async e=>{e.preventDefault();loginMsg.textContent='Đang đăng nhập...';const {error}=await supabaseClient.auth.signInWithPassword({email:document.querySelector('#email').value.trim(),password:document.querySelector('#password').value});if(error){loginMsg.textContent='Sai mật khẩu hoặc tài khoản chưa dùng mật khẩu. Có thể dùng Google.';return}loginMsg.textContent='';await showApp()});
googleLogin?.addEventListener('click',async()=>{loginMsg.textContent='Đang chuyển sang Google...';const redirectTo=window.location.origin+window.location.pathname;const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});if(error)loginMsg.textContent='Không mở được Google: '+error.message});
logout.addEventListener('click',async()=>{await supabaseClient.auth.signOut();showLogin()});
status.addEventListener('change',load);channel.addEventListener('change',render);search.addEventListener('input',render);refresh.addEventListener('click',load);
list.addEventListener('click',async e=>{const b=e.target.closest('button[data-id]');if(!b)return;b.disabled=true;const note=prompt('Ghi chú ngắn (có thể bỏ trống):','')||null;const {error}=await supabaseClient.rpc('admin_update_market_brief_lead_v1',{p_id:b.dataset.id,p_status:b.dataset.st,p_note:note});b.disabled=false;if(error){alert('Không cập nhật được: '+error.message);return}await load()});
exportCsv.addEventListener('click',()=>{
  const data=visibleRows();if(!data.length)return;
  const cols=['full_name','phone','email','channel','status','source','subscribe_count','created_at','last_seen_at'];
  const quote=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const csv='\ufeff'+[cols.join(','),...data.map(r=>cols.map(c=>quote(r[c])).join(','))].join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`market-leads-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
const {data}=await supabaseClient.auth.getSession();data.session?showApp():showLogin();
