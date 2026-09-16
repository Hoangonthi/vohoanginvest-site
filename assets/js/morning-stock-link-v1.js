function patchMorningStockLinks(){
  let changed=false;

  const staticSection=document.querySelector('#co-phieu-dang-chu-y-hom-nay');
  if(staticSection){
    const staticLink=staticSection.querySelector('a.card-action, a[href="watchlist.html"]');
    if(staticLink){
      staticLink.href='co-phieu-dang-chu-y.html';
      staticLink.textContent='Xem thêm →';
      changed=true;
    }
  }

  const actionCard=document.querySelector('.vh5-action.watch');
  if(actionCard){
    const title=actionCard.querySelector('h3');
    const caption=actionCard.querySelector('.vh5-watch-caption');
    const link=actionCard.querySelector('.vh5-watch-link');
    if(title)title.textContent='◉ Cổ phiếu đáng chú ý';
    if(caption)caption.textContent='Một vài mã đang nổi bật theo dữ liệu dòng tiền hôm nay.';
    if(link){
      link.href='co-phieu-dang-chu-y.html';
      link.textContent='Xem toàn bộ →';
      changed=true;
    }
  }

  return changed;
}

patchMorningStockLinks();
const observer=new MutationObserver(()=>patchMorningStockLinks());
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(patchMorningStockLinks,300);
setTimeout(patchMorningStockLinks,900);
setTimeout(patchMorningStockLinks,1800);
