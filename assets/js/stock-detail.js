import { SUPABASE_URL } from "./supabase-client.js";

const $=(s)=>document.querySelector(s);
const fmtNum=(v,d=2)=>{
  if(v===null||v===undefined||v==="") return "—";
  const n=Number(v); if(!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:d}).format(n);
};
const fmtPct=(v)=>v===null||v===undefined||!Number.isFinite(Number(v))?"—":`${Number(v)>0?"+":""}${fmtNum(v,2)}%`;
const fmtCompact=(v)=>{
  if(v===null||v===undefined||v===""||!Number.isFinite(Number(v))) return "—";
  const n=Number(v), a=Math.abs(n);
  if(a>=1_000_000_000) return `${fmtNum(n/1_000_000_000,2)} Tỷ`;
  if(a>=1_000_000) return `${fmtNum(n/1_000_000,2)} Tr`;
  if(a>=1_000) return `${fmtNum(n/1_000,2)} N`;
  return fmtNum(n,0);
};
const cls=(v)=>v===null||v===undefined?"":Number(v)>0?"up":Number(v)<0?"down":"";
const esc=(s)=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const dateVN=(v)=>{if(!v)return"—";const [y,m,d]=String(v).slice(0,10).split("-");return d&&m&&y?`${d}/${m}/${y}`:String(v)};
const MARKET_ENDPOINT="https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed";

let current=null;

