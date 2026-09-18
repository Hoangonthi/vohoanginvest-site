import { supabaseClient } from './assets/js/supabase-client.js';
import {
  esc,sourceLabel,parseSource,stageLabel,priorityLabel,temperatureLabel,
  severityLabel,toolLabel,actionText,formatDateTime,formatTime
} from './assets/js/admin-humanize.js';

const $=s=>document.querySelector(s);
const loginBox=$('#loginBox'),app=$('#app'),loginForm=$('#loginForm'),googleLogin=$('#googleLogin');
const loginMsg=$('#loginMsg'),logout=$('#logout'),days=$('#days'),refresh=$('#refresh');
const metrics=$('#metrics'),rates=$('#rates'),sources=$('#sources'),sync=$('#sync'),queue=$('#queue');
const search=$('#search'),priority=$('#priority'),temperature=$('#temperature'),todaySummary=$('#todaySummary');
let rows=[];

function plainCrmText(v=''){
  return String(v||'')
    .replace(/\blead\b/gi,'khách')
    .replace(/assessment/gi,'bài đánh giá')
    .replace(/follow-?up/gi,'liên hệ tiếp')
    .replace(/\bgap\b/gi,'điểm cần cải thiện');
}

function zaloPhone(phone=''){
  let p=String(phone).replace(/\D/g,'');
  if(p.startsWith('0'))p='84'+p.slice(1);
  return p;
}

function tagLabel(v){
  return ({INVESTOR:'Đầu tư',DIGITAL_SERVICE:'Dịch vụ số',REFERRER:'Người giới thiệu',PARTNER:'Đối tác',CTV:'CTV',VIP:'VIP',NURTURE:'Theo dõi'})[v]||v;
}

function priorityClass(v){
  if(v==='P1')return 'is-high';
  if(v==='P2')return 'is-mid';
  return 'is-low';
}

function dueText(v){
  if(!v)return 'Chưa có hạn xử lý';
  const d=new Date(v);
  return (d.getTime()<Date.now()?'Đã quá hạn · ':'Hạn · ')+formatDateTime(v);
}

function sourceBox(raw){
  const s=parseSource(raw);
  return '<div class="admin-source"><strong>'+esc(s.sourceLabel)+'</strong>'
    +(s.channel?'<span>Kênh vào: '+esc(s.channel)+'</span>':'')
    +(s.campaign?'<span>Chiến dịch: '+esc(s.campaign)+'</span>':'')
    +'<details class="admin-tech"><summary>Xem thông tin kỹ thuật</summary><code>'+esc(s.raw)+'</code></details></div>';
}

function activityBox(r){
  const actions=Array.isArray(r.web_actions_today)?r.web_actions_today:[];
  const tools=Array.isArray(r.web_tools_today)?r.web_tools_today:[];
  if(!r.web_session_id||!Number(r.web_events_today||0)){
    return '<div class="admin-activity"><div class="admin-activity-title">Hoạt động hôm nay <span>Chưa ghi nhận</span></div><div class="admin-help">Chưa ghi nhận hoạt động website hôm nay từ phiên đã gắn với khách này.</div></div>';
  }
  const seen=new Set();
  const uniqueActions=[];
  for(const a of actions){
    const label=actionText(a);
    const key=String(a.tool_code||'')+'|'+String(a.event_type||'')+'|'+label;
    if(seen.has(key))continue;
    seen.add(key);
    uniqueActions.push({...a,_label:label});
    if(uniqueActions.length>=5)break;
  }
  return '<div class="admin-activity">'
    +'<div class="admin-activity-title">Hoạt động trên website hôm nay <span>'+Number(r.web_events_today||0)+' lượt · gần nhất '+formatTime(r.web_last_seen_at)+'</span></div>'
    +'<div class="admin-activity-tools">'+tools.map(t=>'<span class="admin-tool">'+esc(toolLabel(t))+'</span>').join('')+'</div>'
    +'<div class="admin-activity-list">'+uniqueActions.map(a=>'<div class="admin-activity-item"><time>'+formatTime(a.created_at)+'</time><span>'+esc(a._label)+'</span></div>').join('')+'</div>'
    +'</div>';
}

