import { supabaseClient } from './assets/js/supabase-client.js';

const loginBox=document.querySelector('#loginBox');
const app=document.querySelector('#app');
const content=document.querySelector('#content');
const loginForm=document.querySelector('#loginForm');
const googleLogin=document.querySelector('#googleLogin');
const loginMsg=document.querySelector('#loginMsg');
const logout=document.querySelector('#logout');
const customerId=new URLSearchParams(location.search).get('id');

const TAGS=['INVESTOR','DIGITAL_SERVICE','REFERRER','PARTNER','CTV','VIP','NURTURE'];
const tagLabels={INVESTOR:'Khách đầu tư',DIGITAL_SERVICE:'Khách dịch vụ số',REFERRER:'Người giới thiệu',PARTNER:'Đối tác',CTV:'CTV',VIP:'VIP',NURTURE:'Nuôi dưỡng'};
function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function fmt(v){if(!v)return '—';return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v))}
function zaloPhone(phone=''){let p=String(phone).replace(/\D/g,'');if(p.startsWith('0'))p='84'+p.slice(1);return p}
function labelStage(v){return ({NEW_LEAD:'Lead mới',ENGAGED:'Đã tương tác',QUALIFIED:'Đủ điều kiện',MEETING:'Đang hẹn',CLIENT:'Khách hàng',NURTURE:'Theo dõi',LOST:'Không tiếp tục'})[v]||v||'—'}
function labelSeverity(v){return ({CRITICAL:'Rất cần ưu tiên',HIGH:'Cần ưu tiên',MEDIUM:'Cần cải thiện',LOW:'Theo dõi'})[v]||v||'—'}
function labelMeeting(v){return ({NEW:'Mới',CONTACTED:'Đã liên hệ',CONFIRMED:'Đã xác nhận',COMPLETED:'Hoàn thành',CANCELLED:'Đã hủy',NO_SHOW:'Không tham dự'})[v]||v||'—'}
function tempLabel(v){return ({HOT:'Lead nóng',WARM:'Lead ấm',COOL:'Lead mát',PAUSED:'Tạm dừng'})[v]||v||'—'}
function sectionItems(items,render,empty='Chưa có dữ liệu'){return items?.length?items.map(render).join(''):`<p class="muted">${empty}</p>`}

