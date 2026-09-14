(()=>{
  const reveal=host=>{
    if(!host||host.classList.contains('vh-final-ready'))return;
    host.classList.add('vh-final-ready');
    const loading=document.getElementById('vhMorningDecisionLoading');
    if(loading)loading.remove();
  };

  const readyEnough=host=>{
    if(!host)return false;
    const verdictDone=!!host.querySelector('.vh5-verdict.vhb-v2');
    const macroDone=!!host.querySelector('.vh5-macro-regime .vh2-list');
    const signalDone=[...host.querySelectorAll('.vh5-section')][0]?.querySelector('.vh5-card h3')?.textContent?.trim();
    return verdictDone&&macroDone&&!!signalDone;
  };

  const start=()=>{
    const started=performance.now();
    const tick=()=>{
      const host=document.getElementById('vhDecisionBoardV5');
      if(readyEnough(host)){
        requestAnimationFrame(()=>requestAnimationFrame(()=>reveal(host)));
        return;
      }
      if(host&&performance.now()-started>2600){reveal(host);return}
      requestAnimationFrame(tick);
    };
    tick();
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
