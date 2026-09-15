const API = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-live-public";
const commentsById = new Map();
let maxCommentId = 0;
let pollTimer = null;
let latestSnapshot = null;

const $ = (id) => document.getElementById(id);
const esc = (value = "") => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const num = (v) => { if(v===null||v===undefined||v==="")return null; const x=Number(v); return Number.isFinite(x)?x:null; };
const fmt = (v,d=2) => { const x=num(v); return x===null?"—":new Intl.NumberFormat("vi-VN",{minimumFractionDigits:d,maximumFractionDigits:d}).format(x); };
const signed = (v,d=2) => { const x=num(v); return x===null?"—":`${x>0?"+":""}${fmt(x,d)}`; };
const pct = (v) => { const x=num(v); return x===null?"—":`${signed(x,2)}%`; };
const toneClass = (v) => { const x=num(v); return x===null||Math.abs(x)<.0001?"flat":x>0?"up":"down"; };
const timeText = (iso) => { if(!iso)return"—"; try{return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(iso));}catch{return"—";} };
const isVietnamTradingNow = () => { const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()); const get=(t)=>parts.find(p=>p.type===t)?.value||""; if(["Sat","Sun"].includes(get("weekday")))return false; const m=Number(get("hour"))*60+Number(get("minute")); return(m>=525&&m<=691)||(m>=780&&m<=901); };

function setStatus(snapshot){const root=$("liveStatus");if(!root)return;if(!snapshot?.captured_at){root.classList.add("off");root.querySelector("span").textContent="Đang chờ dữ liệu";return;}const age=Math.max(0,(Date.now()-new Date(snapshot.captured_at).getTime())/1000),live=isVietnamTradingNow()&&age<=75;root.classList.toggle("off",!live);root.querySelector("span").textContent=live?`TRỰC TIẾP · ${timeText(snapshot.captured_at)}`:`Dữ liệu gần nhất · ${timeText(snapshot.captured_at)}`;}
function renderStrip(snapshot){const el=$("liveStrip");if(!el||!snapshot)return;const v=snapshot.vnindex||{},t=snapshot.technical||{},breadth=num(v.adv)!==null&&num(v.dec)!==null?`${Math.round(v.adv)} tăng / ${Math.round(v.dec)} giảm`:"—";el.innerHTML=`<div class="stat primary"><span>VN-Index</span><strong class="${toneClass(v.change)}">${fmt(v.value,2)} · ${signed(v.change,2)} (${pct(v.change_pct)})</strong></div><div class="stat"><span>Từ đáy phiên</span><strong class="${num(v.rebound_from_low)>0?"up":"flat"}">${num(v.rebound_from_low)!==null?`+${fmt(v.rebound_from_low,1)} điểm`:"—"}</strong></div><div class="stat"><span>Độ rộng</span><strong>${breadth}</strong></div><div class="stat"><span>MA10</span><strong>${fmt(t.ma10,1)}</strong></div><div class="stat"><span>Cản gần</span><strong>${fmt(t.resistance_near,1)}</strong></div>`;}

