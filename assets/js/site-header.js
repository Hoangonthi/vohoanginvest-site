import "./site-header-core-v20260914.js";

function applyAboutHeroCopy(){
  const page=(window.location.pathname.split("/").pop()||"").toLowerCase();
  if(page!=="ve-toi.html") return;

  const copy=document.querySelector(".profile-hero-copy");
  if(!copy) return;

  const lead=copy.querySelector(".profile-hero-lead");
  if(lead){
    const story=document.createElement("div");
    story.className="profile-hero-lead profile-hero-story";
    story.innerHTML=`
      <p>Tôi là <strong>Võ Hoàng</strong>, làm việc trong lĩnh vực chứng khoán.</p>
      <p>Tôi đã đi qua những giai đoạn kiếm tiền rất dễ, cũng từng trải qua những lúc càng cố càng sai. Có khi nhìn đúng cổ phiếu nhưng sai thời điểm. Có lúc đang có lãi rồi trả lại thị trường chỉ vì kỳ vọng thêm một chút.</p>
      <p>Đi đủ lâu mới hiểu: tìm được cơ hội chỉ là một phần. Khó hơn là biết đặt bao nhiêu vốn khi mình đúng và dừng lại ở đâu khi mình sai.</p>
      <p>Vì vậy, trước một quyết định, tôi không chỉ hỏi <strong>“có tăng không?”</strong>. Tôi quan tâm hơn đến <strong>vì sao nó có thể tăng, điều gì sẽ khiến mình sai, nên đặt bao nhiêu vốn và nếu sai thì mất bao nhiêu</strong>.</p>
      <p>Tôi vẫn có thể sai. Nhưng tôi không còn để một lần sai quyết định cả tài khoản.</p>
      <p class="profile-story-closing"><strong>Cơ hội luôn còn. Điều quan trọng là mình còn đủ vốn, đủ tỉnh táo và đủ bản lĩnh để đi tiếp.</strong></p>`;
    lead.replaceWith(story);
  }

  const actions=copy.querySelector(".profile-actions");
  if(actions){
    actions.querySelector('a[href*="kiem-tra-nhanh-tai-khoan"]')?.remove();
    if(!actions.querySelector("a")) actions.remove();
  }

  if(!document.getElementById("vh-about-story-style")){
    const style=document.createElement("style");
    style.id="vh-about-story-style";
    style.textContent=`
      .profile-hero h1{font-size:22px;line-height:1.34;letter-spacing:-.012em;max-width:690px}
      .profile-hero-story{max-width:690px;font-size:14.5px;line-height:1.72;text-align:left}
      .profile-hero-story p{margin:0 0 10px}
      .profile-hero-story p:last-child{margin-bottom:0}
      .profile-hero-story strong{color:#fff;font-weight:700}
      .profile-hero-story .profile-story-closing strong{color:var(--gold-2,#f3cf74)}
      .profile-hero-copy .profile-actions:has(a:only-child){margin-top:20px}
      @media(max-width:680px){
        .profile-hero h1{font-size:18px;line-height:1.38}
        .profile-hero-story{font-size:13px;line-height:1.65;text-align:left}
        .profile-hero-story p{margin-bottom:9px}
      }`;
    document.head.appendChild(style);
  }
}

function applyMarketLiveLink(){
  const page=(window.location.pathname.split("/").pop()||"").toLowerCase();
  if(page!=="thi-truong-hom-nay.html") return;
  const tools=document.querySelector(".reader-tools");
  if(!tools || tools.querySelector('[data-live-commentary-link]')) return;

  const link=document.createElement("a");
  link.href="binh-luan-thi-truong-truc-tiep.html";
  link.setAttribute("data-live-commentary-link","");
  link.innerHTML=`<span><i class="vh-live-dot"></i>Bình luận trực tiếp</span><span>→</span>`;
  tools.prepend(link);

  if(!document.getElementById("vh-live-link-style")){
    const style=document.createElement("style");
    style.id="vh-live-link-style";
    style.textContent=`
      [data-live-commentary-link] span:first-child{display:inline-flex;align-items:center;gap:7px}
      .vh-live-dot{width:7px;height:7px;border-radius:50%;background:#ff6b72;box-shadow:0 0 0 4px rgba(255,107,114,.10);flex:0 0 auto}
    `;
    document.head.appendChild(style);
  }
}

function applyNewsAutoRefresh(){
  const page=(window.location.pathname.split("/").pop()||"").toLowerCase();
  if(page!=="tin-tuc-24h.html") return;
  if(window.__vhNewsAutoRefreshStarted) return;

  const refresh=document.getElementById("refresh");
  if(!refresh) return;

  window.__vhNewsAutoRefreshStarted=true;
  const intervalMs=60_000;
  refresh.textContent="↻ Cập nhật · tự động 60s";
  refresh.title="Trang tự kiểm tra tin mới mỗi 60 giây. Bạn vẫn có thể bấm để cập nhật ngay.";

  const refreshIfVisible=()=>{
    if(document.visibilityState!=="visible") return;
    refresh.click();
  };

  window.setInterval(refreshIfVisible,intervalMs);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible") refreshIfVisible();
  });
}

function applyLiveDualStream(){
  const page=(window.location.pathname.split("/").pop()||"").toLowerCase();
  if(page!=="binh-luan-thi-truong-truc-tiep.html") return;
  if(window.__vhLiveDualStreamLoaded) return;
  window.__vhLiveDualStreamLoaded=true;
  import("./market-live-dual-stream.js?v=20260915-2").catch(()=>{});
}

function applyLiveLayoutCommunity(){
  const page=(window.location.pathname.split("/").pop()||"").toLowerCase();
  if(page!=="binh-luan-thi-truong-truc-tiep.html") return;
  if(window.__vhLiveLayoutCommunityLoaded) return;
  window.__vhLiveLayoutCommunityLoaded=true;
  if(!document.getElementById("vh-live-community-column-style")){
    const style=document.createElement("style");
    style.id="vh-live-community-column-style";
    style.textContent=".community-side{grid-template-columns:1fr!important}.community-panel{min-width:0}";
    document.head.appendChild(style);
  }
  import("./market-live-layout-community.js?v=20260915-1").catch(()=>{});
}

function applyPageEnhancements(){
  applyAboutHeroCopy();
  applyMarketLiveLink();
  applyNewsAutoRefresh();
  applyLiveDualStream();
  applyLiveLayoutCommunity();
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",applyPageEnhancements,{once:true});
}else{
  applyPageEnhancements();
}