function renderQueue(){
  const q=String(search.value||'').trim().toLowerCase();
  const p=priority.value;
  const t=temperature.value;
  const data=rows.filter(r=>{
    const hay=[r.full_name,r.phone,r.email,sourceLabel(r.source),r.next_action_title,r.priority_reason,(r.tags||[]).join(' '),(r.web_tools_today||[]).map(toolLabel).join(' ')].join(' ').toLowerCase();
    return(!p||r.priority===p)&&(!t||r.temperature===t)&&(!q||hay.includes(q));
  });

  if(!data.length){
    queue.innerHTML='<div class="admin-card admin-empty">Không có khách phù hợp bộ lọc.</div>';
    return;
  }

  queue.innerHTML=data.map(r=>{
    const tags=(r.tags||[]).map(x=>'<span class="admin-tool">'+esc(tagLabel(x))+'</span>').join('');
    const phone=r.phone||'';
    return '<article class="admin-card person-card">'
      +'<div><span class="admin-badge '+priorityClass(r.priority)+'">'+esc(priorityLabel(r.priority))+'</span><div class="admin-score">'+Number(r.lead_score||0)+'</div><div class="admin-help" style="margin:-1px 0 7px">Điểm ưu tiên</div><span class="admin-badge">'+esc(temperatureLabel(r.temperature))+'</span></div>'
      +'<div class="person-contact"><h3>'+esc(r.full_name||'Chưa có tên')+'</h3><div class="person-meta">'
        +(phone?'<a href="tel:'+esc(phone)+'"><strong>'+esc(phone)+'</strong></a>':'<span>Chưa có số điện thoại</span>')
        +(r.email?'<a href="mailto:'+esc(r.email)+'">'+esc(r.email)+'</a>':'<span>Chưa có email</span>')
        +'<span>'+esc(stageLabel(r.stage))+'</span>'
        +(tags?'<div class="admin-activity-tools">'+tags+'</div>':'')
      +'</div></div>'
      +'<div>'+sourceBox(r.source)+'<div class="person-meta" style="margin-top:8px"><span>Đánh giá gần nhất: '+esc(severityLabel(r.latest_assessment_severity))+'</span><span>Điểm đánh giá: '+(r.latest_assessment_score??'—')+(r.latest_assessment_gap?' · Điểm cần cải thiện: '+esc(r.latest_assessment_gap):'')+'</span></div></div>'
      +activityBox(r)
      +'<div class="admin-actions"><div style="width:100%;font-size:11px;line-height:1.5"><strong>'+esc(plainCrmText(r.next_action_title||'Theo dõi khách'))+'</strong><div class="admin-help">'+esc(plainCrmText(r.priority_reason||''))+'</div><div class="admin-help">'+esc(dueText(r.next_action_due_at))+'</div></div>'
        +'<a class="is-main" href="khach-hang.html?id='+encodeURIComponent(r.customer_id)+'">Hồ sơ khách</a>'
        +(phone?'<a href="tel:'+esc(phone)+'">Gọi</a><a href="https://zalo.me/'+esc(zaloPhone(phone))+'" target="_blank" rel="noopener">Zalo</a>':'')
        +(r.task_id?'<button class="is-done" data-task="'+esc(r.task_id)+'">Đã xử lý xong</button>':'')
      +'</div>'
    +'</article>';
  }).join('');
}