function render(data){
  const c=data.customer||{}; const s=data.crm_state||{}; const a=data.latest_assessment||{}; const ls=data.lead_score||{}; const tags=data.tags||[];
  const priority=s.computed_priority?.priority||'P4'; const next=s.next_action||{};
  const openTasks=(data.tasks||[]).filter(t=>t.status==='OPEN');
  content.innerHTML=`
    <section class="hero">
      <article class="card">
        <p class="small">CUSTOMER 360</p><h1>${esc(c.full_name||'Chưa có tên')}</h1>
        <div>${esc(c.phone||'—')} · ${esc(c.email||'—')}</div>
        <div class="small">Nguồn: ${esc(c.source||'Không rõ')} · Tạo: ${fmt(c.created_at)}</div>
        <div class="chips"><span class="chip">${esc(priority)}</span><span class="chip">Lead score ${esc(ls.score??0)}/100</span><span class="chip">${esc(tempLabel(ls.temperature))}</span><span class="chip">${esc(labelStage(s.stage))}</span>${a.severity?`<span class="chip">${esc(labelSeverity(a.severity))}</span>`:''}${tags.map(t=>`<span class="chip">${esc(tagLabels[t]||t)}</span>`).join('')}</div>
        <div class="actions"><a href="tel:${esc(c.phone)}">Gọi</a><a href="https://zalo.me/${esc(zaloPhone(c.phone))}" target="_blank" rel="noopener">Zalo</a><button data-add-note="CALL">Ghi nhận cuộc gọi</button><button data-add-note="ZALO">Ghi nhận Zalo</button></div>
      </article>
      <article class="card"><h2 class="section-title">Việc nên làm tiếp</h2><strong>${esc(next.title||'Chưa có việc cấp thiết')}</strong><p class="small">${esc(s.computed_priority?.reason||'')}</p><p>Hạn: ${fmt(next.due_at)}</p>${next.task_id?`<button class="primary" data-complete-task="${esc(next.task_id)}">Đánh dấu đã xong</button>`:''}<p class="small">Điểm nóng được tính từ độ mới của lead, Assessment, lịch hẹn, task quá hạn và độ đầy đủ thông tin.</p></article>
    </section>

    <section class="grid">
      <article class="card"><h2 class="section-title">Assessment gần nhất</h2>${a.id?`<div class="score">${esc(a.overall_score??'—')}</div><p><strong>${esc(labelSeverity(a.severity))}</strong></p><p>Ưu tiên: ${esc(a.primary_gap||'—')} ${a.secondary_gap?`· ${esc(a.secondary_gap)}`:''}</p><p>${esc(a.reason_to_meet||'')}</p><p class="small">${esc(a.next_best_action||'')}</p><p class="small">Hoàn thành: ${fmt(a.completed_at)}</p>`:'<p class="muted">Khách chưa làm Assessment.</p>'}</article>
      <article class="card"><h2 class="section-title">Trạng thái & phân loại</h2><p>Giai đoạn: <strong>${esc(labelStage(s.stage))}</strong></p><p>Lần liên hệ gần nhất: ${fmt(s.last_contact_at)}</p><p>Người phụ trách: ${esc(s.owner_name||'Chưa phân công')}</p><label>Đổi giai đoạn<select id="stageSelect"><option value="NEW_LEAD">Lead mới</option><option value="ENGAGED">Đã tương tác</option><option value="QUALIFIED">Đủ điều kiện</option><option value="MEETING">Đang hẹn</option><option value="CLIENT">Khách hàng</option><option value="NURTURE">Theo dõi</option><option value="LOST">Không tiếp tục</option></select></label><button class="primary" id="saveStage" style="margin-top:8px">Lưu giai đoạn</button><div style="margin-top:16px"><strong>Loại quan hệ</strong><div class="chips" id="tagBox">${TAGS.map(t=>`<label class="chip" style="cursor:pointer"><input type="checkbox" value="${t}" data-tag ${tags.includes(t)?'checked':''}> ${esc(tagLabels[t])}</label>`).join('')}</div><button id="saveTags" style="margin-top:8px">Lưu phân loại</button></div></article>
    </section>

    <section class="grid">
      <article class="card"><h2 class="section-title">Điểm cần cải thiện</h2>${sectionItems(data.gaps,g=>`<div class="item"><strong>${esc(g.gap_type)} · ${esc(labelSeverity(g.severity))}</strong><div>${esc(g.evidence||'')}</div><div class="small">${esc(g.consequence||'')}</div><div class="small"><b>Tiếp theo:</b> ${esc(g.next_action||'')}</div></div>`,'Chưa có gap Assessment.')}</article>
      <article class="card"><h2 class="section-title">Việc đang mở (${openTasks.length})</h2>${sectionItems(openTasks,t=>`<div class="item task-open"><strong>${esc(t.priority)} · ${esc(t.title)}</strong><div class="small">Hạn: ${fmt(t.due_at)} · ${esc(t.task_type||'')}</div><button data-complete-task="${esc(t.id)}">Xong việc</button></div>`,'Không có task đang mở.')}</article>
    </section>

    <section class="grid">
      <article class="card"><h2 class="section-title">Lịch hẹn</h2>${sectionItems(data.meeting_requests,m=>`<div class="item"><strong>${esc(labelMeeting(m.status))} · ${esc(m.purpose||'')}</strong><div>${esc(m.meeting_type||'')} · ${esc(m.preferred_date||'—')} ${esc(m.preferred_time||m.preferred_daypart||'')}</div><div class="small">Nguồn: ${esc(m.source||'')} · Tạo ${fmt(m.created_at)}</div></div>`,'Chưa có lịch hẹn.')}</article>
      <article class="card"><h2 class="section-title">Lịch sử Assessment</h2>${sectionItems(data.assessment_history,h=>`<div class="item"><strong>${esc(h.overall_score??'—')} · ${esc(labelSeverity(h.severity))}</strong><div>${esc(h.primary_gap||'')}</div><div class="small">${fmt(h.completed_at)} · ${esc(h.source||'')}</div></div>`,'Chưa có lịch sử Assessment.')}</article>
    </section>

    <section class="card"><h2 class="section-title">Ghi chú nhanh</h2><div class="quick-note"><select id="noteType"><option value="NOTE">Ghi chú</option><option value="CALL">Cuộc gọi</option><option value="ZALO">Zalo</option><option value="EMAIL">Email</option></select><textarea id="noteText" rows="2" placeholder="Ghi nội dung trao đổi, nhu cầu, hẹn gọi lại..."></textarea><button id="saveNote">Lưu</button></div><p id="noteMsg" class="small"></p></section>
    <section class="card"><h2 class="section-title">Timeline</h2><div class="timeline">${sectionItems(data.activities,x=>`<div class="item"><strong>${esc(x.activity_type||'HOẠT ĐỘNG')}</strong><div>${esc(x.note||'')}</div><div class="small">${fmt(x.created_at)}${x.actor_name?` · ${esc(x.actor_name)}`:''}</div></div>`,'Chưa có lịch sử tương tác.')}</div></section>`;
  const stage=document.querySelector('#stageSelect'); if(stage) stage.value=s.stage||'NEW_LEAD';
}

