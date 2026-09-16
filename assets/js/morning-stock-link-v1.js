function patchMorningStockLink(){
  const card=document.querySelector('.vh5-action.watch');
  if(!card)return false;
  const title=card.querySelector('h3');
  const caption=card.querySelector('.vh5-watch-caption');
  const link=card.querySelector('.vh5-watch-link');
  if(title)title.textContent='◉ Cổ phiếu đáng chú ý';
  if(caption)caption.textContent='Một vài mã đang nổi bật theo dữ liệu dòng tiền hôm nay.';
  if(link){link.href='co-phieu-dang-chu-y.html';link.textContent='Xem toàn bộ →';}
  return true;
}

patchMorningStockLink();
const observer=new MutationObserver(()=>{
  if(patchMorningStockLink())observer.disconnect();
});
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(patchMorningStockLink,700);
setTimeout(patchMorningStockLink,1800);
