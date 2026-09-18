import { SUPABASE_URL } from "./supabase-client.js";

const $=(s)=>document.querySelector(s);
const fmtNum=(v,d=2)=>{
  if(v===null||v===undefined||v==="") return "—";
  const n=Number(v); if(!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:d}).format(n);
};
const fmtPct=(v)=>v===null||v===undefined||!Number.isFinite(Number(v))?"—":`${Number(v)>0?"+":""}${fmtNum(v,2)}%`;
const cls=(v)=>v===null||v===undefined?"":Number(v)>0?"up":Number(v)<0?"down":"";
const esc=(s)=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const dateVN=(v)=>{if(!v)return"—";const [y,m,d]=String(v).slice(0,10).split("-");return d&&m&&y?`${d}/${m}/${y}`:String(v)};
const MARKET_ENDPOINT="https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed";

let current=null;

function setStatus(text,error=false){
  const el=$("#pageStatus"); el.textContent=text||""; el.classList.toggle("show",!!text); el.classList.toggle("error",error);
}
function metric(label,value,sub="",tone=""){
  return `<div class="sd-kpi"><span>${esc(label)}</span><strong class="${tone}">${esc(value)}</strong><small>${esc(sub)}</small></div>`;
}
function cell(label,value,sub="",tone=""){
  return `<div class="sd-cell"><span>${esc(label)}</span><b class="${tone}">${esc(value)}</b>${sub?`<small>${esc(sub)}</small>`:""}</div>`;
}
function valid(v){return v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))}
function hasMeaningfulFundamental(b){
  if(!b||!Object.keys(b).length)return false;
  const core=[b.eps,b.book_value_per_share,b.sales_per_share,b.return_on_equity,b.return_on_assets,b.gross_profit_per_share,b.ebitda_per_share];
  return core.some(v=>valid(v)&&Number(v)!==0);
}
function summaryLine(title,text,tone=""){
  return `<div class="sd-summary-item ${tone}"><b>•</b><div><b>${esc(title)}:</b> ${esc(text)}</div></div>`;
}
function technicalInsight(t){
  if(!valid(t.close)) return null;
  const c=Number(t.close), m20=valid(t.ma20)?Number(t.ma20):null, m50=valid(t.ma50)?Number(t.ma50):null, m200=valid(t.ma200)?Number(t.ma200):null;
  if(m20!==null&&m50!==null&&m200!==null){
    if(c>m20&&c>m50&&c>m200) return ["Xu hướng","Giá đang nằm trên MA20, MA50 và MA200; cấu trúc giá hiện đồng thuận theo hướng tích cực.","positive"];
    if(c>m20&&c>m50&&c<m200) return ["Xu hướng","Giá đã đứng trên MA20 và MA50 nhưng vẫn dưới MA200; ngắn–trung hạn cải thiện, xu hướng dài hơn chưa xác nhận hoàn toàn.","watch"];
    if(c<m20&&c<m50&&c<m200) return ["Xu hướng","Giá đang dưới cả MA20, MA50 và MA200; cấu trúc hiện vẫn yếu và cần tín hiệu cải thiện trước khi nói đến xu hướng bền hơn.","negative"];
  }
  if(m20!==null) return ["Xu hướng",`Giá đang ${c>m20?"trên":"dưới"} MA20; đây là tín hiệu ngắn hạn, cần đặt cùng MA50/MA200 để đọc đầy đủ hơn.`,c>m20?"positive":"watch"];
  return null;
}
function momentumInsight(t){
  const r=valid(t.rsi14)?Number(t.rsi14):null, v=valid(t.volume_vs_avg20)?Number(t.volume_vs_avg20):null;
  const parts=[];
  let tone="";
  if(r!==null){
    if(r>=70){parts.push(`RSI14 ${fmtNum(r)} đang ở vùng cao; động lượng mạnh nhưng dư địa ngắn hạn không còn rộng như trước.`);tone="watch"}
    else if(r>=50){parts.push(`RSI14 ${fmtNum(r)} nằm trên 50, cho thấy động lượng hiện nghiêng tích cực.`);tone="positive"}
    else if(r<=30){parts.push(`RSI14 ${fmtNum(r)} ở vùng thấp; áp lực giảm đã lớn nhưng đây không tự động là tín hiệu tạo đáy.`);tone="negative"}
    else {parts.push(`RSI14 ${fmtNum(r)} dưới 50, động lượng hiện chưa mạnh.`);tone="watch"}
  }
  if(v!==null){
    if(v>=1.2) parts.push(`Khối lượng phiên gần nhất bằng ${fmtNum(v)}x trung bình 20 phiên, cho thấy mức tham gia cao hơn bình thường.`);
    else if(v<=0.8) parts.push(`Khối lượng chỉ bằng ${fmtNum(v)}x trung bình 20 phiên, nên tín hiệu giá hiện chưa có sự xác nhận mạnh từ thanh khoản.`);
  }
  return parts.length?["Động lượng & thanh khoản",parts.join(" "),tone]:null;
}
function flowInsight(f){
  const w5=f?.window_5||{}, w20=f?.window_20||{};
  const items=[];
  const build=(label,v5,v20)=>{
    if(!valid(v5)&&!valid(v20)) return;
    if(valid(v5)&&valid(v20)){
      const a=Number(v5),b=Number(v20);
      if(a>0&&b>0) items.push(`${label} đang mua ròng cả 5 và 20 phiên, dòng tiền có tính duy trì.`);
      else if(a<0&&b<0) items.push(`${label} đang bán ròng cả 5 và 20 phiên, áp lực chưa chỉ là một phiên đơn lẻ.`);
      else if(a>0&&b<0) items.push(`${label} 5 phiên chuyển sang mua ròng nhưng 20 phiên vẫn âm; có cải thiện ngắn hạn nhưng chưa đảo được bức tranh dài hơn.`);
      else if(a<0&&b>0) items.push(`${label} 5 phiên chuyển sang bán ròng trong khi 20 phiên vẫn dương; cần theo dõi đây là chốt lời ngắn hay thay đổi xu hướng dòng tiền.`);
    }else{
      const v=valid(v5)?Number(v5):Number(v20), n=valid(v5)?5:20;
      items.push(`${label} ${n} phiên đang ${v>=0?"mua":"bán"} ròng ${fmtNum(Math.abs(v),0)} cp.`);
    }
  };
  build("Khối ngoại",w5.foreign_net_volume,w20.foreign_net_volume);
  build("Tự doanh",w5.proprietary_net_volume,w20.proprietary_net_volume);
  if(!items.length) return null;
  return ["Dòng tiền",items.join(" "),""];
}
function fundamentalInsight(b){
  if(!hasMeaningfulFundamental(b)) return ["Cơ bản","Hiện chưa đủ dữ liệu Cơ bản đáng tin cậy để hệ thống diễn giải; phần này được để trống thay vì suy đoán.","watch"];
  const parts=[];
  if(valid(b.return_on_equity)) parts.push(`ROE hiện ${fmtPct(b.return_on_equity)}`);
  if(valid(b.profit_margin)) parts.push(`biên lợi nhuận ${fmtPct(b.profit_margin)}`);
  if(valid(b.qtrly_revenue_growth)) parts.push(`tăng trưởng doanh thu quý ${fmtPct(b.qtrly_revenue_growth)}`);
  if(valid(b.qtrly_earnings_growth)) parts.push(`tăng trưởng lợi nhuận quý ${fmtPct(b.qtrly_earnings_growth)}`);
  const val=[];
  if(valid(b.pe)) val.push(`P/E ${fmtNum(b.pe)}`);
  if(valid(b.pb)) val.push(`P/B ${fmtNum(b.pb)}`);
  let text=parts.length?parts.join(" · ")+".":"Có snapshot Cơ bản nhưng số liệu hoạt động còn hạn chế.";
  if(val.length) text+=` Định giá đang ghi nhận ${val.join(" · ")}; chưa nên gọi là rẻ/đắt nếu chưa đặt cạnh lịch sử và doanh nghiệp cùng ngành.`;
  return ["Cơ bản",text,""];
}
function signalInsight(sig){
  if(!sig?.length) return null;
  const s=sig[0], outs=Array.isArray(s.outcomes)?s.outcomes:[];
  let text=`Tín hiệu gần nhất là ${s.signal_label||s.signal_code||"tín hiệu kỹ thuật"} ngày ${dateVN(s.signal_date)}.`;
  const settled=outs.filter(o=>valid(o.return_pct));
  if(settled.length){
    text+= " Kết quả lịch sử đã ghi nhận: "+settled.slice(0,4).map(o=>`T+${o.horizon_sessions} ${fmtPct(o.return_pct)}`).join(" · ")+". Đây là kết quả sau tín hiệu đã xảy ra, không phải dự báo.";
  }
  return ["Tín hiệu HT",text,""];
}
function eventInsight(ev,d){
  if(!ev?.length) return null;
  const nearest=[...ev].sort((a,b)=>Math.abs(Number(a.days_from_event||0))-Math.abs(Number(b.days_from_event||0)))[0];
  return ["Bối cảnh sự kiện",`Có ${ev.length} SK trong cửa sổ quanh ${dateVN(d.effective_as_of_date)}; gần nhất: “${nearest.title}” (${dateVN(nearest.event_date)}). SK chỉ là bối cảnh, không mặc định là nguyên nhân biến động giá.`,""];
}
function renderOverview(d){
  const t=d.technical||{}, f=d.flow||{}, b=d.fundamental||{}, sig=d.signals||[], ev=d.market_events||[], q=d.live_quote||null;
  $("#overviewKpis").innerHTML=[
    metric("Giá đóng cửa",fmtNum(t.close),dateVN(d.effective_as_of_date)),
    metric("Giá hiện tại",q&&valid(q.price)?fmtNum(q.price):"—",q&&valid(q.change_pct)?fmtPct(q.change_pct):"Chưa có intraday",q&&valid(q.change_pct)?cls(q.change_pct):""),
    metric("20 phiên",fmtPct(t.return_20d_pct),"",cls(t.return_20d_pct)),
    metric("RSI14",fmtNum(t.rsi14),valid(t.rsi14)?(Number(t.rsi14)>=70?"Vùng cao":Number(t.rsi14)>=50?"Trên 50":Number(t.rsi14)<=30?"Vùng thấp":"Dưới 50"):""),
    metric("MA20",valid(t.ma20)&&valid(t.close)?(Number(t.close)>Number(t.ma20)?"Trên":"Dưới"):"—",valid(t.ma20)?fmtNum(t.ma20):"",valid(t.ma20)&&valid(t.close)?(Number(t.close)>Number(t.ma20)?"up":"down"):""),
    metric("Ngoại 20P",fmtNum(f.window_20?.foreign_net_volume,0),"cp ròng",cls(f.window_20?.foreign_net_volume))
  ].join("");

  const insights=[
    technicalInsight(t),
    momentumInsight(t),
    flowInsight(f),
    fundamentalInsight(b),
    signalInsight(sig),
    eventInsight(ev,d)
  ].filter(Boolean);

  $("#overviewHeading").textContent="";
  $("#overviewSummary").innerHTML=insights.map(x=>summaryLine(x[0],x[1],x[2])).join("");

  $("#overviewDeep").innerHTML=`
    <article class="sd-card sd-compact-card"><div class="sd-card-head"><div><span>CHỈ BÁO XÁC NHẬN</span><h2>Kỹ thuật & Flow</h2></div></div>
      <div class="sd-grid">
        ${cell("Breakout 20D",t.breakout_20d===true?"Có":t.breakout_20d===false?"Chưa":"—")}
        ${cell("Breakdown 20D",t.breakdown_20d===true?"Có":t.breakdown_20d===false?"Chưa":"—")}
        ${cell("KL / TB20",valid(t.volume_vs_avg20)?fmtNum(t.volume_vs_avg20)+"x":"—")}
        ${cell("Ngoại 5P",fmtNum(f.window_5?.foreign_net_volume,0),"",cls(f.window_5?.foreign_net_volume))}
      </div>
    </article>
    <article class="sd-card sd-compact-card"><div class="sd-card-head"><div><span>ĐỘ PHỦ DỮ LIỆU</span><h2>Hệ thống đang biết gì</h2></div></div>
      <div class="sd-grid">
        ${cell("D1",valid(t.bars_used)?fmtNum(t.bars_used,0)+" phiên":"—")}
        ${cell("Cơ bản",hasMeaningfulFundamental(b)?"Có":"Chưa đủ")}
        ${cell("HT",String(sig.length))}
        ${cell("SK",String(ev.length))}
      </div>
    </article>`;
}
function renderTechnical(d){
 const t=d.technical||{};
 const q=d.live_quote||null;
 const arr=[
  ["Close D1",fmtNum(t.close)],["Giá hiện tại",q&&valid(q.price)?fmtNum(q.price):"—",q&&valid(q.change_pct)?fmtPct(q.change_pct):"Chưa có intraday"],["5 phiên",fmtPct(t.return_5d_pct)],[ "20 phiên",fmtPct(t.return_20d_pct)],
  ["60 phiên",fmtPct(t.return_60d_pct)],["MA10",fmtNum(t.ma10)],["MA20",fmtNum(t.ma20)],["MA50",fmtNum(t.ma50)],
  ["MA200",fmtNum(t.ma200)],["RSI14",fmtNum(t.rsi14)],["Đỉnh 20P trước",fmtNum(t.high20_prev)],["Đáy 20P trước",fmtNum(t.low20_prev)],
  ["Breakout 20D",t.breakout_20d===true?"Có":t.breakout_20d===false?"Chưa":"—"],["Breakdown 20D",t.breakdown_20d===true?"Có":t.breakdown_20d===false?"Chưa":"—"],
  ["KL TB20",fmtNum(t.avg_volume_20,0)],["KL / TB20",valid(t.volume_vs_avg20)?fmtNum(t.volume_vs_avg20)+"x":"—"]
 ];
 const insight=[technicalInsight(t),momentumInsight(t)].filter(Boolean);
 $("#technicalGrid").innerHTML=arr.map(([a,b])=>cell(a,b)).join("")+
   (insight.length?`<div class="sd-analysis" style="grid-column:1/-1"><b>Hệ thống đọc:</b> ${insight.map(x=>esc(x[1])).join(" ")}</div>`:"");
}
function renderFlow(d){
 const f=d.flow||{};
 const one=(label,w)=>`<div class="sd-flow-card"><h3>${label}</h3>
   <div class="sd-flow-row"><span>Khối ngoại</span><b class="${cls(w?.foreign_net_volume)}">${fmtNum(w?.foreign_net_volume,0)}</b></div>
   <div class="sd-flow-row"><span>Tự doanh</span><b class="${cls(w?.proprietary_net_volume)}">${fmtNum(w?.proprietary_net_volume,0)}</b></div>
   <div class="sd-flow-row"><span>Chủ động mua/bán</span><b class="${cls(w?.active_net_volume)}">${fmtNum(w?.active_net_volume,0)}</b></div>
   <div class="sd-flow-row"><span>Dư mua - dư bán</span><b class="${cls(w?.bid_ask_surplus_net_volume)}">${fmtNum(w?.bid_ask_surplus_net_volume,0)}</b></div>
   <div class="sd-flow-row"><span>Số phiên có dữ liệu</span><b>${fmtNum(w?.rows_available,0)}</b></div>
 </div>`;
 const fi=flowInsight(f);
 $("#flowGrid").innerHTML=one("1 phiên",f.window_1)+one("5 phiên",f.window_5)+one("20 phiên",f.window_20)+
   (fi?`<div class="sd-analysis" style="grid-column:1/-1"><b>Hệ thống đọc:</b> ${esc(fi[1])}</div>`:"");
}
function renderFundamental(d){
 const b=d.fundamental||{};
 $("#fundamentalDate").textContent=b.snapshot_date?`Snapshot ${dateVN(b.snapshot_date)}`:"";
 if(!hasMeaningfulFundamental(b)){
   $("#fundamentalGrid").innerHTML=`<div class="sd-empty" style="grid-column:1/-1">Mã này hiện chưa có đủ dữ liệu Cơ bản để phân tích. Hệ thống không diễn giải các giá trị 0 mặc định như dữ liệu thực.</div><div class="sd-analysis" style="grid-column:1/-1"><b>Hệ thống đọc:</b> Chưa đủ dữ liệu đáng tin cậy nên không tạo kết luận Cơ bản cho mã này.</div>`;
   return;
 }
 const fields=[
  ["EPS",b.eps],["BVPS",b.book_value_per_share],["Sales/share",b.sales_per_share],["ROE",valid(b.return_on_equity)?fmtPct(b.return_on_equity):null],
  ["ROA",valid(b.return_on_assets)?fmtPct(b.return_on_assets):null],["P/E",b.pe],["P/B",b.pb],["P/S",b.ps],
  ["Forward P/E",b.forward_pe],["P/CF",b.p_cf],["PEG",b.peg_ratio],["Beta",b.beta],
  ["Profit margin",valid(b.profit_margin)?fmtPct(b.profit_margin):null],["Operating margin",valid(b.operating_margin)?fmtPct(b.operating_margin):null],
  ["Tăng DT quý",valid(b.qtrly_revenue_growth)?fmtPct(b.qtrly_revenue_growth):null],["Tăng LN quý",valid(b.qtrly_earnings_growth)?fmtPct(b.qtrly_earnings_growth):null],
  ["Gross profit/share",b.gross_profit_per_share],["EBITDA/share",b.ebitda_per_share],["Operating cash flow",b.operating_cash_flow],["Levered FCF",b.levered_free_cash_flow],
  ["Shares out",b.shares_out],["Shares float",b.shares_float],["Insider %",valid(b.insider_hold_percent)?fmtPct(b.insider_hold_percent):null],["Institution %",valid(b.institution_hold_percent)?fmtPct(b.institution_hold_percent):null]
 ];
 const have=fields.filter(([,v])=>v!==null&&v!==undefined&&v!==""&&v!=="—");
 const fi=fundamentalInsight(b);
 $("#fundamentalGrid").innerHTML=(have.length?have.map(([a,v])=>cell(a,typeof v==="number"?fmtNum(v):v)).join(""):`<div class="sd-empty" style="grid-column:1/-1">Mã này hiện chưa có đủ dữ liệu Cơ bản.</div>`)+
   (fi?`<div class="sd-analysis" style="grid-column:1/-1"><b>Hệ thống đọc:</b> ${esc(fi[1])}</div>`:"");
}
function renderHistory(d){
 const sig=d.signals||[], ev=d.market_events||[];
 $("#signalList").innerHTML=sig.length?sig.slice(0,8).map(s=>{
  const outs=(s.outcomes||[]).map(o=>`<span class="sd-outcome">T+${esc(o.horizon_sessions)}: <b class="${cls(o.return_pct)}">${fmtPct(o.return_pct)}</b></span>`).join("");
  return `<div class="sd-list-item"><header><strong>${esc(s.signal_label||s.signal_code||"Tín hiệu")}</strong><time>${dateVN(s.signal_date)}</time></header>${s.reason?`<p>${esc(s.reason)}</p>`:""}<div class="sd-outcomes">${outs}</div></div>`;
 }).join(""):`<div class="sd-empty">Chưa có tín hiệu HT gần đây.</div>`;
 $("#eventList").innerHTML=ev.length?ev.map(e=>`<div class="sd-list-item"><header><strong>${esc(e.title)}</strong><time>${dateVN(e.event_date)}</time></header><p>${esc(e.summary||"")}</p><small>${esc(e.category||"SK")} · cách ngày đang xem ${Math.abs(Number(e.days_from_event||0))} ngày</small></div>`).join(""):`<div class="sd-empty">Không có SK trong cửa sổ thời gian hiện tại.</div>`;
 const si=signalInsight(sig), ei=eventInsight(ev,d);
 if(si) $("#signalList").insertAdjacentHTML("beforeend",`<div class="sd-analysis"><b>Hệ thống đọc:</b> ${esc(si[1])}</div>`);
 if(ei) $("#eventList").insertAdjacentHTML("beforeend",`<div class="sd-analysis"><b>Hệ thống đọc:</b> ${esc(ei[1])}</div>`);
}
function render(d){
 current=d;
 document.title=`${d.symbol} | Hồ sơ cổ phiếu | Võ Hoàng`;
 $("#symbolTitle").textContent=d.symbol;
 $("#symbolInput").value=d.symbol;
 $("#effectiveDate").textContent="";
 renderOverview(d);renderTechnical(d);renderFlow(d);renderFundamental(d);renderHistory(d);
 setStatus("");
}
async function fetchLiveQuote(symbol){
 try{
  const r=await fetch(`${MARKET_ENDPOINT}?_=${Date.now()}`,{cache:"no-store",headers:{"Accept":"application/json"}});
  if(!r.ok)return null;
  const data=await r.json();
  const rows=Array.isArray(data?.vn30_stocks)?data.vn30_stocks:[];
  const row=rows.find(x=>String(x?.symbol||"").toUpperCase()===symbol);
  if(!row)return null;
  const price=Number(row.close), changePct=Number(row.change_pct);
  return {
    price:Number.isFinite(price)?price:null,
    change_pct:Number.isFinite(changePct)?changePct:null,
    date:row.date||null,
    source:data.vn30_stock_source||"market-feed"
  };
 }catch{return null}
}

