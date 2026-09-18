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
function summaryLine(title,text){
  return `<div class="sd-summary-item"><b>•</b><div><b>${esc(title)}:</b> ${esc(text)}</div></div>`;
}
function renderOverview(d){
  const t=d.technical||{}, f=d.flow||{}, b=d.fundamental||{}, sig=d.signals||[], ev=d.market_events||[];
  $("#overviewKpis").innerHTML=[
    metric("Giá đóng cửa",fmtNum(t.close),dateVN(d.effective_as_of_date)),
    metric("1 phiên",fmtPct(t.change_1d_pct),"So với phiên trước",cls(t.change_1d_pct)),
    metric("20 phiên",fmtPct(t.return_20d_pct),"Biến động 20 phiên",cls(t.return_20d_pct)),
    metric("RSI 14",fmtNum(t.rsi14),valid(t.rsi14)?(Number(t.rsi14)>=70?"Vùng cao":Number(t.rsi14)<=30?"Vùng thấp":"Trung tính"):""),
    metric("So MA20",valid(t.ma20)&&valid(t.close)?(Number(t.close)>Number(t.ma20)?"Trên MA20":"Dưới MA20"):"—",valid(t.ma20)?`MA20: ${fmtNum(t.ma20)}`:"",valid(t.ma20)&&valid(t.close)?(Number(t.close)>Number(t.ma20)?"up":"down"):""),
    metric("Flow ngoại 20P",fmtNum(f.window_20?.foreign_net_volume,0),"Khối lượng ròng",cls(f.window_20?.foreign_net_volume))
  ].join("");

  const lines=[];
  if(valid(t.close)){
    const pos=[];
    [["MA20",t.ma20],["MA50",t.ma50],["MA200",t.ma200]].forEach(([name,v])=>{if(valid(v))pos.push(`${Number(t.close)>Number(v)?"trên":"dưới"} ${name}`)});
    if(pos.length) lines.push(summaryLine("Vị trí giá",`Giá ${fmtNum(t.close)} đang ${pos.join(", ")}.`));
  }
  if(valid(t.return_5d_pct)||valid(t.return_20d_pct)||valid(t.return_60d_pct)){
    lines.push(summaryLine("Biến động",`5 phiên ${fmtPct(t.return_5d_pct)}, 20 phiên ${fmtPct(t.return_20d_pct)}, 60 phiên ${fmtPct(t.return_60d_pct)}.`));
  }
  if(f.window_20){
    const parts=[];
    if(valid(f.window_20.foreign_net_volume)) parts.push(`khối ngoại ${Number(f.window_20.foreign_net_volume)>=0?"mua":"bán"} ròng ${fmtNum(Math.abs(f.window_20.foreign_net_volume),0)} cp`);
    if(valid(f.window_20.proprietary_net_volume)) parts.push(`tự doanh ${Number(f.window_20.proprietary_net_volume)>=0?"mua":"bán"} ròng ${fmtNum(Math.abs(f.window_20.proprietary_net_volume),0)} cp`);
    if(parts.length) lines.push(summaryLine("Flow 20 phiên",parts.join("; ")+"."));
  }
  if(hasMeaningfulFundamental(b)){
    const parts=[];
    if(valid(b.return_on_equity))parts.push(`ROE ${fmtPct(b.return_on_equity)}`);
    if(valid(b.eps))parts.push(`EPS ${fmtNum(b.eps)}`);
    if(valid(b.pe))parts.push(`P/E ${fmtNum(b.pe)}`);
    if(valid(b.pb))parts.push(`P/B ${fmtNum(b.pb)}`);
    if(parts.length) lines.push(summaryLine("Cơ bản",parts.join(" · ")+"."));
  }
  if(sig.length) lines.push(summaryLine("Tín hiệu HT gần nhất",`${sig[0].signal_label||sig[0].signal_code||"Có tín hiệu"} ngày ${dateVN(sig[0].signal_date)}.`));
  if(ev.length) lines.push(summaryLine("Bối cảnh SK",`Có ${ev.length} sự kiện thị trường nằm trong vùng thời gian quanh ${dateVN(d.effective_as_of_date)}.`));

  $("#overviewHeading").textContent=`${d.symbol} tại ${dateVN(d.effective_as_of_date)}`;
  $("#overviewSummary").innerHTML=lines.length?lines.join(""):`<div class="sd-empty">Chưa đủ dữ liệu để tạo tóm tắt.</div>`;

  $("#overviewDeep").innerHTML=`
    <article class="sd-card"><div class="sd-card-head"><div><span>ĐIỂM CẦN NHÌN</span><h2>Kỹ thuật & Flow</h2></div></div>
      <div class="sd-grid">
        ${cell("Breakout 20D",t.breakout_20d===true?"Có":t.breakout_20d===false?"Chưa":"—")}
        ${cell("Breakdown 20D",t.breakdown_20d===true?"Có":t.breakdown_20d===false?"Chưa":"—")}
        ${cell("KL / TB20",valid(t.volume_vs_avg20)?fmtNum(t.volume_vs_avg20)+"x":"—")}
        ${cell("Ngoại 5P",fmtNum(f.window_5?.foreign_net_volume,0),"",cls(f.window_5?.foreign_net_volume))}
      </div>
    </article>
    <article class="sd-card"><div class="sd-card-head"><div><span>DỮ LIỆU ĐANG CÓ</span><h2>Độ phủ hồ sơ</h2></div></div>
      <div class="sd-grid">
        ${cell("D1",valid(t.bars_used)?fmtNum(t.bars_used,0)+" phiên":"—")}
        ${cell("Cơ bản",hasMeaningfulFundamental(b)?"Có":"Chưa đủ")}
        ${cell("Tín hiệu HT",String(sig.length))}
        ${cell("SK liên quan",String(ev.length))}
      </div>
    </article>`;
}
function renderTechnical(d){
 const t=d.technical||{};
 const arr=[
  ["Close",fmtNum(t.close)],["1 phiên",fmtPct(t.change_1d_pct)],["5 phiên",fmtPct(t.return_5d_pct)],["20 phiên",fmtPct(t.return_20d_pct)],
  ["60 phiên",fmtPct(t.return_60d_pct)],["MA10",fmtNum(t.ma10)],["MA20",fmtNum(t.ma20)],["MA50",fmtNum(t.ma50)],
  ["MA200",fmtNum(t.ma200)],["RSI14",fmtNum(t.rsi14)],["Đỉnh 20P trước",fmtNum(t.high20_prev)],["Đáy 20P trước",fmtNum(t.low20_prev)],
  ["Breakout 20D",t.breakout_20d===true?"Có":t.breakout_20d===false?"Chưa":"—"],["Breakdown 20D",t.breakdown_20d===true?"Có":t.breakdown_20d===false?"Chưa":"—"],
  ["KL TB20",fmtNum(t.avg_volume_20,0)],["KL / TB20",valid(t.volume_vs_avg20)?fmtNum(t.volume_vs_avg20)+"x":"—"]
 ];
 $("#technicalGrid").innerHTML=arr.map(([a,b])=>cell(a,b)).join("");
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
 $("#flowGrid").innerHTML=one("1 phiên",f.window_1)+one("5 phiên",f.window_5)+one("20 phiên",f.window_20);
}
function renderFundamental(d){
 const b=d.fundamental||{};
 $("#fundamentalDate").textContent=b.snapshot_date?`Snapshot ${dateVN(b.snapshot_date)}`:"";
 if(!hasMeaningfulFundamental(b)){
   $("#fundamentalGrid").innerHTML=`<div class="sd-empty" style="grid-column:1/-1">Mã này hiện chưa có đủ dữ liệu Cơ bản để phân tích. Hệ thống không diễn giải các giá trị 0 mặc định như dữ liệu thực.</div>`;
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
 $("#fundamentalGrid").innerHTML=have.length?have.map(([a,v])=>cell(a,typeof v==="number"?fmtNum(v):v)).join(""):`<div class="sd-empty" style="grid-column:1/-1">Mã này hiện chưa có đủ dữ liệu Cơ bản.</div>`;
}
function renderHistory(d){
 const sig=d.signals||[], ev=d.market_events||[];
 $("#signalList").innerHTML=sig.length?sig.slice(0,8).map(s=>{
  const outs=(s.outcomes||[]).map(o=>`<span class="sd-outcome">T+${esc(o.horizon_sessions)}: <b class="${cls(o.return_pct)}">${fmtPct(o.return_pct)}</b></span>`).join("");
  return `<div class="sd-list-item"><header><strong>${esc(s.signal_label||s.signal_code||"Tín hiệu")}</strong><time>${dateVN(s.signal_date)}</time></header>${s.reason?`<p>${esc(s.reason)}</p>`:""}<div class="sd-outcomes">${outs}</div></div>`;
 }).join(""):`<div class="sd-empty">Chưa có tín hiệu HT gần đây.</div>`;
 $("#eventList").innerHTML=ev.length?ev.map(e=>`<div class="sd-list-item"><header><strong>${esc(e.title)}</strong><time>${dateVN(e.event_date)}</time></header><p>${esc(e.summary||"")}</p><small>${esc(e.category||"SK")} · cách ngày đang xem ${Math.abs(Number(e.days_from_event||0))} ngày</small></div>`).join(""):`<div class="sd-empty">Không có SK trong cửa sổ thời gian hiện tại.</div>`;
}
function render(d){
 current=d;
 document.title=`${d.symbol} | Hồ sơ cổ phiếu | Võ Hoàng`;
 $("#symbolTitle").textContent=d.symbol;
 $("#symbolInput").value=d.symbol;
 $("#effectiveDate").textContent=`Dữ liệu đến ${dateVN(d.effective_as_of_date)}`;
 renderOverview(d);renderTechnical(d);renderFlow(d);renderFundamental(d);renderHistory(d);
 setStatus("");
}
async function load(symbol){
 const s=String(symbol||"").trim().toUpperCase();
 if(!/^[A-Z0-9]{2,12}$/.test(s)){setStatus("Mã cổ phiếu chưa hợp lệ.",true);return}
 setStatus("Đang đọc Stock Memory và tính chỉ số…");
 try{
  const url=`${SUPABASE_URL}/functions/v1/stock-metrics-v1?symbol=${encodeURIComponent(s)}`;
  const r=await fetch(url,{headers:{"Accept":"application/json"}});
  const body=await r.json();
  if(!r.ok||!body?.ok)throw new Error(body?.error||"Không đọc được dữ liệu");
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
