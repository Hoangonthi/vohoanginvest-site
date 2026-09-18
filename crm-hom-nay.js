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

const tabCrmBtn=$('#tabCrmBtn'),tabVisitorsBtn=$('#tabVisitorsBtn');
const crmTabPanel=$('#crmTabPanel'),visitorsTabPanel=$('#visitorsTabPanel');
const visitorMetrics=$('#visitorMetrics'),visitorSearch=$('#visitorSearch'),visitorType=$('#visitorType');
const visitorAttention=$('#visitorAttention'),visitorTool=$('#visitorTool'),visitorRefresh=$('#visitorRefresh');
const visitorCount=$('#visitorCount'),visitorList=$('#visitorList'),visitorDetail=$('#visitorDetail');

let rows=[];
let visitorRows=[];
let visitorsLoaded=false;
let selectedVisitorSession='';

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


function visitorKindLabel(r){
  if(r.customer_id)return 'Đã nhận diện';
  if(r.is_logged_in)return 'Đã đăng nhập';
  return 'Người lạ';
}

function visitorKindClass(r){
  if(r.customer_id)return 'is-known';
  if(r.is_logged_in)return 'is-login';
  return 'is-anonymous';
}

function attentionLabel(v){
  return ({HIGH:'Đáng chú ý',MEDIUM:'Có tương tác',LOW:'Chỉ xem'})[v]||'—';
}

function attentionClass(v){
  return v==='HIGH'?'is-high':v==='MEDIUM'?'is-medium':'is-low';
}

function shortSession(v=''){
  const s=String(v||'');
  return s?s.slice(0,8).toUpperCase():'—';
}

function visitorDisplayName(r){
  if(r.full_name)return r.full_name;
  if(r.is_logged_in)return 'Tài khoản đã đăng nhập';
  return 'Người lạ #'+shortSession(r.session_id);
}

function dedupeActions(actions=[]){
  const out=[];
  const seen=new Set();
  for(const a of actions){
    const label=actionText(a);
    const key=String(a.tool_code||'')+'|'+String(a.event_type||'')+'|'+String(a.result_code||'')+'|'+label;
    if(seen.has(key))continue;
    seen.add(key);
    out.push({...a,_label:label});
  }
  return out;
}