function currentPulse(snapshot){
  if(!snapshot)return null;
  const v=snapshot.vnindex||{},w=snapshot.world||{},ball=w.ball||{},match=w.match||{},breadth=match.breadth||{},driver=w.driver||{},strong=w?.lines?.strongest||[],weak=w?.lines?.weakest||[];
  const d5=num(ball.delta_5m),d15=num(ball.delta_15m),adv=num(v.adv),dec=num(v.dec),balance=num(breadth.balance),change=num(v.change);
  let headline="Thế trận đang được cập nhật";
  if(d5!==null&&d5>=2)headline="VN-Index đang tăng nhịp trong vài phút gần đây";
  else if(d5!==null&&d5<=-2)headline="VN-Index đang chậm lại trong vài phút gần đây";
  else if(driver?.sector?.name&&driver?.confidence&&driver.confidence!=="THẤP")headline=`${driver.sector.name} đang là nhóm nổi bật trong nhịp hiện tại`;
  else if(balance!==null&&balance>=.18)headline="Độ rộng đang nghiêng rõ về phía tăng";
  else if(balance!==null&&balance<=-.18)headline="Mặt bằng cổ phiếu đang chịu áp lực rõ hơn";
  else if(change!==null&&Math.abs(change)>=.01)headline=change>0?"VN-Index vẫn giữ sắc xanh, cần nhìn độ lan tỏa":"VN-Index vẫn ở dưới tham chiếu, cần nhìn lực đỡ";

  const bits=[];
  bits.push(`VN-Index hiện ở ${fmt(v.value,2)} điểm, ${signed(v.change,2)} điểm (${pct(v.change_pct)}).`);
  if(d5!==null&&Math.abs(d5)>=.1)bits.push(`Trong khoảng 5 phút gần đây, chỉ số ${d5>0?"tăng":"giảm"} ${fmt(Math.abs(d5),1)} điểm${d15!==null?`; 15 phút là ${signed(d15,1)} điểm`:""}.`);
  else if(d15!==null&&Math.abs(d15)>=.1)bits.push(`Trong khoảng 15 phút gần đây, VN-Index thay đổi ${signed(d15,1)} điểm.`);
  if(adv!==null&&dec!==null){if(adv>dec*1.25)bits.push(`Độ rộng đang ủng hộ bên tăng với ${Math.round(adv)} mã tăng so với ${Math.round(dec)} mã giảm.`);else if(dec>adv*1.25)bits.push(`Độ rộng còn yếu với ${Math.round(dec)} mã giảm so với ${Math.round(adv)} mã tăng.`);else bits.push(`Độ rộng khá cân bằng: ${Math.round(adv)} mã tăng và ${Math.round(dec)} mã giảm.`);}
  if(driver?.sector?.name){const players=Array.isArray(driver.players)?driver.players.map(x=>x?.symbol).filter(Boolean).slice(0,3):[];bits.push(`Nhịp hiện tại đang đi cùng ${driver.sector.name}${num(driver.sector.change_pct)!==null?` (${signed(driver.sector.change_pct,2)}%)`:""}${players.length?`, nổi bật ${players.join(", ")}`:""}.`);}
  else if(strong.length){bits.push(`Các nhóm nổi bật lúc này: ${strong.slice(0,2).map(x=>`${x.name} ${signed(x.change_pct,2)}%`).join(" · ")}.`);}
  if(weak.length&&num(weak[0]?.change_pct)!==null&&Number(weak[0].change_pct)<-.25)bits.push(`Ở chiều ngược lại, ${weak[0].name} đang là nhóm gây áp lực đáng chú ý.`);

  let watch="Theo dõi xem độ rộng và nhóm đang dẫn có giữ được nhịp trong vài phút tiếp theo hay không.";
  const above=w?.zones?.nearest_above,below=w?.zones?.nearest_below;
  if(above&&num(above.value)!==null&&num(above.distance_pct)!==null&&Number(above.distance_pct)<=.6)watch=`Phía trước gần nhất là ${above.label} quanh ${fmt(above.value,1)} điểm. Nếu chỉ số tiến qua vùng này cùng độ rộng mở rộng, nhịp tăng sẽ thuyết phục hơn.`;
  else if(below&&num(below.value)!==null&&num(below.distance_pct)!==null&&Number(below.distance_pct)<=.6)watch=`Vùng đỡ gần nhất nằm quanh ${below.label} ${fmt(below.value,1)} điểm. Nếu mất vùng này cùng lúc số mã giảm tăng nhanh, rủi ro ngắn hạn sẽ cao hơn.`;
  else if(d15!==null&&d15>0)watch="Theo dõi xem đà cải thiện có lan sang thêm nhóm ngành và số mã tăng có tiếp tục mở rộng hay không.";
  else if(d15!==null&&d15<0)watch="Theo dõi xem lực bán có mở rộng sang thêm nhóm hay chỉ tập trung ở một vài khu vực.";

  return{headline,body:bits.join(" "),watch};
}

