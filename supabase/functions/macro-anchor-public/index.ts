import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED=new Set(["https://www.vohoanginvest.com","https://vohoanginvest.com","https://hoangonthi.github.io","http://localhost:3000","http://127.0.0.1:5500"]);
function cors(req:Request){const o=req.headers.get("origin")||"";return{"Access-Control-Allow-Origin":ALLOWED.has(o)?o:"https://www.vohoanginvest.com","Access-Control-Allow-Methods":"GET,OPTIONS","Access-Control-Allow-Headers":"content-type","Cache-Control":"no-store, max-age=0","Vary":"Origin"}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),"Content-Type":"application/json; charset=utf-8"}})}
function num(v:any){const x=Number(v);return Number.isFinite(x)?x:null}
function fmt(v:any,d=1){const x=num(v);return x===null?"—":x.toLocaleString("vi-VN",{minimumFractionDigits:0,maximumFractionDigits:d})}
function plus(v:any,d=1){const x=num(v);return x===null?"—":`${x>0?"+":""}${fmt(x,d)}%`}
function card(id:string,title:string,status:string,tone:string,evidence:string[],conclusion:string,mechanism:string,contradiction:string,watch:string,market_implication:string){return{id,title,status,tone,evidence,conclusion,mechanism,contradiction,watch,market_implication}}
function clean(v:any){return String(v??"").replace(/\s+/g," ").trim()}
function norm(v:any){return clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function facts(e:any){return [e?.event_title,...(e?.fact_summary?.latest||[]).map((x:any)=>x?.statement)].map(clean).filter(Boolean)}
function independents(e:any){return Number(e?.verification?.independent_sources||0)}
function actualFedDecision(events:any[]){
  const actual=/\b(rate hike|hiked rates?|raises? (?:the )?(?:federal funds )?rate|tang lai suat|nang lai suat)\b/i;
  const future=/\b(sap tang|co the tang|du kien tang|ky vong tang|truoc them|neu chot tang|expected to hike|may hike|could hike|likely to hike|before (?:the )?fed)\b/i;
  const candidates=(events||[]).filter((e:any)=>{
    const t=norm(facts(e).join(" | "));
    return actual.test(t)&&!future.test(t);
  }).sort((a:any,b:any)=>{
    const sa=(Number(a?.impact_score)||0)+(Number(a?.confidence_score)||0)*.35+independents(a)*18+(String(a?.fact_summary?.content_type||"").toUpperCase()==="FACT"?15:0);
    const sb=(Number(b?.impact_score)||0)+(Number(b?.confidence_score)||0)*.35+independents(b)*18+(String(b?.fact_summary?.content_type||"").toUpperCase()==="FACT"?15:0);
    return sb-sa||new Date(b?.last_seen_at||0).getTime()-new Date(a?.last_seen_at||0).getTime();
  });
  const hit=candidates[0];
  if(!hit)return null;
  const allText=norm((events||[]).flatMap((e:any)=>facts(e)).join(" | "));
  const hawkishForward=/tiep tuc tang|tang them|them mot dot tang|dieu chinh tiep|hiking again|further (?:rate )?increase|additional (?:rate )?hike|more (?:rate )?hikes|hawkish outlook|continue tightening/.test(allText);
  let bps:number|null=null;
  for(const e of candidates.slice(0,8))for(const o of e?.number_summary?.observations||[]){
    const v=num(o?.value),u=String(o?.unit||"").toLowerCase(),ctx=norm(o?.context||"");
    if(v===null)continue;
    if(u==="bps"&&v>0&&v<=200){bps=v;break}
    if((u==="point"||u==="%")&&v>0&&v<=2&&/(fed|lai suat|rate)/.test(ctx)){bps=v*100;break}
  }
  const seen=hit?.last_seen_at||null;
  const move=bps!=null?` ${fmt(bps,0)} điểm cơ bản`:"";
  const text=`Fed đã tăng lãi suất${move}; đây là quyết định đã công bố, không còn là kỳ vọng trước sự kiện${hawkishForward?", đồng thời tín hiệu hiện tại cho thấy khả năng còn thắt chặt thêm trong năm":""}.`;
  return{ok:true,kind:"ACTUAL_FED_DECISION",direction:"RISK_UP",tone:"negative",strength:hawkishForward?4:3,label:hawkishForward?"FED ĐÃ TĂNG LÃI SUẤT · RỦI RO BÊN NGOÀI TĂNG":"FED ĐÃ TĂNG LÃI SUẤT",text,occurred_at:seen,event_id:hit?.id||null,event_title:hit?.event_title||null,rate_move_bps:bps,hawkish_forward:hawkishForward,independent_sources:Math.max(...candidates.map(independents),0),source_priority:100};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="GET")return json(req,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")||"https://elmrbnewlukxscbcfizg.supabase.co";
    const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!key)throw new Error("SERVICE_ROLE_NOT_AVAILABLE");
    const headers={apikey:key,Authorization:`Bearer ${key}`,Accept:"application/json"};
    const since=new Date(Date.now()-48*3600_000).toISOString();
    const macroUrl=`${url}/rest/v1/vietnam_macro_monthly_snapshots?select=month_key,coverage_end,source_label,payload&order=month_key.desc&limit=1`;
    const fedUrl=new URL(`${url}/rest/v1/news_intelligence_events`);
    fedUrl.searchParams.set("select","id,event_title,event_type,last_seen_at,direction,impact_score,confidence_score,verification,fact_summary,number_summary,market_confirmation,vietnam_transmission");
    fedUrl.searchParams.set("status","eq.ACTIVE");
    fedUrl.searchParams.set("event_type","eq.FED_RATES");
    fedUrl.searchParams.set("last_seen_at",`gte.${since}`);
    fedUrl.searchParams.set("order","last_seen_at.desc");
    fedUrl.searchParams.set("limit","80");
    const [r,fedR]=await Promise.all([fetch(macroUrl,{headers}),fetch(fedUrl,{headers})]);
    if(!r.ok)throw new Error(`MACRO_SNAPSHOT_${r.status}`);
    const rows=await r.json();const row=rows?.[0];if(!row)throw new Error("NO_MACRO_SNAPSHOT");
    const fedEvents=fedR.ok?await fedR.json():[];
    const fedDecision=actualFedDecision(fedEvents);
    const p=row.payload||{},s=p.latest_summary||{};
    const gdp=s.gdp_6m_yoy,iip=s.iip_8m_yoy,fdiReal=s.fdi_disbursed_8m_yoy,fdiReg=s.fdi_registered_8m_yoy,publicInv=s.public_investment_8m_yoy,publicPlan=s.public_investment_plan_pct,retailReal=s.retail_real_8m_yoy,cpi=s.cpi_aug_yoy,core=s.core_inflation_8m,trade=s.trade_balance_8m_usd_billion,imports=s.imports_8m_yoy,enterprise=s.enterprises_new_plus_returned_8m_yoy;
    const importLatest=Array.isArray(p.imports)?p.imports.at(-1):null;const productionShare=importLatest?.production_inputs_share_pct;
    const enterpriseLatest=Array.isArray(p.enterprises)?p.enterprises.at(-1):null;
    const creditLatest=Array.isArray(p.credit_money)?p.credit_money.at(-1):null;
    const policyEvidence=fedDecision?[fedDecision.text,`CPI T8: ${plus(cpi,2)} YoY · cơ bản 8T: ${plus(core,2)}`,`Cán cân thương mại 8T: ${fmt(trade,2)} tỷ USD`]:[`CPI T8: ${plus(cpi,2)} YoY · cơ bản 8T: ${plus(core,2)}`,`Cán cân thương mại 8T: ${fmt(trade,2)} tỷ USD`,`Nhập khẩu 8T: ${plus(imports,1)} · đầu vào sản xuất ${fmt(productionShare,1)}%`];
    const policyStatus=fedDecision?"RỦI RO TIỀN TỆ TĂNG":"CẦN THEO DÕI CHẶT";
    const policyConclusion=fedDecision?`${fedDecision.text} Nền tăng trưởng trong nước vẫn là lực đỡ, nhưng chi phí vốn quốc tế cao hơn làm biên an toàn giảm và tăng yêu cầu theo dõi tỷ giá, lợi suất và dòng vốn.`:"Rủi ro chính của thị trường trung hạn không nằm ở tăng trưởng hiện tại, mà ở khả năng lạm phát và cân đối ngoại tệ khiến điều kiện tiền tệ bớt thuận lợi.";
    const policyWatch=fedDecision?"Theo dõi phản ứng sau quyết định Fed qua DXY, lợi suất trái phiếu Mỹ, USD/VND, lãi suất liên ngân hàng và dòng vốn ngoại. Hạ đánh giá thêm nếu các biến này cùng xấu đi; giảm mức cảnh báo nếu phản ứng hạ nhiệt và điều kiện tiền tệ trong nước vẫn ổn định.":"Theo dõi USD/VND, lãi suất liên ngân hàng, OMO, tăng trưởng tiền gửi so tín dụng và CPI tháng tới.";
    const cards=[
      card("growth","Tăng trưởng & sản xuất","LỰC ĐỠ MẠNH","positive",[`GDP 6T: ${plus(gdp,2)} YoY`,`IIP 8T: ${plus(iip,1)} YoY`,`FDI thực hiện 8T: ${plus(fdiReal,1)} YoY`],"Nền kinh tế vẫn ở pha mở rộng mạnh; sản xuất và vốn đầu tư là hai động lực quan trọng, không chỉ dựa vào tiêu dùng.","IIP tăng hai chữ số cùng FDI thực hiện tăng cho thấy công suất sản xuất đang được bổ sung và sử dụng. Điều này hỗ trợ kỳ vọng doanh thu/lợi nhuận của nhiều doanh nghiệp niêm yết trong trung hạn.","Tăng trưởng tổng thể mạnh chưa có nghĩa mọi doanh nghiệp cùng hưởng lợi; mức độ lan tỏa cần được kiểm tra qua lợi nhuận, đơn hàng và dòng tiền từng ngành.","Theo dõi IIP, FDI thực hiện, tăng trưởng tín dụng và lợi nhuận doanh nghiệp để xem đà mở rộng có tiếp tục lan tỏa hay không.","Ủng hộ nền 3–12 tháng cho cổ phiếu nếu điều kiện tiền tệ không xấu đi đáng kể."),
      card("demand","Đầu tư & cầu nội địa","ĐỘNG LỰC CÒN RỘNG","positive",[`Đầu tư công 8T: ${plus(publicInv,1)} · mới ${fmt(publicPlan,1)}% kế hoạch`,`Bán lẻ thực 8T: ${plus(retailReal,1)} YoY`,`FDI đăng ký 8T: ${plus(fdiReg,1)} YoY`],"Động lực tăng trưởng không chỉ nằm ở một trụ: đầu tư công, tiêu dùng thực và dòng vốn FDI đều đang hỗ trợ hoạt động kinh tế.","Giải ngân đầu tư công tăng trong khi tỷ lệ hoàn thành kế hoạch mới khoảng một nửa hàm ý còn dư địa thực thi nếu mục tiêu năm được theo đuổi. Bán lẻ thực tăng cho thấy cầu nội địa vẫn tăng sau khi loại ảnh hưởng giá.",`Điểm cần lưu ý là số doanh nghiệp thành lập mới + quay lại 8T ${plus(enterprise,1)} YoY${enterpriseLatest?.aug_new_yoy!=null?`; riêng tháng 8 doanh nghiệp mới ${plus(enterpriseLatest.aug_new_yoy,1)}`:""}. Tăng trưởng đang mạnh nhưng có thể phân hóa giữa các doanh nghiệp.`,"Theo dõi tốc độ giải ngân quý IV, bán lẻ thực, đơn hàng và số doanh nghiệp gia nhập/rời thị trường.","Tích cực hơn với các ngành nhận dòng vốn trực tiếp; không nên suy rộng thành toàn bộ thị trường cùng tăng."),
      card("policy","Lạm phát & điều kiện tiền tệ",policyStatus,fedDecision?"negative":"warning",policyEvidence,policyConclusion,"Fed → lợi suất trái phiếu Mỹ và DXY → chi phí vốn quốc tế, tỷ giá, dòng vốn và định giá tài sản rủi ro. Lớp trong nước tiếp tục được đọc qua CPI, thanh khoản hệ thống và USD/VND.",`Nhập siêu không hoàn toàn là tín hiệu xấu: khoảng ${fmt(productionShare,1)}% nhập khẩu là tư liệu sản xuất, phù hợp với IIP/FDI mạnh. Tuy nhiên, khi Fed thắt chặt, áp lực ngoại tệ cần được đánh giá nghiêm ngặt hơn.`,policyWatch,fedDecision?"Ngắn hạn, biến động tâm lý, USD và lợi suất có thể tăng. Trung hạn, tác động chỉ trở thành rủi ro lớn hơn nếu điều kiện vốn quốc tế cao kéo dài và truyền vào tỷ giá/lãi suất trong nước.":"Nếu điều kiện tiền tệ thắt chặt trước khi tăng trưởng đạt đỉnh, định giá cổ phiếu có thể chịu áp lực dù GDP/IIP vẫn cao.")
    ];
    const thesis=fedDecision?"Tăng trưởng trong nước vẫn là lực đỡ cho thị trường 3–12 tháng, nhưng sau quyết định tăng lãi suất của Fed, rủi ro tiền tệ bên ngoài đã tăng một bậc. Trọng tâm chuyển từ chờ sự kiện sang theo dõi mức độ truyền dẫn qua lợi suất, USD, tỷ giá và dòng vốn.":"Tăng trưởng vẫn là lực đỡ cho thị trường 3–12 tháng, nhưng môi trường không còn một chiều. Biến số quyết định cần theo dõi là liệu lạm phát và áp lực ngoại tệ có buộc điều kiện tiền tệ trở nên kém hỗ trợ hơn hay không.";
    const riskLine=fedDecision?`${fedDecision.text} Tín dụng trong nước gần nhất ${creditLatest?.credit_growth_ytd_pct!=null?plus(creditLatest.credit_growth_ytd_pct,2):"—"} YTD; cần đọc cùng USD/VND, tiền gửi và lãi suất.`:`Tín dụng gần nhất ${creditLatest?.credit_growth_ytd_pct!=null?plus(creditLatest.credit_growth_ytd_pct,2):"—"} YTD; cần đọc cùng tiền gửi, tỷ giá và lãi suất thay vì xem tăng trưởng tín dụng riêng lẻ.`;
    const regime=fedDecision?"TÍCH CỰC NHƯNG RỦI RO BÊN NGOÀI TĂNG":"TÍCH CỰC CÓ ĐIỀU KIỆN";
    const regimeTone=fedDecision?"mixed-risk-up":"mixed-positive";
    return json(req,{ok:true,version:"1.1-actual-event-precedence",generated_at:new Date().toISOString(),as_of:fedDecision?.occurred_at||row.coverage_end||row.month_key,source_label:row.source_label||null,horizon:"3–12 THÁNG",regime,regime_tone:regimeTone,thesis,risk_line:riskLine,policy_event:fedDecision,data_precedence:["VERIFIED_OR_CONFIRMED_ACTUAL_EVENT","LIVE_MARKET_CONFIRMATION","EXPECTATION","MONTHLY_MACRO_SNAPSHOT"],cards,principles:["Sự kiện đã xảy ra phải thắng kỳ vọng trước sự kiện.","Vĩ mô là nền 3–12 tháng, không phải tín hiệu mua bán trong ngày.","Tăng trưởng tốt chỉ hỗ trợ thị trường nếu tiền tệ, tỷ giá và định giá không xấu đi quá mạnh.","Vĩ mô tốt không đồng nghĩa mọi ngành và mọi cổ phiếu đều tốt."]});
  }catch(e){return json(req,{ok:false,error:"MACRO_ANCHOR_FAILED",detail:String((e as Error)?.message||e).slice(0,300)},500)}
});