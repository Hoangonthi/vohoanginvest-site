import { supabaseClient } from './assets/js/supabase-client.js';

const loginBox=document.querySelector('#loginBox');
const app=document.querySelector('#app');
const loginForm=document.querySelector('#loginForm');
const googleLogin=document.querySelector('#googleLogin');
const loginMsg=document.querySelector('#loginMsg');
const logout=document.querySelector('#logout');
const days=document.querySelector('#days');
const refresh=document.querySelector('#refresh');
const metrics=document.querySelector('#metrics');
const rates=document.querySelector('#rates');
const sources=document.querySelector('#sources');
const sync=document.querySelector('#sync');
const queue=document.querySelector('#queue');
const search=document.querySelector('#search');
const priority=document.querySelector('#priority');
const temperature=document.querySelector('#temperature');

let rows=[];
function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function fmt(v){if(!v)return '—';return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v))}
function zaloPhone(phone=''){let p=String(phone).replace(/\D/g,'');if(p.startsWith('0'))p='84'+p.slice(1);return p}
function stageLabel(v){return ({NEW_LEAD:'Lead mới',ENGAGED:'Đã tương tác',QUALIFIED:'Đủ điều kiện',MEETING:'Đang hẹn',CLIENT:'Khách hàng',NURTURE:'Theo dõi',LOST:'Không tiếp tục'})[v]||v||'—'}
function sevLabel(v){return ({CRITICAL:'Rất cần ưu tiên',HIGH:'Cần ưu tiên',MEDIUM:'Trung bình',LOW:'Theo dõi'})[v]||'Chưa có'}
function tempLabel(v){return ({HOT:'Nóng',WARM:'Ấm',COOL:'Mát'})[v]||v||'—'}
function tagLabel(v){return ({INVESTOR:'Đầu tư',DIGITAL_SERVICE:'Dịch vụ số',REFERRER:'Người giới thiệu',PARTNER:'Đối tác',CTV:'CTV',VIP:'VIP',NURTURE:'Nuôi dưỡng'})[v]||v}

function renderQueue(){
  const q=search.value.trim().toLowerCase();
  const p=priority.value; const t=temperature.value;
  const data=rows.filter(r=>{const hay=[r.full_name,r.phone,r.email,r.source,r.next_action_title,r.priority_reason,(r.tags||[]).join(' ')].join(' ').toLowerCase();return(!p||r.priority===p)&&(!t||r.temperature===t)&&(!q||hay.includes(q))});
  queue.innerHTML=data.length?data.map(r=>`<article class="card lead">
    <div><span class="p">${esc(r.priority||'P4')}</span><div class="score">${r.lead_score??0}</div><span class="temp">${esc(tempLabel(r.temperature))}</span></div>
    <div><h3>${esc(r.full_name||'Chưa có tên')}</h3><div>${esc(r.phone||'')}</div><div class="small">${esc(r.email||'')}</div><div class="small">${esc(r.source||'Không rõ nguồn')}</div>${r.tags?.length?`<div class="tags">${r.tags.map(x=>`<span class="tag">${esc(tagLabel(x))}</span>`).join('')}</div>`:''}</div>
    <div><strong>${esc(stageLabel(r.stage))}</strong><div class="small">Assessment: ${esc(sevLabel(r.latest_assessment_severity))}</div><div class="small">Điểm: ${r.latest_assessment_score??'—'} · Gap: ${esc(r.latest_assessment_gap||'—')}</div></div>
    <div class="need"><strong>${esc(r.next_action_title||'Theo dõi khách')}</strong><div class="small">${esc(r.priority_reason||'')}</div><div class="small">Hạn: ${fmt(r.next_action_due_at)}</div></div>
    <div class="actions"><a href="khach-hang.html?id=${encodeURIComponent(r.customer_id)}">Hồ sơ 360</a><a href="tel:${esc(r.phone)}">Gọi</a><a href="https://zalo.me/${esc(zaloPhone(r.phone))}" target="_blank" rel="noopener">Zalo</a>${r.task_id?`<button data-task="${r.task_id}">Xong việc</button>`:''}</div>
  </article>`).join(''):'<div class="card empty">Không có khách phù hợp bộ lọc.</div>';
}