function evidenceHtml(comment){
  const e=comment?.evidence||{},w=e.world_model||{},v=w.ball||e.vnindex||{},d=w.driver||{},out=e.outside_context||{};const driver=d?.sector?.name||"",players=Array.isArray(d?.players)?d.players.map(x=>x?.symbol).filter(Boolean).slice(0,3).join(", "):"";const der=out?.derivatives?.trend==="TANG"?"Nghiêng tăng":out?.derivatives?.trend==="GIAM"?"Nghiêng giảm":"";
  return `<details class="evidence"><summary>+ Xem căn cứ</summary><div class="evidence-grid">
    <div class="evi"><span>VN-Index</span><b>${fmt(v.value,2)}</b></div>
    <div class="evi"><span>15 phút</span><b class="${toneClass(v.delta_15m)}">${num(v.delta_15m)!==null?`${signed(v.delta_15m,1)} điểm`:"—"}</b></div>
    <div class="evi"><span>Từ đáy</span><b>${num(v.rebound_from_low??v.rebound)!==null?`+${fmt(v.rebound_from_low??v.rebound,1)} điểm`:"—"}</b></div>
    <div class="evi"><span>Độ rộng</span><b>${num(w?.match?.breadth?.adv)!==null&&num(w?.match?.breadth?.dec)!==null?`${Math.round(w.match.breadth.adv)} tăng / ${Math.round(w.match.breadth.dec)} giảm`:"—"}</b></div>
    ${driver?`<div class="evi"><span>Nhóm nổi bật</span><b>${esc(driver)} · ${esc(d.confidence||"")}</b></div>`:""}
    ${players?`<div class="evi"><span>Mã nổi bật</span><b>${esc(players)}</b></div>`:""}
    ${w?.zones?.nearest_below?`<div class="evi"><span>Vùng dưới gần</span><b>${esc(w.zones.nearest_below.label)} ${fmt(w.zones.nearest_below.value,1)}</b></div>`:""}
    ${w?.zones?.nearest_above?`<div class="evi"><span>Vùng trên gần</span><b>${esc(w.zones.nearest_above.label)} ${fmt(w.zones.nearest_above.value,1)}</b></div>`:""}
    ${der?`<div class="evi"><span>Phái sinh</span><b>${esc(der)}</b></div>`:""}
  </div></details>`;
}
function renderLatest(){
  const panel=$("latestPanel");if(!panel)return;
  const comments=[...commentsById.values()].sort((a,b)=>new Date(b.published_at)-new Date(a.published_at)),c=comments[0],pulse=currentPulse(latestSnapshot),head=`<div class="panel-head"><h2>Bình luận trực tiếp lúc này</h2><span id="latestRefresh">Cập nhật ~10 giây</span></div>`;
  if(!pulse){panel.innerHTML=head+`<div class="empty">Đang chờ snapshot trực tiếp...</div>`;return;}
  const lastEvent=c?`<div class="watch-next"><b>Sự kiện gần nhất · ${timeText(c.published_at)}:</b> ${esc(c.headline)}${c.watch_next?` — ${esc(c.watch_next)}`:""}</div>`:"";
  panel.innerHTML=head+`<article class="latest"><div class="latest-time">${timeText(latestSnapshot?.captured_at)} · ĐANG THEO DÕI</div><h2>${esc(pulse.headline)}</h2><p class="latest-body">${esc(pulse.body)}</p><div class="watch-next"><b>Điểm cần nhìn tiếp:</b> ${esc(pulse.watch)}</div>${lastEvent}${c?evidenceHtml(c):""}</article>`;
}
function renderTimeline(){const list=$("timelineList");if(!list)return;const comments=[...commentsById.values()].sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));if(!comments.length){list.innerHTML=`<div class="empty">Các mốc thay đổi đáng chú ý sẽ được ghi vào đây.</div>`;return;}list.innerHTML=comments.slice(0,20).map(c=>`<article class="timeline-item ${esc(c.tone||"neutral")}"><div class="timeline-time">${timeText(c.published_at)}</div><h3>${esc(c.headline)}</h3><p>${esc(c.body)}</p></article>`).join("");}

