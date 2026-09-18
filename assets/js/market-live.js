import { supabaseClient } from './supabase-client.js';

const API = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-live-public";
const commentsById = new Map();
let maxCommentId = 0;
let pollTimer = null;
let latestSnapshot = null;
let previousSnapshot = null;
let derivativeState = null;
let previousDerivative = null;
let isAdmin = false;
let pollCount = 0;

const $ = (id) => document.getElementById(id);
const esc = (value = "") => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
const num = (v) => { if(v===null||v===undefined||v==="")return null; const x=Number(v); return Number.isFinite(x)?x:null; };
const fmt = (v,d=2) => { const x=num(v); return x===null?"—":new Intl.NumberFormat("vi-VN",{minimumFractionDigits:d,maximumFractionDigits:d}).format(x); };
const signed = (v,d=2) => { const x=num(v); return x===null?"—":`${x>0?"+":""}${fmt(x,d)}`; };
const pct = (v) => { const x=num(v); return x===null?"—":`${signed(x,2)}%`; };
const toneClass = (v) => { const x=num(v); return x===null||Math.abs(x)<.0001?"flat":x>0?"up":"down"; };
const timeText = (iso) => { if(!iso)return"—"; try{return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(iso));}catch{return"—";} };
const isVietnamTradingNow = () => { const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()); const get=(t)=>parts.find(p=>p.type===t)?.value||""; if(["Sat","Sun"].includes(get("weekday")))return false; const m=Number(get("hour"))*60+Number(get("minute")); return(m>=525&&m<=691)||(m>=780&&m<=901); };
const sameName = (a,b) => String(a||"").trim().toLowerCase()===String(b||"").trim().toLowerCase();

function setStatus(snapshot){
  const root=$("liveStatus");if(!root)return;
  if(!snapshot?.captured_at){root.classList.add("off");root.querySelector("span").textContent="Đang chờ dữ liệu";return;}
  const age=Math.max(0,(Date.now()-new Date(snapshot.captured_at).getTime())/1000),live=isVietnamTradingNow()&&age<=75;
  root.classList.toggle("off",!live);
  root.querySelector("span").textContent=live?`TRỰC TIẾP · ${timeText(snapshot.captured_at)}`:`Dữ liệu gần nhất · ${timeText(snapshot.captured_at)}`;
}

function renderStrip(snapshot){
  const el=$("liveStrip");if(!el||!snapshot)return;
  const v=snapshot.vnindex||{},flow=snapshot.flow||{},w=snapshot.world||{},ball=w.ball||{};
  const breadth=num(v.adv)!==null&&num(v.dec)!==null?`${Math.round(v.adv)} tăng / ${Math.round(v.dec)} giảm`:null;
  const d15=num(ball.delta_15m);
  const leader=strongest(snapshot);
  const cards=[
    `<div class="stat primary"><span>VN-Index</span><strong class="${toneClass(v.change)}">${fmt(v.value,2)} · ${signed(v.change,2)} (${pct(v.change_pct)})</strong></div>`,
    d15!==null?`<div class="stat"><span>Nhịp 15 phút</span><strong class="${toneClass(d15)}">${signed(d15,1)} điểm</strong></div>`:"",
    breadth?`<div class="stat"><span>Độ rộng</span><strong>${breadth}</strong></div>`:"",
    leader?`<div class="stat"><span>Nhóm dẫn</span><strong>${esc(leader.name)} · ${pct(leader.change_pct)}</strong></div>`:"",
    num(v.value_b)!==null?`<div class="stat"><span>Thanh khoản</span><strong>${fmt(v.value_b,1)} tỷ</strong></div>`:flow.label?`<div class="stat"><span>Nhịp tiền</span><strong>${esc(flow.label)}</strong></div>`:""
  ].filter(Boolean);
  el.innerHTML=cards.join("");
}

