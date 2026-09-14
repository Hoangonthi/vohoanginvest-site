const VH_LANG_DECISION='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test';
const VH_LANG_MACRO='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/macro-anchor-public';
const VH_LANG_HOT='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed';

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const fmt=(v,d=1)=>{const x=num(v);return x==null?'—':x.toLocaleString('vi-VN',{maximumFractionDigits:d})};
const pct=(v,d=1)=>{const x=num(v);return x==null?'—':`${x>0?'+':''}${fmt(x,d)}%`};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clip=(s,n=220)=>{s=String(s||'').trim();return s.length>n?s.slice(0,n-1).trim()+'…':s};

function group(k){
  if(['MARKET_BREADTH','LIQUIDITY','LEADERSHIP','INDEX_MOVE'].includes(k))return'MARKET';
  if(['MACRO_VN','MACRO_US','RATE_EXPECTATION','FX_VND','ECONOMIC_EVENT','FOMC_EVENT'].includes(k))return'MACRO';
  if(['GLOBAL_EQUITY','FX_DOLLAR','BOND_YIELD','COMMODITY'].includes(k))return'GLOBAL';
  return'OTHER';
}
function score(x){return Number(x?.impact_score||0)+(x?.confidence==='CAO'?8:x?.confidence==='KHÁ'?4:0)}
function selectSignals(vars){
  const rows=(vars||[]).filter(x=>x&&x.kind!=='NEWS'&&Array.isArray(x.evidence)&&x.evidence.length).sort((a,b)=>score(b)-score(a));
  const picked=[];
  for(const g of ['MARKET','GLOBAL','MACRO']){const x=rows.find(r=>group(r.kind)===g&&!picked.includes(r));if(x)picked.push(x)}
  for(const x of rows){if(picked.length>=3)break;if(!picked.includes(x))picked.push(x)}
  return picked.slice(0,3);
}