function renderMarketNow(snapshot){
  const root=$("marketNow");if(!root||!snapshot)return;const v=snapshot.vnindex||{},t=snapshot.technical||{},state=snapshot.state||{},flow=snapshot.flow||{},w=snapshot.world||{},ball=w.ball||{},driver=w.driver||{},below=w?.zones?.nearest_below,above=w?.zones?.nearest_above;
  root.innerHTML=`
    ${w?.match?.label?`<div class="section-mini"><h3>Câu chuyện lúc này</h3><div style="color:rgba(245,247,251,.88);font-size:11.5px;line-height:1.65">${esc(w.match.label)}</div><div class="side-grid" style="margin-top:9px"><div class="side-cell"><span>5 phút</span><b class="${toneClass(ball.delta_5m)}">${num(ball.delta_5m)!==null?`${signed(ball.delta_5m,1)} điểm`:"—"}</b></div><div class="side-cell"><span>15 phút</span><b class="${toneClass(ball.delta_15m)}">${num(ball.delta_15m)!==null?`${signed(ball.delta_15m,1)} điểm`:"—"}</b></div><div class="side-cell"><span>Nhóm đang nổi</span><b>${esc(driver?.sector?.name||"Chưa rõ")}</b></div><div class="side-cell"><span>Độ tin cậy</span><b>${esc(driver?.confidence||"—")}</b></div></div></div>`:""}
    <div class="section-mini"><h3>Trạng thái hiện tại</h3><div class="side-grid"><div class="side-cell"><span>Trạng thái</span><b>${esc(state.label||"Đang theo dõi")}</b></div><div class="side-cell"><span>Điểm trạng thái</span><b>${num(state.score)!==null?`${Math.round(state.score)}/100`:"—"}</b></div><div class="side-cell"><span>Đỉnh phiên</span><b>${fmt(v.high,2)}</b></div><div class="side-cell"><span>Đáy phiên</span><b>${fmt(v.low,2)}</b></div><div class="side-cell"><span>Thanh khoản</span><b>${num(v.value_b)!==null?`${fmt(v.value_b,1)} tỷ`:"—"}</b></div><div class="side-cell"><span>Nhịp tiền</span><b>${esc(flow.label||"—")}</b></div></div></div>
    <div class="section-mini"><h3>Khu vực cần chú ý</h3><div class="side-grid"><div class="side-cell"><span>Phía dưới gần</span><b>${below?`${esc(below.label)} ${fmt(below.value,1)}`:"—"}</b></div><div class="side-cell"><span>Phía trên gần</span><b>${above?`${esc(above.label)} ${fmt(above.value,1)}`:"—"}</b></div><div class="side-cell"><span>MA10 / MA20</span><b>${fmt(t.ma10,1)} / ${fmt(t.ma20,1)}</b></div><div class="side-cell"><span>VWAP</span><b>${fmt(t.vwap,1)}</b></div><div class="side-cell"><span>RSI14</span><b>${fmt(t.rsi14,1)}</b></div><div class="side-cell"><span>MA50</span><b>${fmt(t.ma50,1)}</b></div></div>${snapshot.technical_available?"":`<div style="margin-top:9px;color:var(--muted2);font-size:9px;line-height:1.5">AFL kỹ thuật chưa gửi snapshot mới; các ô kỹ thuật có thể tạm để trống.</div>`}</div>`;
}
function stockPct(row){return num(row?.change_pct??row?.changePct??row?.pct);}
function renderLeaders(snapshot){
  const root=$("marketLeaders");if(!root||!snapshot)return;const world=snapshot.world||{},strong=world?.lines?.strongest?.length?world.lines.strongest:(snapshot?.sectors?.strongest||[]),weak=world?.lines?.weakest?.length?world.lines.weakest:(snapshot?.sectors?.weakest||[]),gain=snapshot?.vn30?.gainers||[],lose=snapshot?.vn30?.losers||[];
  const rows=(items,type="sector")=>items.length?items.map(x=>{const name=type==="stock"?(x.symbol||x.code||"—"):(x.name||x.symbol||"—"),p=type==="stock"?stockPct(x):num(x.change_pct),role=type==="sector"&&x.role?` · ${x.role}`:"";return`<div class="mini-row"><span>${esc(name)}${esc(role)}</span><b class="${toneClass(p)}">${pct(p)}</b></div>`;}).join(""):`<div class="mini-row"><span>Chưa đủ dữ liệu</span><b>—</b></div>`;
  root.innerHTML=`<div class="section-mini"><h3>Nhóm đang hỗ trợ</h3><div class="row-list">${rows(strong)}</div></div><div class="section-mini"><h3>Nhóm đang gây áp lực</h3><div class="row-list">${rows(weak)}</div></div>${world?.driver?.players?.length?`<div class="section-mini"><h3>Mã nổi bật trong nhóm đang chi phối</h3><div class="row-list">${rows(world.driver.players,"stock")}</div></div>`:""}<div class="section-mini"><h3>VN30 tăng nổi bật</h3><div class="row-list">${rows(gain,"stock")}</div></div><div class="section-mini"><h3>VN30 giảm nổi bật</h3><div class="row-list">${rows(lose,"stock")}</div></div>`;
}
function renderSnapshot(snapshot){setStatus(snapshot);latestSnapshot=snapshot||null;if(!snapshot){renderLatest();return;}renderStrip(snapshot);renderMarketNow(snapshot);renderLeaders(snapshot);renderLatest();const st=$("snapshotTime");if(st)st.textContent=timeText(snapshot.captured_at);}
function mergeComments(items=[]){for(const c of items){const id=Number(c?.id);if(!Number.isFinite(id))continue;commentsById.set(id,c);maxCommentId=Math.max(maxCommentId,id);}renderLatest();renderTimeline();}
async function load(initial=false){try{const url=initial||!maxCommentId?`${API}?limit=20&_=${Date.now()}`:`${API}?after_id=${maxCommentId}&limit=10&_=${Date.now()}`;const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();if(!data?.ok)throw new Error(data?.error||"NO_DATA");renderSnapshot(data.latest);mergeComments(Array.isArray(data.comments)?data.comments:[]);if(!data.latest){const now=$("marketNow");if(now)now.innerHTML=`<div class="empty">Chưa có dữ liệu live hôm nay. Hệ thống bắt đầu ghi khi AmiBridge chạy trong giờ giao dịch.</div>`;const leaders=$("marketLeaders");if(leaders)leaders.innerHTML=`<div class="empty">Chưa có dữ liệu nhóm/VN30 hôm nay.</div>`;}}catch(error){console.warn("Market live load failed",error);const status=$("liveStatus");if(status){status.classList.add("off");status.querySelector("span").textContent="Chưa kết nối được dữ liệu";}}}
function start(){load(true);pollTimer=window.setInterval(()=>{if(document.visibilityState==="visible")load(false);},10000);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")load(false);});}
start();
