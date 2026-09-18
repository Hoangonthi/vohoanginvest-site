import { supabaseClient } from './supabase-client.js';

const PAGE = 'binh-luan-thi-truong-truc-tiep.html';
const COMMUNITY_LIMIT = 24;
const TIMELINE_STEP = 7;
let timelineVisible = TIMELINE_STEP;
let communityUser = null;
let communityTimer = null;
let communityBusy = false;

const $ = (id) => document.getElementById(id);
const esc = (value = '') => String(value)
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&#039;');

function currentPage(){
  return (window.location.pathname.split('/').pop() || '').toLowerCase();
}

function timeText(iso){
  if(!iso) return '—';
  try{
    return new Intl.DateTimeFormat('vi-VN',{
      timeZone:'Asia/Ho_Chi_Minh',
      hour:'2-digit',minute:'2-digit',hour12:false
    }).format(new Date(iso));
  }catch{return '—';}
}

function injectStyle(){
  if(document.getElementById('vh-live-layout-community-style')) return;
  const style=document.createElement('style');
  style.id='vh-live-layout-community-style';
  style.textContent=`
    .live-overview-stack{display:grid;gap:8px;margin-top:10px}
    .live-overview-stack .panel{border-radius:14px;box-shadow:none}
    .live-overview-stack .panel-head{padding:9px 12px}
    .live-overview-stack .panel-head h2{font-size:12px}
    .live-overview-stack .panel-head span{font-size:8.5px}

    .market-overview-panel .side-body{padding:8px 10px!important}
    .market-overview-panel #marketNow{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px!important}
    .market-overview-panel #marketNow>.section-mini{display:contents!important}
    .market-overview-panel #marketNow>.section-mini>h3,
    .market-overview-panel #marketNow>.section-mini>div:not(.side-grid){display:none!important}
    .market-overview-panel #marketNow .side-grid{display:contents!important}
    .market-overview-panel #marketNow .side-cell{padding:7px 8px;min-height:48px;border-radius:9px}
    .market-overview-panel #marketNow .side-cell span{font-size:7px;letter-spacing:.05em}
    .market-overview-panel #marketNow .side-cell b{font-size:9.5px;line-height:1.35}

    .leaders-overview-panel .side-body{padding:8px 10px!important}
    .leaders-overview-panel #marketLeaders{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px!important}
    .leaders-overview-panel #marketLeaders>.section-mini{margin:0!important;padding:8px 9px!important;border:1px solid var(--line2)!important;border-radius:10px;background:rgba(255,255,255,.012)}
    .leaders-overview-panel #marketLeaders>.section-mini h3{font-size:8px;margin:0 0 6px}
    .leaders-overview-panel #marketLeaders .row-list{gap:4px}
    .leaders-overview-panel #marketLeaders .mini-row{font-size:9px;gap:7px}

    .community-panel .panel-head{align-items:flex-start}
    .community-panel .panel-head h2{font-size:15px}
    .community-panel .side-body{padding:12px}
    .community-copy{margin:-2px 0 10px;color:var(--muted2);font-size:9px;line-height:1.5}
    .community-compose{display:grid;gap:7px;padding:9px;border:1px solid var(--line2);border-radius:11px;background:rgba(255,255,255,.012)}
    .community-compose textarea{width:100%;min-height:68px;max-height:150px;resize:vertical;border:1px solid var(--line2);border-radius:9px;background:#06182a;color:var(--text);padding:9px 10px;outline:none;font-size:10.5px;line-height:1.55}
    .community-compose textarea:focus{border-color:rgba(224,187,99,.45)}
    .community-compose-foot{display:flex;justify-content:space-between;align-items:center;gap:8px}
    .community-identity{min-width:0;color:var(--muted2);font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .community-submit,.community-login-link,.timeline-more{border:1px solid rgba(224,187,99,.32);border-radius:9px;background:rgba(224,187,99,.08);color:var(--gold2);font-weight:700;cursor:pointer}
    .community-submit{padding:7px 10px;font-size:9px}
    .community-submit:disabled{opacity:.5;cursor:not-allowed}
    .community-login-box{padding:10px;border:1px solid var(--line2);border-radius:10px;color:var(--muted);font-size:10px;line-height:1.55}
    .community-login-link{display:inline-flex;margin-top:8px;padding:7px 10px;font-size:9px}
    .community-msg{min-height:14px;margin-top:6px;color:var(--muted2);font-size:8.5px}
    .community-list{display:grid;gap:0;margin-top:9px;max-height:690px;overflow:auto;padding-right:2px}
    .community-item{padding:10px 2px;border-top:1px solid var(--line2)}
    .community-item:first-child{border-top:0}
    .community-item-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
    .community-name{min-width:0;color:#f2d485;font-size:9.5px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .community-time{flex:0 0 auto;color:var(--muted2);font-size:8px}
    .community-body{margin:0;color:rgba(245,247,251,.80);font-size:10px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
    .community-empty{padding:14px 3px;color:var(--muted2);font-size:9.5px;line-height:1.55}

    .timeline-more-wrap{padding:0 17px 14px;text-align:center}
    .timeline-more{padding:8px 13px;font-size:9px}
    .timeline-more[hidden]{display:none!important}

    .live-note{display:grid;gap:4px}
    .live-note span{display:block}

    @media(max-width:1050px){
      .market-overview-panel #marketNow{grid-template-columns:repeat(4,minmax(0,1fr))}
      .leaders-overview-panel #marketLeaders{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(max-width:680px){
      .market-overview-panel #marketNow{grid-template-columns:repeat(2,minmax(0,1fr))}
      .leaders-overview-panel #marketLeaders{grid-template-columns:1fr 1fr}
      .community-list{max-height:460px}
    }
  `;
  document.head.appendChild(style);
}

