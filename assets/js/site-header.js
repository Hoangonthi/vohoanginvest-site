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

function setupLiveCompactOverview(){
  if(window.__vhLiveCompactOverviewStarted) return;
  const marketPanel=document.querySelector('.market-overview-panel');
  const leadersPanel=document.querySelector('.leaders-overview-panel');
  if(!marketPanel||!leadersPanel){
    window.setTimeout(setupLiveCompactOverview,80);
    return;
  }
  window.__vhLiveCompactOverviewStarted=true;

  if(!document.getElementById('vh-live-overview-compact-style')){
    const style=document.createElement('style');
    style.id='vh-live-overview-compact-style';
    style.textContent=`
      .live-overview-stack{gap:6px!important;margin-top:15px!important}
      .live-overview-stack .vh-overview-compact{position:relative;overflow:visible!important;border-radius:12px!important;box-shadow:none!important;margin-top:8px}
      .live-overview-stack .vh-overview-compact>.panel-head{position:absolute!important;top:-10px!important;left:10px!important;right:8px!important;z-index:8;padding:0!important;border:0!important;min-height:21px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:6px!important;pointer-events:none}
      .live-overview-stack .vh-overview-compact>.panel-head h2{margin:0!important;padding:2px 8px!important;background:#06172a!important;border-radius:999px!important;box-shadow:0 0 0 4px #06172a!important;color:#fff!important;font-size:10.5px!important;line-height:17px!important;pointer-events:auto}
      .live-overview-stack .vh-overview-compact>.panel-head>span{margin-left:auto!important;padding:2px 5px!important;background:#06172a!important;color:var(--muted2)!important;font-size:7px!important;line-height:16px!important;pointer-events:none}
      .vh-overview-toggle{pointer-events:auto!important;border:1px solid rgba(224,187,99,.28);border-radius:999px;background:#071a2d;color:var(--gold2);height:21px;padding:0 8px;font-size:7.5px;font-weight:800;cursor:pointer;white-space:nowrap}
      .vh-overview-toggle:hover{border-color:rgba(224,187,99,.55);background:rgba(224,187,99,.08)}

      /* Các ô thị trường tự rộng theo nội dung, không chia đều cột */
      .market-overview-panel .side-body{padding:10px 7px 7px!important}
      .market-overview-panel #marketNow{display:flex!important;flex-wrap:wrap!important;align-items:stretch!important;justify-content:flex-start!important;gap:4px!important}
      .market-overview-panel #marketNow>.section-mini{display:contents!important}
      .market-overview-panel #marketNow>.section-mini>h3,
      .market-overview-panel #marketNow>.section-mini>div:not(.side-grid){display:none!important}
      .market-overview-panel #marketNow .side-grid{display:contents!important}
      .market-overview-panel #marketNow .side-cell{flex:0 0 auto!important;width:max-content!important;min-width:78px!important;max-width:210px!important;padding:5px 7px!important;min-height:40px!important;border-radius:8px!important}
      .market-overview-panel #marketNow .side-cell span{font-size:6.2px!important;letter-spacing:.035em!important;white-space:nowrap!important}
      .market-overview-panel #marketNow .side-cell b{margin-top:3px!important;font-size:8.7px!important;line-height:1.22!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}
      .market-overview-panel.is-collapsed #marketNow>.section-mini:nth-child(n+3){display:none!important}

      /* Nhóm & cổ phiếu cũng ôm sát nội dung dài/ngắn */
      .leaders-overview-panel .side-body{padding:10px 7px 7px!important}
      .leaders-overview-panel #marketLeaders{display:flex!important;flex-wrap:wrap!important;align-items:stretch!important;justify-content:flex-start!important;gap:5px!important}
      .leaders-overview-panel #marketLeaders>.section-mini{flex:0 0 auto!important;width:max-content!important;min-width:185px!important;max-width:330px!important;margin:0!important;padding:6px 8px!important;border-radius:8px!important;min-height:0!important}
      .leaders-overview-panel #marketLeaders>.section-mini h3{font-size:7.2px!important;margin:0 0 4px!important;line-height:1.25!important;white-space:nowrap!important}
      .leaders-overview-panel #marketLeaders .row-list{gap:2px!important;width:max-content!important;min-width:100%!important}
      .leaders-overview-panel #marketLeaders .mini-row{font-size:8.2px!important;line-height:1.25!important;gap:12px!important;width:max-content!important;min-width:100%!important}
      .leaders-overview-panel #marketLeaders .mini-row span,
      .leaders-overview-panel #marketLeaders .mini-row b{white-space:nowrap!important}
      .leaders-overview-panel.is-collapsed #marketLeaders>.section-mini:nth-child(n+5){display:none!important}

      @media(max-width:680px){
        .live-overview-stack{margin-top:14px!important}
        .live-overview-stack .vh-overview-compact>.panel-head{left:8px!important;right:6px!important}
        .live-overview-stack .vh-overview-compact>.panel-head>span{display:none!important}
        .market-overview-panel #marketNow .side-cell{flex:1 1 calc(50% - 4px)!important;width:auto!important;min-width:0!important;max-width:none!important;min-height:38px!important}
        .market-overview-panel #marketNow .side-cell b{overflow:hidden!important;text-overflow:ellipsis!important}
        .leaders-overview-panel #marketLeaders>.section-mini{flex:1 1 calc(50% - 5px)!important;width:auto!important;min-width:0!important;max-width:none!important}
        .leaders-overview-panel #marketLeaders .row-list,
        .leaders-overview-panel #marketLeaders .mini-row{width:100%!important;min-width:0!important}
      }
    `;
    document.head.appendChild(style);
  }

  const prepare=(panel,label)=>{
    panel.classList.add('vh-overview-compact','is-collapsed');
    const head=panel.querySelector(':scope > .panel-head');
    if(!head||head.querySelector('.vh-overview-toggle')) return;
    const button=document.createElement('button');
    button.type='button';
    button.className='vh-overview-toggle';
    button.setAttribute('aria-expanded','false');
    button.textContent='Mở rộng ▾';
    button.title=`Mở rộng ${label}`;
    button.addEventListener('click',()=>{
      const collapsed=panel.classList.toggle('is-collapsed');
      button.setAttribute('aria-expanded',String(!collapsed));
      button.textContent=collapsed?'Mở rộng ▾':'Thu gọn ▴';
      button.title=collapsed?`Mở rộng ${label}`:`Thu gọn ${label}`;
    });
    head.appendChild(button);
  };

  prepare(marketPanel,'Thị trường lúc này');
  prepare(leadersPanel,'Nhóm & cổ phiếu');
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
  import("./market-live-layout-community.js?v=20260915-2")
    .then(()=>setupLiveCompactOverview())
    .catch(()=>{});
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