function sectorRows(snapshot){return Array.isArray(snapshot?.sectors?.all)?snapshot.sectors.all:[];}
function strongest(snapshot){return snapshot?.sectors?.strongest?.[0]||sectorRows(snapshot)[0]||null;}
function weakest(snapshot){return snapshot?.sectors?.weakest?.[0]||[...sectorRows(snapshot)].reverse()[0]||null;}
function stockExtremes(snapshot){
  let best=null,worst=null;
  for(const s of sectorRows(snapshot)){
    for(const x of (s?.top_gainers||[])){const p=num(x?.change_pct);if(p!==null&&(!best||p>best.pct))best={...x,pct:p,sector:s};}
    for(const x of (s?.top_losers||[])){const p=num(x?.change_pct);if(p!==null&&(!worst||p<worst.pct))worst={...x,pct:p,sector:s};}
  }
  return{best,worst};
}
function sectorInternalLine(sector){
  if(!sector)return"";
  const g=(sector.top_gainers||[])[0],l=(sector.top_losers||[])[0],gp=num(g?.change_pct),lp=num(l?.change_pct);
  if(g?.symbol&&l?.symbol&&gp!==null&&lp!==null&&(gp-lp>=4||gp>=4.5||lp<=-3.5))return`Trong ${sector.name}, ${g.symbol} đang mạnh nhất ${signed(gp,2)}%, còn ${l.symbol} ở phía yếu nhất ${signed(lp,2)}%.`;
  if(g?.symbol&&gp!==null&&gp>=5)return`${g.symbol} đang là mã nổi bật nhất trong ${sector.name} với ${signed(gp,2)}%.`;
  if(l?.symbol&&lp!==null&&lp<=-5)return`${l.symbol} đang là điểm yếu đáng chú ý trong ${sector.name} với ${signed(lp,2)}%.`;
  return"";
}