function moveOverviewPanels(){
  const hero=document.querySelector('.live-hero');
  const strip=$('liveStrip');
  const admin=$('liveAdminPanel');
  const marketRoot=$('marketNow');
  const leadersRoot=$('marketLeaders');
  if(!hero||!strip||!marketRoot||!leadersRoot) return false;

  let wrap=$('liveOverviewStack');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='liveOverviewStack';
    wrap.className='live-overview-stack';
    if(admin) hero.insertBefore(wrap,admin); else strip.insertAdjacentElement('afterend',wrap);
  }

  const marketPanel=marketRoot.closest('.panel');
  const leadersPanel=leadersRoot.closest('.panel');
  if(marketPanel){marketPanel.classList.add('market-overview-panel');wrap.appendChild(marketPanel);}
  if(leadersPanel){leadersPanel.classList.add('leaders-overview-panel');wrap.appendChild(leadersPanel);}

  const aside=document.querySelector('.live-grid .side-stack');
  if(aside) aside.classList.add('community-side');
  return true;
}

function updateDisclaimer(){
  const note=document.querySelector('.live-note');
  if(!note) return;
  note.innerHTML=`
    <span>Bình luận được tạo từ dữ liệu thị trường tại thời điểm cập nhật, có thể có độ trễ hoặc sai lệch. Nội dung chỉ mang tính tham khảo, không phải khuyến nghị mua/bán hay cam kết lợi nhuận.</span>
    <span>Thông tin được tổng hợp từ các nguồn công khai phục vụ mục đích tham khảo và phân tích; có thể có độ trễ, sai lệch hoặc thay đổi theo thời điểm. Các tên gọi, phân nhóm và mối liên hệ không hàm ý quan hệ chính thức nếu chưa được công bố. Người đọc nên đối chiếu với nguồn chính thức khi cần xác nhận.</span>`;
}

function ensureTimelineButton(){
  const list=$('timelineList');
  const panel=list?.closest('.timeline');
  if(!list||!panel) return null;
  let wrap=panel.querySelector('.timeline-more-wrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.className='timeline-more-wrap';
    wrap.innerHTML='<button type="button" class="timeline-more" id="timelineMore">Xem thêm</button>';
    panel.appendChild(wrap);
    $('timelineMore')?.addEventListener('click',()=>{
      const items=[...list.querySelectorAll('.timeline-item')];
      if(timelineVisible < items.length) timelineVisible += TIMELINE_STEP;
      else timelineVisible = TIMELINE_STEP;
      applyTimelineLimit();
    });
  }
  return wrap.querySelector('.timeline-more');
}

function applyTimelineLimit(){
  const list=$('timelineList');
  if(!list) return;
  const items=[...list.querySelectorAll('.timeline-item')];
  items.forEach((item,index)=>{item.hidden=index>=timelineVisible;});
  const btn=ensureTimelineButton();
  if(!btn) return;
  if(items.length<=TIMELINE_STEP){btn.hidden=true;return;}
  btn.hidden=false;
  if(timelineVisible>=items.length){
    btn.textContent='Thu gọn';
  }else{
    btn.textContent=`Xem thêm ${Math.min(TIMELINE_STEP,items.length-timelineVisible)} bình luận`;
  }
}

function watchTimeline(){
  const list=$('timelineList');
  if(!list) return;
  const observer=new MutationObserver(()=>queueMicrotask(applyTimelineLimit));
  observer.observe(list,{childList:true});
  applyTimelineLimit();
}

function userLabel(user){
  if(!user) return '';
  const m=user.user_metadata||{};
  return String(m.display_name||m.full_name||m.name||user.email?.split('@')[0]||'Tài khoản').trim();
}

