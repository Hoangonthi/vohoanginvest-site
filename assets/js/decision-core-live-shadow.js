const API="https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/decision-core-live-public-v1";
const POLICY="DP_ACCOUNT_SHADOW_2026_09_V6";
const DEFAULT_SYMBOLS=["VCB","HPG","FPT","SSI","PVD"];
const POLL_MS=30000;

const esc=(v="")=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const fmtAge=(s)=>{
  const n=Number(s);
  if(!Number.isFinite(n))return "—";
  if(n<60)return n+"s";
  const m=Math.floor(n/60);
  if(m<60)return m+"m";
  return Math.floor(m/60)+"h "+(m%60)+"m";
};
const pct=(v)=>{
  const n=Number(v);
  return Number.isFinite(n)?Math.round(n*100)+"%":"—";
};
const cleanSymbols=(raw)=>{
  const out=[];
  for(const part of String(raw||"").split(",")){
    const s=part.trim().toUpperCase();
    if(/^[A-Z0-9._-]{1,12}$/.test(s)&&!out.includes(s))out.push(s);
    if(out.length>=20)break;
  }
  return out;
};

function injectStyle(){
  if(document.getElementById("dcShadowStyle"))return;
  const style=document.createElement("style");
  style.id="dcShadowStyle";
  style.textContent=`
    .dc-shadow-toggle{width:100%;margin-top:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.035);color:#eef6ff;text-align:left;cursor:pointer;font-weight:700}.dc-shadow-panel[hidden]{display:none!important}
    .dc-shadow{margin-top:8px;padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(2,12,24,.58)}
    .dc-shadow-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
    .dc-shadow-title{font-size:14px;font-weight:700;letter-spacing:.04em}
    .dc-shadow-sub{margin-top:4px;font-size:12px;opacity:.72}
    .dc-shadow-controls{display:flex;gap:8px;flex-wrap:wrap}
    .dc-shadow-controls input{min-width:250px;max-width:420px;padding:9px 11px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:#071421;color:#eef6ff}
    .dc-shadow-controls button{padding:9px 12px;border-radius:10px;border:0;cursor:pointer}
    .dc-shadow-meta{margin-top:10px;font-size:12px;opacity:.75}
    .dc-shadow-table-wrap{margin-top:12px;overflow:auto}
    .dc-shadow-table{width:100%;border-collapse:collapse;font-size:12px;min-width:900px}
    .dc-shadow-table th,.dc-shadow-table td{padding:9px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;vertical-align:top}
    .dc-shadow-table th{font-weight:600;opacity:.72;white-space:nowrap}
    .dc-shadow-symbol{font-weight:700}
    .dc-shadow-fresh{color:#8ee6ad}
    .dc-shadow-aging{color:#ffd97d}
    .dc-shadow-stale,.dc-shadow-error{color:#ff9a9a}
    .dc-shadow-muted{opacity:.66}
    .dc-shadow-warning{margin-top:10px;padding:9px 10px;border-radius:10px;background:rgba(255,184,77,.08);font-size:12px;line-height:1.45}
  `;
  document.head.appendChild(style);
}

function shell(root){
  root.innerHTML=`<button type="button" class="dc-shadow-toggle" id="dcShadowToggle" aria-expanded="false">＋ Kiểm tra chéo cổ phiếu</button><div class="dc-shadow-panel" id="dcShadowPanel" hidden><div class="dc-shadow">
    <div class="dc-shadow-head">
      <div>
        <div class="dc-shadow-title">DECISION CORE · SHADOW</div>
        <div class="dc-shadow-sub">Chỉ dùng kiểm tra chéo trong livestream · không phải authority</div>
      </div>
      <div class="dc-shadow-controls">
        <input id="dcShadowSymbols" value="${DEFAULT_SYMBOLS.join(",")}" aria-label="Mã Decision Core shadow">
        <button type="button" id="dcShadowRefresh">Làm mới</button>
      </div>
    </div>
    <div class="dc-shadow-meta" id="dcShadowMeta">Chưa tải Decision Core.</div>
    <div class="dc-shadow-table-wrap"><div id="dcShadowBody"></div></div>
    <div class="dc-shadow-warning">Shadow-only: <b>official=false · authority=false · read_only=true</b>. Nếu dữ liệu thiếu hoặc cũ, giữ UNKNOWN/INSUFFICIENT và không suy diễn thành khuyến nghị.</div>
  </div></div>`;
}

async function fetchOne(symbol){
  const url=API+"?symbol="+encodeURIComponent(symbol)+"&policy_version="+encodeURIComponent(POLICY)+"&_="+Date.now();
  try{
    const res=await fetch(url,{cache:"no-store"});
    const body=await res.json().catch(()=>null);
    if(!res.ok||!body?.ok)return {symbol,error:body?.error||("HTTP_"+res.status)};
    if(body.official!==false||body.authority!==false||body.read_only!==true){
      return {symbol,error:"SHADOW_SAFETY_FLAGS_MISMATCH"};
    }
    return body;
  }catch(error){
    return {symbol,error:error instanceof Error?error.message:"FETCH_FAILED"};
  }
}

