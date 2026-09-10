import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const U=Deno.env.get("SUPABASE_URL")!, K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const nowIso=()=>new Date().toISOString();
function vn(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",weekday:"short",hour12:false}).formatToParts(new Date()),g=(t:string)=>p.find(x=>x.type===t)?.value||"";return{date:`${g("year")}-${g("month")}-${g("day")}`,w:g("weekday"),m:Number(g("hour"))*60+Number(g("minute"))};}
async function key(){const{data,error}=await db.from("news_worker_config").select("worker_key").eq("singleton",true).single();if(error)throw error;return data.worker_key;}
async function auth(req:Request){const k=req.headers.get("x-news-worker-key")||"";return !!k&&k===await key();}
async function market(){try{const r=await fetch(`${U}/functions/v1/market-feed`,{headers:{accept:"application/json"}});return r.ok?await r.json():null;}catch{return null;}}
function indexRow(m:any,symbol:string){return Array.isArray(m?.indexes)?m.indexes.find((x:any)=>String(x?.symbol||"")===symbol)||null:null;}
async function build(force=false){const c=vn();if(!force&&(["Sat","Sun"].includes(c.w)||c.m<390||c.m>525))return{skipped:true,reason:"OUTSIDE_MORNING_WINDOW",local_date:c.date,local_minute:c.m};
  const{data:existing,error:ee}=await db.from("morning_briefs").select("id,status,vo_hoang_view").eq("brief_date",c.date).maybeSingle();if(ee)throw ee;if(existing&&existing.status!=="DRAFT")return{skipped:true,reason:"LOCKED_AFTER_REVIEW",brief_id:existing.id,status:existing.status};
  const{data:candidates,error:ce}=await db.rpc("news_brief_candidates_v1",{p_hours:30,p_limit:12});if(ce)throw ce;const top=(candidates||[]).slice(0,7);
  const m=await market(),mi=m?.market_intelligence||null,state=mi?.state?.label||null,score=mi?.state?.score??null,vni=indexRow(m,"VN-INDEX");
  const lead=top[0];const headline=state?`Trạng thái thị trường: ${state}${lead?.title?` · Điểm tin cần chú ý: ${lead.title}`:""}`:(lead?.title||"Bản tin môi giới - đang chờ đủ dữ liệu thị trường và tin tức");
  const things:any[]=[];if(mi?.flow?.label)things.push(`Dòng tiền: ${mi.flow.label}`);if(mi?.breadth?.label)things.push(`Độ rộng: ${mi.breadth.label}`);const sector=top.find((x:any)=>x.sector)?.sector;if(sector)things.push(`Nhóm cần theo dõi: ${sector} do có thông tin mới được hệ thống đánh giá cao`);else if(lead?.title)things.push(`Tin cần theo dõi: ${lead.title}`);
  const risk=Number(mi?.state?.risk_level||3);const scenarios=[{name:"Thuận lợi",condition:"Độ rộng và dòng tiền cùng cải thiện; nhóm dẫn dắt duy trì sức mạnh.",action:risk<=2?"Duy trì tỷ trọng theo kế hoạch; chỉ mở mới khi điểm mua và mức rủi ro đạt chuẩn.":"Chỉ tăng tỷ trọng khi trạng thái thị trường cải thiện rõ."},{name:"Phân hóa",condition:"Chỉ số giữ được nhưng độ rộng hoặc dòng tiền chưa lan tỏa.",action:"Ưu tiên cổ phiếu có sức mạnh riêng; hạn chế mua đuổi và giữ tỷ trọng vừa phải."},{name:"Xấu đi",condition:"Độ rộng suy yếu, dòng tiền chậm lại hoặc chỉ số mất vùng hỗ trợ gần.",action:"Ưu tiên quản trị vị thế và giảm đòn bẩy trước khi tìm cơ hội mới."}];
  const payload:any={brief_date:c.date,market_state:state,market_score:score,vnindex_snapshot:vni,headline,three_things_to_watch:things.slice(0,3),scenarios,status:"DRAFT",updated_at:nowIso()};if(existing?.vo_hoang_view)payload.vo_hoang_view=existing.vo_hoang_view;
  const{data:brief,error:be}=await db.from("morning_briefs").upsert(payload,{onConflict:"brief_date"}).select("id,brief_date,status").single();if(be)throw be;
  await db.from("morning_brief_items").delete().eq("brief_id",brief.id);
  if(top.length){const items=top.map((r:any,i:number)=>({brief_id:brief.id,news_item_id:r.news_item_id,rank:i+1,section:i<3?"TOP_NEWS":"WATCH",used_reason:`${r.used_reason}; điểm chọn bản tin ${r.brief_score}`,title_snapshot:r.title,source_name_snapshot:r.source_name,source_url_snapshot:r.source_url,compact_summary_snapshot:r.compact_summary||null}));const{error:ie}=await db.from("morning_brief_items").insert(items);if(ie)throw ie;}
  return{brief,items:top.length,market_state:state,market_score:score,top_score:top[0]?.brief_score??null};}
Deno.serve(async req=>{if(req.method==="GET")return json({ok:true,service:"broker-brief-builder",version:"1.0"});if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);if(!await auth(req))return json({ok:false,error:"UNAUTHORIZED"},401);const b=await req.json().catch(()=>({}));try{return json({ok:true,result:await build(Boolean(b.force))});}catch(e){return json({ok:false,error:"BUILD_FAILED",detail:String(e?.message||e).slice(0,800)},500);}});
