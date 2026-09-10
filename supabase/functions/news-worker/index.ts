import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { XMLParser } from "npm:fast-xml-parser@4.5.0";
import * as cheerio from "npm:cheerio@1.0.0";

const U=Deno.env.get("SUPABASE_URL")!, K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,K,{auth:{persistSession:false}});
const xp=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",textNodeName:"#text",trimValues:true});

// Conservative allow-list for article text. Official exchange notices can also
// contribute a symbol from a leading "ABC:" prefix, so small-cap notices are not lost.
const TICKERS=new Set((
  "AAA ACB ANV ASM BCM BID BMP BSI BVH BWE CII CMG CTD CTG DBC DCM DGC DGW DIG DPM DRC DXG EIB FPT FRT FTS GAS GEX GMD GVR HAG HAH HCM HDB HDG HPG HSG IDC KBC KDH KSB LPB MBB MSB MSN MWG NKG NLG NTL NVL OCB PC1 PDR PHR PLX PNJ POW PVD PVS REE SAB SHB SSI STB TCB TCH TPB VCB VCG VCI VHC VHM VIB VIC VIX VJC VND VNM VPB VPI VRE VTP"
).split(" "));
const res=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const arr=(v:any)=>v==null?[]:Array.isArray(v)?v:[v];
const txt=(v:any):string=>v==null?"":typeof v==="string"||typeof v==="number"?String(v).trim():typeof v==="object"?txt(v["#text"]??v._??v.value??""):"";
const strip=(v:any)=>String(v||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g," ").trim();
const iso=(v:any)=>{const s=txt(v);if(!s)return null;const d=new Date(s);return Number.isNaN(d.getTime())?null:d.toISOString();};
const abs=(v:string,b:string)=>{try{return new URL(v,b).toString();}catch{return v||null;}};
async function hash(v:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function symbols(text:string,title:string,sourceId:string){
  const upper=text.toUpperCase();
  const out=new Set<string>();
  for(const token of upper.match(/\b[A-Z]{3}\b|\b[A-Z]{2}[0-9]\b/g)||[]){
    if(TICKERS.has(token)) out.add(token);
  }
  // VND is ambiguous with Vietnamese dong. Keep it only in explicit stock/company context.
  if(out.has("VND")&&!/(cổ phiếu\s+vnd|mã\s+vnd|vndirect|chứng khoán\s+vnd)/i.test(text)) out.delete("VND");
  // Official exchange notices commonly begin with the ticker followed by a colon.
  if(/^hose_|^hnx_/i.test(sourceId)){
    const m=title.trim().match(/^([A-Z0-9]{3,5})\s*:/);
    if(m) out.add(m[1]);
  }
  return [...out].slice(0,8);
}
function sector(v:string){
  const s=v.toLowerCase(),rules:[string,string[]][]=[
    ["Ngân hàng",["ngân hàng","bank"]],
    ["Chứng khoán",["công ty chứng khoán","ngành chứng khoán","nhóm chứng khoán","cổ phiếu chứng khoán"]],
    ["Bất động sản",["bất động sản","địa ốc"]],
    ["Thép",["thép","quặng sắt"]],
    ["Dầu khí",["dầu khí","giá dầu","brent","wti"]],
    ["Điện",["điện lực","giá điện"]],
    ["Công nghệ",["công nghệ","bán dẫn"]],
    ["Bán lẻ",["bán lẻ","tiêu dùng"]]
  ];
  for(const [n,ks] of rules)if(ks.some(k=>s.includes(k)))return n;
  return null;
}
function vn(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",weekday:"short",hour12:false}).formatToParts(new Date()),g=(t:string)=>p.find(x=>x.type===t)?.value||"";return{w:g("weekday"),m:Number(g("hour"))*60+Number(g("minute"))};}
function effective(base:number){const c=vn();if(["Sat","Sun"].includes(c.w))return Math.max(base,60);if(c.m>=360&&c.m<525)return base;if(c.m<=900)return Math.max(base,10);if(c.m<1320)return Math.max(base,30);return Math.max(base,60);}
function due(s:any){return !s.last_success_at||(Date.now()-new Date(s.last_success_at).getTime())/60000>=effective(Number(s.fetch_interval_minutes||10))-.5;}
async function key(){const{data,error}=await db.from("news_worker_config").select("worker_key").eq("singleton",true).single();if(error)throw error;return data.worker_key;}
async function auth(req:Request){const k=req.headers.get("x-news-worker-key")||"";return !!k&&k===await key();}
async function fetchRaw(u:string){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);try{const r=await fetch(u,{signal:ctl.signal,headers:{"user-agent":"Mozilla/5.0 (compatible; VoHoangNewsWorker/4.0)",accept:"application/rss+xml, application/xml, text/xml, text/html, */*"}});if(!r.ok)throw new Error(`HTTP_${r.status}`);return await r.text();}finally{clearTimeout(timer);}}
function parseRss(body:string,base:string){const d=xp.parse(body),c=d?.rss?.channel;let es:any[]=[];if(c)es=arr(c.item);else if(d?.feed)es=arr(d.feed.entry);else if(d?.["rdf:RDF"])es=arr(d["rdf:RDF"].item);return es.slice(0,15).map((i:any)=>{const title=strip(txt(i.title)),summary=strip(txt(i.description??i.summary??i["content:encoded"]??i.content));let l="";if(typeof i.link==="string")l=i.link;else if(Array.isArray(i.link))l=txt(i.link.find((x:any)=>x?.["@_rel"]==="alternate")?.["@_href"]??i.link[0]?.["@_href"]??i.link[0]);else l=txt(i.link?.["@_href"]??i.link);const guid=txt(i.guid??i.id);return{title,summary,source_url:abs(l||guid,base),external_id:guid||l||title,published_at:iso(i.pubDate??i.published??i.updated??i["dc:date"]),raw_payload:{guid,pubDate:txt(i.pubDate??i.published??i.updated??i["dc:date"])}};}).filter((x:any)=>x.title);}
function parseHtml(body:string,base:string){const $=cheerio.load(body),o:any[]=[],seen=new Set<string>();$("a[href]").each((_i,e)=>{if(o.length>=15)return;const title=strip($(e).attr("title")||$(e).text()),l=abs(String($(e).attr("href")||""),base);if(title.length<25||!l||!/vietstock\.vn/i.test(l)||seen.has(l))return;seen.add(l);o.push({title,summary:"",source_url:l,external_id:l,published_at:null,raw_payload:{}});});return o;}
async function prep(items:any[],sourceId:string){return await Promise.all(items.map(async i=>{const text=`${i.title} ${i.summary}`;return{...i,content_hash:await hash(String(i.source_url||i.external_id||i.title).toLowerCase()),detected_symbols:symbols(text,i.title,sourceId),detected_sector:sector(text)};}));}
async function oneSource(s:any){try{const body=await fetchRaw(s.url),raw=String(s.source_type).toUpperCase()==="HTML"?parseHtml(body,s.url):parseRss(body,s.url),items=await prep(raw,s.source_id);const{data,error}=await db.rpc("news_ingest_batch_v1",{p_source_id:s.source_id,p_items:items});if(error)throw error;return{source_id:s.source_id,ok:true,...data};}catch(e){const msg=String(e?.message||e).slice(0,400);await db.from("news_sources").update({last_error_at:new Date().toISOString(),last_error:msg,updated_at:new Date().toISOString()}).eq("source_id",s.source_id);return{source_id:s.source_id,ok:false,error:msg};}}
async function collect(){const{data,error}=await db.from("news_sources").select("*").eq("enabled",true).order("trust_score",{ascending:false});if(error)throw error;const dueSources=(data||[]).filter(due);const results=await Promise.all(dueSources.map(oneSource));const st:any={sources_due:dueSources.length,sources_ok:0,sources_error:0,inserted:0,duplicates:0,priority:0,consider:0,watch:0,reject:0,errors:[]};for(const r of results){if(!r.ok){st.sources_error++;st.errors.push({source_id:r.source_id,error:r.error});continue;}st.sources_ok++;for(const k of ["inserted","duplicates","priority","consider","watch","reject"])st[k]+=Number(r[k]||0);}return st;}
Deno.serve(async req=>{if(req.method==="GET")return res({ok:true,service:"news-worker",version:"4.0"});if(req.method!=="POST")return res({ok:false,error:"METHOD_NOT_ALLOWED"},405);if(!await auth(req))return res({ok:false,error:"UNAUTHORIZED"},401);const b=await req.json().catch(()=>({})),a=String(b.action||"COLLECT").toUpperCase();try{if(a==="COLLECT"||a==="RUN_CYCLE")return res({ok:true,collect:await collect()});if(a==="CLEANUP"){const{data,error}=await db.rpc("news_cleanup_retention");if(error)throw error;return res({ok:true,cleanup:data});}return res({ok:false,error:"UNKNOWN_ACTION"},400);}catch(e){return res({ok:false,error:"WORKER_FAILED",detail:String(e?.message||e).slice(0,800)},500);}});
