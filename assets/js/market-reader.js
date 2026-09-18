import { mountMarketLeadForm } from "./market-lead.js";
import { trackTool } from "./tool-events.js";
import { getAdaptiveMarketBrief } from "./market-brief-engine.js";

const ENDPOINT = window.VH_MARKET_ENDPOINT || "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed";
const NEWS_ENDPOINT = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/broker-brief-public?mode=news";
const SNAPSHOT_ENDPOINT = "https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-snapshot-public";
const REFRESH_MS = 60_000;
const AUX_REFRESH_MS = 300_000;
const SHARE_URL = "https://www.vohoanginvest.com/thi-truong-hom-nay.html";
const NEWS_24H_URL = "https://www.vohoanginvest.com/tin-tuc-24h.html";
const SECTORS = {VNFIN:"Tài chính",VNREAL:"Bất động sản",VNIND:"Công nghiệp",VNIT:"Công nghệ thông tin",VNMAT:"Nguyên vật liệu",VNCONS:"Hàng tiêu dùng thiết yếu",VNCOND:"Hàng tiêu dùng không thiết yếu",VNENE:"Năng lượng",VNHEAL:"Y tế",VNUTI:"Tiện ích"};

let latestData = null;
let latestNews = [];
let latestSnapshot = null;
let viewTracked = false;
let auxFetchedAt = 0;
let auxPromise = null;