function visibleVisitors(){
  const q=String(visitorSearch.value||'').trim().toLowerCase();
  const type=visitorType.value||'';
  const attention=visitorAttention.value||'';
  const tool=visitorTool.value||'';

  return visitorRows.filter(r=>{
    if(type==='ANONYMOUS'&&(r.customer_id||r.is_logged_in))return false;
    if(type==='LOGGED_IN'&&!r.is_logged_in)return false;
    if(type==='IDENTIFIED'&&!r.customer_id)return false;
    if(attention&&r.attention_level!==attention)return false;
    if(tool&&!(r.tools_today||[]).includes(tool))return false;
    if(!q)return true;
    const hay=[
      r.full_name,r.phone,r.email,r.source,r.session_id,
      sourceLabel(r.source),(r.tools_today||[]).map(toolLabel).join(' ')
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function renderVisitorMetrics(){
  const total=visitorRows.length;
  const anonymous=visitorRows.filter(r=>!r.customer_id&&!r.is_logged_in).length;
  const logged=visitorRows.filter(r=>r.is_logged_in).length;
  const identified=visitorRows.filter(r=>r.customer_id).length;
  const high=visitorRows.filter(r=>r.attention_level==='HIGH').length;

  const data=[
    ['Tổng phiên hôm nay',total,'Mỗi trình duyệt/phiên được tính riêng'],
    ['Người lạ',anonymous,'Chưa biết danh tính'],
    ['Đã đăng nhập',logged,'Có dấu hiệu/tài khoản đăng nhập'],
    ['Đã nhận diện',identified,'Đã nối được hồ sơ khách'],
    ['Đáng chú ý',high,'Có CTA, để lại thông tin hoặc dùng sâu']
  ];

  visitorMetrics.innerHTML=data.map((x,i)=>
    '<div class="admin-card admin-metric '+(i===4?'is-focus':'')+'"><span>'+esc(x[0])+'</span><strong>'+Number(x[1]||0)+'</strong><small>'+esc(x[2])+'</small></div>'
  ).join('');
}

function populateVisitorTools(){
  const current=visitorTool.value;
  const tools=[...new Set(visitorRows.flatMap(r=>Array.isArray(r.tools_today)?r.tools_today:[]))].sort((a,b)=>toolLabel(a).localeCompare(toolLabel(b),'vi'));
  visitorTool.innerHTML='<option value="">Mọi trang / công cụ</option>'
    +tools.map(t=>'<option value="'+esc(t)+'">'+esc(toolLabel(t))+'</option>').join('');
  if(tools.includes(current))visitorTool.value=current;
}

function visitorSourceText(r){
  const parsed=parseSource(r.source||'');
  return parsed.sourceLabel||'Chưa rõ nguồn';
}

function renderVisitorList(){
  const data=visibleVisitors();
  visitorCount.textContent=data.length+' / '+visitorRows.length+' phiên';

  if(!data.length){
    visitorList.innerHTML='<div class="admin-card admin-empty">Không có lượt truy cập phù hợp bộ lọc.</div>';
    return;
  }

  visitorList.innerHTML=data.map(r=>{
    const actions=dedupeActions(Array.isArray(r.recent_actions)?r.recent_actions:[]).slice(0,3);
    const selected=r.session_id===selectedVisitorSession?' is-selected':'';
    return '<article class="admin-card visitor-card'+selected+'" data-session="'+esc(r.session_id)+'">'
      +'<div class="visitor-card-head"><div><h3>'+esc(visitorDisplayName(r))+'</h3><div class="visitor-card-meta">'
        +(r.phone?'<span>'+esc(r.phone)+'</span>':'')
        +(r.email?'<span>'+esc(r.email)+'</span>':'')
        +'<span>Vào '+formatTime(r.first_seen_at)+'</span>'
        +'<span>Gần nhất '+formatTime(r.last_seen_at)+'</span>'
        +'<span>'+Number(r.events_today||0)+' lượt hoạt động</span>'
      +'</div></div><div style="display:grid;gap:5px;justify-items:end"><span class="visitor-kind '+visitorKindClass(r)+'">'+esc(visitorKindLabel(r))+'</span><span class="visitor-attention '+attentionClass(r.attention_level)+'">'+esc(attentionLabel(r.attention_level))+'</span></div></div>'
      +'<div class="admin-source"><strong>'+esc(visitorSourceText(r))+'</strong></div>'
      +'<div class="admin-activity-tools">'+(r.tools_today||[]).slice(0,5).map(t=>'<span class="admin-tool">'+esc(toolLabel(t))+'</span>').join('')+'</div>'
      +(actions.length?'<div class="visitor-actions-preview">'+actions.map(a=>'<div><time>'+formatTime(a.created_at)+'</time><span>'+esc(a._label)+'</span></div>').join('')+'</div>':'')
    +'</article>';
  }).join('');
}

function renderVisitorDetailShell(r){
  const parsed=parseSource(r.source||'');
  const contactButtons=r.customer_id
    ?'<div class="admin-actions" style="justify-content:flex-start;max-width:none;margin-top:10px"><a class="is-main" href="khach-hang.html?id='+encodeURIComponent(r.customer_id)+'">Hồ sơ khách</a>'
      +(r.phone?'<a href="tel:'+esc(r.phone)+'">Gọi</a><a href="https://zalo.me/'+esc(zaloPhone(r.phone))+'" target="_blank" rel="noopener">Zalo</a>':'')
      +'</div>'
    :'';

  visitorDetail.innerHTML=
    '<div class="visitor-detail-head"><div><h2>'+esc(visitorDisplayName(r))+'</h2><div class="visitor-card-meta">'
      +'<span class="visitor-kind '+visitorKindClass(r)+'">'+esc(visitorKindLabel(r))+'</span>'
      +'<span class="visitor-attention '+attentionClass(r.attention_level)+'">'+esc(attentionLabel(r.attention_level))+'</span>'
    +'</div></div><span class="admin-help">'+Number(r.events_today||0)+' lượt</span></div>'
    +'<div class="visitor-detail-grid">'
      +'<div class="visitor-detail-box"><span>Lần đầu hôm nay</span><strong>'+formatTime(r.first_seen_at)+'</strong></div>'
      +'<div class="visitor-detail-box"><span>Gần nhất</span><strong>'+formatTime(r.last_seen_at)+'</strong></div>'
      +'<div class="visitor-detail-box"><span>Số điện thoại</span><strong>'+esc(r.phone||'Chưa có')+'</strong></div>'
      +'<div class="visitor-detail-box"><span>Email</span><strong>'+esc(r.email||'Chưa có')+'</strong></div>'
    +'</div>'
    +'<div class="admin-source"><strong>'+esc(parsed.sourceLabel||'Chưa rõ nguồn')+'</strong>'
      +'<details class="admin-tech"><summary>Xem mã phiên / dữ liệu kỹ thuật</summary><code>'+esc(r.session_id)+(r.source?' | '+esc(r.source):'')+'</code></details>'
    +'</div>'
    +'<div class="admin-activity-tools" style="margin-top:10px">'+(r.tools_today||[]).map(t=>'<span class="admin-tool">'+esc(toolLabel(t))+'</span>').join('')+'</div>'
    +contactButtons
    +'<h3 class="admin-section-title" style="margin-top:18px">Hoạt động trong ngày</h3>'
    +'<div id="visitorTimeline" class="visitor-timeline"><div class="admin-help">Đang tải chi tiết...</div></div>';
}

async function loadVisitorDetail(sessionId){
  const r=visitorRows.find(x=>x.session_id===sessionId);
  if(!r)return;
  selectedVisitorSession=sessionId;
  renderVisitorList();
  renderVisitorDetailShell(r);

  const {data,error}=await supabaseClient.rpc('admin_today_visitor_events_v1',{p_session_id:sessionId,p_limit:150});
  const timeline=$('#visitorTimeline');
  if(!timeline)return;
  if(error){
    timeline.innerHTML='<div class="admin-help">Không tải được chi tiết: '+esc(error.message)+'</div>';
    return;
  }

  const events=Array.isArray(data)?data:[];
  timeline.innerHTML=events.length?events.map(a=>
    '<div class="visitor-timeline-item"><time>'+formatTime(a.created_at)+'</time><div><strong>'+esc(actionText(a))+'</strong>'
      +(a.score!==null&&a.score!==undefined?'<span>Điểm ghi nhận: '+esc(a.score)+'</span>':'')
    +'</div></div>'
  ).join(''):'<div class="admin-help">Chưa có hoạt động chi tiết.</div>';
}

async function loadVisitors(){
  visitorRefresh.disabled=true;
  visitorRefresh.textContent='Đang tải...';
  visitorList.innerHTML='<div class="admin-card admin-panel">Đang tải truy cập hôm nay...</div>';

  const {data,error}=await supabaseClient.rpc('admin_today_visitors_v1',{p_limit:500});

  visitorRefresh.disabled=false;
  visitorRefresh.textContent='Làm mới';

  if(error){
    visitorList.innerHTML='<div class="admin-card admin-panel">Không tải được truy cập hôm nay: '+esc(error.message)+'</div>';
    return;
  }

  visitorRows=Array.isArray(data)?data:[];
  visitorsLoaded=true;
  renderVisitorMetrics();
  populateVisitorTools();
  renderVisitorList();

  if(selectedVisitorSession&&visitorRows.some(r=>r.session_id===selectedVisitorSession)){
    await loadVisitorDetail(selectedVisitorSession);
  }else if(visitorRows.length){
    await loadVisitorDetail(visitorRows[0].session_id);
  }else{
    visitorDetail.innerHTML='<div class="admin-empty">Hôm nay chưa ghi nhận phiên truy cập nào.</div>';
  }
}

async function activateAdminTab(name,updateHash=true){
  const visitors=name==='visitors';
  tabCrmBtn.classList.toggle('is-active',!visitors);
  tabVisitorsBtn.classList.toggle('is-active',visitors);
  tabCrmBtn.setAttribute('aria-selected',String(!visitors));
  tabVisitorsBtn.setAttribute('aria-selected',String(visitors));
  crmTabPanel.classList.toggle('hidden',visitors);
  visitorsTabPanel.classList.toggle('hidden',!visitors);
  if(updateHash)history.replaceState(null,'',visitors?'#truy-cap':'#crm');
  if(visitors&&!visitorsLoaded)await loadVisitors();
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

async function showApp(){
  loginBox.classList.add('hidden');
  app.classList.remove('hidden');
  logout.classList.remove('hidden');
  await load();
  await activateAdminTab(location.hash==='#truy-cap'?'visitors':'crm',false);
}
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

tabCrmBtn.addEventListener('click',()=>activateAdminTab('crm'));
tabVisitorsBtn.addEventListener('click',()=>activateAdminTab('visitors'));
visitorSearch.addEventListener('input',renderVisitorList);
visitorType.addEventListener('change',renderVisitorList);
visitorAttention.addEventListener('change',renderVisitorList);
visitorTool.addEventListener('change',renderVisitorList);
visitorRefresh.addEventListener('click',loadVisitors);
visitorList.addEventListener('click',e=>{
  const card=e.target.closest('[data-session]');
  if(card)loadVisitorDetail(card.dataset.session);
});
window.addEventListener('hashchange',()=>{
  if(location.hash==='#truy-cap')activateAdminTab('visitors',false);
  if(location.hash==='#crm'||!location.hash)activateAdminTab('crm',false);
});

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
