import {supabaseClient as db} from './supabase-client.js';
const root=document.getElementById('tradeRecommendations');
const $=s=>root?.querySelector(s);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const money=n=>Number(n).toLocaleString('vi-VN',{maximumFractionDigits:2});
const time=s=>s?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(s)):'—';
const tDays=s=>{const start=new Date(s);const end=new Date();const dateVN=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(x);let n=0;let d=new Date(dateVN(start)+'T00:00:00Z');const e=new Date(dateVN(end)+'T00:00:00Z').getTime();while(d.getTime()<e && n<10000){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)n++}return 'T'+n};
let records=[],prices={},priceSources={},priceDates={},isAdmin=false,authUser=null,priceAt=null,mode='ACTIVE',expandedSymbol=null;
function currentPrice(symbol){const p=Number(prices[symbol]);return Number.isFinite(p)&&p>0?p:null}
function priceLabel(symbol){return priceSources[symbol]==='EOD'?'Giá đóng cửa '+(priceDates[symbol]||'gần nhất'):'Giá realtime'}
function profit(entry,exit){return ((exit*(1-.0015-.001))/(entry*(1+.0015))-1)*100}
function reached(r,p){let n=Number(r.reached_tp)||0;if(r.status==='ACTIVE'&&p!==null&&priceSources[r.symbol]==='REALTIME'){if(p>=Number(r.tp3))n=Math.max(n,3);else if(p>=Number(r.tp2))n=Math.max(n,2);else if(p>=Number(r.tp1))n=Math.max(n,1)}return n}
function statusText(r,n,stop){if(r.status==='CLOSED_TP')return '<span class="trade-status done">Đã chốt lời</span>';if(r.status==='CLOSED_STOP')return '<span class="trade-status stopped">Đã cắt lỗ</span>';if(r.status==='CLOSED_OTHER')return '<span class="trade-status done">Đã đóng</span>';if(stop)return '<span class="trade-status stopped">Chạm ST · Chờ xác nhận</span>';return n?'<span class="trade-status achieved">Đã đạt TP'+n+'</span>':'<span class="trade-status watching">Đang theo dõi</span>'}
function rowHtml(r){
 const closed=r.status!=='ACTIVE',p=closed?Number(r.exit_price):currentPrice(r.symbol),net=p===null?null:profit(Number(r.entry_price),p),n=reached(r,p),stop=!closed&&p!==null&&priceSources[r.symbol]==='REALTIME'&&p<=Number(r.stop_price);
 const col=net===null?'unknown':Math.abs(net)<0.005?'flat':net>0?'gain':'loss';
 const tp=i=>'<td class="trade-target"><span class="trade-target-chip '+(n>=i?'hit':'')+'">'+money(r['tp'+i])+(n>=i?'<small>✓ Đạt</small>':'')+'</span></td>';
 const date=r.entry_time_known===false?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(r.entry_at)):time(r.entry_at);
 return '<tr class="trade-row '+(stop?'trade-stop-row':'')+'"><td class="trade-symbol"><strong class="trade-symbol-value '+col+'">'+safe(r.symbol)+'</strong><small>'+date+'</small></td><td><span class="trade-tbadge">'+tDays(r.entry_at)+'</span></td><td>'+money(r.entry_price)+'</td><td class="trade-price" title="'+safe(priceLabel(r.symbol))+'">'+(p===null?'—':money(p))+(closed?'':priceSources[r.symbol]==='EOD'?'<small style="display:block;font-size:10px;white-space:nowrap">Đóng cửa '+safe(priceDates[r.symbol]||'')+'</small>':'')+'</td>'+tp(1)+tp(2)+tp(3)+'<td class="'+(stop?'trade-stop-hit':'')+'">'+money(r.stop_price)+'</td><td class="trade-pl '+col+'">'+(net===null?'—':(net>0?'+':'')+money(net)+'%')+'</td><td>'+statusText(r,n,stop)+'</td>'+(isAdmin?'<td class="trade-actions"><button type="button" data-edit="'+r.id+'">Sửa</button> '+(!closed?'<button type="button" data-close="'+r.id+'">Đóng</button>':'')+' <button type="button" class="trade-delete" data-delete="'+r.id+'">Xóa</button></td>':'')+'</tr>'
}
function mobileRow(r){
 const closed=r.status!=='ACTIVE',p=closed?(r.exit_price==null?null:Number(r.exit_price)):currentPrice(r.symbol);
 const net=p===null?null:profit(Number(r.entry_price),p),n=reached(r,p),stop=!closed&&p!==null&&priceSources[r.symbol]==='REALTIME'&&p<=Number(r.stop_price);
 const col=net===null?'unknown':Math.abs(net)<0.005?'flat':net>0?'gain':'loss';
 const open=expandedSymbol===r.id,date=r.entry_time_known===false?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(r.entry_at)):time(r.entry_at);
 const field=(label,value,cls='')=>'<div class="trade-mobile-field"><small>'+label+'</small><strong class="'+cls+'">'+value+'</strong></div>';
 const target=i=>field('TP'+i,money(r['tp'+i])+(n>=i?' <small>✓ Đạt</small>':''),'trade-mobile-target '+(n>=i?'hit':''));
 return '<article class="trade-mobile-card'+(open?' is-open':'')+'"><button type="button" class="trade-mobile-summary" data-expand="'+r.id+'" aria-expanded="'+open+'"><span class="trade-mobile-symbol trade-symbol-value '+col+'">'+safe(r.symbol)+'</span><span class="trade-tbadge">'+tDays(r.entry_at)+'</span><span class="trade-mobile-pnl '+col+'">'+(net===null?'—':(net>0?'+':'')+money(net)+'%')+'</span><span class="trade-mobile-status">'+statusText(r,n,stop)+'</span><span class="trade-mobile-chevron" aria-hidden="true">'+(open?'⌃':'⌄')+'</span></button>'+
 (open?'<div class="trade-mobile-details"><div class="trade-mobile-date">Ngày khuyến nghị: '+date+'</div><div class="trade-mobile-grid">'+field('Giá mua',money(r.entry_price))+field(closed?'Giá thoát':priceSources[r.symbol]==='EOD'?'Giá đóng cửa '+safe(priceDates[r.symbol]||''):'Giá hiện tại',p===null?'—':money(p))+field('Lãi/lỗ sau phí',net===null?'—':(net>0?'+':'')+money(net)+'%',col)+target(1)+target(2)+target(3)+field('ST',money(r.stop_price),stop?'trade-mobile-stop':'')+'</div>'+(isAdmin?'<div class="trade-mobile-actions"><button type="button" data-edit="'+r.id+'">Sửa</button>'+(!closed?'<button type="button" data-close="'+r.id+'">Đóng</button>':'')+'<button type="button" class="trade-delete" data-delete="'+r.id+'">Xóa</button></div>':'')+'</div>':'')+'</article>';
}
function render(){
 if(!root)return;
 const shown=records.filter(r=>mode==='ACTIVE'?r.status==='ACTIVE':r.status!=='ACTIVE').sort((a,b)=>new Date(b.entry_at)-new Date(a.entry_at)||a.symbol.localeCompare(b.symbol));
 $('#tradeBody').innerHTML=shown.length?shown.map(rowHtml).join(''):'<tr><td colspan="11" class="empty">Chưa có khuyến nghị.</td></tr>';
 $('#tradeMobileList').innerHTML=shown.length?shown.map(mobileRow).join(''):'<div class="empty">Chưa có khuyến nghị.</div>';
 $('#tradePriceAt').textContent=priceAt?'Giá cập nhật: '+time(priceAt):'Chưa có dữ liệu giá';
 $('#tradeAdmin').hidden=!isAdmin;$('#tradeAdd').hidden=!isAdmin;
 root.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===mode))
}
async function refresh(){const [{data:rs,error},{data:live}]=await Promise.all([db.from('stock_trade_recommendations').select('*').order('entry_at',{ascending:false}).limit(300),db.rpc('stock_recs_prices')]);if(error){$('#tradeError').textContent='Không tải được khuyến nghị: '+error.message;return}records=rs||[];prices=live?.prices||{};priceSources=live?.sources||{};priceDates=live?.dates||{};priceAt=live?.captured_at;render()}
function alertError(e){$('#tradeError').textContent=e?.message||String(e)}
function showForm(r=null,from=null){if(!isAdmin)return;const f=$('#tradeForm');f.hidden=false;f.dataset.edit=r?.id||'';f.elements.symbol.value=r?.symbol||from?.symbol||'';f.elements.symbol.readOnly=false;f.elements.entry.value=r?.entry_price||from?.price||'';f.elements.entry.readOnly=false;f.elements.entryAt.value=r?new Date(r.entry_at).toLocaleString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,16):'';f.elements.entryAt.disabled=false;['tp1','tp2','tp3','stop'].forEach(k=>f.elements[k].value=r?(k==='stop'?r.stop_price:r[k]):'');if(!r)calculateTargets();f.scrollIntoView({behavior:'smooth',block:'center'})}
function calculateTargets(){const f=$('#tradeForm');if(f.dataset.edit)return;const v=Number(f.elements.entry.value);if(!(v>0))return;[['tp1',1.05],['tp2',1.10],['tp3',1.15],['stop',.93]].forEach(([k,m])=>f.elements[k].value=(Math.round(v*m*100)/100).toFixed(2))}
async function save(e){e.preventDefault();if(!isAdmin)return;const f=e.currentTarget,id=f.dataset.edit;const entry=Number(f.elements.entry.value);const fields={tp1:Number(f.elements.tp1.value),tp2:Number(f.elements.tp2.value),tp3:Number(f.elements.tp3.value),stop_price:Number(f.elements.stop.value)};if(!(fields.stop_price<entry&&entry<fields.tp1&&fields.tp1<fields.tp2&&fields.tp2<fields.tp3)){alertError('Kiểm tra thứ tự ST < Giá mua < TP1 < TP2 < TP3');return}let req;if(id){const original=records.find(r=>r.id===id);if(!original)return alertError('Không tìm thấy khuyến nghị cần sửa');const symbol=f.elements.symbol.value.trim().toUpperCase(),date=f.elements.entryAt.value;if(!/^[A-Z]{3}$/.test(symbol))return alertError('Mã cổ phiếu phải có 3 chữ cái');const parsedDate=date?new Date(date).toISOString():original.entry_at;const entryAt=Math.floor(new Date(parsedDate).getTime()/60000)===Math.floor(new Date(original.entry_at).getTime()/60000)?original.entry_at:parsedDate;const changed=symbol!==original.symbol||entry!==Number(original.entry_price)||Math.floor(new Date(entryAt).getTime()/60000)!==Math.floor(new Date(original.entry_at).getTime()/60000);if(changed&&!confirm('Thay đổi mã, giá mua hoặc ngày mua sẽ đặt lại lịch sử đã đạt TP của khuyến nghị này. Tiếp tục?'))return;req=db.from('stock_trade_recommendations').update({...fields,symbol,entry_price:entry,entry_at:entryAt,entry_time_known:!!date}).eq('id',id)}else{const date=f.elements.entryAt.value;req=db.from('stock_trade_recommendations').insert({...fields,symbol:f.elements.symbol.value.trim().toUpperCase(),entry_price:entry,entry_at:date?new Date(date).toISOString():new Date().toISOString(),entry_time_known:!!date})}const {error}=await req;if(error)return alertError(error);f.hidden=true;$('#tradeError').textContent='';await refresh()}
async function deleteTrade(id){
 const r=records.find(x=>x.id===id);if(!isAdmin||!r)return;
 if(!confirm('XÓA VĨNH VIỄN khuyến nghị '+r.symbol+' ngày '+time(r.entry_at)+'? Thao tác này không thể hoàn tác.'))return;
 const {error}=await db.from('stock_trade_recommendations').delete().eq('id',id);
 if(error)return alertError(error);
 $('#tradeError').textContent='Đã xóa '+r.symbol+' khỏi danh sách.';
 await refresh();
}
async function closeTrade(id){const r=records.find(x=>x.id===id);if(!r||!isAdmin||r.status!=='ACTIVE')return;const kind=prompt('Chọn kết quả: TP / ST / DONG',currentPrice(r.symbol)!==null&&currentPrice(r.symbol)<=Number(r.stop_price)?'ST':r.reached_tp?'TP':'DONG');if(!kind)return;const k=kind.trim().toUpperCase();if(!['TP','ST','DONG'].includes(k))return alertError('Chỉ chọn TP, ST hoặc DONG');const raw=prompt('Giá thoát thực tế',String(currentPrice(r.symbol)||r.entry_price));if(raw===null)return;const exit=Number(raw);if(!(exit>0))return alertError('Giá thoát không hợp lệ');if(!confirm('Xác nhận đóng '+r.symbol+' tại giá '+exit+'?'))return;const status=k==='TP'?'CLOSED_TP':k==='ST'?'CLOSED_STOP':'CLOSED_OTHER';const {error}=await db.from('stock_trade_recommendations').update({status,exit_price:exit,exited_at:new Date().toISOString()}).eq('id',id);if(error)return alertError(error);await refresh()}
root?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view){mode=b.dataset.view;expandedSymbol=null;render()}else if(b.dataset.expand){expandedSymbol=expandedSymbol===b.dataset.expand?null:b.dataset.expand;render()}else if(b.dataset.edit)showForm(records.find(r=>r.id===b.dataset.edit));else if(b.dataset.close)closeTrade(b.dataset.close);else if(b.dataset.delete)deleteTrade(b.dataset.delete);else if(b.id==='tradeAdd')showForm();else if(b.id==='tradeCancel')$('#tradeForm').hidden=true});
$('#tradeForm')?.addEventListener('submit',save);
$('#tradeForm')?.elements.entry.addEventListener('input',calculateTargets);
window.addEventListener('vh-stock-recommend',async e=>{
 if(!isAdmin)return;
 const symbol=String(e.detail?.symbol||'').trim().toUpperCase(),price=Number(e.detail?.price);
 if(!/^[A-Z]{3}$/.test(symbol)||!(price>0))return alertError('Mã hoặc giá không hợp lệ');
 if(records.some(r=>r.symbol===symbol&&r.status==='ACTIVE'))return alertError(symbol+' đã có trong danh sách đang theo dõi');
 const round=x=>Math.round(x*100)/100;
 const {error}=await db.from('stock_trade_recommendations').insert({symbol,entry_price:price,entry_at:new Date().toISOString(),entry_time_known:true,tp1:round(price*1.05),tp2:round(price*1.10),tp3:round(price*1.15),stop_price:round(price*.93)});
 if(error)return alertError(error);
 await refresh();
 document.querySelector('[data-main-tab="recommendations"]')?.click();
 $('#tradeError').textContent=symbol+' đã được thêm vào danh sách khuyến nghị với giá mua '+money(price);
});
async function init(){const {data:{user}}=await db.auth.getUser();authUser=user;isAdmin=!!user&&(await db.rpc('stock_recs_is_admin')).data===true;window.__vhTradeAdmin=isAdmin;window.vhRenderNotable?.();await refresh();setInterval(refresh,60000)}
init().catch(alertError);