function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function fmt(v,d=2){const x=n(v);return x===null?"—":x.toLocaleString("vi-VN",{minimumFractionDigits:d,maximumFractionDigits:d})}
function fmtTrim(v,d=2){const x=n(v);return x===null?"—":x.toLocaleString("vi-VN",{minimumFractionDigits:0,maximumFractionDigits:d})}
function pct(v){const x=n(v);return x===null?"—":`${x>0?"+":""}${fmtTrim(x,2)}%`}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function tone(v){const t=String(v||"neutral");return ["positive","warning","danger","neutral"].includes(t)?t:"neutral"}
function safeHref(v){const h=String(v||"");return /^[a-z0-9-]+\.html(?:[?#].*)?$/i.test(h)?h:"#"}
function actionHref(link){
  const href=String(link?.href||"");
  const label=String(link?.label||"").toLowerCase();
  if(href.includes("tinh-rui-ro-danh-muc.html")||label.includes("rủi ro danh mục"))return "investor-calculator.html#portfolio";
  if(href.includes("tinh-quy-mo-lenh-co-phieu.html")||label.includes("quy mô lệnh"))return "investor-calculator.html#position";
  return safeHref(href);
}
function index(data,symbol){return Array.isArray(data?.indexes)?data.indexes.find(x=>String(x?.symbol||"")===symbol):null}
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v}
function setHtml(id,v){const e=document.getElementById(id);if(e)e.innerHTML=v}
function clip(v,max=180){const s=String(v||"").replace(/\s+/g," ").trim();return s.length>max?s.slice(0,max-1).trim()+"…":s}

function humanize(value){
  return String(value||"")
    .replace(/mở rộng rủi ro/gi,"tăng tỷ trọng")
    .replace(/mở rộng tỷ trọng/gi,"tăng tỷ trọng")
    .replace(/mở rộng vị thế/gi,"mua thêm")
    .replace(/tăng mức độ chủ động/gi,"tăng tỷ trọng")
    .replace(/nâng dần mức độ chủ động/gi,"tăng tỷ trọng từng bước")
    .replace(/mức độ chủ động/gi,"mức giải ngân")
    .replace(/điểm sai/gi,"mức cắt lỗ")
    .replace(/quản trị vị thế/gi,"quản lý các vị thế đang nắm giữ")
    .replace(/giảm rủi ro trở lại/gi,"giảm tỷ trọng trở lại")
    .replace(/hạ mức rủi ro/gi,"giảm tỷ trọng")
    .replace(/hạ rủi ro/gi,"giảm tỷ trọng")
    .replace(/phòng thủ/gi,"giữ tài khoản an toàn")
    .replace(/chất lượng hồi/gi,"độ rộng và dòng tiền của nhịp hồi")
    .replace(/\s+/g," ")
    .trim();
}

function renderLive(mi,data){
  const el=document.getElementById("readerLive");if(!el)return;
  const fresh=mi?.freshness||{};
  el.className=`reader-live is-${tone(fresh.tone)}`;
  const updated=data?.updated_at||data?.relay_received_at||"";
  let suffix="";
  if(updated){
    const d=new Date(String(updated).includes("T")?updated:String(updated).replace(" ","T"));
    if(!Number.isNaN(d.getTime()))suffix=" · "+new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(d);
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
  setText("readerAction",humanize(mi?.action?.headline||"Theo dõi thêm dữ liệu."));
  setText("readerActionDetail",humanize(mi?.action?.detail||""));
  const links=Array.isArray(mi?.action?.links)?mi.action.links:[];
  setHtml("readerActions",links.map(x=>`<a href="${actionHref(x)}" data-reader-cta="tool">${esc(x?.label||"Mở công cụ")}</a>`).join(""));
}

function ensureViewpoint(){
  let el=document.querySelector('[data-vh-viewpoint]');if(el)return el;
  const metrics=document.querySelector('.reader-metrics');if(!metrics)return null;
  el=document.createElement('section');el.className='reader-sharebar';el.dataset.vhViewpoint='';
  el.innerHTML='<div><span>CÁCH VÕ HOÀNG NHÌN</span><strong id="vhViewHeadline">—</strong></div><p id="vhViewText"></p>';
  metrics.insertAdjacentElement('afterend',el);return el;
}

function getViewpoint(mi){
  const risk=Number(mi?.state?.risk_level)||3;
  let h='Ad không cố đoán thị trường sẽ đi bao nhiêu điểm.';
  let p='Điều quan trọng là số mã tăng/giảm, dòng tiền, nhóm dẫn dắt và tỷ trọng cổ phiếu trong tài khoản có phù hợp với trạng thái hiện tại hay không.';
  if(risk>=4){
    h='Ở trạng thái này, Ad ưu tiên cùng ACE giữ an toàn cho tài khoản hơn là cố đoán đáy.';
    p='Nếu số mã tăng chưa cải thiện và dòng tiền chưa quay lại, một nhịp hồi chưa đủ để vội mua thêm. Cơ hội tốt không cần phải mua bằng mọi giá.';
  }else if(risk<=2){
    h='Thị trường đang thuận hơn, nhưng từng lệnh vẫn cần kỷ luật.';
    p='Ưu tiên cổ phiếu khỏe, có dòng tiền, điểm mua hợp lý và xác định sẵn mức cắt lỗ trước khi tăng tỷ trọng.';
  }
  return{h,p};
}

function renderViewpoint(mi){const el=ensureViewpoint();if(!el)return;const view=getViewpoint(mi);setText('vhViewHeadline',view.h);setText('vhViewText',view.p)}

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
  const rows=Object.entries(SECTORS).map(([symbol,name])=>{const row=index(data,symbol);return{symbol,name,change:n(row?.change_pct),meta:momentum.get(symbol)||null}}).filter(x=>x.change!==null).sort((a,b)=>b.change-a.change);
  if(!rows.length){setHtml("sectorTable","<p class='reader-note'>Chưa có dữ liệu nhóm ngành.</p>");return}
  const maxAbs=Math.max(.15,...rows.map(x=>Math.abs(x.change)));
  setHtml("sectorTable",rows.map((x,i)=>{const cls=x.change>0?"up":x.change<0?"down":"flat";const width=Math.max(6,Math.min(100,Math.abs(x.change)/maxAbs*100));const meta=x.meta?.delta_15m===null||x.meta?.delta_15m===undefined?"":` · ${esc(x.meta.momentum||"")} ${pct(x.meta.delta_15m)}`;return `<div class="sector-row ${cls}"><div class="sector-name"><b>${i+1}. ${esc(x.name)}</b><small>${esc(x.symbol)}${meta}</small></div><div class="sector-bar"><i style="width:${width}%"></i></div><strong>${pct(x.change)}</strong></div>`}).join(""));
}

function renderAlerts(mi){
  const alerts=Array.isArray(mi?.alerts)?mi.alerts:[];
  if(!alerts.length){setHtml("readerAlerts",`<div class="reader-alert"><b>Chưa có cảnh báo lớn</b><p>Tiếp tục theo dõi độ rộng, dòng tiền và nhóm dẫn dắt.</p></div>`);return}
  setHtml("readerAlerts",alerts.map(a=>`<div class="reader-alert is-${tone(a?.level)}"><b>${esc(a?.title||"Lưu ý")}</b><p>${esc(humanize(a?.detail||""))}</p></div>`).join(""));
}

function validSameTimeRatio(flow){
  const same=n(flow?.same_time_ratio);
  const avg=n(flow?.same_time_avg_b);
  const days=n(flow?.baseline_days)??0;
  if(same===null||avg===null||avg<=0||days<5)return null;
  if(same<=0.1||same>=5)return null;
  return same;
}

function renderBaseline(mi){
  const flow=mi?.flow||{};
  const same=validSameTimeRatio(flow);
  setText("currentGt",flow.value_b===null||flow.value_b===undefined?"—":`${fmtTrim(flow.value_b,1)} tỷ`);
  setText("sameTimeRatio",same===null?"Chưa đủ chuẩn":`${Math.round(same*100)}%`);
  setText("paceRatio",flow.pace_ratio_15m===null||flow.pace_ratio_15m===undefined?"Chưa đủ nhịp":`${Math.round(Number(flow.pace_ratio_15m)*100)}%`);
  setText("baselineDays",`${flow.baseline_days||0}/${flow.baseline_target_days||20} phiên`);
  setText("baselineStatus",same!==null?"Đã có chuẩn tối thiểu":"Đang tích lũy");
}

function formatBriefTime(data){
  const raw=data?.updated_at||data?.relay_received_at||"";if(!raw)return"—";
  const d=new Date(String(raw).includes("T")?raw:String(raw).replace(" ","T"));if(Number.isNaN(d.getTime()))return"—";
  return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric",hour12:false}).format(d);
}

function formatLeadership(items,limit=3){if(!Array.isArray(items)||!items.length)return"Chưa đủ dữ liệu";return items.slice(0,limit).map(x=>`${x?.name||x?.symbol||"—"} ${pct(x?.change_pct)}`).join(" · ")}

function marketMoveText(vnPct){
  const x=n(vnPct);if(x===null)return"VN-Index chưa có dữ liệu thay đổi.";
  if(Math.abs(x)<0.01)return"VN-Index gần như đi ngang.";
  return `VN-Index ${x>0?"tăng":"giảm"} ${fmtTrim(Math.abs(x),2)}%.`;
}

function breadthNarrative(data,mi){
  const vn=index(data,"VN-INDEX")||{};
  const breadth=mi?.breadth||{};
  const adv=n(breadth.adv),dec=n(breadth.dec),flat=n(breadth.flat);
  const move=marketMoveText(vn.change_pct);
  if(adv===null||dec===null)return `${move} Độ rộng thị trường chưa đủ dữ liệu.`;
  if(dec>=Math.max(adv*1.55,adv+60)){
    return `${move} ${Math.round(dec)} mã giảm so với ${Math.round(adv)} mã tăng. Phần lớn cổ phiếu đang chịu áp lực bán mạnh hơn những gì điểm số của chỉ số thể hiện.`;
  }
  if(adv>=Math.max(dec*1.4,dec+45)){
    return `${move} ${Math.round(adv)} mã tăng so với ${Math.round(dec)} mã giảm. Sức mạnh đang lan ra nhiều cổ phiếu hơn, không chỉ tập trung ở một vài mã lớn.`;
  }
  return `${move} Độ rộng tương đối cân bằng với ${Math.round(adv)} mã tăng, ${Math.round(flat||0)} mã tham chiếu và ${Math.round(dec)} mã giảm.`;
}

function flowNarrative(flow){
  const value=flow?.value_b===null||flow?.value_b===undefined?null:n(flow.value_b);
  const same=validSameTimeRatio(flow);
  const pace=n(flow?.pace_ratio_15m);
  const head=value===null?"Thanh khoản chưa đủ dữ liệu.":`Thanh khoản ${fmtTrim(value,1)} tỷ đồng.`;
  if(same!==null){
    const diff=Math.round(Math.abs(same-1)*100);
    if(same>=1.12)return `${head} Cao hơn khoảng ${diff}% so với bình quân các phiên trước tại cùng thời điểm.`;
    if(same<=0.88)return `${head} Thấp hơn khoảng ${diff}% so với bình quân các phiên trước tại cùng thời điểm.`;
    return `${head} Xấp xỉ mức bình quân các phiên trước tại cùng thời điểm.`;
  }
  if(pace!==null){
    if(pace>=1.15)return `${head} Dòng tiền 15 phút gần nhất đang vào nhanh hơn.`;
    if(pace<=0.85)return `${head} Dòng tiền 15 phút gần nhất đang chậm lại.`;
  }
  return `${head} Chưa đủ dữ liệu đáng tin cậy để so sánh với các phiên trước tại cùng thời điểm.`;
}

function normalizeVn30Row(row){
  if(!row||typeof row!=="object")return null;
  const symbol=String(row.symbol||row.ticker||row.code||row.stock_code||"").trim().toUpperCase();
  const change=n(row.change_pct??row.changePercent??row.pct_change??row.percent_change);
  if(!symbol||change===null)return null;
  return{symbol,change};
}

function extractVn30Rows(data){
  const explicit=[data?.vn30_stocks,data?.vn30_members,data?.market_intelligence?.vn30_stocks,data?.vn30?.stocks,data?.vn30?.members].find(Array.isArray);
  if(explicit)return explicit.map(normalizeVn30Row).filter(Boolean);
  if(Array.isArray(data?.stocks)){
    return data.stocks.filter(row=>/VN30/i.test(String(row?.index||row?.group||row?.basket||row?.index_name||""))).map(normalizeVn30Row).filter(Boolean);
  }
  return[];
}

function vn30Narrative(data,mi){
  const rows=extractVn30Rows(data);if(!rows.length)return"";
  const adv=n(mi?.breadth?.adv),dec=n(mi?.breadth?.dec),vnPct=n(index(data,"VN-INDEX")?.change_pct);
  const gainers=rows.filter(x=>x.change>0).sort((a,b)=>b.change-a.change).slice(0,3);
  const losers=rows.filter(x=>x.change<0).sort((a,b)=>a.change-b.change).slice(0,3);
  const names=(items)=>items.map(x=>`${x.symbol} ${pct(x.change)}`).join(" · ");
  if(dec!==null&&adv!==null&&dec>adv*1.4&&gainers.length){
    return `Trong VN30, ${names(gainers)} vẫn tăng, giúp chỉ số được nâng đỡ trong khi phần lớn cổ phiếu trên thị trường còn yếu.`;
  }
  if(vnPct!==null&&vnPct<0&&losers.length){
    return `Trong VN30, ${names(losers)} đang giảm, cho thấy áp lực bán cũng xuất hiện ở nhóm vốn hóa lớn.`;
  }
  if(adv!==null&&dec!==null&&adv>dec*1.4&&losers.length){
    return `Độ rộng đang tích cực dù một số mã VN30 như ${names(losers)} còn giảm; sức mạnh thị trường không chỉ phụ thuộc vào nhóm trụ.`;
  }
  const parts=[];
  if(gainers.length)parts.push(`tăng: ${names(gainers)}`);
  if(losers.length)parts.push(`giảm: ${names(losers)}`);
  return parts.length?`VN30 đang phân hóa — ${parts.join("; ")}.`:"";
}

function alertLines(mi){
  const alerts=Array.isArray(mi?.alerts)?mi.alerts:[];
  if(!alerts.length)return["• Chưa có cảnh báo lớn; tiếp tục theo dõi số mã tăng/giảm, dòng tiền và nhóm dẫn dắt."];
  return alerts.slice(0,2).map(a=>`• ${a?.title||"Lưu ý"}${a?.detail?`: ${humanize(a.detail)}`:""}`);
}

function newsImpact(item){
  const candidates=[item?.impact_summary,item?.impact_note,item?.why_it_matters,item?.market_implication,item?.conclusion,item?.summary_snapshot,item?.summary];
  const text=candidates.map(x=>clip(humanize(x),150)).find(Boolean);
  return text||"";
}

function newsLines(){
  const items=(Array.isArray(latestNews)?latestNews:[]).filter(x=>String(x?.title_snapshot||x?.title||"").trim()).slice(0,3);
  return items.map(item=>{
    const title=clip(item?.title_snapshot||item?.title||"Tin thị trường",150);
    const impact=newsImpact(item);
    return `• ${title}${impact?` — ${impact}`:""}`;
  });
}

function macroSummary(){
  const macro=latestSnapshot?.macro;
  if(!macro?.ok)return null;
  const label=String(macro.regime||macro.label||"TRUNG TÍNH").trim();
  const thesis=clip(humanize(macro.thesis||macro.summary||macro.conclusion||"Nền vĩ mô tiếp tục được theo dõi theo tăng trưởng, lạm phát, tỷ giá và điều kiện tiền tệ."),240);
  const cards=Array.isArray(macro.cards)?macro.cards:[];
  const warning=cards.find(x=>x?.tone==="warning"||x?.tone==="danger"||/THEO DÕI|RỦI RO|CHẶT/i.test(String(x?.status||"")));
  const watch=warning?clip(humanize(warning.watch||warning.conclusion||warning.market_implication||""),180):"";
  return{label,thesis,watch};
}

async function fetchNewsContext(){
  const r=await fetch(NEWS_ENDPOINT,{cache:"no-store",headers:{Accept:"application/json"}});
  const j=await r.json();
  if(!r.ok||!j?.ok)throw new Error(j?.error||`HTTP ${r.status}`);
  latestNews=Array.isArray(j?.items)?j.items.slice(0,5):[];
}

async function fetchSnapshotContext(){
  const r=await fetch(SNAPSHOT_ENDPOINT,{cache:"no-store",headers:{Accept:"application/json"}});
  const j=await r.json();
  if(!r.ok||!j?.ok)throw new Error(j?.error||`HTTP ${r.status}`);
  latestSnapshot=j;
}

function refreshBriefContext(force=false){
  const now=Date.now();
  if(!force&&auxPromise)return auxPromise;
  if(!force&&now-auxFetchedAt<120_000&&(latestNews.length||latestSnapshot))return Promise.resolve();
  auxFetchedAt=now;
  auxPromise=Promise.allSettled([fetchNewsContext(),fetchSnapshotContext()]).finally(()=>{auxPromise=null});
  return auxPromise;
}

function buildBrief(data){
  const mi=data?.market_intelligence||{};
  const state=mi.state||{};
  const flow=mi.flow||{};
  const adaptive=getAdaptiveMarketBrief(data);
  const vn30=vn30Narrative(data,mi);

  const lines=[
    `RÀ SOÁT THỊ TRƯỜNG – VÕ HOÀNG`,
    `Cập nhật ${formatBriefTime(data)}`,
    ``,
    `TRẠNG THÁI: ${state.label||"—"} · ${state.score??"—"}/100`,
    breadthNarrative(data,mi)
  ];

  if(vn30)lines.push(vn30);

  lines.push(
    ``,
    `DÒNG TIỀN`,
    flowNarrative(flow),
    `Nhóm mạnh: ${formatLeadership(mi?.leadership?.leaders,3)}`,
    `Nhóm yếu: ${formatLeadership(mi?.leadership?.laggards,3)}`,
    ``,
    `QUAN ĐIỂM`,
    humanize(adaptive.headline),
    humanize(adaptive.detail),
    ``,
    `HÀNH ĐỘNG`,
    humanize(adaptive.action),
    `Theo dõi: ${humanize(adaptive.watch)}.`,
    ``,
    `Tin tức 24h: ${NEWS_24H_URL}`,
    `Xem thị trường realtime: ${SHARE_URL}`,
    ``,
    `VÕ HOÀNG – ĐẦU TƯ CHUẨN HỆ THỐNG`
  );

  return lines.join("\n");
}

function showCopySuccess(){
  const btn=document.getElementById("copyReaderBrief");if(!btn)return;
  const original=btn.dataset.originalLabel||btn.textContent||"Sao chép";
  btn.dataset.originalLabel=original;btn.textContent="✓";btn.setAttribute("aria-label","Đã sao chép");btn.classList.add("is-copied");
  clearTimeout(showCopySuccess.timer);
  showCopySuccess.timer=setTimeout(()=>{btn.textContent=original;btn.setAttribute("aria-label",original);btn.classList.remove("is-copied")},1600);
}

async function copyBrief(){
  if(!latestData)return;
  const text=buildBrief(latestData),message=document.getElementById("readerShareMessage");
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
    else{const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();document.execCommand("copy");area.remove()}
    showCopySuccess();
    if(message)message.textContent="Đã sao chép rà soát trong phiên. Có thể dán thẳng vào Zalo/Facebook/Threads.";
    trackTool("MARKET_READER","COPY_BRIEF",{resultCode:"SUCCESS",metadata:{score:latestData?.market_intelligence?.state?.score??null,vn30:extractVn30Rows(latestData).length}});
  }catch{
    if(message)message.textContent="Chưa sao chép được trên trình duyệt này.";
  }
}

async function shareBrief(){
  if(!latestData)return;
  const text=buildBrief(latestData);
  if(navigator.share){
    try{await navigator.share({title:"Rà soát thị trường – Võ Hoàng",text,url:SHARE_URL});trackTool("MARKET_READER","SHARE",{resultCode:"SUCCESS"});return}
    catch(error){if(error?.name==="AbortError")return}
  }
  await copyBrief();
}

function render(data){
  latestData=data;
  const mi=data?.market_intelligence;
  if(!mi){const live=document.getElementById("readerLive");if(live)live.innerHTML="<i></i><span>Đang chờ bộ đọc thị trường…</span>";return}
  renderLive(mi,data);renderState(mi);renderMetrics(data,mi);renderViewpoint(mi);renderSectors(data,mi);renderAlerts(mi);renderBaseline(mi);
  if(!viewTracked){viewTracked=true;trackTool("MARKET_READER","VIEW",{resultCode:String(mi?.state?.label||"UNKNOWN").slice(0,80),score:n(mi?.state?.score),metadata:{freshness:mi?.freshness?.status||null}})}
}

async function refresh(){
  try{const r=await fetch(ENDPOINT,{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);render(await r.json())}
  catch{const live=document.getElementById("readerLive");if(live){live.className="reader-live is-danger";live.innerHTML="<i></i><span>Chưa cập nhật được dữ liệu</span>"}}
}

function initConversion(){
  const leadRoot=document.querySelector('[data-market-lead-root]');
  if(leadRoot)mountMarketLeadForm(leadRoot,{source:'MARKET_READER_BRIEF',metadata:{placement:'market_reader'}});
  document.getElementById("copyReaderBrief")?.addEventListener("click",copyBrief);
  document.getElementById("shareReaderBrief")?.addEventListener("click",shareBrief);
  document.addEventListener("click",event=>{
    const link=event.target.closest("a[href]");if(!link)return;
    const href=link.getAttribute("href")||"";
    if(href.includes("investor-calculator")||href.includes("start=assessment")||href.includes("start=contact"))trackTool("MARKET_READER","CTA_CLICK",{resultCode:href.includes("assessment")?"ASSESSMENT":href.includes("contact")?"CONTACT":"CALCULATOR",metadata:{href:href.slice(0,120)}})
  });
}

initConversion();
refresh();
setInterval(()=>{if(!document.hidden)refresh()},REFRESH_MS);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