function eventTitleVi(title,type){
  const t=String(title||'');
  if(type==='FOMC'||/FOMC/i.test(t))return 'Cuộc họp Fed và công bố quyết định lãi suất';
  if(/Import and Export Price Indexes/i.test(t))return 'Chỉ số giá xuất khẩu và nhập khẩu của Mỹ';
  if(/Consumer Price Index/i.test(t))return 'Chỉ số giá tiêu dùng của Mỹ (CPI)';
  if(/Producer Price Index/i.test(t))return 'Chỉ số giá sản xuất của Mỹ (PPI)';
  if(/Employment Situation/i.test(t))return 'Báo cáo việc làm của Mỹ';
  if(/Real Earnings/i.test(t))return 'Báo cáo thu nhập thực tế của người lao động Mỹ';
  return t.replace(/U\.S\./gi,'Mỹ').replace(/United States/gi,'Mỹ');
}
function eventSourceVi(source){
  if(String(source).toUpperCase()==='BLS')return 'Cục Thống kê Lao động Mỹ';
  if(String(source).toUpperCase()==='FED')return 'Cục Dự trữ Liên bang Mỹ';
  return source||'nguồn chính thức';
}
function nextEventText(decision){
  const ev=(decision?.upcoming_events||[]).filter(x=>num(x.hours_away)!=null&&num(x.hours_away)>=0&&num(x.hours_away)<=168).sort((a,b)=>a.hours_away-b.hours_away)[0];
  if(!ev)return 'Trong 7 ngày tới, hệ thống chưa ghi nhận sự kiện kinh tế Mỹ đủ lớn để làm thay đổi đáng kể mức độ thận trọng hiện tại.';
  const h=num(ev.hours_away)||0;
  const when=h<24?`trong khoảng ${Math.max(1,Math.round(h))} giờ tới`:`trong khoảng ${fmt(h/24,1)} ngày tới`;
  return `${eventSourceVi(ev.source)} dự kiến công bố ${eventTitleVi(ev.title,ev.type)} ${when}. Đây là mốc cần theo dõi vì kết quả có thể làm thay đổi kỳ vọng lãi suất, lợi suất trái phiếu Mỹ và đồng USD.`;
}
function fedPlain(fed){
  if(!fed?.ok)return 'Kỳ vọng lãi suất của Fed chưa có dữ liệu đủ tin cậy để kết luận.';
  const shift=num(fed.shift_5d_pct_point), implied=num(fed.implied_rate);
  if(fed.tone==='negative')return `Thị trường đang định giá mặt bằng lãi suất Fed cao hơn trước${shift!=null?` khoảng ${fmt(Math.abs(shift),3)} điểm % trong cửa sổ gần đây`:''}. Nói đơn giản: kỳ vọng Fed hạ lãi suất sớm đang giảm, nên điều kiện tài chính bên ngoài kém thuận lợi hơn cho cổ phiếu.`;
  if(fed.tone==='positive')return `Thị trường đang định giá mặt bằng lãi suất Fed thấp hơn trước${shift!=null?` khoảng ${fmt(Math.abs(shift),3)} điểm % trong cửa sổ gần đây`:''}. Nói đơn giản: kỳ vọng Fed hạ lãi suất đang tăng, đây là yếu tố hỗ trợ hơn cho định giá và dòng vốn.`;
  return `Kỳ vọng lãi suất Fed chưa dịch chuyển đủ mạnh để tạo hướng rõ${implied!=null?`; mức lãi suất bình quân hàm ý hiện khoảng ${fmt(implied,3)}%`:''}.`;
}
function hotRows(hot,limit=3){
  return (hot?.stocks||[]).filter(x=>num(x.change_pct)!=null).sort((a,b)=>(num(b.value_traded_bn)||0)-(num(a.value_traded_bn)||0)).slice(0,limit);
}
function hotPlain(hot){
  const rows=hotRows(hot,3);
  if(!rows.length)return 'Hiện chưa có cổ phiếu nào đủ tiêu chuẩn dòng tiền để đưa vào danh sách theo dõi ngắn hạn.';
  const s=rows.map(x=>`${x.symbol} ${pct(x.change_pct)} với giá trị giao dịch khoảng ${fmt(x.value_traded_bn,1)} tỷ đồng`).join('; ');
  return `Dòng tiền ngắn hạn đang tập trung đáng chú ý tại ${s}. Đây là các mã nên đưa vào danh sách quan sát T+, chưa phải tín hiệu để mua đuổi.`;
}
function marketBreadthText(x){
  if(x?.direction==='negative')return 'Số mã giảm đang chiếm ưu thế, vì vậy chưa phù hợp để mở rộng danh mục hoặc mua thêm trên diện rộng. Nếu giao dịch, chỉ nên chọn những cổ phiếu khỏe hơn thị trường và có dòng tiền riêng.';
  if(x?.direction==='positive')return 'Số mã tăng đang lan tỏa tốt hơn. Đây là điều kiện thuận lợi hơn để mở rộng danh mục có chọn lọc, với điều kiện thanh khoản và nhóm dẫn dắt cùng xác nhận.';
  return 'Số mã tăng và giảm đang khá cân bằng, nên lợi thế chưa đủ rõ để tăng tỷ trọng. Tiếp tục giữ vị thế tốt và chờ sự lan tỏa rõ hơn.';
}
function liquidityText(x){
  if(x?.direction==='negative')return 'Tiền vào thị trường đang thấp hơn mức thường thấy cùng thời điểm. Vì vậy các nhịp tăng dễ thiếu độ bền; chưa nên mua đuổi hoặc tăng mạnh tỷ trọng.';
  if(x?.direction==='positive')return 'Thanh khoản đang cao hơn mức thường thấy cùng thời điểm. Nếu đi cùng số mã tăng và nhóm dẫn dắt khỏe, đây là cơ sở để nâng mức chủ động.';
  return 'Thanh khoản đang quanh mức bình thường, chưa tạo thêm lợi thế rõ ràng cho bên mua hoặc bên bán.';
}
function signalView(x){
  const evidence=(x?.evidence||[]).join(' · ');
  switch(x?.kind){
    case'MARKET_BREADTH':
      return {cat:'ĐỘ RỘNG THỊ TRƯỜNG',headline:x.direction==='negative'?'Chưa nên mở rộng danh mục trên diện rộng':x.direction==='positive'?'Độ lan tỏa đang ủng hộ mua chọn lọc hơn':'Thị trường chưa có độ lan tỏa đủ rõ',impact:marketBreadthText(x),conclusion:marketBreadthText(x),chain:'Số mã tăng/giảm → mức độ lan tỏa của dòng tiền → độ tin cậy của VN-Index → quyết định có nên mở rộng danh mục hay không.',short:marketBreadthText(x),long:'Độ rộng chủ yếu dùng cho quyết định vài phiên; không dùng một mình để kết luận xu hướng 3–12 tháng.',watch:'Nếu số mã tăng cải thiện rõ và thanh khoản cùng tăng, có thể nâng mức chủ động. Nếu số mã giảm tiếp tục áp đảo, ưu tiên bảo toàn vốn.',evidence};
    case'LIQUIDITY':
      return {cat:'DÒNG TIỀN THỊ TRƯỜNG',headline:x.direction==='negative'?'Dòng tiền chưa đủ khỏe để mua đuổi':x.direction==='positive'?'Dòng tiền đang hỗ trợ nhịp tăng tốt hơn':'Thanh khoản chưa tạo lợi thế rõ',impact:liquidityText(x),conclusion:liquidityText(x),chain:'Thanh khoản → khả năng hấp thụ lượng cổ phiếu bán ra → độ bền của nhịp tăng/hồi phục → mức độ chủ động khi giải ngân.',short:liquidityText(x),long:'Thanh khoản vài phiên chỉ phản ánh trạng thái ngắn hạn; xu hướng trung hạn vẫn phải đọc cùng lợi nhuận doanh nghiệp, lãi suất và vĩ mô.',watch:'Chỉ nâng mức chủ động khi thanh khoản cải thiện đồng thời với độ rộng và nhóm dẫn dắt.',evidence};
    case'BOND_YIELD':
      return {cat:'LÃI SUẤT QUỐC TẾ',headline:x.direction==='negative'?'Lợi suất Mỹ tăng đang gây thêm áp lực lên định giá':'Lợi suất Mỹ giảm đang làm áp lực chi phí vốn dịu bớt',impact:x.direction==='negative'?'Lợi suất trái phiếu Mỹ tăng làm tài sản an toàn hấp dẫn hơn và mức sinh lời yêu cầu đối với cổ phiếu cao hơn. Ngắn hạn, điều này có thể gây áp lực lên tâm lý, đồng USD và dòng vốn vào thị trường mới nổi; nếu kéo dài nhiều tuần, tác động sẽ rõ hơn lên định giá và chi phí vốn.':'Lợi suất trái phiếu Mỹ giảm giúp giảm bớt áp lực lên định giá và dòng vốn. Tuy nhiên cần xem đồng USD và kỳ vọng Fed có cùng hạ nhiệt hay không.',conclusion:x.direction==='negative'?'Lợi suất Mỹ đang tăng đủ mạnh để trở thành yếu tố bất lợi cho tài sản rủi ro, nhưng chưa thể dùng riêng tín hiệu này để kết luận VN-Index sẽ giảm.':'Lợi suất Mỹ đang hạ nhiệt, tạo môi trường bên ngoài thuận lợi hơn; vẫn cần thị trường Việt Nam xác nhận bằng độ rộng và dòng tiền.',chain:'Lợi suất Mỹ → sức hấp dẫn của tài sản an toàn bằng USD → mức sinh lời yêu cầu đối với cổ phiếu → định giá; đồng thời tác động tới đồng USD → dòng vốn quốc tế → tỷ giá và khối ngoại tại Việt Nam.',short:'Trong vài phiên tới, ưu tiên theo dõi phản ứng của DXY, USD/VND, khối ngoại và độ rộng thị trường Việt Nam.',long:x.direction==='negative'?'Nếu lợi suất duy trì ở vùng cao trong nhiều tuần, áp lực sẽ chuyển từ tâm lý sang định giá, chi phí vốn và dư địa điều hành tiền tệ.':'Nếu lợi suất tiếp tục giảm bền vững, điều kiện vốn quốc tế sẽ hỗ trợ hơn cho định giá và thị trường mới nổi.',watch:'Đánh giá sẽ dịu lại nếu lợi suất và DXY cùng hạ, trong khi tỷ giá và dòng tiền trong nước ổn định.',evidence};
    case'MACRO_US':
      return {cat:'VĨ MÔ MỸ',headline:x.direction==='negative'?'Lạm phát Mỹ còn cao, Fed khó hạ lãi suất nhanh':'Lạm phát Mỹ đang hạ nhiệt, kỳ vọng giảm lãi suất có cơ sở hơn',impact:x.direction==='negative'?'Lạm phát cao khiến Fed khó nới lỏng sớm. Nếu thị trường tiếp tục nâng kỳ vọng lãi suất, lợi suất trái phiếu và đồng USD có thể duy trì ở mức cao, từ đó gây áp lực lên định giá và dòng vốn vào thị trường mới nổi.':'Lạm phát hạ nhiệt giúp tăng dư địa giảm lãi suất, nhưng cần thêm xác nhận từ việc làm, lợi suất và phản ứng của Fed.',conclusion:x.direction==='negative'?'Số liệu lạm phát hiện chưa tạo điều kiện để Fed hạ lãi suất nhanh. Đây là yếu tố bất lợi vừa phải cho định giá, đặc biệt nếu lợi suất Mỹ và đồng USD cùng tăng.':'Lạm phát đang đi theo hướng thuận lợi hơn cho kỳ vọng giảm lãi suất, nhưng chưa nên kết luận chỉ từ một kỳ số liệu.',chain:'Lạm phát Mỹ → kỳ vọng chính sách Fed → lợi suất trái phiếu và đồng USD → chi phí vốn toàn cầu → dòng vốn và định giá tại Việt Nam.',short:'Trong ngắn hạn, phản ứng của lợi suất và đồng USD sau số liệu quan trọng hơn bản thân con số CPI đứng riêng lẻ.',long:'Nếu lạm phát giảm đều trong nhiều tháng, điều kiện tài chính sẽ dần thuận lợi hơn; nếu quay tăng, áp lực giữ lãi suất cao sẽ kéo dài.',watch:'Theo dõi CPI/PPI, báo cáo việc làm, phát biểu Fed, US10Y và DXY.',evidence};
    case'RATE_EXPECTATION':
      return {cat:'KỲ VỌNG LÃI SUẤT FED',headline:x.direction==='negative'?'Thị trường đang giảm kỳ vọng Fed hạ lãi suất sớm':x.direction==='positive'?'Thị trường đang tăng kỳ vọng Fed hạ lãi suất':'Kỳ vọng lãi suất Fed chưa thay đổi rõ',impact:fedPlain(window.__vhAdvisorDecision?.macro?.fed_expectation||{}),conclusion:fedPlain(window.__vhAdvisorDecision?.macro?.fed_expectation||{}),chain:'Kỳ vọng lãi suất Fed → lợi suất trái phiếu Mỹ và đồng USD → chi phí vốn/dòng vốn quốc tế → tỷ giá và định giá cổ phiếu Việt Nam.',short:'Trong T+1–T+5, đây là yếu tố ảnh hưởng tâm lý và dòng vốn; chưa đủ để quyết định mua/bán nếu thị trường Việt Nam không cùng xác nhận.',long:'Nếu kỳ vọng lãi suất cao hơn kéo dài nhiều tuần, định giá và tỷ giá mới chịu ảnh hưởng rõ hơn. Nếu kỳ vọng giảm lãi suất quay lại, áp lực sẽ dịu bớt.',watch:'Sau các số liệu CPI, PPI, việc làm hoặc cuộc họp Fed, kiểm tra xem kỳ vọng lãi suất có tiếp tục dịch chuyển cùng hướng hay không.',evidence};
    case'FX_DOLLAR':
      return {cat:'ĐỒNG USD',headline:x.direction==='negative'?'Đồng USD mạnh hơn đang tạo thêm áp lực bên ngoài':'Đồng USD yếu đi giúp giảm bớt áp lực tỷ giá',impact:x.direction==='negative'?'USD mạnh thường khiến dòng vốn vào thị trường mới nổi thận trọng hơn và gây thêm áp lực lên tỷ giá. Với Việt Nam, cần xem USD/VND và khối ngoại có cùng xấu đi hay không.':'USD yếu bớt giúp môi trường bên ngoài thuận lợi hơn cho tỷ giá và dòng vốn.',conclusion:x.summary||'',chain:'DXY → sức mạnh đồng USD → dòng vốn quốc tế và tỷ giá → chi phí vốn/định giá tại Việt Nam.',short:'Tác động ngắn hạn rõ nhất qua tỷ giá, khối ngoại và tâm lý.',long:'Chỉ nâng thành rủi ro trung hạn nếu USD mạnh kéo dài và tỷ giá trong nước cùng chịu áp lực.',watch:x.watch||'Theo dõi DXY cùng USD/VND.',evidence};
    case'INDEX_MOVE':
      return {cat:'VN-INDEX',headline:x.direction==='negative'?'Chỉ số đang suy yếu; ưu tiên kiểm soát vị thế':'Chỉ số tăng, nhưng cần kiểm tra chất lượng bên dưới',impact:x.direction==='negative'?'VN-Index giảm chỉ đáng lo hơn khi đi cùng số mã giảm áp đảo và dòng tiền yếu. Nếu chỉ số giảm nhưng nhiều cổ phiếu vẫn giữ nền tốt, ưu tiên chọn lọc thay vì bán đồng loạt.':'VN-Index tăng chỉ đáng tin hơn khi số mã tăng và thanh khoản cùng cải thiện.',conclusion:x.summary||'',chain:'VN-Index → phản ánh bề mặt thị trường; độ rộng + dòng tiền → kiểm tra chất lượng thật của nhịp tăng/giảm.',short:x.action_effect||'',long:'Biến động chỉ số vài phiên không thay thế đánh giá vĩ mô 3–12 tháng.',watch:x.watch||'',evidence};
    default:
      return {cat:String(x?.scope||x?.kind||'TÍN HIỆU').replace(/_/g,' '),headline:x?.title||'Tín hiệu cần theo dõi',impact:x?.action_effect||x?.summary||'',conclusion:x?.summary||'',chain:`${x?.title||'Tín hiệu'} → kỳ vọng thị trường → phản ứng giá và dòng tiền → hành động.`,short:x?.action_effect||'',long:'Chỉ nâng thành kết luận trung hạn khi tín hiệu kéo dài và được nhiều dữ liệu khác xác nhận.',watch:x?.watch||'Theo dõi dữ liệu tiếp theo.',evidence};
  }
}

