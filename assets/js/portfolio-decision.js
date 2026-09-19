import { supabaseClient } from "./supabase-client.js";

const ENDPOINT="https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/portfolio-decision-public";
const DRAFT_KEY="vh_portfolio_decision_draft_v1";
const MAX_ROWS=20;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>{if(v===null||v===undefined||String(v).trim()==="")return null;const x=Number(v);return Number.isFinite(x)?x:null};
const fmt=(v,d=2)=>num(v)===null?"—":new Intl.NumberFormat("vi-VN",{maximumFractionDigits:d}).format(Number(v));
const pct=(v,d=1)=>num(v)===null?"—":fmt(v,d)+"%";
const stamp=v=>{if(!v)return"—";try{return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",hour12:false}).format(new Date(v))}catch{return"—"}};
const moveClass=v=>num(v)>0?"pf-up":num(v)<0?"pf-down":"pf-flat";
const stateClass=s=>String(s||"UNKNOWN").toLowerCase();

function message(text="",tone=""){
  const el=$("#formMessage"); if(!el)return;
  el.textContent=text; el.className="pf-message"+(tone?" "+tone:"");
}
function rowHtml(d={}){
  return '<div class="pf-position-row">'+
    '<input class="pf-symbol" data-field="symbol" maxlength="3" autocomplete="off" placeholder="VCB" value="'+esc(d.symbol||"")+'" aria-label="Mã cổ phiếu">'+
    '<input data-field="weight" type="number" min="0" max="100" step="0.1" inputmode="decimal" placeholder="25" value="'+esc(d.weight??"")+'" aria-label="Tỷ trọng phần trăm">'+
    '<input class="pf-cost" data-field="avg" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Không bắt buộc" value="'+esc(d.avg??"")+'" aria-label="Giá vốn">'+
    '<button class="pf-remove" type="button" data-remove aria-label="Xóa dòng">×</button></div>';
}
function addRow(d={}){
  const list=$("#positionList"); if(!list||$$(".pf-position-row",list).length>=MAX_ROWS)return;
  list.insertAdjacentHTML("beforeend",rowHtml(d));
}
function ensureRows(){if(!$$(".pf-position-row",$("#positionList")).length){addRow();addRow();addRow();addRow()}}
function serialize(){
  return {
    positions:$$(".pf-position-row",$("#positionList")).map(row=>({
      symbol:($('[data-field="symbol"]',row)?.value||"").trim().toUpperCase(),
      weight:$('[data-field="weight"]',row)?.value??"",
      avg:$('[data-field="avg"]',row)?.value??""
    })),
    cash:$("#cashPct")?.value??"",
    margin:$("#marginPct")?.value??"",
    accountChange:$("#accountChange")?.value??"",
    saveHistory:Boolean($("#saveHistory")?.checked)
  };
}
function saveDraft(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify(serialize()))}catch{}}
function loadDraft(){
  let d=null;try{d=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null")}catch{}
  const rows=Array.isArray(d?.positions)?d.positions.filter(x=>x?.symbol||x?.weight||x?.avg):[];
  if(rows.length)rows.slice(0,MAX_ROWS).forEach(addRow);else ensureRows();
  if(d?.cash!==undefined&&$("#cashPct"))$("#cashPct").value=d.cash;
  if(d?.margin!==undefined&&$("#marginPct"))$("#marginPct").value=d.margin;
  if(d?.accountChange!==undefined&&$("#accountChange"))$("#accountChange").value=d.accountChange;
  if(d?.saveHistory!==undefined&&$("#saveHistory"))$("#saveHistory").checked=Boolean(d.saveHistory);
}
function inputPayload(){
  const raw=serialize(),seen=new Set(),positions=[];
  for(const row of raw.positions){
    const symbol=String(row.symbol||"").trim().toUpperCase(),weight=num(row.weight),avg=num(row.avg);
    if(!symbol&&!row.weight&&!row.avg)continue;
    if(!/^[A-Z]{3}$/.test(symbol))throw new Error('Mã "'+(symbol||"trống")+'" chưa đúng định dạng 3 ký tự.');
    if(seen.has(symbol))throw new Error(symbol+" đang xuất hiện hai lần. Hãy gộp về một dòng.");
    seen.add(symbol);
    if(weight===null||weight<=0||weight>100)throw new Error("Tỷ trọng "+symbol+" phải lớn hơn 0% và không vượt 100%.");
    if(avg!==null&&avg<=0)throw new Error("Giá vốn "+symbol+" phải lớn hơn 0 hoặc để trống.");
    positions.push({symbol:symbol,weight_pct:weight,avg_price:avg});
  }
  const cash=num(raw.cash),margin=num(raw.margin),accountChange=num(raw.accountChange);
  if(cash!==null&&(cash<0||cash>100))throw new Error("Tiền mặt phải nằm trong 0–100%.");
  if(margin!==null&&(margin<0||margin>=100))throw new Error("Nợ margin / tổng tài sản phải từ 0% đến dưới 100%.");
  const stockSum=positions.reduce((a,x)=>a+x.weight_pct,0);
  const effectiveCash=cash===null?Math.max(0,100-stockSum):cash;
  if(stockSum+effectiveCash>102)throw new Error("Tổng tỷ trọng đang khoảng "+fmt(stockSum+effectiveCash,1)+"%. Hãy kiểm tra lại.");
  return {positions:positions,cash_pct:cash,margin_pct:margin??0,account_change_pct:accountChange};
}
function setLoading(on){
  const b=$("#analyzeBtn");if(!b)return;b.disabled=on;b.textContent=on?"ĐANG HỢP NHẤT DỮ LIỆU…":"PHÂN TÍCH DANH MỤC →";
}
function freshClass(code){if(code==="LIVE")return"live";if(["DELAYED","LAST_SESSION","PAUSED","CLOSE"].includes(code))return"warn";if(code==="STALE")return"bad";return""}
function renderSource(d){
  const c=d.context||{},f=c.market_freshness||{},root=$("#sourceStrip");if(!root)return;
  root.innerHTML='<span class="pf-dot '+freshClass(f.code)+'"></span><b>'+esc(f.label||"Chưa xác định")+'</b>'+
    '<span>Thị trường: '+esc(c.market_date||"—")+'</span><span>·</span>'+
    '<span>'+(c.tplus_usable?"T+ cùng phiên":"T+ không dùng cho phiên này")+'</span><span>·</span>'+
    '<span>MARKET → SECTOR → STOCK → PORTFOLIO → ACTION</span>';
}
function renderExec(d){
  const p=d.portfolio||{},m=d.market||{},c=d.confidence||{},score=num(p.portfolio_score),pre=Boolean(c.preliminary),alpha=num(p.account_alpha);
  $("#scoreRing").style.setProperty("--score-pct",(score??0)+"%");$("#scoreNum").textContent=score===null?"—":Math.round(score);
  $("#scoreState").textContent=pre?"ĐÁNH GIÁ SƠ BỘ":(p.portfolio_state||"CHƯA ĐỦ DỮ LIỆU");
  $("#execTitle").textContent=pre?"Chưa đủ dữ liệu để kết luận sâu.":"Danh mục hiện tại: "+String(p.portfolio_state||"đang được đánh giá").toLowerCase()+".";
  $("#execSummary").textContent=alpha===null?(p.main_strength||"Hệ thống đang đọc vị trí danh mục trong thị trường hiện tại."):(alpha>=0?"Danh mục đang tốt hơn VN-Index "+fmt(alpha,2)+" điểm %. ":"Danh mục đang kém VN-Index "+fmt(Math.abs(alpha),2)+" điểm %. ")+(alpha>=0?(p.main_strength||""):(p.main_risk||""));
  $("#metricMarket").textContent=num(m.market_score)===null?"—":Math.round(m.market_score);
  $("#metricPortfolio").textContent=score===null?"—":Math.round(score);
  $("#metricFit").textContent=num(p.market_fit_score)===null?"—":Math.round(p.market_fit_score);
  $("#metricRisk").textContent=num(p.risk_score)===null?"—":Math.round(p.risk_score);
  $("#keyMessage").textContent=[p.main_strength,p.main_risk].filter(Boolean).join(" ");
  $("#priorityAction").textContent=p.priority_action||"Chưa đủ dữ liệu để xác định việc cần ưu tiên.";
  $("#confidenceInline").textContent="Độ tin cậy "+(c.label||"—")+(num(c.score)!==null?" · "+Math.round(c.score)+"/100":"");
}
function allocationBox(label,value,tone){
  return '<div class="pf-state-box '+tone+'"><span>'+esc(label)+'</span><b>'+pct(value)+'</b></div>';
}
function renderAllocation(d){
  const p=d.portfolio||{};
  $("#allocationGrid").innerHTML=[
    allocationBox("Dẫn dắt",p.leading_weight,"good"),allocationBox("Khỏe",p.strong_weight,"good"),
    allocationBox("Giữ cấu trúc",p.holding_weight,"neutral"),allocationBox("Theo dõi",p.watch_weight,"warn"),
    allocationBox("Suy yếu",p.weakening_weight,"bad"),allocationBox("Rủi ro",p.risk_weight,"bad"),
    allocationBox("Chưa đủ dữ liệu",p.unknown_weight,"neutral"),allocationBox("Tiền mặt",p.cash_weight,"neutral")
  ].join("");
}
function fitItem(label,value,note=""){return '<div class="pf-fit-item"><span>'+esc(label)+'</span><b>'+value+'</b>'+(note?'<em>'+esc(note)+'</em>':"")+'</div>'}
function renderFit(d){
  const p=d.portfolio||{},m=d.market||{},alpha=num(p.account_alpha);
  $("#fitGrid").innerHTML=[
    fitItem("Vốn mạnh hơn VN-Index",pct(p.stronger_than_vnindex_weight)),
    fitItem("Vốn trong ngành mạnh",pct(p.strong_sector_weight)),
    fitItem("Mã trùng danh sách T+",num(p.tplus_symbol_coverage)===null?"Chưa dùng":pct(p.tplus_symbol_coverage),d.context?.tplus_usable?"Theo số mã đang giữ":"Nguồn không cùng phiên"),
    fitItem("Vốn thuộc T+",num(p.tplus_capital_coverage)===null?"Chưa dùng":pct(p.tplus_capital_coverage),d.context?.tplus_usable?"Theo tỷ trọng vốn":"Nguồn không cùng phiên"),
    fitItem("Vốn gần kháng cự",pct(p.near_resistance_weight)),
    fitItem("Vốn yếu hơn thị trường",pct(p.weaker_than_market_weight)),
    fitItem("Account Alpha",alpha===null?"Chưa đủ dữ liệu":(alpha>0?"+":"")+fmt(alpha,2)+" điểm %"),
    fitItem("VN-Index",(num(m.vnindex_change_pct)>0?"+":"")+pct(m.vnindex_change_pct,2)),
    fitItem("Market Score",num(m.market_score)===null?"—":Math.round(m.market_score)+"/100"),
    fitItem("Trạng thái thị trường",m.market_state||"—"),
    fitItem("Độ rộng",m.breadth?.label||"—",num(m.breadth?.adv)!==null&&num(m.breadth?.dec)!==null?fmt(m.breadth.adv,0)+" tăng · "+fmt(m.breadth.dec,0)+" giảm":""),
    fitItem("Thanh khoản",m.flow?.label||"—",num(m.flow?.value_b)!==null?fmt(m.flow.value_b,1)+" tỷ":""),
    ...(m.leading_sectors?.[0]?[fitItem("Nhóm đang hỗ trợ",m.leading_sectors[0].name||m.leading_sectors[0].key||"—",pct(m.leading_sectors[0].change_pct,2))]:[]),
    ...(m.weak_sectors?.[0]?[fitItem("Nhóm đang gây áp lực",m.weak_sectors[0].name||m.weak_sectors[0].key||"—",pct(m.weak_sectors[0].change_pct,2))]:[]),
    ...(m.morning_context?.macro_regime?[fitItem("Bối cảnh sáng nay",m.morning_context.macro_regime,"Morning Decision Brain")]:[])
  ].join("");
  const drivers=Array.isArray(p.score_drivers)?p.score_drivers:[],model=p.score_model||{};
  const modelNote=model?.portfolio_score?'<div class="pf-driver"><b>Cách tính có thể truy ngược:</b> Market Fit 45% · chất lượng vốn 35% · sức chịu rủi ro 20%. Trong Market Fit: sức mạnh tương đối 35% · đồng pha ngành 25% · cấu trúc MA 30% · T+ 10%. Thành phần thiếu dữ liệu được bỏ khỏi mẫu số, không tự điền.</div>':'';
  $("#scoreDrivers").innerHTML=(drivers.length?drivers.map(x=>'<div class="pf-driver '+esc(x.tone||"")+'">'+esc(x.text)+'</div>').join(""):'<div class="pf-driver">Chưa có đủ yếu tố để giải thích điểm số sâu hơn.</div>')+modelNote;
}
function levelText(x){return x&&num(x.value)!==null?esc(x.label||"Vùng")+" "+fmt(x.value,2):"Chưa đủ dữ liệu"}
function maText(t){
  if(!t)return"Chưa đủ dữ liệu";
  const a=[["MA10",t.above_ma10],["MA20",t.above_ma20],["MA50",t.above_ma50]],up=a.filter(x=>x[1]===true).map(x=>x[0]),down=a.filter(x=>x[1]===false).map(x=>x[0]);
  if(up.length===3)return"Trên MA10/20/50";
  return [up.length?"Trên "+up.join("/"):"",down.length?"Dưới "+down.join("/"):""].filter(Boolean).join(" · ")||"Chưa đủ dữ liệu";
}
function renderPositions(d){
  const rows=Array.isArray(d.positions)?d.positions:[],out=$("#positionCards");
  if(!rows.length){out.innerHTML='<div class="pf-empty" style="min-height:150px"><div><strong>Chưa có danh mục.</strong>Thị trường vẫn được đọc, nhưng chưa thể kết luận sâu về tài khoản.</div></div>';return}
  out.innerHTML=rows.map(x=>{
    const mv=num(x.change_pct),t=x.technical||{},reasons=Array.isArray(x.state_reasons)?x.state_reasons.join(" "):"",tplus=x.tplus_flag?'<span class="pf-badge leading">T+</span>':"";
    return '<article class="pf-stock-card"><div class="pf-stock-head"><div class="pf-symbol-line"><strong>'+esc(x.symbol)+'</strong>'+
      '<span class="pf-badge '+stateClass(x.stock_state)+'">'+esc(x.stock_state_label||"CHƯA ĐỦ DỮ LIỆU")+'</span>'+tplus+
      '</div><div class="pf-stock-price"><b>'+fmt(x.price,2)+'</b><small class="'+moveClass(mv)+'">'+(mv===null?"—":(mv>0?"+":"")+pct(mv,2))+'</small></div></div>'+
      '<div class="pf-stock-body"><div class="pf-stock-facts">'+
      '<div class="pf-fact"><span>Tỷ trọng</span><b>'+pct(x.weight_pct)+'</b></div>'+
      '<div class="pf-fact"><span>Ngành</span><b>'+esc(x.sector||"Chưa phân nhóm")+(num(x.sector_change_pct)!==null?" · "+pct(x.sector_change_pct,2):"")+'</b></div>'+
      '<div class="pf-fact"><span>So VN-Index</span><b class="'+moveClass(x.market_relative_strength)+'">'+(num(x.market_relative_strength)===null?"—":(num(x.market_relative_strength)>0?"+":"")+fmt(x.market_relative_strength,2)+" điểm %")+'</b></div>'+
      '<div class="pf-fact"><span>Cấu trúc</span><b>'+esc(maText(t))+'</b></div>'+
      '<div class="pf-fact"><span>Hỗ trợ gần</span><b>'+levelText(x.nearest_support)+'</b></div>'+
      '<div class="pf-fact"><span>Kháng cự gần</span><b>'+levelText(x.nearest_resistance)+'</b></div>'+
      '<div class="pf-fact"><span>Stock Score</span><b>'+(num(x.stock_score)===null?"—":Math.round(x.stock_score)+"/100")+'</b></div>'+
      '<div class="pf-fact"><span>Độ tin cậy</span><b>'+esc(x.data_confidence?.label||"—")+'</b></div></div>'+
      '<div class="pf-stock-note"><b>Đánh giá:</b> '+esc(reasons||"Chưa đủ dữ liệu để giải thích trạng thái.")+'</div>'+
      '<div class="pf-stock-note"><b>Với vị thế đang có:</b> '+esc(x.holding_action||"Chưa đủ dữ liệu.")+'</div>'+
      '<div class="pf-stock-note"><b>Điều kiện xấu đi:</b> '+esc(x.deterioration_condition||"Chưa đủ dữ liệu.")+'</div>'+
      '<div class="pf-stock-actions"><small>'+esc(x.price_source==="LIVE_CURRENT"?"Giá current từ Stock Price Live":x.price_source==="D1"?"Giá D1 gần nhất":"Chưa có nguồn giá")+(x.price_updated_at?" · "+stamp(x.price_updated_at):"")+'</small>'+
      '<a class="pf-detail-link" href="stock-detail.html?symbol='+encodeURIComponent(x.symbol)+'">Xem phân tích chi tiết →</a></div></div></article>';
  }).join("");
}
function renderEventsNews(d){
  const ev=Array.isArray(d.events)?d.events:[],nw=Array.isArray(d.news)?d.news:[];
  $("#eventList").innerHTML=ev.length?ev.map(x=>'<article class="pf-event"><header><b>'+esc(x.title)+'</b><time>'+stamp(x.detected_at)+'</time></header><p>'+esc((x.related_symbols||[]).join(" · "))+(x.severity?" · Mức "+esc(x.severity):"")+'</p></article>').join(""):'<div class="pf-note">Không có sự kiện đủ quan trọng và đủ liên quan trực tiếp tới danh mục trong dữ liệu hiện tại.</div>';
  $("#newsList").innerHTML=nw.length?nw.map(x=>'<article class="pf-news"><header><b>'+esc(x.title)+'</b><time>'+stamp(x.last_seen_at)+'</time></header><p>'+pct(x.capital_coverage_pct)+' danh mục liên quan · '+esc((x.related_symbols||[]).join(", "))+' · '+esc(x.market_confirmation?.status||"Chưa có xác nhận giá")+'</p></article>').join(""):'<div class="pf-note">Không có tin đã qua bộ lọc xác minh liên quan trực tiếp tới các mã/ngành đang giữ. Hệ thống không tự điền tin.</div>';
}
function renderRiskStress(d){
  const p=d.portfolio||{},s=d.stress_test||{};
  $("#riskGrid").innerHTML=[
    '<div class="pf-risk-card"><span>Vị thế lớn nhất</span><b>'+pct(p.largest_position_weight)+'</b></div>',
    '<div class="pf-risk-card"><span>Top 3 vị thế</span><b>'+pct(p.top3_weight)+'</b></div>',
    '<div class="pf-risk-card"><span>Ngành lớn nhất</span><b>'+pct(p.largest_sector_weight)+'</b></div>',
    '<div class="pf-risk-card"><span>Nợ margin / tài sản</span><b>'+pct(p.margin_pct)+'</b></div>'
  ].join("");
  const sectors=Array.isArray(p.sector_weights)?p.sector_weights.slice(0,6):[];
  $("#sectorWeights").innerHTML=sectors.map(x=>'<div class="pf-sector-row"><div><span>'+esc(x.sector)+'</span><div class="pf-sector-bar"><i style="width:'+Math.min(100,Math.max(0,num(x.weight)||0))+'%"></i></div></div><b>'+pct(x.weight)+'</b></div>').join("");
  const sc=Array.isArray(s.scenarios)?s.scenarios:[];
  $("#stressBody").innerHTML=sc.length?sc.map(x=>'<tr><td>Cổ phiếu '+pct(x.market_shock_pct)+'</td><td class="'+moveClass(x.equity_change_pct)+'">'+pct(x.equity_change_pct,2)+'</td></tr>').join(""):'<tr><td colspan="2">Chưa đủ dữ liệu tỷ trọng để chạy stress cơ học.</td></tr>';
  $("#stressNote").textContent=s.note||"Stress test chỉ là mô hình cơ học, không phải dự báo.";
}
function renderConditions(d){
  const p=d.portfolio||{},good=Array.isArray(p.upgrade_conditions)?p.upgrade_conditions:[],bad=Array.isArray(p.downgrade_conditions)?p.downgrade_conditions:[];
  $("#upgradeList").innerHTML=good.map(x=>"<li>"+esc(x)+"</li>").join("")||"<li>Chưa đủ dữ liệu.</li>";
  $("#downgradeList").innerHTML=bad.map(x=>"<li>"+esc(x)+"</li>").join("")||"<li>Chưa đủ dữ liệu.</li>";
}
function renderConfidence(d){
  const c=d.confidence||{},ctx=d.context||{},data=c.data||{},miss=d.missing_contract||{};
  $("#confidenceScore").textContent=num(c.score)===null?"—":Math.round(c.score)+"/100";
  $("#confidenceLabel").textContent=(c.preliminary?"SƠ BỘ · ":"")+(c.label||"—");
  $("#confidenceData").innerHTML=[
    ["Thị trường",data.market],["Độ phủ stock",num(data.stock_weighted_coverage)===null?"—":Math.round(data.stock_weighted_coverage)+"/100"],
    ["Tỷ trọng",data.portfolio_weight],["Ngành",data.sector],["T+",data.tplus],["Tin tức",data.news]
  ].map(x=>'<div><span>'+esc(x[0])+'</span><b>'+esc(x[1]||"—")+'</b></div>').join("");
  const missing=Object.values(miss).filter(Boolean);
  $("#unknownContract").innerHTML=missing.length?"<b>Những gì hệ thống chủ động không suy đoán:</b><br>"+missing.map(esc).join("<br>"):"";
  $("#resultUpdated").textContent="Cập nhật bộ não: "+stamp(d.generated_at)+" · "+esc(ctx.market_freshness?.label||"");
}
function historyComparison(d){
  const key="vh_portfolio_decision_last_summary_v1",p=d.portfolio||{},m=d.market||{};
  let prev=null;try{prev=JSON.parse(localStorage.getItem(key)||"null")}catch{}
  const current={
    hash:d.portfolio_hash||null,score:num(p.portfolio_score),market:num(m.market_score),
    healthy:(num(p.leading_weight)||0)+(num(p.strong_weight)||0)+(num(p.holding_weight)||0),
    weak:(num(p.weakening_weight)||0)+(num(p.risk_weight)||0),
    margin:num(p.margin_pct)||0,near:num(p.near_resistance_weight)||0,at:d.generated_at||new Date().toISOString()
  };
  if(prev&&prev.hash&&current.hash===prev.hash&&num(prev.score)!==null&&current.score!==null){
    const delta=current.score-num(prev.score),why=[];
    if(current.market!==null&&num(prev.market)!==null&&current.market-num(prev.market)<=-3)why.push("Market Score giảm "+fmt(Math.abs(current.market-num(prev.market)),0)+" điểm");
    if(current.market!==null&&num(prev.market)!==null&&current.market-num(prev.market)>=3)why.push("Market Score tăng "+fmt(current.market-num(prev.market),0)+" điểm");
    if(current.weak-num(prev.weak)>=5)why.push("tỷ trọng Suy yếu/Rủi ro tăng "+fmt(current.weak-num(prev.weak),1)+" điểm %");
    if(current.weak-num(prev.weak)<=-5)why.push("tỷ trọng Suy yếu/Rủi ro giảm "+fmt(Math.abs(current.weak-num(prev.weak)),1)+" điểm %");
    if(current.healthy-num(prev.healthy)>=5)why.push("vốn ở nhóm khỏe tăng "+fmt(current.healthy-num(prev.healthy),1)+" điểm %");
    if(current.healthy-num(prev.healthy)<=-5)why.push("vốn ở nhóm khỏe giảm "+fmt(Math.abs(current.healthy-num(prev.healthy)),1)+" điểm %");
    if(current.margin-num(prev.margin)>=5)why.push("margin tăng "+fmt(current.margin-num(prev.margin),1)+" điểm %");
    if(current.near-num(prev.near)>=10)why.push("tỷ trọng gần cản tăng "+fmt(current.near-num(prev.near),1)+" điểm %");
    const box=$("#scoreDrivers");
    if(box){
      const tone=delta>0?"positive":delta<0?"negative":"";
      const line='<div class="pf-driver '+tone+'"><b>So với lần phân tích gần nhất:</b> '+(delta>0?"+":"")+fmt(delta,0)+' điểm'+(why.length?" · "+esc(why.join("; ")):" · cấu trúc điểm không thay đổi đáng kể.")+'</div>';
      box.insertAdjacentHTML("afterbegin",line);
    }
  }
  try{localStorage.setItem(key,JSON.stringify(current))}catch{}
}
function showResults(d){
  renderSource(d);$("#resultPlaceholder")?.classList.add("pf-hidden");$("#resultContent")?.classList.remove("pf-hidden");
  renderExec(d);renderAllocation(d);renderFit(d);renderPositions(d);renderEventsNews(d);renderRiskStress(d);renderConditions(d);renderConfidence(d);historyComparison(d);
}
async function saveSnapshot(d,input){
  if(!$("#saveHistory")?.checked)return;
  const res=await supabaseClient.auth.getSession(),session=res.data.session;
  if(!session?.user){message("Bạn đang ở chế độ riêng tư trên máy này. Đăng nhập nếu muốn lưu lịch sử.","");return}
  const p=d.portfolio||{},m=d.market||{},c=d.confidence||{};
  const ins=await supabaseClient.from("portfolio_decision_snapshots").insert({
    auth_user_id:session.user.id,portfolio_hash:d.portfolio_hash||null,portfolio_score:p.portfolio_score,
    market_fit_score:p.market_fit_score,risk_score:p.risk_score,market_score:m.market_score,account_alpha:p.account_alpha,
    data_confidence:c.label||null,input_payload:input,decision_payload:d
  });
  if(ins.error)throw ins.error;
  message("Đã lưu snapshot vào lịch sử tài khoản.","ok");
}
async function analyze(){
  let input;try{input=inputPayload()}catch(e){message(e.message||"Dữ liệu nhập chưa hợp lệ.","error");return}
  saveDraft();setLoading(true);message("");
  try{
    const r=await fetch(ENDPOINT,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(input)});
    const d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||("HTTP "+r.status));
    showResults(d);
    try{await saveSnapshot(d,input)}catch(e){console.error(e);message("Phân tích đã xong nhưng chưa lưu được lịch sử. Kết quả hiện tại vẫn dùng bình thường.","error")}
    if(matchMedia("(max-width:1040px)").matches)$("#resultContent")?.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){console.error(e);message("Chưa kết nối được Bộ não danh mục. Không có kết luận nào được tạo từ dữ liệu thiếu. Vui lòng thử lại.","error")}
  finally{setLoading(false)}
}
function bind(){
  $("#addPosition")?.addEventListener("click",()=>{addRow();saveDraft()});
  $("#positionList")?.addEventListener("click",e=>{const b=e.target.closest("[data-remove]");if(!b)return;b.closest(".pf-position-row")?.remove();ensureRows();saveDraft()});
  $("#positionList")?.addEventListener("input",e=>{if(e.target.matches('[data-field="symbol"]'))e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3);saveDraft()});
  ["cashPct","marginPct","accountChange","saveHistory"].forEach(id=>$("#"+id)?.addEventListener("input",saveDraft));
  $("#analyzeBtn")?.addEventListener("click",analyze);
  $("#clearPortfolio")?.addEventListener("click",()=>{localStorage.removeItem(DRAFT_KEY);$("#positionList").innerHTML="";ensureRows();["cashPct","marginPct","accountChange"].forEach(id=>{if($("#"+id))$("#"+id).value=""});if($("#saveHistory"))$("#saveHistory").checked=false;message("Đã xóa dữ liệu nhập trên thiết bị này.","")});
}
async function loadMarketContext(){
  try{
    const r=await fetch(ENDPOINT,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({positions:[],cash_pct:100,margin_pct:0})});
    const d=await r.json().catch(()=>null);
    if(r.ok&&d?.ok)showResults(d);
  }catch(e){console.debug("Portfolio market context unavailable",e)}
}
function init(){
  loadDraft();bind();
  $("#resultPlaceholder").innerHTML='<div><strong>Đang đọc bối cảnh thị trường…</strong>Danh mục của bạn chưa được gửi đi cho đến khi bấm Phân tích danh mục.</div>';
  loadMarketContext();
}
init();
