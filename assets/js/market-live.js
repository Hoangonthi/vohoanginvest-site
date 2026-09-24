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
let dayHistoryLoaded = false;
let historyLoading = false;
const HISTORY_STEP = 7;
let timelineVisible = HISTORY_STEP;
let decisionContext = [];
let decisionContextAt = 0;
const DECISION_API = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/decision-core-live-public-v1";
const DECISION_POLICY = "DP_ACCOUNT_SHADOW_2026_09_V6";

const marqueeState={
  raf:0,
  lastTs:0,
  offset:0,
  width:0,
  speed:52,
  track:null,
  first:null,
  second:null
};

const $ = (id) => document.getElementById(id);
const publicTerms = (value = "") => String(value).replace(/\bVWAP\b/gi,"vùng giá bình quân phiên");
const esc = (value = "") => publicTerms(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
const num = (v) => { if(v===null||v===undefined||v==="")return null; const x=Number(v); return Number.isFinite(x)?x:null; };
const fmt = (v,d=2) => { const x=num(v); return x===null?"—":new Intl.NumberFormat("vi-VN",{minimumFractionDigits:d,maximumFractionDigits:d}).format(x); };
const signed = (v,d=2) => { const x=num(v); return x===null?"—":`${x>0?"+":""}${fmt(x,d)}`; };
const pct = (v) => { const x=num(v); return x===null?"—":`${signed(x,2)}%`; };
const toneClass = (v) => { const x=num(v); return x===null||Math.abs(x)<.0001?"flat":x>0?"up":"down"; };
const timeText = (iso) => { if(!iso)return"—"; try{return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(iso));}catch{return"—";} };
const isVietnamTradingNow = () => { const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()); const get=(t)=>parts.find(p=>p.type===t)?.value||""; if(["Sat","Sun"].includes(get("weekday")))return false; const m=Number(get("hour"))*60+Number(get("minute")); return(m>=525&&m<=691)||(m>=780&&m<=901); };
const commentaryClock = () => {
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const get=t=>parts.find(p=>p.type===t)?.value||"";
  return{weekday:get("weekday"),minutes:Number(get("hour"))*60+Number(get("minute"))};
};
const commentaryPhaseNow = () => {
  const now=commentaryClock();
  if(["Sat","Sun"].includes(now.weekday))return "OFF";
  if(now.minutes<520)return "PRE";
  if(now.minutes<=900)return "LIVE";
  return "CLOSED";
};
const isCommentaryWindowNow = () => commentaryPhaseNow()==="LIVE";
const commentaryWindowLabel = "08:40–15:00";
const sameName = (a,b) => String(a||"").trim().toLowerCase()===String(b||"").trim().toLowerCase();

function setStatus(snapshot){
  const root=$("liveStatus");if(!root)return;
  if(!snapshot?.captured_at){root.classList.add("off");root.querySelector("span").textContent="Đang chờ dữ liệu";return;}
  const age=Math.max(0,(Date.now()-new Date(snapshot.captured_at).getTime())/1000),live=isVietnamTradingNow()&&age<=75;
  root.classList.toggle("off",!live);
  root.querySelector("span").textContent=live?`TRỰC TIẾP · ${timeText(snapshot.captured_at)}`:`Dữ liệu gần nhất · ${timeText(snapshot.captured_at)}`;
}

function liquidStockExtremes(snapshot){
  const map=new Map();
  for(const s of sectorRows(snapshot)){
    for(const side of ["top_gainers","top_losers"]){
      for(const x of (s?.[side]||[])){
        const p=num(x?.change_pct),vol=num(x?.volume),price=num(x?.price),turnover=price!==null&&vol!==null?price*vol/1000000:null;
        if(!x?.symbol||p===null||vol===null||turnover===null||vol<500000||turnover<15)continue;
        const row={symbol:String(x.symbol).toUpperCase(),pct:p,sector:s.name||"",turnover};
        const old=map.get(row.symbol);
        if(!old||Math.abs(row.pct)>Math.abs(old.pct))map.set(row.symbol,row);
      }
    }
  }
  const all=[...map.values()];
  return{
    strong:all.filter(x=>x.pct>0).sort((a,b)=>b.pct-a.pct).slice(0,3),
    weak:all.filter(x=>x.pct<0).sort((a,b)=>a.pct-b.pct).slice(0,3)
  };
}

