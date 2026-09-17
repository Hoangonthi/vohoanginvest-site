// Bản tin sáng phải luôn hiện nội dung; tuyệt đối không giữ skeleton cũ.
const clearStaleMorningLoader=()=>{
  document.getElementById('vhMorningDecisionLoading')?.remove();
  document.getElementById('vhMorningDecisionPrebootStyle')?.remove();
  document.getElementById('vhDecisionBoardV5')?.classList.add('vh-final-ready');
};
clearStaleMorningLoader();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clearStaleMorningLoader,{once:true});
setTimeout(clearStaleMorningLoader,800);
setTimeout(clearStaleMorningLoader,2500);

// RESTORE FINAL DECISION DASHBOARD V5.
// Legacy HTML chỉ là fallback: stable guard sẽ ẩn khi V5 thực sự hiển thị,
// và tự trả legacy về nếu V5 không dựng được. Không dùng MutationObserver.
const V='20260917-v5-restored-stable-1';
await import(`./morning-brief-core.js?v=${V}`);
await import(`./morning-decision-dashboard-v5.js?v=${V}`);
await import(`./morning-decision-dashboard-v5-anchor.js?v=${V}`);
await import(`./morning-advisor-engine-v1.js?v=${V}`);
await import(`./morning-verdict-board-v2.js?v=${V}`);
await import(`./morning-macro-action-engine-v2.js?v=${V}`);
await import(`./morning-readable-type-v1.js?v=${V}`);
await import(`./morning-stock-link-v1.js?v=${V}`);
await import(`./morning-v5-stable-guard.js?v=${V}`);
clearStaleMorningLoader();
