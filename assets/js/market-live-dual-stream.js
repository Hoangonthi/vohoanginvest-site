const API = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-live-public";
let activeAdminComment = null;
let rendering = false;
let timer = null;

const esc = (value="") => String(value)
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");

function timeText(iso){
  if(!iso) return "—";
  try{
    return new Intl.DateTimeFormat("vi-VN",{
      timeZone:"Asia/Ho_Chi_Minh",
      hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false
    }).format(new Date(iso));
  }catch{return "—";}
}

function renderAdmin(comment){
  const panel=document.getElementById("latestPanel");
  if(!panel||!comment) return;
  rendering=true;
  panel.dataset.liveStream="admin";
  panel.innerHTML=`
    <div class="panel-head"><h2>Bình luận mới nhất</h2><span>Cập nhật trực tiếp</span></div>
    <article class="latest">
      <div class="latest-time">${timeText(comment.published_at)} · ĐANG THEO DÕI</div>
      <h2>${esc(comment.headline||"Cập nhật diễn biến thị trường")}</h2>
      <p class="latest-body">${esc(comment.body||"")}</p>
      ${comment.watch_next?`<div class="watch-next"><b>Điểm cần nhìn tiếp:</b> ${esc(comment.watch_next)}</div>`:""}
    </article>`;
  rendering=false;
}

function releaseAdmin(){
  const panel=document.getElementById("latestPanel");
  if(panel?.dataset.liveStream==="admin") delete panel.dataset.liveStream;
  activeAdminComment=null;
}

async function sync(){
  try{
    const r=await fetch(`${API}?limit=3&_=${Date.now()}`,{cache:"no-store"});
    if(!r.ok) return;
    const data=await r.json();
    const latest=Array.isArray(data?.comments)?data.comments[0]:null;
    if(latest?.source_mode==="admin-live"){
      const changed=!activeAdminComment||Number(activeAdminComment.id)!==Number(latest.id)||activeAdminComment.body!==latest.body;
      activeAdminComment=latest;
      if(changed||document.getElementById("latestPanel")?.dataset.liveStream!=="admin") renderAdmin(latest);
      return;
    }
    if(activeAdminComment) releaseAdmin();
  }catch{}
}

function start(){
  const panel=document.getElementById("latestPanel");
  if(!panel) return;
  const observer=new MutationObserver(()=>{
    if(rendering||!activeAdminComment) return;
    if(panel.dataset.liveStream!=="admin") queueMicrotask(()=>renderAdmin(activeAdminComment));
  });
  observer.observe(panel,{childList:true,subtree:true});
  sync();
  timer=window.setInterval(()=>{if(document.visibilityState==="visible")sync();},2500);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")sync();});
}

start();