function currentPulse(snapshot){
  if(!snapshot)return null;
  const v=snapshot.vnindex||{},w=snapshot.world||{},ball=w.ball||{},leader=strongest(snapshot),laggard=weakest(snapshot),prevLeader=strongest(previousSnapshot);
  const adv=num(v.adv),dec=num(v.dec),prevAdv=num(previousSnapshot?.vnindex?.adv),prevDec=num(previousSnapshot?.vnindex?.dec);
  const tick=num(v.value)!==null&&num(previousSnapshot?.vnindex?.value)!==null?num(v.value)-num(previousSnapshot.vnindex.value):null;
  const advDelta=adv!==null&&prevAdv!==null?adv-prevAdv:null,decDelta=dec!==null&&prevDec!==null?dec-prevDec:null;
  const d5=num(ball.delta_5m),d15=num(ball.delta_15m),leaderChanged=leader&&prevLeader&&!sameName(leader.name,prevLeader.name);
  const phase=Math.floor(new Date(snapshot.captured_at||Date.now()).getTime()/20000)%5;
  const extremes=stockExtremes(snapshot);
  const derChanged=derivativeState?.direction&&previousDerivative?.direction&&derivativeState.direction!==previousDerivative.direction;
  const derNow=num(derivativeState?.last_price),derPrev=num(previousDerivative?.last_price);
  const derTick=derNow!==null&&derPrev!==null?derNow-derPrev:null;

  let headline="Thị trường đang giữ nhịp, nhưng bên trong vẫn có phân hóa";
  if(leaderChanged)headline=`${leader.name} vừa vượt lên dẫn đầu nhóm ngành`;
  else if(tick!==null&&tick>=.30)headline=`VN-Index vừa nhích thêm ${fmt(tick,2)} điểm`;
  else if(tick!==null&&tick<=-.30)headline=`VN-Index vừa lùi ${fmt(Math.abs(tick),2)} điểm`;
  else if(advDelta!==null&&advDelta>=7)headline="Độ rộng vừa mở thêm về phía tăng";
  else if(decDelta!==null&&decDelta>=7)headline="Số mã giảm đang tăng lên, cần nhìn lại độ lan tỏa";
  else if(derChanged)headline=`Phái sinh vừa chuyển sang trạng thái ${derivativeState.label.toLowerCase()}`;
  else if(phase===3&&derTick!==null&&Math.abs(derTick)<.20)headline=`Phái sinh gần như đi ngang quanh ${fmt(derNow,1)}`;
  else if(phase===3&&derTick!==null&&derTick>=.50)headline=`Phái sinh vừa nhích thêm ${fmt(derTick,1)} điểm`;
  else if(phase===3&&derTick!==null&&derTick<=-.50)headline=`Phái sinh vừa lùi ${fmt(Math.abs(derTick),1)} điểm`;
  else if((extremes.worst?.pct??0)<=-5.5)headline=`${extremes.worst.symbol} đang là biến động bất thường cần chú ý`;
  else if(phase===1&&leader&&laggard)headline=`${leader.name} mạnh nhất, ${laggard.name} đang ở phía yếu nhất`;
  else if(phase===2&&leader)headline=`Bên trong ${leader.name} đang xuất hiện phân hóa rõ hơn`;
  else if(phase===3&&derivativeState)headline=`Cơ sở đang vận động trong khi phái sinh ${derivativeState.label.toLowerCase()}`;
  else if(d5!==null&&Math.abs(d5)>=1)headline=d5>0?"VN-Index đang cải thiện trong 5 phút gần đây":"VN-Index đang chậm lại trong 5 phút gần đây";

  const bits=[];
  const indexOpeners=[
    `VN-Index hiện ở ${fmt(v.value,2)} điểm, ${signed(v.change,2)} điểm (${pct(v.change_pct)}).`,
    `Mặt điểm số lúc này: VN-Index ${fmt(v.value,2)}, thay đổi ${signed(v.change,2)} điểm (${pct(v.change_pct)}).`,
    `Chỉ số đang đứng tại ${fmt(v.value,2)} điểm, tương ứng ${signed(v.change,2)} điểm (${pct(v.change_pct)}).`
  ];
  bits.push(indexOpeners[phase%indexOpeners.length]);

  if(tick!==null&&Math.abs(tick)>=.05)bits.push(`So với lần cập nhật trước, chỉ số ${tick>0?"nhích thêm":"lùi"} ${fmt(Math.abs(tick),2)} điểm.`);
  else if(d5!==null&&Math.abs(d5)>=.1)bits.push(`Trong khoảng 5 phút, VN-Index thay đổi ${signed(d5,1)} điểm${d15!==null?`; 15 phút là ${signed(d15,1)} điểm`:""}.`);

  if(adv!==null&&dec!==null){
    let breadth=`Độ rộng hiện có ${Math.round(adv)} mã tăng và ${Math.round(dec)} mã giảm`;
    if(advDelta!==null&&Math.abs(advDelta)>=3)breadth+=`, số mã tăng ${advDelta>0?"tăng thêm":"giảm"} ${Math.abs(Math.round(advDelta))} mã so với lần trước`;
    if(decDelta!==null&&Math.abs(decDelta)>=3)breadth+=`, số mã giảm ${decDelta>0?"tăng thêm":"giảm"} ${Math.abs(Math.round(decDelta))} mã`;
    bits.push(breadth+".");
  }

  if(leader&&laggard){
    const next=snapshot?.sectors?.strongest?.[1];
    let s=`Nhóm mạnh nhất lúc này là ${leader.name} ${signed(leader.change_pct,2)}%`;
    if(next)s+=`, kế đến ${next.name} ${signed(next.change_pct,2)}%`;
    if(!sameName(leader.name,laggard.name))s+=`; phía yếu nhất là ${laggard.name} ${signed(laggard.change_pct,2)}%`;
    bits.push(s+".");
    const internal=sectorInternalLine(leader);if(internal)bits.push(internal);
  }

  if(derivativeState?.fresh){
    let derLine=`Phái sinh hiện ${derivativeState.label.toLowerCase()}`;
    if(derNow!==null){
      if(derTick!==null&&Math.abs(derTick)<.20)derLine+=`, gần như đi ngang quanh ${fmt(derNow,1)} trong nhịp cập nhật này`;
      else if(derTick!==null&&derTick>0)derLine+=`, vừa nhích thêm ${fmt(derTick,1)} điểm lên ${fmt(derNow,1)}`;
      else if(derTick!==null&&derTick<0)derLine+=`, vừa lùi ${fmt(Math.abs(derTick),1)} điểm về ${fmt(derNow,1)}`;
      else derLine+=`, giá gần nhất ${fmt(derNow,1)}`;
    }
    bits.push(`${derLine}; đây là lớp tham chiếu thêm, không dùng để quy kết nguyên nhân cho cơ sở.`);
  }

  let watch="Nhìn tiếp sự thay đổi của độ rộng, nhóm dẫn và nhóm yếu; nếu cả ba cùng cải thiện thì nhịp tăng sẽ có chất lượng hơn.";
  const above=w?.zones?.nearest_above,below=w?.zones?.nearest_below;
  if(above&&num(above.value)!==null&&num(above.distance_pct)!==null&&Number(above.distance_pct)<=.6)watch=`Phía trước gần nhất là ${above.label} quanh ${fmt(above.value,1)} điểm. Cần nhìn đồng thời độ rộng và phản ứng của nhóm dẫn khi VN-Index tiến vào vùng này.`;
  else if(below&&num(below.value)!==null&&num(below.distance_pct)!==null&&Number(below.distance_pct)<=.6)watch=`Vùng đỡ gần nhất quanh ${below.label} ${fmt(below.value,1)} điểm. Nếu chỉ số mất vùng này và số mã giảm mở rộng, rủi ro ngắn hạn sẽ tăng.`;
  else if(leaderChanged)watch=`Theo dõi xem ${leader.name} có giữ được vị trí dẫn đầu thêm vài nhịp hay chỉ là luân chuyển ngắn; đồng thời nhìn ${prevLeader.name} có suy yếu tiếp hay không.`;
  else if(derivativeState?.direction==="GIAM"&&num(v.change)>0)watch="Cơ sở đang xanh nhưng phái sinh nghiêng giảm; cần theo dõi xem sự lệch pha này thu hẹp hay mở rộng trong các nhịp tiếp theo.";
  else if(derivativeState?.direction==="TANG"&&num(v.change)<0)watch="Cơ sở còn đỏ nhưng phái sinh nghiêng tăng; cần theo dõi liệu độ rộng có cải thiện để xác nhận nhịp hồi hay không.";
  else if(d15!==null&&d15>0)watch="Theo dõi xem đà cải thiện có lan sang thêm nhóm ngành thay vì chỉ tập trung ở một nhóm đang mạnh.";
  else if(d15!==null&&d15<0)watch="Theo dõi xem lực bán có lan rộng hay chỉ tập trung cục bộ; nhóm yếu nhất sẽ là nơi cần nhìn trước.";

  return{headline,body:bits.join(" "),watch};
}