function setStatus(text,error=false){
  const el=$("#pageStatus"); el.textContent=text||""; el.classList.toggle("show",!!text); el.classList.toggle("error",error);
}
function setDataVisible(visible){
  const tabs=document.querySelector(".sd-tabs");
  if(tabs) tabs.hidden=!visible;
  document.querySelectorAll(".sd-panel").forEach(el=>{el.hidden=!visible;});
}
function clearVisibleData(){
  setDataVisible(false);
  current=null;
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
  if(!hasMeaningfulFundamental(b)) return ["Cơ bản","Hiện chưa đủ dữ liệu Cơ bản đáng tin cậy để diễn giải; phần này được để trống thay vì suy đoán.","watch"];
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
function addPoint(arr,title,text,tone=""){
  if(!text)return;
  arr.push({title,text,tone});
}
function thesisItem(x){
  return `<div class="sd-thesis-item ${x.tone||""}"><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div>`;
}
function scenarioCard(kind,title,condition,meaning,watch){
  return `<article class="sd-scenario ${kind}">
    <span>${esc(title)}</span>
    <strong>${esc(condition)}</strong>
    <p>${esc(meaning)}</p>
    <small>${esc(watch)}</small>
  </article>`;
}
function buildDynamicAnalysis(d){
  const t=d.technical||{}, f=d.flow||{}, b=d.fundamental||{}, q=d.live_quote||null;
  const support=[], risk=[], neutral=[];
  const px=q&&valid(q.price)?Number(q.price):(valid(t.close)?Number(t.close):null);
  const m20=valid(t.ma20)?Number(t.ma20):null, m50=valid(t.ma50)?Number(t.ma50):null, m200=valid(t.ma200)?Number(t.ma200):null;
  const s20=valid(t.ma20_slope_5d_pct)?Number(t.ma20_slope_5d_pct):null;
  const s50=valid(t.ma50_slope_10d_pct)?Number(t.ma50_slope_10d_pct):null;
  const s200=valid(t.ma200_slope_20d_pct)?Number(t.ma200_slope_20d_pct):null;
  const rsi=valid(t.rsi14)?Number(t.rsi14):null;
  const vol=valid(t.volume_vs_avg20)?Number(t.volume_vs_avg20):null;
  const ret20=valid(t.return_20d_pct)?Number(t.return_20d_pct):null;
  const ret60=valid(t.return_60d_pct)?Number(t.return_60d_pct):null;

  let techScore=0, fundScore=0, flowScore=0;

  if(px!==null&&m20!==null){
    if(px>m20){addPoint(support,"Giá giữ trên MA20",`Giá hiện tại ${fmtNum(px)} đang cao hơn MA20 ${fmtNum(m20)}, cấu trúc ngắn hạn vẫn giữ được nền.`,"positive");techScore++}
    else {addPoint(risk,"Giá dưới MA20",`Giá hiện tại ${fmtNum(px)} đang dưới MA20 ${fmtNum(m20)}, nhịp ngắn hạn chưa lấy lại ưu thế.`,"negative");techScore--}
  }
  if(px!==null&&m50!==null){
    if(px>m50){addPoint(support,"Trên MA50",`Giá vẫn nằm trên MA50 ${fmtNum(m50)}, xu hướng trung hạn chưa bị phá vỡ.`,"positive");techScore++}
    else {addPoint(risk,"Dưới MA50",`Giá đã nằm dưới MA50 ${fmtNum(m50)}, cần thận trọng với khả năng suy yếu trung hạn.`,"negative");techScore--}
  }
  if(px!==null&&m200!==null){
    if(px>m200){addPoint(support,"Trên MA200",`Giá đang trên MA200 ${fmtNum(m200)}, cấu trúc dài hơn có sự đồng thuận tích cực.`,"positive");techScore++}
    else {addPoint(risk,"Chưa vượt MA200",`Giá vẫn dưới MA200 ${fmtNum(m200)}, xu hướng dài hơn chưa xác nhận hoàn toàn.`,"watch")}
  }
  if(s20!==null){
    if(s20>0.25){addPoint(support,"MA20 đang dốc lên",`MA20 tăng ${fmtPct(s20)} trong 5 phiên đo lường, cho thấy nền giá ngắn hạn đang nâng dần.`,"positive");techScore++}
    else if(s20<-.25){addPoint(risk,"MA20 đang dốc xuống",`MA20 giảm ${fmtPct(s20)} trong 5 phiên đo lường, xu hướng ngắn hạn còn chịu sức ép.`,"negative");techScore--}
  }
  if(s50!==null){
    if(s50>0.35){addPoint(support,"MA50 cải thiện",`MA50 đang đi lên ${fmtPct(s50)} trong 10 phiên đo lường, nền trung hạn được nâng dần.`,"positive")}
    else if(s50<-.35){addPoint(risk,"MA50 suy yếu",`MA50 đang đi xuống ${fmtPct(s50)} trong 10 phiên đo lường.`,"negative")}
  }
  if(rsi!==null){
    if(rsi>=50&&rsi<70){addPoint(support,"Động lượng trên 50",`RSI14 ở ${fmtNum(rsi)}, động lượng nghiêng tích cực nhưng chưa vào vùng quá nóng.`,"positive");techScore++}
    else if(rsi>=70){addPoint(risk,"Động lượng nóng",`RSI14 ở ${fmtNum(rsi)}; xu hướng có lực nhưng rủi ro rung lắc ngắn hạn cao hơn.`,"watch")}
    else if(rsi<40){addPoint(risk,"Động lượng yếu",`RSI14 chỉ ${fmtNum(rsi)}, cho thấy lực giá hiện còn yếu.`,"negative");techScore--}
  }
  if(vol!==null){
    if(vol>=1.2&&ret20!==null&&ret20>0){addPoint(support,"Thanh khoản xác nhận",`Khối lượng bằng ${fmtNum(vol)}x trung bình 20 phiên trong bối cảnh giá 20 phiên tăng ${fmtPct(ret20)}.`,"positive");techScore++}
    else if(vol<=.8){addPoint(risk,"Thanh khoản chưa xác nhận",`Khối lượng chỉ bằng ${fmtNum(vol)}x trung bình 20 phiên; tín hiệu giá hiện thiếu sự tham gia mạnh của dòng tiền.`,"watch")}
  }
  if(t.breakout_20d===true){addPoint(support,"Đã vượt đỉnh 20P",`Close đã vượt đỉnh của 20 phiên trước (${fmtNum(t.high20_prev)}).`,"positive");techScore+=2}
  if(t.breakdown_20d===true){addPoint(risk,"Đã thủng đáy 20P",`Close đã thủng đáy của 20 phiên trước (${fmtNum(t.low20_prev)}).`,"negative");techScore-=2}
  if(valid(t.range60?.position_pct)){
    const pos=Number(t.range60.position_pct);
    if(pos>=75)addPoint(support,"Đứng ở vùng trên của biên 60 phiên",`Giá đang ở khoảng ${fmtNum(pos)}% biên dao động 60 phiên, phản ánh sức mạnh giá tương đối tốt.`,"positive");
    else if(pos<=25)addPoint(risk,"Nằm ở vùng thấp của biên 60 phiên",`Giá chỉ ở khoảng ${fmtNum(pos)}% biên dao động 60 phiên, cấu trúc giá còn yếu.`,"negative");
  }
  if(valid(t.atr14_pct)&&Number(t.atr14_pct)>=4){
    addPoint(risk,"Biến động cao",`ATR14 tương đương khoảng ${fmtPct(t.atr14_pct)} giá đóng cửa; biên dao động hiện lớn hơn mức bình thường của một vị thế ổn định.`,"watch");
  }

  const fw5=f?.window_5||{}, fw20=f?.window_20||{};
  const flowPair=(label,v5,v20)=>{
    if(!valid(v5)||!valid(v20))return;
    const a=Number(v5),z=Number(v20);
    if(a>0&&z>0){addPoint(support,`${label} duy trì mua ròng`,`5 phiên +${fmtNum(a,0)} cp và 20 phiên +${fmtNum(z,0)} cp; dòng tiền có tính duy trì.`,"positive");flowScore++}
    else if(a<0&&z<0){addPoint(risk,`${label} duy trì bán ròng`,`5 phiên ${fmtNum(a,0)} cp và 20 phiên ${fmtNum(z,0)} cp; áp lực bán chưa phải nhiễu một phiên.`,"negative");flowScore--}
    else if(a>0&&z<0){addPoint(neutral,`${label} đang cải thiện ngắn hạn`,`5 phiên đã chuyển mua ròng nhưng 20 phiên vẫn âm; có chuyển biến nhưng chưa đảo được xu hướng dài hơn.`,"watch")}
    else if(a<0&&z>0){addPoint(risk,`${label} ngắn hạn suy yếu`,`5 phiên chuyển bán ròng dù 20 phiên vẫn dương; cần theo dõi đây là chốt lời hay đổi trạng thái.`,"watch")}
  };
  flowPair("Khối ngoại",fw5.foreign_net_volume,fw20.foreign_net_volume);
  flowPair("Tự doanh",fw5.proprietary_net_volume,fw20.proprietary_net_volume);

  if(hasMeaningfulFundamental(b)){
    const roe=valid(b.return_on_equity)?Number(b.return_on_equity):null;
    const roa=valid(b.return_on_assets)?Number(b.return_on_assets):null;
    const rev=valid(b.qtrly_revenue_growth)?Number(b.qtrly_revenue_growth):null;
    const earn=valid(b.qtrly_earnings_growth)?Number(b.qtrly_earnings_growth):null;
    const pm=valid(b.profit_margin)?Number(b.profit_margin):null;
    const ocf=valid(b.operating_cash_flow)?Number(b.operating_cash_flow):null;

    if(roe!==null){
      if(roe>=15){addPoint(support,"Hiệu quả vốn tốt",`ROE ${fmtPct(roe)} cho thấy khả năng tạo lợi nhuận trên vốn chủ ở mức đáng chú ý.`,"positive");fundScore++}
      else if(roe<8){addPoint(risk,"ROE còn thấp",`ROE ${fmtPct(roe)} cho thấy hiệu quả sử dụng vốn hiện chưa cao.`,"watch");fundScore--}
    }
    if(roa!==null&&roa>=8){addPoint(support,"Hiệu quả tài sản tốt",`ROA ${fmtPct(roa)} cho thấy doanh nghiệp tạo lợi nhuận khá tốt trên tài sản.`,"positive")}
    if(rev!==null&&earn!==null){
      if(rev>0&&earn>0){
        if(earn>rev+5){addPoint(support,"Lợi nhuận tăng nhanh hơn doanh thu",`Doanh thu quý tăng ${fmtPct(rev)} trong khi lợi nhuận tăng ${fmtPct(earn)}; tăng trưởng hiện có dấu hiệu mở rộng hiệu quả.`,"positive");fundScore+=2}
        else {addPoint(support,"Doanh thu và lợi nhuận cùng tăng",`Doanh thu quý ${fmtPct(rev)} và lợi nhuận quý ${fmtPct(earn)} cùng tăng.`,"positive");fundScore++}
      }else if(rev>0&&earn<0){addPoint(risk,"Tăng trưởng doanh thu chưa chuyển thành lợi nhuận",`Doanh thu quý tăng ${fmtPct(rev)} nhưng lợi nhuận giảm ${fmtPct(earn)}; cần chú ý áp lực biên hoặc chi phí.`,"negative");fundScore--}
      else if(rev<0&&earn<0){addPoint(risk,"Tăng trưởng đang co lại",`Doanh thu quý ${fmtPct(rev)} và lợi nhuận quý ${fmtPct(earn)} cùng giảm.`,"negative");fundScore-=2}
    }
    if(pm!==null&&pm>0)addPoint(neutral,"Biên lợi nhuận",`Biên lợi nhuận hiện ghi nhận ${fmtPct(pm)}; cần so với lịch sử để đánh giá mở rộng hay co hẹp.`,"");
    if(ocf!==null){
      if(ocf>0){addPoint(support,"Dòng tiền hoạt động dương","Operating Cash Flow đang dương, giúp chất lượng lợi nhuận có thêm một lớp xác nhận.","positive");fundScore++}
      else if(ocf<0){addPoint(risk,"Dòng tiền hoạt động âm","Operating Cash Flow đang âm; chất lượng lợi nhuận cần được kiểm tra kỹ hơn.","negative");fundScore--}
    }
    const val=[];
    if(valid(b.pe))val.push(`P/E ${fmtNum(b.pe)}x`);
    if(valid(b.pb))val.push(`P/B ${fmtNum(b.pb)}x`);
    if(valid(b.ps))val.push(`P/S ${fmtNum(b.ps)}x`);
    if(val.length)addPoint(neutral,"Định giá hiện tại",`${val.join(" · ")}. Chưa kết luận rẻ/đắt khi chưa có benchmark lịch sử và ngành.`,"");
  }else{
    addPoint(risk,"Cơ bản chưa đủ dữ liệu","Nguồn hiện chưa có đủ số liệu Cơ bản đáng tin cậy để đánh giá doanh nghiệp; không diễn giải các giá trị 0 mặc định thành dữ liệu thực.","watch");
  }

  let regime="PHÂN HÓA — CẦN ĐỌC TỪNG LỚP";
  let regimeTone="watch";
  let thesis="Giá, dòng tiền và nền tảng doanh nghiệp chưa tạo thành một tín hiệu đồng thuận rõ ràng.";
  if(techScore>=3&&fundScore>=2&&flowScore>=0){
    regime="CƠ BẢN & KỸ THUẬT ĐANG ĐỒNG THUẬN";
    regimeTone="positive";
    thesis="Nền tảng doanh nghiệp và cấu trúc giá đang cùng nghiêng tích cực; điểm cần theo dõi là độ bền của dòng tiền và khả năng giữ các vùng xác nhận.";
  }else if(fundScore>=2&&techScore<=0){
    regime="CƠ BẢN TỐT — GIÁ CHƯA XÁC NHẬN";
    regimeTone="watch";
    thesis="Doanh nghiệp có các điểm nền tảng tích cực nhưng hành vi giá chưa xác nhận; đây là trạng thái cần chờ thị trường đồng thuận thay vì chỉ dựa vào Cơ bản.";
  }else if(techScore>=3&&fundScore<=0){
    regime="GIÁ MẠNH — CƠ BẢN CHƯA THEO KỊP";
    regimeTone="watch";
    thesis="Kỹ thuật đang mạnh hơn nền tảng Cơ bản hiện có; cần phân biệt một xu hướng giá tốt với một luận điểm đầu tư dài hơn đã được xác nhận.";
  }else if(techScore<=-2&&fundScore<=0){
    regime="CẤU TRÚC ĐANG YẾU";
    regimeTone="negative";
    thesis="Giá và các lớp xác nhận hiện chưa thuận lợi; trọng tâm lúc này là theo dõi khả năng lấy lại các vùng kỹ thuật quan trọng và sự cải thiện của dòng tiền.";
  }else if(techScore>=1&&fundScore>=1){
    regime="NGHIÊNG TÍCH CỰC — CHƯA ĐỦ ĐỒNG THUẬN";
    regimeTone="positive";
    thesis="Một số lớp dữ liệu đang ủng hộ nhau nhưng chưa đạt mức xác nhận toàn diện; cần theo dõi thêm xu hướng, flow và vùng giá then chốt.";
  }

  const high20=valid(t.high20_prev)?Number(t.high20_prev):null;
  const low20=valid(t.low20_prev)?Number(t.low20_prev):null;
  const posTrigger=high20!==null?`Vượt và giữ trên ${fmtNum(high20)}`:(m20!==null?`Giữ trên MA20 ${fmtNum(m20)}`:"Cấu trúc giá cải thiện");
  const baseTrigger=m20!==null&&m50!==null?`Giữ vùng MA20–MA50 (${fmtNum(m20)}–${fmtNum(m50)})`:"Giữ cấu trúc hiện tại";
  const negTrigger=low20!==null?`Thủng ${fmtNum(low20)}`:(m50!==null?`Mất MA50 ${fmtNum(m50)}`:"Cấu trúc giá suy yếu");

  const scenarios=[
    {
      kind:"positive",title:"Kịch bản tích cực",condition:posTrigger,
      meaning:vol!==null&&vol>=1.2?"Nếu đi kèm thanh khoản tiếp tục trên trung bình, tín hiệu xác nhận sẽ có chất lượng tốt hơn.":"Cần thêm sự xác nhận của thanh khoản và flow, không chỉ một nhịp vượt giá.",
      watch:"Theo dõi: vượt đỉnh, volume, flow 5 phiên và độ dốc MA20."
    },
    {
      kind:"base",title:"Kịch bản trung tính",condition:baseTrigger,
      meaning:"Giá chưa tạo tín hiệu mới nhưng vẫn giữ được nền; khi đó ưu tiên quan sát quá trình tích lũy và sự thay đổi của dòng tiền.",
      watch:"Theo dõi: MA20/MA50, biên 20 phiên, RSI quanh 50 và thanh khoản."
    },
    {
      kind:"negative",title:"Kịch bản xấu đi",condition:negTrigger,
      meaning:"Nếu đi kèm MA20/MA50 dốc xuống và flow chuyển xấu, luận điểm kỹ thuật hiện tại sẽ suy yếu rõ.",
      watch:"Theo dõi: thủng đáy, flow 5/20 phiên và vị trí trong biên 60 phiên."
    }
  ];

  const change=[];
  if(high20!==null)addPoint(change,"Xác nhận mạnh hơn",`Giá vượt và giữ được trên vùng đỉnh 20 phiên ${fmtNum(high20)}, tốt hơn nếu volume > 1x–1,2x trung bình 20 phiên.`,"positive");
  if(m20!==null)addPoint(change,"Cảnh báo sớm",`Giá mất MA20 ${fmtNum(m20)} trong khi MA20 bắt đầu dốc xuống sẽ làm suy yếu luận điểm ngắn hạn.`,"watch");
  if(m50!==null)addPoint(change,"Vô hiệu kỹ thuật trung hạn",`Giá nằm dưới MA50 ${fmtNum(m50)} và không sớm lấy lại vùng này sẽ làm cấu trúc trung hạn xấu hơn.`,"negative");
  if(low20!==null)addPoint(change,"Mốc cấu trúc quan trọng",`Thủng đáy 20 phiên ${fmtNum(low20)} là tín hiệu breakdown rõ hơn, cần đánh giá lại toàn bộ luận điểm kỹ thuật.`,"negative");

  return {support,risk,neutral,regime,regimeTone,thesis,scenarios,change,techScore,fundScore,flowScore};
}
function renderHistoryEdge(d){
  const s=d.signal_stats;
  if(!s||!s.signal_code){
    return `<div class="sd-empty">Chưa có đủ mẫu lịch sử cùng loại tín hiệu để thống kê.</div>`;
  }
  const labels={BREAKOUT_20D:"Vượt đỉnh 20P",BREAKDOWN_20D:"Thủng đáy 20P"};
  const rows=Object.entries(s.horizons||{}).map(([h,v])=>{
    const x=v||{};
    return `<div class="sd-history-stat"><span>T+${esc(h)}</span><b class="${cls(x.avg_return_pct)}">${fmtPct(x.avg_return_pct)}</b><small>${fmtNum(x.win_rate_pct)}% mẫu dương · n=${fmtNum(x.n,0)}</small></div>`;
  }).join("");
  return `<div class="sd-history-head"><b>${esc(labels[s.signal_code]||s.signal_code)}</b><span>${fmtNum(s.sample_size,0)} tín hiệu cùng loại trong bộ nhớ gần nhất</span></div>
    <div class="sd-history-grid">${rows||'<div class="sd-empty">Chưa có outcome đủ để thống kê.</div>'}</div>
    <p class="sd-history-note">Đây là thống kê các tín hiệu đã xảy ra của chính mã, dùng để hiểu hành vi lịch sử; không phải xác suất dự báo cho lần hiện tại.</p>`;
}
function renderOverview(d){
  const t=d.technical||{}, f=d.flow||{}, q=d.live_quote||null;
  $("#overviewKpis").innerHTML=[
    metric("Giá đóng cửa",fmtNum(t.close),dateVN(d.effective_as_of_date)),
    metric("Giá hiện tại",q&&valid(q.price)?fmtNum(q.price):"—",q&&valid(q.change_pct)?fmtPct(q.change_pct):"Chưa có intraday",q&&valid(q.change_pct)?cls(q.change_pct):""),
    metric("20 phiên",fmtPct(t.return_20d_pct),"",cls(t.return_20d_pct)),
    metric("RSI14",fmtNum(t.rsi14),valid(t.rsi14)?(Number(t.rsi14)>=70?"Vùng cao":Number(t.rsi14)>=50?"Trên 50":Number(t.rsi14)<=30?"Vùng thấp":"Dưới 50"):""),
    metric("MA20",valid(t.ma20)&&valid(t.close)?(Number(t.close)>Number(t.ma20)?"Trên":"Dưới"):"—",valid(t.ma20)?fmtNum(t.ma20):"",valid(t.ma20)&&valid(t.close)?(Number(t.close)>Number(t.ma20)?"up":"down"):""),
    metric("Ngoại 20P",fmtCompact(f.window_20?.foreign_net_volume),"cp ròng",cls(f.window_20?.foreign_net_volume))
  ].join("");

  const a=buildDynamicAnalysis(d);
  $("#masterView").innerHTML=`
    <div class="sd-regime ${a.regimeTone}">
      <span>TRẠNG THÁI TỔNG HỢP</span>
      <strong>${esc(a.regime)}</strong>
      <p>${esc(a.thesis)}</p>
    </div>
    <div class="sd-master-evidence">
      ${a.neutral.slice(0,3).map(thesisItem).join("")}
    </div>`;

  $("#supportList").innerHTML=a.support.length?a.support.slice(0,7).map(thesisItem).join(""):`<div class="sd-empty">Chưa có đủ lớp dữ liệu tạo thành điểm ủng hộ rõ ràng.</div>`;
  $("#riskList").innerHTML=a.risk.length?a.risk.slice(0,7).map(thesisItem).join(""):`<div class="sd-empty">Hiện chưa xuất hiện điểm đối nghịch nổi bật trong các dữ liệu đang có.</div>`;
  if($("#supportCount")) $("#supportCount").textContent=a.support.length?`${Math.min(a.support.length,7)} điểm tích cực`:"";
  if($("#riskCount")) $("#riskCount").textContent=a.risk.length?`${Math.min(a.risk.length,7)} điểm cần lưu ý`:"";
  if($("#changeCount")) $("#changeCount").textContent=a.change.length?`${a.change.length} điều kiện`:"";
  $("#scenarioGrid").innerHTML=a.scenarios.map(s=>scenarioCard(s.kind,s.title,s.condition,s.meaning,s.watch)).join("");
  $("#changeView").innerHTML=a.change.map(thesisItem).join("");
  $("#historyEdge").innerHTML=renderHistoryEdge(d);

  $("#overviewConfirm").innerHTML=[
    cell("Vượt đỉnh 20P",t.breakout_20d===true?"Có":t.breakout_20d===false?"Chưa":"—"),
    cell("Thủng đáy 20P",t.breakdown_20d===true?"Có":t.breakdown_20d===false?"Chưa":"—"),
    cell("KL / TB20",valid(t.volume_vs_avg20)?fmtNum(t.volume_vs_avg20)+"x":"—"),
    cell("ATR14 / Giá",valid(t.atr14_pct)?fmtPct(t.atr14_pct):"—"),
    cell("Vị trí biên 60P",valid(t.range60?.position_pct)?fmtPct(t.range60.position_pct):"—"),
    cell("Ngoại 5P",fmtCompact(f.window_5?.foreign_net_volume),"",cls(f.window_5?.foreign_net_volume)),
    cell("MA20 dốc",valid(t.ma20_slope_5d_pct)?fmtPct(t.ma20_slope_5d_pct):"—"),
    cell("MA50 dốc",valid(t.ma50_slope_10d_pct)?fmtPct(t.ma50_slope_10d_pct):"—")
  ].join("");
}
function renderTechnical(d){
 const t=d.technical||{};
 const q=d.live_quote||null;
 const arr=[
  ["Close D1",fmtNum(t.close)],["Giá hiện tại",q&&valid(q.price)?fmtNum(q.price):"—",q&&valid(q.change_pct)?fmtPct(q.change_pct):"Chưa có intraday"],["5 phiên",fmtPct(t.return_5d_pct)],[ "20 phiên",fmtPct(t.return_20d_pct)],
  ["60 phiên",fmtPct(t.return_60d_pct)],["MA10",fmtNum(t.ma10)],["MA20",fmtNum(t.ma20)],["MA50",fmtNum(t.ma50)],
  ["MA200",fmtNum(t.ma200)],["RSI14",fmtNum(t.rsi14)],["Đỉnh 20P trước",fmtNum(t.high20_prev)],["Đáy 20P trước",fmtNum(t.low20_prev)],
  ["Vượt đỉnh 20P",t.breakout_20d===true?"Có":t.breakout_20d===false?"Chưa":"—"],["Thủng đáy 20P",t.breakdown_20d===true?"Có":t.breakdown_20d===false?"Chưa":"—"],
  ["KL TB20",fmtNum(t.avg_volume_20,0)],["KL / TB20",valid(t.volume_vs_avg20)?fmtNum(t.volume_vs_avg20)+"x":"—"]
 ];
 const insight=[technicalInsight(t),momentumInsight(t)].filter(Boolean);
 $("#technicalGrid").innerHTML=arr.map(([a,b,sub])=>cell(a,b,sub||"")).join("")+
   (insight.length?`<div class="sd-analysis" style="grid-column:1/-1"><b>Nhận định:</b> ${insight.map(x=>esc(x[1])).join(" ")}</div>`:"");
}
function renderFlow(d){
 const f=d.flow||{};
 const one=(label,w)=>`<div class="sd-flow-card"><h3>${label}</h3>
   <div class="sd-flow-row"><span>Khối ngoại</span><b class="${cls(w?.foreign_net_volume)}">${fmtCompact(w?.foreign_net_volume)}</b></div>
   <div class="sd-flow-row"><span>Tự doanh</span><b class="${cls(w?.proprietary_net_volume)}">${fmtCompact(w?.proprietary_net_volume)}</b></div>
   <div class="sd-flow-row"><span>Chủ động mua/bán</span><b class="${cls(w?.active_net_volume)}">${fmtCompact(w?.active_net_volume)}</b></div>
   <div class="sd-flow-row"><span>Dư mua - dư bán</span><b class="${cls(w?.bid_ask_surplus_net_volume)}">${fmtCompact(w?.bid_ask_surplus_net_volume)}</b></div>
   <div class="sd-flow-row"><span>Số phiên có dữ liệu</span><b>${fmtNum(w?.rows_available,0)}</b></div>
 </div>`;
 const fi=flowInsight(f);
 $("#flowGrid").innerHTML=one("1 phiên",f.window_1)+one("5 phiên",f.window_5)+one("20 phiên",f.window_20)+
   (fi?`<div class="sd-analysis" style="grid-column:1/-1"><b>Nhận định:</b> ${esc(fi[1])}</div>`:"");
}
function renderFundamental(d){
 const b=d.fundamental||{};
 $("#fundamentalDate").textContent=b.snapshot_date?`Snapshot ${dateVN(b.snapshot_date)}`:"";
 if(!hasMeaningfulFundamental(b)){
   $("#fundamentalGrid").innerHTML=`<div class="sd-empty" style="grid-column:1/-1">Mã này hiện chưa có đủ dữ liệu Cơ bản để phân tích. Không diễn giải các giá trị 0 mặc định như dữ liệu thực.</div><div class="sd-analysis" style="grid-column:1/-1"><b>Nhận định:</b> Chưa đủ dữ liệu đáng tin cậy để kết luận phần Cơ bản của mã này.</div>`;
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
   (fi?`<div class="sd-analysis" style="grid-column:1/-1"><b>Nhận định:</b> ${esc(fi[1])}</div>`:"");
}
function renderHistory(d){
 const sig=d.signals||[], ev=d.market_events||[];
 $("#signalList").innerHTML=sig.length?sig.slice(0,8).map(s=>{
  const outs=(s.outcomes||[]).map(o=>`<span class="sd-outcome">T+${esc(o.horizon_sessions)}: <b class="${cls(o.return_pct)}">${fmtPct(o.return_pct)}</b></span>`).join("");
  return `<div class="sd-list-item"><header><strong>${esc(s.signal_label||s.signal_code||"Tín hiệu")}</strong><time>${dateVN(s.signal_date)}</time></header>${s.reason?`<p>${esc(s.reason)}</p>`:""}<div class="sd-outcomes">${outs}</div></div>`;
 }).join(""):`<div class="sd-empty">Chưa có tín hiệu HT gần đây.</div>`;
 $("#eventList").innerHTML=ev.length?ev.map(e=>`<div class="sd-list-item"><header><strong>${esc(e.title)}</strong><time>${dateVN(e.event_date)}</time></header><p>${esc(e.summary||"")}</p><small>${esc(e.category||"SK")} · cách ngày đang xem ${Math.abs(Number(e.days_from_event||0))} ngày</small></div>`).join(""):`<div class="sd-empty">Không có SK trong cửa sổ thời gian hiện tại.</div>`;
 const si=signalInsight(sig), ei=eventInsight(ev,d);
 if(si) $("#signalList").insertAdjacentHTML("beforeend",`<div class="sd-analysis"><b>Nhận định:</b> ${esc(si[1])}</div>`);
 if(ei) $("#eventList").insertAdjacentHTML("beforeend",`<div class="sd-analysis"><b>Nhận định:</b> ${esc(ei[1])}</div>`);
}
function render(d){
 current=d;
 document.title=`${d.symbol} | Hồ sơ cổ phiếu | Võ Hoàng`;
 $("#symbolTitle").textContent=d.symbol;
 $("#symbolInput").value=d.symbol;
 $("#effectiveDate").textContent="";
 renderOverview(d);renderTechnical(d);renderFlow(d);renderFundamental(d);renderHistory(d);
 setDataVisible(true);
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
 clearVisibleData();
 $("#symbolTitle").textContent=s||"—";
 if(!/^[A-Z0-9]{2,12}$/.test(s)){setStatus("Mã cổ phiếu chưa hợp lệ.",true);return}
 setStatus("Đang cập nhật dữ liệu…");
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
 }catch(err){
  clearVisibleData();
  setStatus(err?.message==="SYMBOL_NOT_ACTIVE_CORE"?"Mã này hiện chưa có dữ liệu trong hệ thống.":"Chưa đọc được dữ liệu mã này. Vui lòng thử lại.",true);
 }
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
