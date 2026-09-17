// Guard chống "thủng giữa trang": chỉ để legacy sections bị ẩn khi board V5 thực sự hiển thị.
const LEGACY_LABELS=[
  'Tại điểm đáng chú ý',
  '3 điều cần nhìn',
  'Điều kiện thay đổi quan điểm',
  'Cách Võ Hoàng nhìn',
  'Không nên làm sáng nay'
];
const LEGACY_HEADING='Những biến số có thể làm thay đổi quyết định hôm nay';

function legacyTargets(){
  const out=[];
  for(const el of document.querySelectorAll('.overline,.section-kicker,.kicker')){
    const text=(el.textContent||'').trim().toLowerCase();
    if(LEGACY_LABELS.some(x=>x.toLowerCase()===text)){
      const box=el.closest('.card,.section,.split-card')||el.parentElement;
      if(box)out.push(box);
    }
  }
  for(const el of document.querySelectorAll('h2,h3')){
    if((el.textContent||'').trim().toLowerCase().includes(LEGACY_HEADING.toLowerCase())){
      const box=el.closest('.card,.section,.split-card')||el.parentElement;
      if(box)out.push(box);
    }
  }
  return [...new Set(out)];
}

function hiddenAncestor(el){
  let p=el?.parentElement||null;
  while(p&&p!==document.body){
    const cs=getComputedStyle(p);
    if(cs.display==='none'||cs.visibility==='hidden')return p;
    p=p.parentElement;
  }
  return null;
}

function boardVisible(board){
  if(!board||!board.isConnected)return false;
  const cs=getComputedStyle(board);
  if(cs.display==='none'||cs.visibility==='hidden')return false;
  if(hiddenAncestor(board))return false;
  const r=board.getBoundingClientRect();
  return r.width>100&&r.height>120;
}

function restoreLegacy(){
  for(const el of legacyTargets()){
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.removeAttribute('aria-hidden');
  }
}

function relocateBoard(board){
  const hidden=hiddenAncestor(board);
  if(!hidden||!hidden.parentNode)return false;
  hidden.parentNode.insertBefore(board,hidden);
  board.style.removeProperty('display');
  board.style.removeProperty('visibility');
  return true;
}

function repair(){
  const board=document.getElementById('vhDecisionBoardV5');
  if(board){
    relocateBoard(board);
    if(boardVisible(board))return true;
  }
  restoreLegacy();
  return false;
}

function init(){
  repair();
  const observer=new MutationObserver(()=>repair());
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  setTimeout(()=>repair(),300);
  setTimeout(()=>repair(),1000);
  setTimeout(()=>repair(),2500);
  setTimeout(()=>repair(),5000);
  setTimeout(()=>observer.disconnect(),12000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
