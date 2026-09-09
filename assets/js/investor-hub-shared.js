import { supabaseClient } from './supabase-client.js';
import { trackTool } from './tool-events.js';

export const MARKET_ENDPOINT = window.VH_MARKET_ENDPOINT || 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed';
export const SECTORS = [
  ['VNFIN','Tài chính'],['VNREAL','Bất động sản'],['VNIND','Công nghiệp'],['VNIT','Công nghệ thông tin'],
  ['VNMAT','Nguyên vật liệu'],['VNCONS','Hàng tiêu dùng thiết yếu'],['VNCOND','Hàng tiêu dùng không thiết yếu'],
  ['VNENE','Năng lượng'],['VNHEAL','Y tế'],['VNUTI','Tiện ích']
];

export function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
export function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
export function fmt(v,d=2){const n=num(v);return n===null?'—':n.toLocaleString('vi-VN',{minimumFractionDigits:0,maximumFractionDigits:d})}
export function pct(v){const n=num(v);return n===null?'—':`${n>0?'+':''}${fmt(n,2)}%`}
export function todayVN(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function fmtDate(v){if(!v)return'—';const d=new Date(`${v}T00:00:00+07:00`);return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(d)}
export function minuteLabel(minute){const m=Number(minute)||0;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
export function localGet(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
export function localSet(key,value){localStorage.setItem(key,JSON.stringify(value))}

export async function fetchMarket(){
  const r=await fetch(MARKET_ENDPOINT,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();
}
export function marketContext(data){
  const mi=data?.market_intelligence||{};
  const indexes=Array.isArray(data?.indexes)?data.indexes:[];
  const get=s=>indexes.find(x=>String(x?.symbol||'')===s)||{};
  const vn=get('VN-INDEX');
  const sectorMap=new Map();
  SECTORS.forEach(([symbol,name])=>sectorMap.set(name,{symbol,name,change:num(get(symbol)?.change_pct)}));
  return {
    raw:data,
    state:mi.state||{},
    freshness:mi.freshness||{},
    vnIndex:num(vn.value),
    vnChange:num(vn.change_pct),
    breadth:mi.breadth||{},
    flow:mi.flow||{},
    leader:mi.leadership?.leader||null,
    sectors:sectorMap
  };
}

export async function getSession(){const {data}=await supabaseClient.auth.getSession();return data.session||null}
export async function googleLogin(){
  const redirectTo=window.location.origin+window.location.pathname+window.location.search;
  return supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});
}
export async function logout(){return supabaseClient.auth.signOut()}
export { supabaseClient, trackTool };