async function load(){
  metrics.innerHTML='<div class="admin-card admin-panel">Đang tải dữ liệu...</div>';
  rates.innerHTML='';
  queue.innerHTML='<div class="admin-card admin-panel">Đang tải danh sách khách...</div>';
  sync.textContent='Đang đồng bộ việc cần theo dõi...';

  const refreshRes=await supabaseClient.rpc('admin_refresh_followups_v1');
  sync.textContent=refreshRes.error?'Việc theo dõi tự động vẫn chạy theo lịch.':'Đã đồng bộ · tạo mới '+Number(refreshRes.data?.created||0)+' việc';

  const [funnelRes,sourceRes,queueRes]=await Promise.all([
    supabaseClient.rpc('crm_funnel_report_v2',{p_days:Number(days.value)}),
    supabaseClient.rpc('crm_funnel_summary_v1',{p_days:Number(days.value)}),
    supabaseClient.rpc('crm_today_queue_v4',{p_limit:200})
  ]);

  if(funnelRes.error||queueRes.error){
    const e=funnelRes.error||queueRes.error;
    metrics.innerHTML='<div class="admin-card admin-panel">Không tải được CRM: '+esc(e.message)+'</div>';
    queue.innerHTML='';
    return;
  }

  const f=funnelRes.data||{};
  const metricData=[
    ['Khách đã ghi nhận',f.lead_count,'Trong khoảng thời gian đã chọn'],
    ['Đã làm bài đánh giá',f.assessment_customers,'Có thêm dữ liệu về nhu cầu'],
    ['Đã gửi yêu cầu hẹn',f.meeting_requests,'Khách chủ động muốn trao đổi'],
    ['Đã xác nhận lịch',f.confirmed_or_better,'Đã có bước tiếp theo rõ'],
    ['Buổi đã hoàn thành',f.completed_meetings,'Đã trao đổi xong']
  ];
  metrics.innerHTML=metricData.map((x,i)=>'<div class="admin-card admin-metric '+(i===2?'is-focus':'')+'"><span>'+esc(x[0])+'</span><strong>'+Number(x[1]||0)+'</strong><small>'+esc(x[2])+'</small></div>').join('');

  rates.innerHTML=[
    ['Khách → làm đánh giá',f.lead_to_assessment_rate],
    ['Đánh giá → yêu cầu hẹn',f.assessment_to_meeting_rate],
    ['Yêu cầu hẹn → xác nhận',f.meeting_to_confirmed_rate],
    ['Xác nhận → hoàn thành',f.confirmed_to_completed_rate]
  ].map(x=>'<span class="admin-chip">'+esc(x[0])+': <strong>'+Number(x[1]||0)+'%</strong></span>').join('');

  const sf=sourceRes.data||{};
  sources.innerHTML=(sf.sources||[]).map(s=>'<span class="admin-chip">'+esc(sourceLabel(s.source))+': <strong>'+Number(s.count||0)+'</strong></span>').join('');

  rows=queueRes.data||[];
  const activeToday=rows.filter(r=>Number(r.web_events_today||0)>0).length;
  const hasPhone=rows.filter(r=>String(r.phone||'').trim()).length;
  const overdue=rows.filter(r=>r.next_action_due_at&&new Date(r.next_action_due_at).getTime()<Date.now()).length;
  todaySummary.innerHTML=[
    ['Có hoạt động web hôm nay',activeToday],
    ['Có số điện thoại để liên hệ',hasPhone],
    ['Việc đang quá hạn',overdue]
  ].map(x=>'<span class="admin-chip">'+esc(x[0])+': <strong>'+Number(x[1]||0)+'</strong></span>').join('');
  renderQueue();
}

async function showApp(){loginBox.classList.add('hidden');app.classList.remove('hidden');logout.classList.remove('hidden');await load();}
function showLogin(){loginBox.classList.remove('hidden');app.classList.add('hidden');logout.classList.add('hidden');}

loginForm.addEventListener('submit',async e=>{
  e.preventDefault();
  loginMsg.textContent='Đang đăng nhập...';
  const {error}=await supabaseClient.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
  if(error){loginMsg.textContent='Không đăng nhập được. Có thể dùng nút Google.';return;}
  loginMsg.textContent='';
  await showApp();
});

googleLogin.addEventListener('click',async()=>{
  loginMsg.textContent='Đang chuyển sang Google...';
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});
  if(error)loginMsg.textContent='Không mở được Google: '+error.message;
});
logout.addEventListener('click',async()=>{await supabaseClient.auth.signOut();showLogin();});
days.addEventListener('change',load);
refresh.addEventListener('click',load);
search.addEventListener('input',renderQueue);
priority.addEventListener('change',renderQueue);
temperature.addEventListener('change',renderQueue);
queue.addEventListener('click',async e=>{
  const b=e.target.closest('button[data-task]');
  if(!b)return;
  b.disabled=true;
  const {error}=await supabaseClient.rpc('admin_complete_task',{p_task_id:b.dataset.task});
  b.disabled=false;
  if(error){alert('Chưa đánh dấu xong được: '+error.message);return;}
  await load();
});

const {data}=await supabaseClient.auth.getSession();
data.session?showApp():showLogin();
