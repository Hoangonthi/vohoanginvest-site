const TARGET_ID='co-phieu-dang-chu-y-hom-nay';

function findTarget(){
  const overline=[...document.querySelectorAll('.overline')].find(el=>el.textContent.trim().toLowerCase()==='cổ phiếu đáng chú ý hôm nay');
  return overline?.closest('.card,.section,.split-card')||overline?.parentElement||null;
}

function wire(){
  const target=findTarget();
  const link=document.querySelector('#vhDecisionBoardV5 .vh5-watch-link');
  if(!target||!link)return false;

  target.id=TARGET_ID;
  target.style.scrollMarginTop='96px';
  link.setAttribute('href',`#${TARGET_ID}`);
  link.setAttribute('aria-label','Đi tới mục Cổ phiếu đáng chú ý hôm nay');

  if(link.dataset.vhAnchorBound!=='1'){
    link.dataset.vhAnchorBound='1';
    link.addEventListener('click',e=>{
      e.preventDefault();
      target.scrollIntoView({behavior:'smooth',block:'start'});
      try{history.replaceState(null,'',`#${TARGET_ID}`)}catch{}
    });
  }
  return true;
}

function init(){
  if(wire())return;
  const observer=new MutationObserver(()=>{
    if(wire())observer.disconnect();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),15000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