function macroTone(macro,decision){
  if(macro?.ok){
    const regime=String(macro.regime||'').toUpperCase();
    if(regime.includes('TÍCH CỰC'))return {label:macro.regime,txt:`Nền 3–12 tháng hiện vẫn nghiêng tích cực. ${macro.thesis||''} Trong quá trình vận động, đánh giá này có thể thay đổi nếu tăng trưởng, lạm phát, tỷ giá hoặc điều kiện tiền tệ xấu đi đủ rõ.`};
    if(regime.includes('TIÊU CỰC')||regime.includes('RỦI RO'))return {label:macro.regime,txt:`Nền 3–12 tháng hiện nghiêng thận trọng. ${macro.thesis||''} Đánh giá sẽ được nâng lại khi tăng trưởng, lạm phát, tỷ giá và điều kiện tiền tệ đồng thời cải thiện.`};
    return {label:macro.regime||'TRUNG TÍNH',txt:`Nền 3–12 tháng hiện chưa nghiêng rõ về tích cực hay tiêu cực. ${macro.thesis||''} Đánh giá sẽ thay đổi khi chuỗi dữ liệu mới đủ mạnh để xác nhận một hướng rõ hơn.`};
  }
  const fed=decision?.macro?.fed_expectation;
  return {label:'TRUNG TÍNH / CHỜ XÁC NHẬN',txt:`Dữ liệu nền chưa đầy đủ để nâng hoặc hạ đánh giá trung hạn. ${fedPlain(fed)} Trong lúc này, không nên dùng riêng biến động ngắn hạn để kết luận xu hướng 3–12 tháng.`};
}
function shortSummary(decision,hot){
  const score=num(decision?.market?.state?.score);
  const tone=decision?.evaluation?.decision_tone;
  const open=tone==='negative'?'Ngắn hạn đang nghiêng thận trọng.':tone==='positive'?'Ngắn hạn đang thuận lợi hơn, nhưng vẫn cần chọn lọc.':'Ngắn hạn chưa có lợi thế đủ rõ cho bên mua hoặc bên bán.';
  const s=score!=null?` Điểm trạng thái thị trường hiện ${Math.round(score)}/100.`:'';
  return `${open}${s} ${nextEventText(decision)} ${fedPlain(decision?.macro?.fed_expectation)} ${hotPlain(hot)}`;
}
function rewriteEvidence(x){
  if(x?.kind==='MACRO_US'){
    const us=window.__vhAdvisorDecision?.macro?.united_states?.items?.find(i=>i.id==='us-cpi');
    if(us)return `Cục Thống kê Lao động Mỹ · ${us.period} · CPI ${fmt(us.yoy,2)}% so với cùng kỳ${num(us.mom)!=null?` · ${fmt(us.mom,2)}% so với tháng trước`:''}`;
  }
  if(x?.kind==='RATE_EXPECTATION'){
    const fed=window.__vhAdvisorDecision?.macro?.fed_expectation;
    if(fed?.ok)return `Mức lãi suất bình quân hàm ý khoảng ${fmt(fed.implied_rate,3)}% · thay đổi ${fmt(fed.shift_5d_pct_point,3)} điểm % trong cửa sổ gần đây`;
  }
  if(x?.kind==='BOND_YIELD')return (x.evidence||[]).join(' · ').replace(/US10Y/g,'Lợi suất trái phiếu Mỹ 10 năm').replace(/bps/g,'điểm cơ bản');
  return (x?.evidence||[]).join(' · ').replace(/bps/g,'điểm cơ bản');
}

