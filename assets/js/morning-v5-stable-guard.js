const LEGACY_LABELS=['Tại điểm đáng chú ý','3 điều cần nhìn','Điều kiện thay đổi quan điểm','Cách Võ Hoàng nhìn','Không nên làm sáng nay'];
const LEGACY_HEADING='Những biến số có thể làm thay đổi quyết định hôm nay';

function legacyTargets(){
  const out=[];
  for(const el of document.querySelectorAll('.overline,.section-kicker,.kicker')){
    const t=(el.textContent||'').trim().toLowerCase();
    if(LEGACY_LABELS.some(x=>x.toLowerCase()===t)){
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

function visibleBoard(){
  const board=document.getElementById('vhDecisionBoardV5');
  if(!board||!board.isConnected)return null;
  let p=board;
  while(p&&p!==document.body){
    const cs=getComputedStyle(p);
    if(cs.display==='none'||cs.visibility==='hidden')return null;
    p=p.parentElement;
  }
  const r=board.getBoundingClientRect();
  return r.width>100&&r.height>120?board:null;
}

function apply(){
  const board=visibleBoard();
  const legacy=legacyTargets();
  if(board){
    legacy.forEach(el=>{if(!el.contains(board)){el.style.display='none';el.setAttribute('aria-hidden','true')}});
    return true;
  }
  legacy.forEach(el=>{el.style.removeProperty('display');el.removeAttribute('aria-hidden')});
  return false;
}

apply();
setTimeout(apply,500);
setTimeout(apply,1800);
setTimeout(apply,4000);