async function load(){
  if(!customerId){content.innerHTML='<div class="card">Thiếu mã khách hàng.</div>';return}
  const {data,error}=await supabaseClient.rpc('admin_get_customer_360_v12',{p_customer_id:customerId});
  if(error){content.innerHTML=`<div class="card">Không tải được hồ sơ: ${esc(error.message)}</div>`;return}
  render(data||{});
}
async function addActivity(type,note){const text=(note||prompt(type==='NOTE'?'Ghi chú:':'Nội dung trao đổi:')||'').trim();if(!text)return;const {error}=await supabaseClient.rpc('admin_add_activity',{p_customer_id:customerId,p_activity_type:type,p_note:text,p_meeting_request_id:null});if(error){alert('Chưa lưu được: '+error.message);return}await load()}
content.addEventListener('click',async e=>{
  const task=e.target.closest('[data-complete-task]');if(task){task.disabled=true;const {error}=await supabaseClient.rpc('admin_complete_task',{p_task_id:task.dataset.completeTask});if(error)alert('Chưa hoàn thành task: '+error.message);await load();return}
  const quick=e.target.closest('[data-add-note]');if(quick){await addActivity(quick.dataset.addNote);return}
  if(e.target.id==='saveNote'){const t=document.querySelector('#noteType').value;const text=document.querySelector('#noteText').value.trim();if(!text)return;await addActivity(t,text);return}
  if(e.target.id==='saveStage'){const v=document.querySelector('#stageSelect').value;const {error}=await supabaseClient.rpc('admin_update_customer_stage',{p_customer_id:customerId,p_stage:v});if(error)alert('Chưa đổi được giai đoạn: '+error.message);await load();return}
  if(e.target.id==='saveTags'){const tags=[...document.querySelectorAll('[data-tag]:checked')].map(x=>x.value);const {error}=await supabaseClient.rpc('admin_set_customer_tags_v1',{p_customer_id:customerId,p_tags:tags});if(error)alert('Chưa lưu phân loại: '+error.message);await load();}
});
async function showApp(){loginBox.classList.add('hidden');app.classList.remove('hidden');logout.classList.remove('hidden');await load()}
function showLogin(){loginBox.classList.remove('hidden');app.classList.add('hidden');logout.classList.add('hidden')}
loginForm.addEventListener('submit',async e=>{e.preventDefault();loginMsg.textContent='Đang đăng nhập...';const {error}=await supabaseClient.auth.signInWithPassword({email:document.querySelector('#email').value.trim(),password:document.querySelector('#password').value});if(error){loginMsg.textContent='Không đăng nhập được. Hãy dùng Google.';return}loginMsg.textContent='';await showApp()});
googleLogin.addEventListener('click',async()=>{const redirectTo=location.origin+location.pathname+location.search;const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});if(error)loginMsg.textContent=error.message});
logout.addEventListener('click',async()=>{await supabaseClient.auth.signOut();showLogin()});
const {data}=await supabaseClient.auth.getSession();data.session?showApp():showLogin();
