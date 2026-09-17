// Bản tin sáng phải luôn hiện nội dung; tuyệt đối không giữ skeleton cũ.
const clearStaleMorningLoader=()=>{
  document.getElementById('vhMorningDecisionLoading')?.remove();
  document.getElementById('vhMorningDecisionPrebootStyle')?.remove();
  document.getElementById('vhDecisionBoardV5')?.remove();
};
clearStaleMorningLoader();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clearStaleMorningLoader,{once:true});
setTimeout(clearStaleMorningLoader,800);
setTimeout(clearStaleMorningLoader,2500);

// STABLE MODE 2026-09-17:
// Không nạp dashboard V5 / repair guard vì hai module này từng ẩn legacy sections
// và repair guard có thể tạo MutationObserver loop. Giữ các section HTML gốc luôn visible.
const V='20260917-stable-middle-1';
await import(`./morning-brief-core.js?v=${V}`);
await import(`./morning-advisor-engine-v1.js?v=${V}`);
await import(`./morning-verdict-board-v2.js?v=${V}`);
await import(`./morning-macro-action-engine-v2.js?v=${V}`);
await import(`./morning-readable-type-v1.js?v=${V}`);
await import(`./morning-stock-link-v1.js?v=${V}`);
clearStaleMorningLoader();
