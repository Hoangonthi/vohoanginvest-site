(()=>{
  const reveal=host=>{
    if(!host||host.classList.contains('vh-final-ready'))return;
    host.classList.add('vh-final-ready');
    const loading=document.getElementById('vhMorningDecisionLoading');
    if(loading)loading.remove();
  };

  const restoreLegacy=()=>{
    const loading=document.getElementById('vhMorningDecisionLoading');
    if(loading)loading.remove();

    // Nếu board mới không dựng được, trả lại phần nội dung gốc đã bị preboot ẩn.
    const candidates=[...document.querySelectorAll('.card,.section,.split-card')];
    for(const el of candidates){
      const text=(el.textContent||'').trim().toLowerCase();
      if(text.includes('tại điểm đáng chú ý')||text.includes('những biến số có thể làm thay đổi quyết định hôm nay')){
        el.style.display='';
        break;
      }
    }
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
    let finished=false;

    const finishWithFallback=()=>{
      if(finished)return;
      finished=true;
      const host=document.getElementById('vhDecisionBoardV5');
      if(host){
        reveal(host);
      }else{
        restoreLegacy();
      }
    };

    // Tuyệt đối không để màn hình chờ chạy vô hạn nếu module phía trước lỗi.
    const hardTimeout=window.setTimeout(finishWithFallback,2600);

    const tick=()=>{
      if(finished)return;
      const host=document.getElementById('vhDecisionBoardV5');
      if(readyEnough(host)){
        finished=true;
        window.clearTimeout(hardTimeout);
        requestAnimationFrame(()=>reveal(host));
        return;
      }

      // Snapshot đã được tính sẵn trên server. Nếu một lớp diễn giải phụ chậm,
      // không giữ người dùng ở màn hình chờ quá lâu.
      if(host&&performance.now()-started>1400){
        finished=true;
        window.clearTimeout(hardTimeout);
        reveal(host);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