function communityShell(){
  const aside=document.querySelector('.live-grid .side-stack');
  if(!aside) return null;
  let panel=$('communityPanel');
  if(panel) return panel;
  panel=document.createElement('div');
  panel.className='panel community-panel';
  panel.id='communityPanel';
  panel.innerHTML=`
    <div class="panel-head"><h2>Bình luận cộng đồng</h2><span>Người dùng đã đăng nhập</span></div>
    <div class="side-body">
      <div id="communityComposer"></div>
      <div class="community-msg" id="communityMsg"></div>
      <div class="community-list" id="communityList"><div class="community-empty">Đang tải bình luận...</div></div>
    </div>`;
  aside.appendChild(panel);
  return panel;
}

function renderComposer(){
  const root=$('communityComposer');
  if(!root) return;
  if(!communityUser){
    root.innerHTML=`<div class="community-login-box">Đăng nhập tài khoản để tham gia bình luận.<br><a class="community-login-link" href="dang-nhap.html">Đăng nhập</a></div>`;
    return;
  }
  root.innerHTML=`
    <div class="community-compose">
      <textarea id="communityText" maxlength="800" placeholder="Bạn đang chú ý điều gì? Chia sẻ ngắn gọn góc nhìn về diễn biến thị trường."></textarea>
      <div class="community-compose-foot">
        <span class="community-identity">Đang bình luận với tên: ${esc(userLabel(communityUser))}</span>
        <button class="community-submit" type="button" id="communitySubmit">Đăng bình luận</button>
      </div>
    </div>`;
  $('communitySubmit')?.addEventListener('click',submitCommunityComment);
  $('communityText')?.addEventListener('keydown',(event)=>{
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter') submitCommunityComment();
  });
}

async function loadCommunityComments(){
  const list=$('communityList');
  if(!list) return;
  const {data,error}=await supabaseClient
    .from('market_live_user_comments')
    .select('id,display_name,body,created_at')
    .order('created_at',{ascending:false})
    .limit(COMMUNITY_LIMIT);
  if(error){
    list.innerHTML='<div class="community-empty">Chưa tải được bình luận cộng đồng.</div>';
    return;
  }
  if(!data?.length){
    list.innerHTML='<div class="community-empty">Chưa có bình luận nào. Người đăng nhập có thể mở đầu câu chuyện.</div>';
    return;
  }
  list.innerHTML=data.map(row=>`
    <article class="community-item">
      <div class="community-item-head"><strong class="community-name">${esc(row.display_name||'Nhà đầu tư')}</strong><span class="community-time">${timeText(row.created_at)}</span></div>
      <p class="community-body">${esc(row.body||'')}</p>
    </article>`).join('');
}

async function submitCommunityComment(){
  if(communityBusy||!communityUser) return;
  const input=$('communityText');
  const button=$('communitySubmit');
  const msg=$('communityMsg');
  const body=String(input?.value||'').trim();
  if(!body){if(msg)msg.textContent='Bạn chưa nhập nội dung.';return;}
  communityBusy=true;
  if(button) button.disabled=true;
  if(msg) msg.textContent='Đang đăng...';
  const {error}=await supabaseClient.from('market_live_user_comments').insert({user_id:communityUser.id,body});
  communityBusy=false;
  if(button) button.disabled=false;
  if(error){
    const text=String(error.message||'');
    if(msg) msg.textContent=text.includes('COMMENT_RATE_LIMIT')?'Bạn vừa bình luận, vui lòng chờ vài giây trước khi đăng tiếp.':'Chưa đăng được bình luận. Vui lòng thử lại.';
    return;
  }
  if(input) input.value='';
  if(msg) msg.textContent='Đã đăng bình luận.';
  await loadCommunityComments();
}

async function syncCommunityUser(){
  const {data}=await supabaseClient.auth.getUser();
  communityUser=data?.user||null;
  renderComposer();
}

function startCommunityPolling(){
  if(communityTimer) window.clearInterval(communityTimer);
  communityTimer=window.setInterval(()=>{
    if(document.visibilityState==='visible') loadCommunityComments();
  },15000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') loadCommunityComments();
  });
}

async function start(){
  if(currentPage()!==PAGE) return;
  if(window.__vhLiveLayoutCommunityStarted) return;
  window.__vhLiveLayoutCommunityStarted=true;

  injectStyle();
  moveOverviewPanels();
  updateDisclaimer();
  watchTimeline();
  communityShell();
  await syncCommunityUser();
  await loadCommunityComments();
  startCommunityPolling();

  supabaseClient.auth.onAuthStateChange((_event,session)=>{
    communityUser=session?.user||null;
    renderComposer();
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