async function load(){
  metrics.innerHTML='<div class="card">Đang tải...</div>'; rates.innerHTML=''; queue.innerHTML='<div class="card">Đang tải...</div>'; sync.textContent='Đang đồng bộ follow-up...';
  const refreshRes=await supabaseClient.rpc('admin_refresh_followups_v1');
  sync.textContent=refreshRes.error?'Follow-up tự động đang chạy theo lịch mỗi giờ.':`Đã đồng bộ follow-up · tạo mới ${refreshRes.data?.created??0}`;
  const [funnelRes,sourceRes,queueRes]=await Promise.all([
    supabaseClient.rpc('crm_funnel_report_v2',{p_days:Number(days.value)}),
    supabaseClient.rpc('crm_funnel_summary_v1',{p_days:Number(days.value)}),
    supabaseClient.rpc('crm_today_queue_v3',{p_limit:200})
  ]);
  if(funnelRes.error||queueRes.error){const e=funnelRes.error||queueRes.error;metrics.innerHTML=`<div class="card">Không tải được CRM: ${esc(e.message)}</div>`;queue.innerHTML='';return}
  const f=funnelRes.data||{};
  metrics.innerHTML=[['Lead',f.lead_count],['Đã làm Assessment',f.assessment_customers],['Yêu cầu hẹn',f.meeting_requests],['Đã xác nhận',f.confirmed_or_better],['Buổi hoàn thành',f.completed_meetings]].map(([a,b])=>`<div class="card metric"><span>${a}</span><strong>${b??0}</strong></div>`).join('');
  rates.innerHTML=[['Lead → Assessment',f.lead_to_assessment_rate],['Assessment → Hẹn',f.assessment_to_meeting_rate],['Hẹn → Xác nhận',f.meeting_to_confirmed_rate],['Xác nhận → Hoàn thành',f.confirmed_to_completed_rate]].map(([a,b])=>`<span class="rate">${a}: <strong>${b??0}%</strong></span>`).join('');
  const sf=sourceRes.data||{}; sources.innerHTML=(sf.sources||[]).map(s=>`<span class="source-pill">${esc(s.source)}: <strong>${s.count}</strong></span>`).join('');
  rows=queueRes.data||[]; renderQueue();
}

async function showApp(){loginBox.classList.add('hidden');app.classList.remove('hidden');logout.classList.remove('hidden');await load()}
function showLogin(){loginBox.classList.remove('hidden');app.classList.add('hidden');logout.classList.add('hidden')}
loginForm.addEventListener('submit',async e=>{e.preventDefault();loginMsg.textContent='Đang đăng nhập...';const {error}=await supabaseClient.auth.signInWithPassword({email:document.querySelector('#email').value.trim(),password:document.querySelector('#password').value});if(error){loginMsg.textContent='Không đăng nhập được. Có thể dùng nút Google.';return}loginMsg.textContent='';await showApp()});
googleLogin.addEventListener('click',async()=>{loginMsg.textContent='Đang chuyển sang Google...';const redirectTo=window.location.origin+window.location.pathname;const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});if(error)loginMsg.textContent='Không mở được Google: '+error.message});
logout.addEventListener('click',async()=>{await supabaseClient.auth.signOut();showLogin()});
days.addEventListener('change',load);refresh.addEventListener('click',load);search.addEventListener('input',renderQueue);priority.addEventListener('change',renderQueue);temperature.addEventListener('change',renderQueue);
queue.addEventListener('click',async e=>{const b=e.target.closest('button[data-task]');if(!b)return;b.disabled=true;const {error}=await supabaseClient.rpc('admin_complete_task',{p_task_id:b.dataset.task});b.disabled=false;if(error){alert('Chưa đánh dấu xong được: '+error.message);return}await load()});
const {data}=await supabaseClient.auth.getSession();data.session?showApp():showLogin();
