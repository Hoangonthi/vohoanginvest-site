const ENDPOINT = window.VH_MARKET_ENDPOINT || "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed";
const REFRESH_MS = 60_000;
const SECTORS = {
  VNFIN: "Tài chính",
  VNREAL: "Bất động sản",
  VNIND: "Công nghiệp",
  VNIT: "Công nghệ thông tin",
  VNMAT: "Nguyên vật liệu",
  VNCONS: "Hàng tiêu dùng thiết yếu",
  VNCOND: "Hàng tiêu dùng không thiết yếu",
  VNENE: "Năng lượng",
  VNHEAL: "Y tế",
  VNUTI: "Tiện ích"
};

function n(value){const x=Number(value);return Number.isFinite(x)?x:null}
function fmt(value,digits=2){const x=n(value);return x===null?"—":x.toLocaleString("vi-VN",{minimumFractionDigits:digits,maximumFractionDigits:digits})}
function fmtTrim(value,digits=2){const x=n(value);return x===null?"—":x.toLocaleString("vi-VN",{minimumFractionDigits:0,maximumFractionDigits:digits})}
function pct(value){const x=n(value);return x===null?"—":`${x>0?"+":""}${fmtTrim(x,2)}%`}
function esc(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function tone(value){const t=String(value||"neutral");return ["positive","warning","danger","neutral"].includes(t)?t:"neutral"}
function safeHref(value){const h=String(value||"");return /^[a-z0-9-]+\.html(?:[?#].*)?$/i.test(h)?h:"#"}
function index(data,symbol){return Array.isArray(data?.indexes)?data.indexes.find(x=>String(x?.symbol||"")===symbol):null}

function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=value}
function setHtml(id,value){const el=document.getElementById(id);if(el)el.innerHTML=value}

function renderLive(mi,data){
  const el=document.getElementById("readerLive");
  if(!el)return;
  const fresh=mi?.freshness||{};
  el.className=`reader-live is-${tone(fresh.tone)}`;
  const updated=data?.updated_at||data?.relay_received_at||"";
  let suffix="";
  if(updated){
    const d=new Date(String(updated).includes("T")?updated:String(updated).replace(" ","T"));
    if(!Number.isNaN(d.getTime())){
      suffix=" · "+new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(d);
    }
  }
  el.innerHTML=`<i></i><span>${esc(fresh.label||"Dữ liệu thị trường")}${esc(suffix)}</span>`;
}

function renderState(mi){
  const state=mi?.state||{};
  const score=Math.max(0,Math.min(100,Number(state.score)||0));
  setText("readerState",state.label||"—");
  setText("readerScore",String(score));
  setText("readerTrend",`${state.trend||"ổn định"}${state.score_delta_15m===null||state.score_delta_15m===undefined?"":` · 15 phút ${state.score_delta_15m>0?"+":""}${state.score_delta_15m} điểm`}`);
  const bar=document.getElementById("readerScoreBar");if(bar)bar.style.width=`${score}%`;
  const card=document.getElementById("readerScoreCard");if(card)card.dataset.tone=tone(state.tone);

  setText("readerAction",mi?.action?.headline||"Theo dõi thêm dữ liệu.");
  setText("readerActionDetail",mi?.action?.detail||"");
  const links=Array.isArray(mi?.action?.links)?mi.action.links:[];
  setHtml("readerActions",links.map(x=>`<a href="${safeHref(x?.href)}">${esc(x?.label||"Mở công cụ")}</a>`).join(""));
}

function renderMetrics(data,mi){
  const vn=index(data,"VN-INDEX");
  const vnValue=n(vn?.value),vnPct=n(vn?.change_pct),vnChange=n(vn?.change);
  setText("vnIndex",vnValue===null?"—":fmt(vnValue,2));
  setText("vnIndexSub",vnChange===null?"—":`${vnChange>0?"+":""}${fmt(vnChange,2)} · ${pct(vnPct)}`);

  const b=mi?.breadth||{};
  setText("breadthState",b.label||"—");
  setText("breadthSub",b.adv===null||b.adv===undefined?"Chưa đủ dữ liệu":`${b.adv} tăng · ${b.flat} TC · ${b.dec} giảm`);

  const flow=mi?.flow||{};
  setText("flowValue",flow.value_b===null||flow.value_b===undefined?"—":`${fmtTrim(flow.value_b,1)} tỷ`);
  setText("flowSub",flow.label||"Đang tích lũy dữ liệu");

  const leader=mi?.leadership?.leader;
  setText("leaderName",leader?leader.name:"—");
  setText("leaderSub",leader?`${pct(leader.change_pct)} · ${leader.momentum||"ổn định"}`:"Chưa xác định");
}

function renderSectors(data,mi){
  const momentum=new Map();
  [...(mi?.leadership?.leaders||[]),...(mi?.leadership?.laggards||[])].forEach(x=>momentum.set(x.symbol,x));
  const rows=Object.entries(SECTORS).map(([symbol,name])=>{
    const row=index(data,symbol);
    return {symbol,name,change:n(row?.change_pct),meta:momentum.get(symbol)||null};
  }).filter(x=>x.change!==null).sort((a,b)=>b.change-a.change);

  if(!rows.length){setHtml("sectorTable","<p class='reader-note'>Chưa có dữ liệu nhóm ngành.</p>");return}
  const maxAbs=Math.max(.15,...rows.map(x=>Math.abs(x.change)));
  setHtml("sectorTable",rows.map((x,i)=>{
    const cls=x.change>0?"up":x.change<0?"down":"flat";
    const width=Math.max(6,Math.min(100,Math.abs(x.change)/maxAbs*100));
    const meta=x.meta?.delta_15m===null||x.meta?.delta_15m===undefined?"":` · ${esc(x.meta.momentum||"")} ${pct(x.meta.delta_15m)}`;
    return `<div class="sector-row ${cls}">
      <div class="sector-name"><b>${i+1}. ${esc(x.name)}</b><small>${esc(x.symbol)}${meta}</small></div>
      <div class="sector-bar"><i style="width:${width}%"></i></div>
      <strong>${pct(x.change)}</strong>
    </div>`;
  }).join(""));
}

function renderAlerts(mi){
  const alerts=Array.isArray(mi?.alerts)?mi.alerts:[];
  if(!alerts.length){
    setHtml("readerAlerts",`<div class="reader-alert"><b>Chưa có cảnh báo lớn</b><p>Tiếp tục theo dõi độ rộng, dòng tiền và nhóm dẫn dắt.</p></div>`);
    return;
  }
  setHtml("readerAlerts",alerts.map(a=>`<div class="reader-alert is-${tone(a?.level)}"><b>${esc(a?.title||"Lưu ý")}</b><p>${esc(a?.detail||"")}</p></div>`).join(""));
}

function renderBaseline(mi){
  const flow=mi?.flow||{};
  setText("currentGt",flow.value_b===null||flow.value_b===undefined?"—":`${fmtTrim(flow.value_b,1)} tỷ`);
  setText("sameTimeRatio",flow.same_time_ratio===null||flow.same_time_ratio===undefined?"Chưa đủ chuẩn":`${Math.round(Number(flow.same_time_ratio)*100)}%`);
  setText("paceRatio",flow.pace_ratio_15m===null||flow.pace_ratio_15m===undefined?"Chưa đủ nhịp":`${Math.round(Number(flow.pace_ratio_15m)*100)}%`);
  setText("baselineDays",`${flow.baseline_days||0}/${flow.baseline_target_days||20} phiên`);
  setText("baselineStatus",mi?.history?.same_time_baseline_ready?"Đã có chuẩn tối thiểu":"Đang tích lũy");
}

function render(data){
  const mi=data?.market_intelligence;
  if(!mi){
    const live=document.getElementById("readerLive");
    if(live)live.innerHTML="<i></i><span>Đang chờ bộ đọc thị trường…</span>";
    return;
  }
  renderLive(mi,data);
  renderState(mi);
  renderMetrics(data,mi);
  renderSectors(data,mi);
  renderAlerts(mi);
  renderBaseline(mi);
}

async function refresh(){
  try{
    const r=await fetch(ENDPOINT,{cache:"no-store"});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    render(await r.json());
  }catch(error){
    const live=document.getElementById("readerLive");
    if(live){live.className="reader-live is-danger";live.innerHTML="<i></i><span>Chưa cập nhật được dữ liệu</span>"}
  }
}

refresh();
setInterval(()=>{if(!document.hidden)refresh()},REFRESH_MS);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