function rewriteDashboard(host,decision,macro,hot){
  window.__vhAdvisorDecision=decision;
  const sigs=selectSignals(decision?.variables);
  const macroView=macroTone(macro,decision);

  const headP=q('.vh5-head p',host);if(headP)headP.textContent='Đọc nhanh theo 5 bước: kết luận hôm nay → điều gì đang tác động mạnh nhất → nền 3–12 tháng → việc nên làm → kịch bản có thể xảy ra.';
  const quote=q('.vh5-quote',host);if(quote)quote.innerHTML='Không cần nhiều thông tin hơn.<br>Cần hiểu đúng thông tin đang có.';

  const hz=qa('.vh5-horizon',host);
  if(hz[0]){const b=q('b',hz[0]),p=q('p',hz[0]);if(b)b.textContent='Ngắn hạn (1–5 phiên)';if(p)p.textContent=shortSummary(decision,hot)}
  if(hz[1]){const b=q('b',hz[1]),p=q('p',hz[1]);if(b)b.textContent='Trung – dài hạn (3–12 tháng)';if(p)p.textContent=macroView.txt}

  const sections=qa('.vh5-section',host);
  const signalCards=sections[0]?qa('.vh5-card',sections[0]):[];
  signalCards.forEach((card,i)=>{const x=sigs[i];if(!x)return;const v=signalView(x);const cat=q('.vh5-cat',card),h3=q('h3',card),ev=q('.vh5-evidence',card),imp=q('.vh5-impact',card);if(cat)cat.textContent=v.cat;if(h3)h3.textContent=v.headline;if(ev)ev.textContent=rewriteEvidence(x);if(imp)imp.textContent='→ '+v.impact});

  if(sections[1]){const note=q('.vh5-sec-note',sections[1]);if(note)note.textContent='Đánh giá xu hướng 3–12 tháng: đang ủng hộ hay cản trở thị trường?';const reg=q('.vh5-macro-regime',sections[1]);if(reg)reg.innerHTML=`<b>${esc(macroView.label)}</b> · ${esc(macroView.txt)}`}

  if(sections[2]){
    const note=q('.vh5-sec-note',sections[2]);if(note)note.textContent='Chuyển dữ liệu thành hành động cụ thể cho danh mục.';
    const watch=q('.vh5-action.watch',sections[2]);
    if(watch){const cap=q('.vh5-watch-caption',watch);if(cap)cap.textContent='Các mã đang nổi bật theo bộ lọc dòng tiền ngắn hạn; dùng để theo dõi, không phải khuyến nghị mua/bán.';const chips=q('.vh5-stock-mini',watch);if(chips&&!hotRows(hot,3).length)chips.innerHTML='<div class="vh5-stock-chip"><b>Chưa có mã phù hợp</b><span>Tiếp tục chờ tín hiệu dòng tiền rõ hơn</span></div>'}
  }

  if(sections[3]){
    const note=q('.vh5-sec-note',sections[3]);if(note)note.textContent='Ba khả năng cho 1–3 phiên tới và điều kiện để thay đổi cách hành động.';
    const sc=qa('.vh5-scenario',sections[3]);if(sc[0]){const b=q('b',sc[0]);if(b)b.textContent='KỊCH BẢN CƠ SỞ'}
  }

  qa('*',host).forEach(el=>{
    if(el.children.length===0&&el.textContent){
      el.textContent=el.textContent.replace(/Market Score/g,'Điểm trạng thái thị trường').replace(/breadth/gi,'độ rộng').replace(/liquidity/gi,'dòng tiền').replace(/hawkish/gi,'thiên về giữ lãi suất cao').replace(/dovish/gi,'thiên về hạ lãi suất').replace(/BASE/g,'KỊCH BẢN CƠ SỞ');
    }
  });

  let activeButton=null;
  qa('[data-vh5-type]',host).forEach(btn=>{
    btn.addEventListener('pointerenter',()=>{activeButton=btn});
    btn.addEventListener('click',()=>{activeButton=btn});
  });
  const popIn=q('.vh5-pop-in',host);
  if(popIn){
    const obs=new MutationObserver(()=>{
      if(!activeButton||!popIn.children.length)return;
      const type=activeButton.dataset.vh5Type,idx=Number(activeButton.dataset.vh5Index);
      if(type==='signal'){
        const x=sigs[idx];if(!x)return;const v=signalView(x);const src=sourceFor(x);
        popIn.innerHTML=`<div class="vh5-pop-top"><div><div class="vh5-kicker">${esc(v.cat)}</div><h3>${esc(v.headline)}</h3></div><button class="vh5-close" type="button">− Thu lại</button></div><div class="vh5-block"><b>Kết luận ngắn hạn</b><p>${esc(v.conclusion)}</p></div><div class="vh5-block"><b>Vì sao tín hiệu này quan trọng?</b><div class="vh5-chain">${esc(v.chain)}</div></div><div class="vh5-block"><b>Tác động trong vài phiên tới</b><p>${esc(v.short)}</p></div><div class="vh5-block"><b>Nếu xu hướng kéo dài</b><p>${esc(v.long)}</p></div><div class="vh5-block"><b>Số liệu đang dùng</b><div>${esc(rewriteEvidence(x))}</div></div><div class="vh5-block"><b>Khi nào đánh giá thay đổi?</b><p>${esc(v.watch)}</p></div><div class="vh5-source">${src.map(s=>`<a href="${esc(s.href)}" ${String(s.href).startsWith('http')?'target="_blank" rel="noopener noreferrer"':''}>Nguồn: ${esc(s.label)} ↗</a>`).join('')}</div>`;
      }else if(type==='macro'){
        const x=(macro?.cards||[])[idx];if(!x)return;
        popIn.innerHTML=`<div class="vh5-pop-top"><div><div class="vh5-kicker">VĨ MÔ · 3–12 THÁNG</div><h3>${esc(x.title)}</h3></div><button class="vh5-close" type="button">− Thu lại</button></div><div class="vh5-block"><b>Kết luận hiện tại</b><p>${esc(x.conclusion||'')}</p></div><div class="vh5-block"><b>Số liệu chính</b><div>${(x.evidence||[]).map(e=>`• ${esc(e)}`).join('<br>')}</div></div><div class="vh5-block"><b>Vì sao ảnh hưởng tới thị trường?</b><p>${esc(x.mechanism||'')}</p></div><div class="vh5-block"><b>Điểm cần thận trọng</b><p>${esc(x.contradiction||'')}</p></div><div class="vh5-block"><b>Ý nghĩa với cổ phiếu</b><p>${esc(x.market_implication||'')}</p></div><div class="vh5-block"><b>Khi nào đánh giá thay đổi?</b><p>${esc(x.watch||'')}</p></div><div class="vh5-source"><a href="https://www.nso.gov.vn/" target="_blank" rel="noopener noreferrer">Nguồn chính thức: Cơ quan Thống kê Quốc gia ↗</a></div>`;
      }
    });
    obs.observe(popIn,{childList:true});
  }
}
function sourceFor(x){
  if(group(x?.kind)==='MARKET')return[{label:'Dữ liệu thị trường Việt Nam',href:'thi-truong-hom-nay.html'}];
  if(x?.kind==='MACRO_US')return[{label:'Cục Thống kê Lao động Mỹ',href:'https://www.bls.gov/'}];
  if(['RATE_EXPECTATION','FOMC_EVENT'].includes(x?.kind))return[{label:'Cục Dự trữ Liên bang Mỹ',href:'https://www.federalreserve.gov/monetarypolicy.htm'}];
  if(x?.kind==='MACRO_VN')return[{label:'Cơ quan Thống kê Quốc gia',href:'https://www.nso.gov.vn/'}];
  return[{label:'Tin tức & dữ liệu 24h',href:'tin-tuc-24h.html'}];
}
async function getJson(url){const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});const j=await r.json();if(!r.ok||!j?.ok)throw new Error(j?.error||`HTTP ${r.status}`);return j}
async function waitHost(){for(let i=0;i<80;i++){const h=document.getElementById('vhDecisionBoardV5');if(h)return h;await new Promise(r=>setTimeout(r,100))}return null}
async function initAdvisorLanguage(){
  const host=await waitHost();if(!host)return;
  try{
    const [decision,macro,hot]=await Promise.all([getJson(VH_LANG_DECISION),getJson(VH_LANG_MACRO).catch(()=>({ok:false})),getJson(VH_LANG_HOT).catch(()=>({ok:false,stocks:[]}))]);
    rewriteDashboard(host,decision,macro,hot);
  }catch(e){console.warn('advisor-language',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAdvisorLanguage,{once:true});else initAdvisorLanguage();