function evidenceHtml(comment){
  const e=comment?.evidence||{},w=e.world_model||{},v=w.ball||e.vnindex||{},d=w.driver||{},out=e.outside_context||{};
  const driver=d?.sector?.name||"",players=Array.isArray(d?.players)?d.players.map(x=>x?.symbol).filter(Boolean).slice(0,3).join(", "):"";
  const der=out?.derivatives?.trend==="TANG"?"Nghiêng tăng":out?.derivatives?.trend==="GIAM"?"Nghiêng giảm":"";
  const hasEvidence=num(v.value)!==null||driver||players||w?.zones?.nearest_below||w?.zones?.nearest_above||der;
  if(!hasEvidence)return"";
  return `<details class="evidence"><summary>+ Xem căn cứ</summary><div class="evidence-grid">
    <div class="evi"><span>VN-Index</span><b>${fmt(v.value,2)}</b></div>
    <div class="evi"><span>15 phút</span><b class="${toneClass(v.delta_15m)}">${num(v.delta_15m)!==null?`${signed(v.delta_15m,1)} điểm`:"—"}</b></div>
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
  const comments=[...commentsById.values()].sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
  const c=comments[0]||null;
  const pulse=currentPulse(latestSnapshot);
  const head=`<div class="panel-head"><h2>Bình luận mới nhất</h2><span id="latestRefresh">Cập nhật ~10 giây</span></div>`;

  if(c&&c.event_id==null){
    panel.innerHTML=head+`<article class="latest ${esc(c.tone||"neutral")}"><div class="latest-time">${timeText(c.published_at)} · ĐANG THEO DÕI</div><h2>${esc(c.headline)}</h2><p class="latest-body">${esc(c.body)}</p>${c.watch_next?`<div class="watch-next"><b>Điểm cần nhìn tiếp:</b> ${esc(c.watch_next)}</div>`:""}${evidenceHtml(c)}</article>`;
    return;
  }

  if(!pulse){
    if(c){panel.innerHTML=head+`<article class="latest ${esc(c.tone||"neutral")}"><div class="latest-time">${timeText(c.published_at)} · ĐANG THEO DÕI</div><h2>${esc(c.headline)}</h2><p class="latest-body">${esc(c.body)}</p>${c.watch_next?`<div class="watch-next"><b>Điểm cần nhìn tiếp:</b> ${esc(c.watch_next)}</div>`:""}${evidenceHtml(c)}</article>`;}
    else panel.innerHTML=head+`<div class="empty">Đang chờ dữ liệu trực tiếp...</div>`;
    return;
  }

  const lastEvent=c?`<div class="last-event"><b>Mốc lịch sử gần nhất · ${timeText(c.published_at)}:</b> ${esc(c.headline)}</div>`:"";
  panel.innerHTML=head+`<article class="latest"><div class="latest-time">${timeText(latestSnapshot?.captured_at)} · ĐANG THEO DÕI</div><h2>${esc(pulse.headline)}</h2><p class="latest-body">${esc(pulse.body)}</p><div class="watch-next"><b>Điểm cần nhìn tiếp:</b> ${esc(pulse.watch)}</div>${lastEvent}${c?evidenceHtml(c):""}</article>`;
}

function dedupeTimeline(comments){
  const out=[];
  for(const c of comments){
    const key=String(c.headline||"").toLowerCase().replace(/\s+/g," ").trim();
    const duplicate=out.some(x=>String(x.headline||"").toLowerCase().replace(/\s+/g," ").trim()===key&&Math.abs(new Date(x.published_at)-new Date(c.published_at))<20*60000);
    if(!duplicate)out.push(c);
  }
  return out;
}
function adminActions(c){
  if(!isAdmin)return"";
  return `<div class="admin-comment-actions"><button type="button" data-edit-comment="${Number(c.id)}">Sửa bình luận</button>${c.is_final?`<span class="final-badge">ĐÃ CHỐT</span>`:""}${c.admin_edited_at?`<span class="edited-badge">ĐÃ SỬA</span>`:""}</div>`;
}
function renderTimeline(){
  const list=$("timelineList");if(!list)return;
  const raw=[...commentsById.values()].sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
  const comments=isAdmin?raw:dedupeTimeline(raw);
  if(!comments.length){list.innerHTML=`<div class="empty">Các mốc thay đổi đáng chú ý sẽ được ghi vào đây.</div>`;return;}
  list.innerHTML=comments.slice(0,30).map(c=>`<article class="timeline-item ${esc(c.tone||"neutral")}"><div class="timeline-time">${timeText(c.published_at)}</div><h3>${esc(c.headline)}</h3><p>${esc(c.body)}</p>${c.watch_next?`<div class="timeline-watch"><b>Nhìn tiếp:</b> ${esc(c.watch_next)}</div>`:""}${adminActions(c)}</article>`).join("");
}

function renderMarketNow(snapshot){
  const root=$("marketNow");if(!root||!snapshot)return;
  const v=snapshot.vnindex||{},t=snapshot.technical||{},state=snapshot.state||{},flow=snapshot.flow||{},w=snapshot.world||{},below=w?.zones?.nearest_below,above=w?.zones?.nearest_above;
  const zoneText=below&&above?`${esc(below.label)} ${fmt(below.value,1)} ↔ ${esc(above.label)} ${fmt(above.value,1)}`:below?`${esc(below.label)} ${fmt(below.value,1)}`:above?`${esc(above.label)} ${fmt(above.value,1)}`:"—";
  root.innerHTML=`
    <div class="side-grid context-summary">
      <div class="side-cell"><span>Trạng thái</span><b>${esc(state.label||"Đang theo dõi")} · ${num(state.score)!==null?`${Math.round(state.score)}/100`:"—"}</b></div>
      <div class="side-cell"><span>Nhịp tiền</span><b>${esc(flow.label||"—")}</b></div>
      <div class="side-cell wide"><span>Vùng gần nhất</span><b>${zoneText}</b></div>
    </div>
    <details class="side-details">
      <summary>+ Xem kỹ thuật chi tiết</summary>
      <div class="side-grid technical-detail">
        <div class="side-cell"><span>Đỉnh / đáy phiên</span><b>${fmt(v.high,1)} / ${fmt(v.low,1)}</b></div>
        <div class="side-cell"><span>MA10 / MA20</span><b>${fmt(t.ma10,1)} / ${fmt(t.ma20,1)}</b></div>
        <div class="side-cell"><span>VWAP</span><b>${fmt(t.vwap,1)}</b></div>
        <div class="side-cell"><span>RSI14</span><b>${fmt(t.rsi14,1)}</b></div>
        <div class="side-cell"><span>MA50</span><b>${fmt(t.ma50,1)}</b></div>
        <div class="side-cell"><span>Thanh khoản</span><b>${num(v.value_b)!==null?`${fmt(v.value_b,1)} tỷ`:"—"}</b></div>
      </div>
      ${snapshot.technical_available?"":`<div class="side-data-note">AFL kỹ thuật chưa gửi snapshot hợp lệ; hệ thống không hiển thị mức 0 giả.</div>`}
    </details>`;
}

function stockPct(row){return num(row?.change_pct??row?.changePct??row?.pct);}
function renderLeaders(snapshot){
  const root=$("marketLeaders");if(!root||!snapshot)return;
  const world=snapshot.world||{},strong=world?.lines?.strongest?.length?world.lines.strongest:(snapshot?.sectors?.strongest||[]),weak=world?.lines?.weakest?.length?world.lines.weakest:(snapshot?.sectors?.weakest||[]);
  const rows=(items)=>items.length?items.slice(0,3).map(x=>`<div class="mini-row"><span>${esc(x.name||x.symbol||"—")}</span><b class="${toneClass(x.change_pct)}">${pct(x.change_pct)}</b></div>`).join(""):"";
  const movers=[];
  for(const s of (snapshot?.sectors?.all||[])){
    for(const side of ["top_gainers","top_losers"]){
      for(const x of (s?.[side]||[])){
        const p=stockPct(x),vol=num(x?.volume),price=num(x?.price),turnover=price!==null&&vol!==null?price*vol/1000000:null;
        if(!x?.symbol||p===null||vol===null||turnover===null||vol<500000||turnover<15)continue;
        if(!movers.some(m=>m.symbol===x.symbol))movers.push({symbol:x.symbol,pct:p,sector:s.name,turnover});
      }
    }
  }
  movers.sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct));
  const moverHtml=movers.length?movers.slice(0,4).map(x=>`<div class="mini-row"><span>${esc(x.symbol)} · ${esc(x.sector||"")}</span><b class="${toneClass(x.pct)}">${pct(x.pct)}</b></div>`).join(""):"";
  const sections=[];
  if(strong.length)sections.push(`<div class="section-mini"><h3>Nhóm đang hỗ trợ</h3><div class="row-list">${rows(strong)}</div></div>`);
  if(weak.length)sections.push(`<div class="section-mini"><h3>Nhóm đang gây áp lực</h3><div class="row-list">${rows(weak)}</div></div>`);
  if(moverHtml)sections.push(`<div class="section-mini"><h3>Cổ phiếu đáng nhìn · thanh khoản thực</h3><div class="row-list">${moverHtml}</div></div>`);
  const panel=root.closest(".panel");
  if(!sections.length){if(panel)panel.hidden=true;root.innerHTML="";return;}
  if(panel)panel.hidden=false;
  root.innerHTML=sections.join("");
}

function renderSnapshot(snapshot){setStatus(snapshot);if(!snapshot)return;renderStrip(snapshot);renderMarketNow(snapshot);renderLeaders(snapshot);const st=$("snapshotTime");if(st)st.textContent=timeText(snapshot.captured_at);}
function mergeComments(items=[],replace=false){if(replace){commentsById.clear();maxCommentId=0;}for(const c of items){const id=Number(c?.id);if(!Number.isFinite(id))continue;commentsById.set(id,c);maxCommentId=Math.max(maxCommentId,id);}renderLatest();renderTimeline();}

async function load(initial=false){
  try{
    pollCount++;
    const full=initial||!maxCommentId||pollCount%6===0;
    const url=full?`${API}?limit=30&_=${Date.now()}`:`${API}?after_id=${maxCommentId}&limit=10&_=${Date.now()}`;
    const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json();if(!data?.ok)throw new Error(data?.error||"NO_DATA");
    if(data.latest&&data.latest.captured_at!==latestSnapshot?.captured_at){previousSnapshot=latestSnapshot;previousDerivative=derivativeState;}
    latestSnapshot=data.latest||latestSnapshot;
    derivativeState=data.derivatives||null;
    renderSnapshot(latestSnapshot);
    mergeComments(Array.isArray(data.comments)?data.comments:[],full);
    renderLatest();
    if(!data.latest){const now=$("marketNow");if(now)now.innerHTML=`<div class="empty">Chưa có dữ liệu live hôm nay. Hệ thống bắt đầu ghi khi AmiBridge chạy trong giờ giao dịch.</div>`;}
  }catch(error){console.warn("Market live load failed",error);const status=$("liveStatus");if(status){status.classList.add("off");status.querySelector("span").textContent="Chưa kết nối được dữ liệu";}}
}

async function loadAdminNotes(){
  if(!isAdmin)return;
  const root=$("adminNoteHistory");
  const {data,error}=await supabaseClient.rpc('admin_market_live_notes_v1',{p_limit:5});
  if(error){if(root)root.textContent="Không tải được ghi chú Admin.";return;}
  const rows=Array.isArray(data)?data:[];
  if(root)root.innerHTML=rows.length?rows.map(x=>`<div class="admin-note-row"><span>${timeText(x.created_at)}</span><p>${esc(x.note)}</p></div>`).join(""):`<div class="admin-note-empty">Chưa có bình luận bổ sung hôm nay.</div>`;
}
async function initAdmin(){
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();if(!session)return;
    const {data,error}=await supabaseClient.rpc('admin_market_live_status_v1');if(error||data?.role!=="ADMIN")return;
    isAdmin=true;
    const panel=$("liveAdminPanel");if(panel)panel.hidden=false;
    await loadAdminNotes();
    renderTimeline();
  }catch{}
}
async function publishAdminNote(){
  if(!isAdmin)return;
  const titleInput=$("adminLiveHeadline"),bodyInput=$("adminLiveNote"),msg=$("adminNoteMsg"),btn=$("adminNotePublish");
  const headline=String(titleInput?.value||"").trim();
  const body=String(bodyInput?.value||"").trim();
  if(headline.length<2){if(msg)msg.textContent="Nhập tiêu đề bình luận trước khi đăng.";titleInput?.focus();return;}
  if(body.length<2){if(msg)msg.textContent="Nhập nội dung bình luận trước khi đăng.";bodyInput?.focus();return;}
  if(btn)btn.disabled=true;if(msg)msg.textContent="Đang đưa bình luận lên luồng trực tiếp...";
  const {error}=await supabaseClient.rpc('admin_market_live_publish_comment_v1',{p_headline:headline,p_body:body});
  if(btn)btn.disabled=false;
  if(error){if(msg)msg.textContent="Không đăng được: "+error.message;return;}
  if(titleInput)titleInput.value="";
  if(bodyInput)bodyInput.value="";
  if(msg)msg.textContent="Đã đăng. Bình luận này đang tham gia cùng luồng với hệ thống.";
  await loadAdminNotes();
  await load(true);
}

function openCommentEditor(id){
  if(!isAdmin)return;
  const c=commentsById.get(Number(id));if(!c)return;
  const d=$("commentEditorDialog");if(!d)return;
  $("editCommentId").value=String(c.id);
  $("editHeadline").value=c.headline||"";
  $("editBody").value=c.body||"";
  $("editWatchNext").value=c.watch_next||"";
  $("editFinalize").checked=Boolean(c.is_final);
  $("editMsg").textContent="";
  d.showModal();
}
async function saveCommentEdit(e){
  e.preventDefault();if(!isAdmin)return;
  const id=Number($("editCommentId").value),headline=$("editHeadline").value.trim(),body=$("editBody").value.trim(),watch=$("editWatchNext").value.trim(),finalize=$("editFinalize").checked,msg=$("editMsg"),btn=$("editSave");
  if(btn)btn.disabled=true;if(msg)msg.textContent="Đang lưu...";
  const {error}=await supabaseClient.rpc('admin_market_live_comment_update_v1',{p_id:id,p_headline:headline,p_body:body,p_watch_next:watch||null,p_finalize:finalize});
  if(btn)btn.disabled=false;
  if(error){if(msg)msg.textContent="Không lưu được: "+error.message;return;}
  $("commentEditorDialog").close();
  await load(true);
}

function bindAdminUi(){
  $("adminNotePublish")?.addEventListener("click",publishAdminNote);
  $("adminLiveNote")?.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();publishAdminNote();}});
  $("adminLiveHeadline")?.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();publishAdminNote();}});
  $("timelineList")?.addEventListener("click",e=>{const b=e.target.closest("[data-edit-comment]");if(b)openCommentEditor(b.dataset.editComment);});
  $("commentEditorForm")?.addEventListener("submit",saveCommentEdit);
  $("editCancel")?.addEventListener("click",()=>$("commentEditorDialog")?.close());
}

function start(){
  bindAdminUi();
  load(true);
  initAdmin();
  pollTimer=window.setInterval(()=>{if(document.visibilityState==="visible")load(false);},10000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")load(false);});
}
start();