function startMarqueeLoop(){
  if(marqueeState.raf)return;
  const step=(ts)=>{
    if(!marqueeState.lastTs)marqueeState.lastTs=ts;
    const dt=Math.min(50,Math.max(0,ts-marqueeState.lastTs));
    marqueeState.lastTs=ts;

    if(marqueeState.track&&marqueeState.width>0){
      marqueeState.offset+=marqueeState.speed*(dt/1000);
      if(marqueeState.offset>=marqueeState.width){
        marqueeState.offset%=marqueeState.width;
      }
      marqueeState.track.style.transform=`translate3d(-${marqueeState.offset}px,0,0)`;
    }

    marqueeState.raf=requestAnimationFrame(step);
  };
  marqueeState.raf=requestAnimationFrame(step);
}

function measureMarquee(){
  if(!marqueeState.first)return;
  requestAnimationFrame(()=>{
    if(!marqueeState.first)return;
    const width=marqueeState.first.getBoundingClientRect().width;
    if(width>0){
      marqueeState.width=width;
      if(marqueeState.offset>=width)marqueeState.offset%=width;
    }
  });
}

function ensureMarqueeShell(el){
  let track=el.querySelector(".market-marquee-track");
  let groups=el.querySelectorAll(".market-marquee-group");

  if(!track||groups.length<2){
    el.innerHTML=`<div class="market-marquee"><div class="market-marquee-track"><div class="market-marquee-group"></div><div class="market-marquee-group" aria-hidden="true"></div></div></div>`;
    track=el.querySelector(".market-marquee-track");
    groups=el.querySelectorAll(".market-marquee-group");
  }

  marqueeState.track=track;
  marqueeState.first=groups[0]||null;
  marqueeState.second=groups[1]||null;
  startMarqueeLoop();
}