async function load(symbol){
 const s=String(symbol||"").trim().toUpperCase();
 if(!/^[A-Z0-9]{2,12}$/.test(s)){setStatus("Mã cổ phiếu chưa hợp lệ.",true);return}
 setStatus("Đang đọc Stock Memory và tính chỉ số…");
 try{
  const url=`${SUPABASE_URL}/functions/v1/stock-metrics-v1?symbol=${encodeURIComponent(s)}`;
  const [r,liveQuote]=await Promise.all([
    fetch(url,{headers:{"Accept":"application/json"}}),
    fetchLiveQuote(s)
  ]);
  const body=await r.json();
  if(!r.ok||!body?.ok)throw new Error(body?.error||"Không đọc được dữ liệu");
  body.data.live_quote=liveQuote;
  render(body.data);
  history.replaceState({}, "", `stock-detail.html?symbol=${encodeURIComponent(s)}`);
 }catch(err){setStatus(err?.message==="SYMBOL_NOT_ACTIVE_CORE"?"Mã này chưa nằm trong 165 mã Core hiện tại.":"Chưa đọc được dữ liệu mã này. Vui lòng thử lại.",true)}
}
document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
 document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===btn));
 document.querySelectorAll("[data-panel]").forEach(x=>x.classList.toggle("active",x.dataset.panel===btn.dataset.tab));
 window.scrollTo({top:Math.max(0,$(".sd-tabs").offsetTop-86),behavior:"smooth"});
}));
$("#loadSymbol").addEventListener("click",()=>load($("#symbolInput").value));
$("#symbolInput").addEventListener("keydown",e=>{if(e.key==="Enter")load(e.currentTarget.value)});
const initial=(new URLSearchParams(location.search).get("symbol")||"FPT").toUpperCase();
load(initial);
