import { supabaseClient } from './supabase-client.js';

const LIMIT=24;
let user=null;
let busy=false;
let timer=null;

const $=id=>document.getElementById(id);
const esc=(value='')=>String(value)
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&#039;');

function timeText(iso){
  if(!iso)return '—';
  try{
    return new Intl.DateTimeFormat('vi-VN',{
      timeZone:'Asia/Ho_Chi_Minh',
      hour:'2-digit',
      minute:'2-digit',
      hour12:false
    }).format(new Date(iso));
  }catch{return '—';}
}

function labelForUser(row){
  return row?.user_metadata?.full_name
    || row?.user_metadata?.name
    || row?.email
    || 'Nhà đầu tư';
}

function shell(){
  const mount=$('communityMount');
  if(!mount)return false;
  mount.innerHTML=`
    <section class="panel community-panel">
      <div class="panel-head">
        <h2>Bình luận cộng đồng</h2>
        <span>Người dùng đã đăng nhập</span>
      </div>
      <div class="community-body-wrap">
        <div id="communityComposer"></div>
        <div class="community-msg" id="communityMsg" aria-live="polite"></div>
        <div class="community-list" id="communityList">
          <div class="community-empty">Đang tải bình luận...</div>
        </div>
      </div>
    </section>`;
  return true;
}

function renderComposer(){
  const root=$('communityComposer');
  if(!root)return;
  if(!user){
    root.innerHTML=`
      <div class="community-login-box">
        Đăng nhập tài khoản để tham gia bình luận.
        <br>
        <a class="community-login-link" href="dang-nhap.html">Đăng nhập</a>
      </div>`;
    return;
  }
  root.innerHTML=`
    <div class="community-compose">
      <textarea id="communityText" maxlength="800" placeholder="Bạn đang theo dõi điều gì trên thị trường? Cùng trao đổi góc nhìn tại đây nhé."></textarea>
      <div class="community-compose-foot">
        <span class="community-identity">Đang bình luận với tên: ${esc(labelForUser(user))}</span>
        <button class="community-submit" type="button" id="communitySubmit">Đăng bình luận</button>
      </div>
    </div>`;
  $('communitySubmit')?.addEventListener('click',submit);
  $('communityText')?.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){
      event.preventDefault();
      submit();
    }
  });
}

async function loadComments(){
  const list=$('communityList');
  if(!list)return;
  const {data,error}=await supabaseClient
    .from('market_live_user_comments')
    .select('id,display_name,body,created_at')
    .order('created_at',{ascending:false})
    .limit(LIMIT);

  if(error){
    list.innerHTML='<div class="community-empty">Chưa tải được bình luận cộng đồng.</div>';
    return;
  }
  if(!data?.length){
    list.innerHTML='';
    return;
  }
  list.innerHTML=data.map(row=>`
    <article class="community-item">
      <div class="community-item-head">
        <strong class="community-name">${esc(row.display_name||'Nhà đầu tư')}</strong>
        <span class="community-time">${timeText(row.created_at)}</span>
      </div>
      <p class="community-comment">${esc(row.body||'')}</p>
    </article>`).join('');
}

async function submit(){
  if(busy||!user)return;
  const input=$('communityText');
  const button=$('communitySubmit');
  const msg=$('communityMsg');
  const body=String(input?.value||'').trim();
  if(!body){
    if(msg)msg.textContent='Bạn chưa nhập nội dung.';
    return;
  }

  busy=true;
  if(button)button.disabled=true;
  if(msg)msg.textContent='Đang đăng...';

  const {error}=await supabaseClient
    .from('market_live_user_comments')
    .insert({user_id:user.id,body});

  busy=false;
  if(button)button.disabled=false;

  if(error){
    const message=String(error.message||'');
    if(msg)msg.textContent=message.includes('COMMENT_RATE_LIMIT')
      ?'Bạn vừa bình luận, vui lòng chờ vài giây trước khi đăng tiếp.'
      :'Chưa đăng được bình luận. Vui lòng thử lại.';
    return;
  }

  if(input)input.value='';
  if(msg)msg.textContent='Đã đăng bình luận.';
  await loadComments();
}

async function syncUser(){
  const {data}=await supabaseClient.auth.getUser();
  user=data?.user||null;
  renderComposer();
}

function startPolling(){
  if(timer)clearInterval(timer);
  timer=setInterval(()=>{
    if(document.visibilityState==='visible')loadComments();
  },15000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')loadComments();
  });
}

async function start(){
  if(!shell())return;
  await syncUser();
  await loadComments();
  startPolling();

  supabaseClient.auth.onAuthStateChange((_event,session)=>{
    user=session?.user||null;
    renderComposer();
  });
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',start,{once:true});
}else{
  start();
}
