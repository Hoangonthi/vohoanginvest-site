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

const V='20260917-middle-repair-1';
await import(`./morning-brief-core.js?v=${V}`);
await import(`./morning-decision-dashboard-v5.js?v=${V}`);
await import(`./morning-decision-dashboard-v5-repair.js?v=${V}`);
await import(`./morning-decision-dashboard-v5-anchor.js?v=${V}`);
await import(`./morning-advisor-engine-v1.js?v=${V}`);
await import(`./morning-verdict-board-v2.js?v=${V}`);
await import(`./morning-macro-action-engine-v2.js?v=${V}`);
await import(`./morning-readable-type-v1.js?v=${V}`);
await import(`./morning-live-patch-v1.js?v=${V}`);
await import(`./morning-stock-link-v1.js?v=${V}`);
clearStaleMorningLoader();