function render(rows){
  const host=document.getElementById("dcShadowBody");
  if(!host)return;
  const html=rows.map((r)=>{
    if(r.error){
      return `<tr><td class="dc-shadow-symbol">${esc(r.symbol)}</td><td class="dc-shadow-error">ERROR</td><td colspan="8" class="dc-shadow-muted">${esc(r.error)}</td></tr>`;
    }
    const d=r.decision||{};
    const c=r.context||{};
    const fresh=String(r.freshness||"UNKNOWN").toLowerCase();
    const missing=Array.isArray(d.missing_capabilities)?d.missing_capabilities.join(", "):"";
    const conflicts=Array.isArray(d.conflict_keys)?d.conflict_keys.join(", "):"";
    return `<tr>
      <td class="dc-shadow-symbol">${esc(r.symbol)}</td>
      <td class="dc-shadow-${esc(fresh)}">${esc(r.freshness||"UNKNOWN")}<div class="dc-shadow-muted">${fmtAge(r.age_seconds)}</div></td>
      <td>${esc(d.market_decision_state||"UNKNOWN")}</td>
      <td>${esc(d.decision_state||"UNKNOWN")}</td>
      <td>${r.freshness==="STALE"?"—":esc(d.action||"UNKNOWN")}</td>
      <td>${pct(d.confidence)}</td>
      <td>${esc(d.evidence_alignment||"UNKNOWN")}</td>
      <td>${esc(c?.sector_state?.sector_state||"UNKNOWN")}</td>
      <td>${esc(c?.fundamental_state?.fundamental_state||"UNKNOWN")}</td>
      <td>${missing?esc(missing):"—"}${conflicts?`<div class="dc-shadow-muted">Xung đột: ${esc(conflicts)}</div>`:""}</td>
    </tr>`;
  }).join("");
  host.innerHTML=`<table class="dc-shadow-table">
    <thead><tr>
      <th>Mã</th><th>Freshness</th><th>Market</th><th>State</th><th>Action</th><th>Conf.</th><th>Alignment</th><th>Sector</th><th>Fundamental</th><th>Thiếu / xung đột</th>
    </tr></thead>
    <tbody>${html}</tbody>
  </table>`;
}

let timer=null;
let loading=false;
async function load(){
  if(loading)return;
  const panel=document.getElementById("liveAdminPanel");
  if(!panel||panel.hidden||document.hidden)return;
  const input=document.getElementById("dcShadowSymbols");
  const cleaned=cleanSymbols(input?.value);
  const symbols=cleaned.length?cleaned:DEFAULT_SYMBOLS;
  loading=true;
  const meta=document.getElementById("dcShadowMeta");
  if(meta)meta.textContent="Đang đọc current store…";
  try{
    const rows=await Promise.all(symbols.map(fetchOne));
    render(rows);
    const ok=rows.filter(x=>!x.error).length;
    const stale=rows.filter(x=>!x.error&&x.freshness==="STALE").length;
    const unsafe=rows.filter(x=>x.error==="SHADOW_SAFETY_FLAGS_MISMATCH").length;
    if(meta){
      meta.textContent=`${ok}/${rows.length} mã đọc được · ${stale} stale · ${unsafe} safety block · ${new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date())}`;
    }
  }finally{
    loading=false;
  }
}
function start(){
  if(timer)return;
  load();
  timer=setInterval(load,POLL_MS);
}
function stop(){
  if(timer){clearInterval(timer);timer=null;}
}

function init(){
  const root=document.getElementById("dcShadowRoot");
  const panel=document.getElementById("liveAdminPanel");
  if(!root||!panel)return;
  injectStyle();
  shell(root);
  const toggle=document.getElementById("dcShadowToggle"),box=document.getElementById("dcShadowPanel");
  toggle?.addEventListener("click",()=>{const open=box?.hidden!==false;if(box)box.hidden=!open;if(toggle){toggle.setAttribute("aria-expanded",String(open));toggle.textContent=(open?"−":"＋")+" Kiểm tra chéo cổ phiếu";}if(open)start();else stop();});
  document.getElementById("dcShadowRefresh")?.addEventListener("click",load);
  const observer=new MutationObserver(()=>{
    if(panel.hidden||document.getElementById("dcShadowPanel")?.hidden)stop();else start();
  });
  observer.observe(panel,{attributes:true,attributeFilter:["hidden"]});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();else if(!panel.hidden&&!document.getElementById("dcShadowPanel")?.hidden)start();});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
