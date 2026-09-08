import { supabaseClient } from './assets/js/supabase-client.js';

const loginBox = document.querySelector('#loginBox');
const app = document.querySelector('#app');
const loginForm = document.querySelector('#loginForm');
const googleLogin = document.querySelector('#googleLogin');
const loginMsg = document.querySelector('#loginMsg');
const logout = document.querySelector('#logout');
const status = document.querySelector('#status');
const source = document.querySelector('#source');
const search = document.querySelector('#search');
const refresh = document.querySelector('#refresh');
const list = document.querySelector('#list');
const count = document.querySelector('#count');
let rows = [];

const statusLabels={NEW:'Mới',CONTACTED:'Đã liên hệ',CONFIRMED:'Đang trao đổi',COMPLETED:'Đã chốt xong',CANCELLED:'Không phù hợp / hủy',NO_SHOW:'Không phản hồi'};
const urgencyLabels={NORMAL:'Bình thường',SOON:'Muốn làm sớm',URGENT:'Gấp'};

function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function fmt(v){return v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—'}
function sourceLabel(raw=''){
  const s=String(raw); if(s.includes('src=tiktok')) return 'TikTok'; if(s.includes('src=facebook')) return 'Facebook'; if(s.includes('src=zalo')) return 'Zalo';
  const ref=s.match(/ref=([^|]+)/)?.[1]; return ref?`CTV/Ref: ${ref}`:'Trang dịch vụ';
}
function urgency(note=''){const m=String(note).match(/^\[SERVICE_REQUEST\]\[([^\]]+)\]\s*/);return m?.[1]||'NORMAL'}
function cleanNote(note=''){return String(note||'').replace(/^\[SERVICE_REQUEST\]\[[^\]]+\]\s*/,'')}
function zaloPhone(phone=''){let p=String(phone).replace(/\D/g,''); if(p.startsWith('0')) p='84'+p.slice(1); return p}

function render(){
  const q=String(search?.value||'').trim().toLowerCase();
  const src=source?.value||'';
  const filtered=rows.filter(r=>{
    const label=sourceLabel(r.source);
    const srcOk=!src || (src==='CTV/Ref'?label.startsWith('CTV/Ref'):label===src);
    if(!srcOk) return false;
    if(!q) return true;
    return [r.full_name,r.phone,r.email,cleanNote(r.note),label].some(v=>String(v||'').toLowerCase().includes(q));
  });
  count.textContent=`${filtered.length} yêu cầu`;
  list.innerHTML=filtered.length?filtered.map(r=>`<article class="card lead">
    <div><span class="badge">${esc(statusLabels[r.status]||r.status)}</span><h3>${esc(r.full_name)}</h3><div>${esc(r.phone)}</div><div class="muted">${esc(r.email||'')}</div><div class="muted">Gửi: ${fmt(r.created_at)}</div></div>
    <div><strong>${esc(sourceLabel(r.source))}</strong><div class="muted">Mức độ: ${esc(urgencyLabels[urgency(r.note)]||urgency(r.note))}</div><div class="muted">Nguồn kỹ thuật: ${esc(r.source)}</div></div>
    <div class="need">${esc(cleanNote(r.note))}</div>
    <div class="actions"><a href="tel:${esc(r.phone)}">Gọi</a><a target="_blank" rel="noopener" href="https://zalo.me/${esc(zaloPhone(r.phone))}">Zalo</a>
      <button data-id="${r.id}" data-st="CONTACTED">Đã gọi</button><button data-id="${r.id}" data-st="CONFIRMED">Đang trao đổi</button><button data-id="${r.id}" data-st="COMPLETED">Chốt xong</button><button data-id="${r.id}" data-st="CANCELLED">Không phù hợp</button></div>
  </article>`).join(''):'<div class="card empty">Không có yêu cầu phù hợp bộ lọc.</div>';
}

async function load(){
  list.innerHTML='<div class="card">Đang tải...</div>';
  const {data,error}=await supabaseClient.rpc('admin_list_service_requests',{p_status:status.value||null,p_limit:100,p_offset:0});
  if(error){
    const denied=String(error.message||'').includes('CRM_ACCESS_DENIED');
    list.innerHTML=`<div class="card">${denied?'Tài khoản này chưa có quyền ADMIN/STAFF. Hãy đăng nhập bằng vohoang.bank@gmail.com.':'Không thể tải dữ liệu: '+esc(error.message)}</div>`;
    return;
  }
  rows=data||[];
  render();
}

async function showApp(){loginBox.classList.add('hidden');app.classList.remove('hidden');logout.classList.remove('hidden');await load()}
async function showLogin(){loginBox.classList.remove('hidden');app.classList.add('hidden');logout.classList.add('hidden')}

loginForm.addEventListener('submit',async e=>{e.preventDefault();loginMsg.textContent='Đang đăng nhập...';const {error}=await supabaseClient.auth.signInWithPassword({email:document.querySelector('#email').value.trim(),password:document.querySelector('#password').value});if(error){loginMsg.textContent='Sai mật khẩu hoặc tài khoản chưa dùng mật khẩu. Hãy bấm “Đăng nhập với Google”.';return}loginMsg.textContent='';await showApp()});

googleLogin?.addEventListener('click',async()=>{
  loginMsg.textContent='Đang chuyển sang Google...';
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});
  if(error) loginMsg.textContent='Không mở được đăng nhập Google: '+error.message;
});

logout.addEventListener('click',async()=>{await supabaseClient.auth.signOut();showLogin()});
status.addEventListener('change',load);source?.addEventListener('change',render);search?.addEventListener('input',render);refresh.addEventListener('click',load);
list.addEventListener('click',async e=>{const b=e.target.closest('button[data-id]');if(!b)return;b.disabled=true;const {error}=await supabaseClient.rpc('admin_update_service_request_status',{p_request_id:b.dataset.id,p_status:b.dataset.st});b.disabled=false;if(error){alert('Không cập nhật được: '+error.message);return}await load()});
const {data}=await supabaseClient.auth.getSession(); data.session?showApp():showLogin();