function renderStrip(snapshot){
  const el=$("liveStrip");if(!el||!snapshot)return;
  const v=snapshot.vnindex||{};
  const strong=snapshot?.sectors?.strongest?.length?snapshot.sectors.strongest:sectorRows(snapshot).slice(0,3);
  const weak=snapshot?.sectors?.weakest?.length?snapshot.sectors.weakest:[...sectorRows(snapshot)].reverse().slice(0,3);
  const breadth=num(v.adv)!==null&&num(v.dec)!==null?`${Math.round(v.adv)} tăng / ${Math.round(v.dec)} giảm`:null;
  const sectorText=(rows)=>rows.slice(0,3).filter(x=>x&&num(x.change_pct)!==null).map(x=>`${x.name||x.symbol} ${pct(x.change_pct)}`).join(" · ");
  const strongText=sectorText(strong),weakText=sectorText(weak);
  const stocks=liquidStockExtremes(snapshot);
  const stockText=(rows)=>rows.map(x=>`${x.symbol} ${pct(x.pct)}`).join(" · ");
  const strongStocks=stockText(stocks.strong),weakStocks=stockText(stocks.weak);
  const items=[
    `<span class="market-context-item primary"><b class="${toneClass(v.change)}">VN-Index ${fmt(v.value,2)} · ${signed(v.change,2)} (${pct(v.change_pct)})</b></span>`,
    breadth?`<span class="market-context-item"><span>Độ rộng</span><b>${breadth}</b></span>`:"",
    strongText?`<span class="market-context-item"><span>Nhóm mạnh</span><b class="up">${esc(strongText)}</b></span>`:"",
    weakText?`<span class="market-context-item"><span>Nhóm yếu</span><b class="down">${esc(weakText)}</b></span>`:"",
    strongStocks?`<span class="market-context-item"><span>Mã mạnh</span><b class="up">${esc(strongStocks)}</b></span>`:"",
    weakStocks?`<span class="market-context-item"><span>Mã yếu</span><b class="down">${esc(weakStocks)}</b></span>`:""
  ].filter(Boolean).join("");

  ensureMarqueeShell(el);

  if(marqueeState.first&&marqueeState.first.innerHTML!==items){
    marqueeState.first.innerHTML=items;
    marqueeState.second.innerHTML=items;
    measureMarquee();
  }else if(!marqueeState.width){
    measureMarquee();
  }
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

async function refreshDecisionContext(snapshot){
  if(!snapshot||Date.now()-decisionContextAt<60000)return;
  decisionContextAt=Date.now();
  const ex=stockExtremes(snapshot);
  const symbols=[ex.best?.symbol,ex.worst?.symbol,...liquidStockExtremes(snapshot).strong.map(x=>x.symbol),...liquidStockExtremes(snapshot).weak.map(x=>x.symbol)].filter(Boolean);
  const unique=[...new Set(symbols)].slice(0,3);
  if(!unique.length)return;
  const rows=await Promise.all(unique.map(async symbol=>{try{const u=DECISION_API+"?symbol="+encodeURIComponent(symbol)+"&policy_version="+encodeURIComponent(DECISION_POLICY)+"&_="+Date.now();const r=await fetch(u,{cache:"no-store"});const j=await r.json();return r.ok&&j?.ok&&j.official===false&&j.authority===false?j:null}catch{return null}}));
  decisionContext=rows.filter(Boolean).filter(x=>x.freshness==="FRESH"&&Number(x?.decision?.confidence||0)>=.45);
}
function decisionCommentLine(){
  if(!decisionContext.length)return"";
  const ranked=[...decisionContext].sort((a,b)=>Number(b?.decision?.confidence||0)-Number(a?.decision?.confidence||0));
  const notable=ranked.filter(x=>{const d=x.decision||{},c=x.context||{};return d.evidence_alignment==="SUPPORTIVE"||c?.sector_state?.sector_state==="LEADING"||c?.sector_state?.sector_state==="LAGGING"||c?.fundamental_state?.fundamental_state==="POSITIVE"}).slice(0,2);
  if(!notable.length)return"";
  return "Ở lớp cổ phiếu, "+notable.map(x=>{const d=x.decision||{},c=x.context||{},s=c?.sector_state?.sector_state,f=c?.fundamental_state?.fundamental_state;let note=d.evidence_alignment==="SUPPORTIVE"?"đang có tín hiệu đồng thuận tốt hơn":s==="LEADING"?"đang thuộc nhóm dẫn":s==="LAGGING"?"đang chậm hơn nhóm":"đang có điểm riêng đáng theo dõi";if(f==="POSITIVE"&&note!=="đang có tín hiệu đồng thuận tốt hơn")note+=", nền cơ bản tích cực";return x.symbol+" "+note}).join("; ")+". Đây là lớp kiểm tra chéo, chỉ nhắc khi dữ liệu đủ mới và có khác biệt đáng chú ý.";
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
  if(leaderChanged)headline=`Nhóm ${leader.name} đang ${num(leader.change_pct)>=0?"tăng":"giảm"} ${fmt(Math.abs(num(leader.change_pct)),2)}%`;
  else if(tick!==null&&tick>=.30)headline=`VN-Index vừa nhích thêm ${fmt(tick,2)} điểm`;
  else if(tick!==null&&tick<=-.30)headline=`VN-Index vừa lùi ${fmt(Math.abs(tick),2)} điểm`;
  else if(advDelta!==null&&advDelta>=7)headline="Độ rộng vừa mở thêm về phía tăng";
  else if(decDelta!==null&&decDelta>=7)headline="Số mã giảm đang tăng lên, cần nhìn lại độ lan tỏa";
  else if(derChanged)headline=`Phái sinh vừa chuyển sang trạng thái ${derivativeState.label.toLowerCase()}`;
  else if(phase===3&&derTick!==null&&Math.abs(derTick)<.20)headline=`Phái sinh gần như đi ngang quanh ${fmt(derNow,1)}`;
  else if(phase===3&&derTick!==null&&derTick>=.50)headline=`Phái sinh vừa nhích thêm ${fmt(derTick,1)} điểm`;
  else if(phase===3&&derTick!==null&&derTick<=-.50)headline=`Phái sinh vừa lùi ${fmt(Math.abs(derTick),1)} điểm`;
  else if((extremes.worst?.pct??0)<=-5.5)headline=`${extremes.worst.symbol} đang là biến động bất thường cần chú ý`;
  else if(phase===1&&leader&&laggard)headline=`Nhóm ${leader.name} ${num(leader.change_pct)>=0?"tăng":"giảm"} ${fmt(Math.abs(num(leader.change_pct)),2)}%, ${laggard.name} ${num(laggard.change_pct)>=0?"tăng":"giảm"} ${fmt(Math.abs(num(laggard.change_pct)),2)}%`;
  else if(phase===2&&leader)headline=`Nhóm ${leader.name} đang ${num(leader.change_pct)>=0?"tăng":"giảm"} ${fmt(Math.abs(num(leader.change_pct)),2)}%`;
  else if(phase===3&&derivativeState)headline=`Cơ sở đang vận động trong khi phái sinh ${derivativeState.label.toLowerCase()}`;
  else if(d5!==null&&Math.abs(d5)>=1)headline=d5>0?"VN-Index đang cải thiện trong 5 phút gần đây":"VN-Index đang chậm lại trong 5 phút gần đây";

  const bits=[];
  const sectorStory=Boolean(leader&&(leaderChanged||phase===1||phase===2));
  if(!sectorStory){
    const indexOpeners=[
      `VN-Index hiện ở ${fmt(v.value,2)} điểm, ${signed(v.change,2)} điểm (${pct(v.change_pct)}).`,
      `Mặt điểm số lúc này: VN-Index ${fmt(v.value,2)}, thay đổi ${signed(v.change,2)} điểm (${pct(v.change_pct)}).`,
      `Chỉ số đang đứng tại ${fmt(v.value,2)} điểm, tương ứng ${signed(v.change,2)} điểm (${pct(v.change_pct)}).`
    ];
    bits.push(indexOpeners[phase%indexOpeners.length]);
    if(tick!==null&&Math.abs(tick)>=.05)bits.push(`So với lần cập nhật trước, chỉ số ${tick>0?"nhích thêm":"lùi"} ${fmt(Math.abs(tick),2)} điểm.`);
    else if(d5!==null&&Math.abs(d5)>=.1)bits.push(`Trong khoảng 5 phút, VN-Index thay đổi ${signed(d5,1)} điểm${d15!==null?`; 15 phút là ${signed(d15,1)} điểm`:""}.`);
  }

  if(adv!==null&&dec!==null){
    let breadth=`Độ rộng hiện có ${Math.round(adv)} mã tăng và ${Math.round(dec)} mã giảm`;
    if(advDelta!==null&&Math.abs(advDelta)>=3)breadth+=`, số mã tăng ${advDelta>0?"tăng thêm":"giảm"} ${Math.abs(Math.round(advDelta))} mã so với lần trước`;
    if(decDelta!==null&&Math.abs(decDelta)>=3)breadth+=`, số mã giảm ${decDelta>0?"tăng thêm":"giảm"} ${Math.abs(Math.round(decDelta))} mã`;
    bits.push(breadth+".");
  }

  if(leader&&laggard){
    const next=snapshot?.sectors?.strongest?.[1];
    let s=`Nhóm ${leader.name} đang ${num(leader.change_pct)>=0?"tăng":"giảm"} ${fmt(Math.abs(num(leader.change_pct)),2)}%`;
    if(next)s+=`; ${next.name} ${num(next.change_pct)>=0?"tăng":"giảm"} ${fmt(Math.abs(num(next.change_pct)),2)}%`;
    if(!sameName(leader.name,laggard.name))s+=`; ${laggard.name} ${num(laggard.change_pct)>=0?"tăng":"giảm"} ${fmt(Math.abs(num(laggard.change_pct)),2)}%`;
    bits.push(s+".");
    const internal=sectorInternalLine(leader);if(internal)bits.push(internal);
  }

  const dcLine=decisionCommentLine();if(dcLine)bits.push(dcLine);

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
  else if(leaderChanged)watch=`Theo dõi nhóm ${leader.name} (${num(leader.change_pct)>=0?"+":"-"}${fmt(Math.abs(num(leader.change_pct)),2)}%) có giữ được mức tăng hiện tại và độ rộng nội nhóm hay không; đồng thời nhìn ${prevLeader.name} có suy yếu tiếp hay không.`;
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
  const phase=commentaryPhaseNow();
  const liveWindow=phase==="LIVE";
  const pulse=liveWindow?currentPulse(latestSnapshot):null;

  let title="Ngoài giờ bình luận";
  let status=`Khung bình luận ${commentaryWindowLabel}`;
  let stamp="BÌNH LUẬN GẦN NHẤT";
  let emptyText=`Ngoài giờ bình luận. Khung bình luận từ ${commentaryWindowLabel}.`;

  if(phase==="LIVE"){
    title="Bình luận trực tiếp";
    status="Đang cập nhật ~10 giây";
    stamp="ĐANG BÌNH LUẬN";
    emptyText="Đang chờ dữ liệu trực tiếp...";
  }else if(phase==="CLOSED"){
    title="Bình luận cuối phiên";
    status="Kết thúc lúc 15:00";
    stamp="BÌNH LUẬN CUỐI PHIÊN";
    emptyText="Phiên bình luận hôm nay đã kết thúc lúc 15:00.";
  }else if(phase==="PRE"){
    title="Chuẩn bị trước phiên";
    status="Bắt đầu bình luận lúc 08:40";
    stamp="BÌNH LUẬN GẦN NHẤT";
    emptyText="Bình luận trực tiếp bắt đầu lúc 08:40.";
  }

  const head=`<div class="panel-head"><h2>${title}</h2><span id="latestRefresh">${status}</span></div>`;

  if(!liveWindow&&c){
    panel.innerHTML=head+`<article class="latest ${esc(c.tone||"neutral")}"><div class="latest-time">${timeText(c.published_at)} · ${stamp}</div><h2>${esc(c.headline)}</h2><p class="latest-body">${esc(c.body)}</p>${c.watch_next?`<div class="watch-next"><b>Điểm cần nhìn tiếp:</b> ${esc(c.watch_next)}</div>`:""}${evidenceHtml(c)}</article>`;
    return;
  }

  if(c&&c.event_id==null){
    panel.innerHTML=head+`<article class="latest ${esc(c.tone||"neutral")}"><div class="latest-time">${timeText(c.published_at)} · ${stamp}</div><h2>${esc(c.headline)}</h2><p class="latest-body">${esc(c.body)}</p>${c.watch_next?`<div class="watch-next"><b>Điểm cần nhìn tiếp:</b> ${esc(c.watch_next)}</div>`:""}${evidenceHtml(c)}</article>`;
    return;
  }

  if(!pulse){
    if(c){
      panel.innerHTML=head+`<article class="latest ${esc(c.tone||"neutral")}"><div class="latest-time">${timeText(c.published_at)} · ${stamp}</div><h2>${esc(c.headline)}</h2><p class="latest-body">${esc(c.body)}</p>${c.watch_next?`<div class="watch-next"><b>Điểm cần nhìn tiếp:</b> ${esc(c.watch_next)}</div>`:""}${evidenceHtml(c)}</article>`;
    }else{
      panel.innerHTML=head+`<div class="empty">${emptyText}</div>`;
    }
    return;
  }

  const lastEvent=c?`<div class="last-event"><b>Mốc lịch sử gần nhất · ${timeText(c.published_at)}:</b> ${esc(c.headline)}</div>`:"";
  panel.innerHTML=head+`<article class="latest"><div class="latest-time">${timeText(latestSnapshot?.captured_at)} · ${stamp}</div><h2>${esc(pulse.headline)}</h2><p class="latest-body">${esc(pulse.body)}</p><div class="watch-next"><b>Điểm cần nhìn tiếp:</b> ${esc(pulse.watch)}</div>${lastEvent}${c?evidenceHtml(c):""}</article>`;
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
function renderRecentContext(){
  const panel=$("recentContextPanel"),list=$("recentContextList");
  if(!panel||!list)return;

  const raw=[...commentsById.values()].sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
  const comments=isAdmin?raw:dedupeTimeline(raw);
  if(!comments.length){panel.hidden=true;list.innerHTML="";return;}

  const latestSaved=comments[0]||null;
  const pulseVisible=isCommentaryWindowNow()&&Boolean(currentPulse(latestSnapshot));
  const latestSavedIsMain=!pulseVisible||Boolean(latestSaved&&latestSaved.event_id==null);
  const prior=comments.slice(latestSavedIsMain?1:0,latestSavedIsMain?3:2);

  if(!prior.length){panel.hidden=true;list.innerHTML="";return;}

  panel.hidden=false;
  list.innerHTML=prior.map(c=>`
    <article class="recent-context-item ${esc(c.tone||"neutral")}">
      <div class="recent-context-time">${timeText(c.published_at)}</div>
      <h3>${esc(c.headline)}</h3>
      <p>${esc(c.body)}</p>
      ${c.watch_next?`<div class="recent-context-watch"><b>Nhìn tiếp:</b> ${esc(c.watch_next)}</div>`:""}
    </article>`).join("");
}

function renderTimeline(){
  const list=$("timelineList");if(!list)return;
  const raw=[...commentsById.values()].sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
  const comments=isAdmin?raw:dedupeTimeline(raw);
  const visible=comments.slice(0,timelineVisible);
  const counter=$("timelineCount");
  const more=$("timelineMoreBtn");

  if(counter)counter.textContent=comments.length
    ?`Đang xem ${Math.min(timelineVisible,comments.length)}/${comments.length} bình luận`
    :"Chưa có bình luận";

  if(!comments.length){
    list.innerHTML=`<div class="empty">Chưa có bình luận trong ngày.</div>`;
    if(more)more.hidden=true;
    return;
  }

  list.innerHTML=visible.map(c=>`<article class="timeline-item ${esc(c.tone||"neutral")}"><div class="timeline-time">${timeText(c.published_at)}</div><h3>${esc(c.headline)}</h3><p>${esc(c.body)}</p>${c.watch_next?`<div class="timeline-watch"><b>Nhìn tiếp:</b> ${esc(c.watch_next)}</div>`:""}${adminActions(c)}</article>`).join("");

  if(more){
    const remaining=Math.max(0,comments.length-visible.length);
    more.hidden=remaining===0;
    more.textContent=remaining>0?`Đọc tiếp ${Math.min(HISTORY_STEP,remaining)} bình luận`:"";
  }
}

function loadMoreTimeline(){
  timelineVisible+=HISTORY_STEP;
  renderTimeline();
}


function renderSnapshot(snapshot){setStatus(snapshot);if(!snapshot)return;renderStrip(snapshot);}
function mergeComments(items=[],replace=false){if(replace){commentsById.clear();maxCommentId=0;}for(const c of items){const id=Number(c?.id);if(!Number.isFinite(id))continue;commentsById.set(id,c);maxCommentId=Math.max(maxCommentId,id);}renderLatest();renderRecentContext();renderTimeline();}

async function load(initial=false){
  try{
    pollCount++;
    const full=initial||!maxCommentId||pollCount%6===0;
    const fullLimit=dayHistoryLoaded?160:30;
    const url=full?`${API}?limit=${fullLimit}&_=${Date.now()}`:`${API}?after_id=${maxCommentId}&limit=10&_=${Date.now()}`;
    const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json();if(!data?.ok)throw new Error(data?.error||"NO_DATA");
    if(data.latest&&data.latest.captured_at!==latestSnapshot?.captured_at){previousSnapshot=latestSnapshot;previousDerivative=derivativeState;}
    latestSnapshot=data.latest||latestSnapshot;
    derivativeState=data.derivatives||null;
    renderSnapshot(latestSnapshot);\n    refreshDecisionContext(latestSnapshot).then(()=>renderLatest()).catch(()=>{});\n    mergeComments(Array.isArray(data.comments)?data.comments:[],full);
    renderLatest();
  }catch(error){console.warn("Market live load failed",error);const status=$("liveStatus");if(status){status.classList.add("off");status.querySelector("span").textContent="Chưa kết nối được dữ liệu";}}
}

function vnDateKey(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=t=>parts.find(p=>p.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function vnDateLabel(){
  return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date());
}
async function loadDayHistory(){
  if(historyLoading)return;
  historyLoading=true;
  const info=$("historyInfo");if(info)info.textContent="Đang tải lịch sử trong ngày…";
  try{
    const r=await fetch(`${API}?limit=160&_=${Date.now()}`,{cache:"no-store"});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json();if(!data?.ok)throw new Error(data?.error||"NO_DATA");
    mergeComments(Array.isArray(data.comments)?data.comments:[],false);
    dayHistoryLoaded=true;
    const count=dedupeTimeline([...commentsById.values()]).length;
    if(info)info.textContent=`${count} bình luận đã lưu hôm nay`;
  }catch(error){
    console.warn("Load day history failed",error);
    if(info)info.textContent="Chưa tải được lịch sử.";
  }finally{historyLoading=false;}
}
async function toggleDayHistory(){
  const panel=$("timelinePanel"),btn=$("reviewCommentsBtn");if(!panel)return;
  if(panel.hidden){
    if(!dayHistoryLoaded)await loadDayHistory();
    timelineVisible=HISTORY_STEP;
    panel.hidden=false;
    panel.dataset.opened="1";
    renderTimeline();
    if(btn)btn.textContent="Ẩn bình luận trong ngày";
    panel.scrollIntoView({behavior:"smooth",block:"start"});
  }else{
    panel.hidden=true;
    panel.dataset.opened="0";
    timelineVisible=HISTORY_STEP;
    if(btn)btn.textContent="Xem lại bình luận trong ngày";
  }
}
async function applyCommentarySessionUi(){
  const panel=$("timelinePanel"),btn=$("reviewCommentsBtn");
  if(!panel)return;
  const opened=panel.dataset.opened==="1";
  panel.hidden=!opened;
  if(btn)btn.textContent=opened?"Ẩn bình luận trong ngày":"Xem lại bình luận trong ngày";
  if(opened){
    if(!dayHistoryLoaded)await loadDayHistory();
    renderTimeline();
  }
}
function pdfHistoryHtml(comments){
  const rows=[...comments].sort((a,b)=>new Date(a.published_at)-new Date(b.published_at));
  const v=latestSnapshot?.vnindex||{};
  const summary=num(v.value)!==null?`VN-Index ${fmt(v.value,2)} · ${signed(v.change,2)} (${pct(v.change_pct)})`:"";
  return `<div style="font-family:'Be Vietnam Pro',Arial,sans-serif;color:#18202a;background:#fff;padding:0 4px">
    <div style="padding:0 0 12px;border-bottom:2px solid #c49a3a">
      <div style="font-size:19px;font-weight:800">BÌNH LUẬN THỊ TRƯỜNG TRỰC TIẾP</div>
      <div style="margin-top:4px;font-size:11px;color:#667085">Võ Hoàng · ${vnDateLabel()}${summary?` · ${summary}`:""}</div>
    </div>
    <div style="margin-top:12px">
      ${rows.map(c=>`<div style="padding:9px 0 10px;border-bottom:1px solid #e7e9ee;break-inside:avoid">
        <div style="font-size:9px;font-weight:700;color:#9b741c">${timeText(c.published_at)}</div>
        <div style="margin-top:3px;font-size:12.5px;font-weight:800;line-height:1.35">${esc(c.headline)}</div>
        <div style="margin-top:4px;font-size:10.5px;line-height:1.6;color:#344054">${esc(c.body)}</div>
        ${c.watch_next?`<div style="margin-top:5px;padding:6px 8px;border-left:2px solid #c49a3a;background:#faf8f2;font-size:9.5px;line-height:1.55"><b>Điểm cần nhìn tiếp:</b> ${esc(c.watch_next)}</div>`:""}
      </div>`).join("")}
    </div>
    <div style="margin-top:12px;padding-top:8px;border-top:1px solid #ddd;font-size:8.5px;line-height:1.5;color:#7b8490">Nội dung cung cấp thông tin và góc nhìn hệ thống, không phải khuyến nghị mua/bán.</div>
  </div>`;
}
function printHistoryFallback(html){
  const w=window.open("","_blank","noopener,noreferrer");if(!w)return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Bình luận thị trường</title><style>@page{size:A4;margin:14mm}body{margin:0;background:#fff}</style></head><body>${html}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  w.document.close();
}
function ensureHtml2Pdf(){
  if(typeof window.html2pdf==="function")return Promise.resolve(true);
  return new Promise(resolve=>{
    const existing=document.querySelector('script[data-html2pdf]');
    if(existing){
      existing.addEventListener("load",()=>resolve(typeof window.html2pdf==="function"),{once:true});
      existing.addEventListener("error",()=>resolve(false),{once:true});
      return;
    }
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";
    script.defer=true;
    script.dataset.html2pdf="1";
    script.onload=()=>resolve(typeof window.html2pdf==="function");
    script.onerror=()=>resolve(false);
    document.head.appendChild(script);
  });
}
async function exportCommentsPdf(){
  const btn=$("exportCommentsPdfBtn"),info=$("historyInfo");
  if(btn)btn.disabled=true;if(info)info.textContent="Đang chuẩn bị PDF…";
  try{
    if(!dayHistoryLoaded)await loadDayHistory();
    const comments=dedupeTimeline([...commentsById.values()]);
    if(!comments.length){if(info)info.textContent="Chưa có bình luận để xuất.";return;}
    const wrap=document.createElement("div");
    wrap.style.cssText="position:fixed;left:-100000px;top:0;width:760px;background:#fff;padding:24px;z-index:-1";
    wrap.innerHTML=pdfHistoryHtml(comments);document.body.appendChild(wrap);
    const html=wrap.firstElementChild;
    const pdfReady=await ensureHtml2Pdf();
    if(pdfReady&&typeof window.html2pdf==="function"){
      await window.html2pdf().set({
        margin:[10,10,10,10],
        filename:`binh-luan-thi-truong-${vnDateKey()}.pdf`,
        image:{type:"jpeg",quality:.98},
        html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff"},
        jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},
        pagebreak:{mode:["css","legacy"]}
      }).from(html).save();
    }else{
      printHistoryFallback(html.outerHTML);
    }
    wrap.remove();
    if(info)info.textContent=`Đã chuẩn bị ${comments.length} bình luận.`;
  }catch(error){
    console.warn("Export PDF failed",error);
    if(info)info.textContent="Xuất PDF chưa thành công.";
  }finally{if(btn)btn.disabled=false;}
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
  $("reviewCommentsBtn")?.addEventListener("click",toggleDayHistory);
  $("timelineMoreBtn")?.addEventListener("click",loadMoreTimeline);
  $("exportCommentsPdfBtn")?.addEventListener("click",exportCommentsPdf);
  $("adminNotePublish")?.addEventListener("click",publishAdminNote);
  $("adminLiveNote")?.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();publishAdminNote();}});
  $("adminLiveHeadline")?.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();publishAdminNote();}});
  $("timelineList")?.addEventListener("click",e=>{const b=e.target.closest("[data-edit-comment]");if(b)openCommentEditor(b.dataset.editComment);});
  $("commentEditorForm")?.addEventListener("submit",saveCommentEdit);
  $("editCancel")?.addEventListener("click",()=>$("commentEditorDialog")?.close());
}

async function start(){
  window.addEventListener("resize",measureMarquee,{passive:true});
  bindAdminUi();
  await load(true);
  await applyCommentarySessionUi();
  initAdmin();
  pollTimer=window.setInterval(()=>{
    if(document.visibilityState==="visible"){
      load(false);
      renderLatest();
    }
  },10000);
  document.addEventListener("visibilitychange",async()=>{
    if(document.visibilityState==="visible"){
      await load(false);
      await applyCommentarySessionUi();
      renderLatest();
    }
  });
}
start();
