import { supabaseClient } from './assets/js/supabase-client.js';

const loginBox=document.querySelector('#loginBox');
const app=document.querySelector('#app');
const loginForm=document.querySelector('#loginForm');
const googleLogin=document.querySelector('#googleLogin');
const loginMsg=document.querySelector('#loginMsg');
const logout=document.querySelector('#logout');
const days=document.querySelector('#days');
const refresh=document.querySelector('#refresh');
const body=document.querySelector('#body');
const empty=document.querySelector('#empty');
const target=document.querySelector('#target');
const src=document.querySelector('#src');
const ref=document.querySelector('#ref');
const campaign=document.querySelector('#campaign');
const makeLink=document.querySelector('#makeLink');
const linkOut=document.querySelector('#linkOut');

function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function pct(v){return `${Number(v||0).toFixed(1)}%`}
function clean(v,max){return String(v||'').trim().replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-').slice(0,max)}
function humanSource(s=''){
  const x=String(s);
  const src=x.match(/src=([^|]+)/)?.[1];
  const ref=x.match(/ref=([^|]+)/)?.[1];
  const cmp=x.match(/cmp=([^|]+)/)?.[1];
  const base=x.split('|')[0]||x;
  const labels=[];
  if(src) labels.push(src.toUpperCase()); else labels.push(base);
  if(ref) labels.push(`REF:${ref}`);
  if(cmp) labels.push(cmp);
  return labels.join(' · ');
}

async function load(){
  body.innerHTML='<tr><td colspan="7">Đang tải...</td></tr>';
  empty.classList.add('hidden');
  const {data,error}=await supabaseClient.rpc('crm_source_performance_v1',{p_days:Number(days.value||30)});
  if(error){
    body.innerHTML=`<tr><td colspan="7">Không thể tải dữ liệu: ${esc(error.message)}</td></tr>`;
    return;
  }
  const rows=Array.isArray(data)?data:[];
  body.innerHTML='';
  empty.classList.toggle('hidden',rows.length>0);
  for(const r of rows){
    body.insertAdjacentHTML('beforeend',`<tr>
      <td><strong>${esc(humanSource(r.source))}</strong><div style="font-size:.78rem;color:#788394">${esc(r.source)}</div></td>
      <td>${Number(r.customers||0)}</td>
      <td>${Number(r.completed_assessments||0)}</td>
      <td>${Number(r.meeting_requests||0)}</td>
      <td>${Number(r.completed_meetings||0)}</td>
      <td>${pct(r.conversion_to_meeting)}</td>
      <td>${pct(r.meeting_completion_rate)}</td>
    </tr>`);
  }
}

async function showApp(){loginBox.classList.add('hidden');app.classList.remove('hidden');logout.classList.remove('hidden');await load()}
function showLogin(){loginBox.classList.remove('hidden');app.classList.add('hidden');logout.classList.add('hidden')}

loginForm.addEventListener('submit',async e=>{e.preventDefault();loginMsg.textContent='Đang đăng nhập...';const {error}=await supabaseClient.auth.signInWithPassword({email:document.querySelector('#email').value.trim(),password:document.querySelector('#password').value});if(error){loginMsg.textContent='Không đăng nhập được. Hãy dùng Google.';return}loginMsg.textContent='';await showApp()});

googleLogin.addEventListener('click',async()=>{
  loginMsg.textContent='Đang chuyển sang Google...';
  const redirectTo=window.location.href.split('#')[0].split('?')[0];
  const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});
  if(error) loginMsg.textContent='Không mở được Google: '+error.message;
});

logout.addEventListener('click',async()=>{await supabaseClient.auth.signOut();showLogin()});
days.addEventListener('change',load);refresh.addEventListener('click',load);

makeLink.addEventListener('click',async()=>{
  const url=new URL(target.value,window.location.href);
  url.searchParams.set('utm_source',clean(src.value,24)||'referral');
  url.searchParams.set('utm_medium',src.value==='ctv'?'ref':'dm');
  const r=clean(ref.value,24); if(r) url.searchParams.set('ref',r);
  const c=clean(campaign.value,28); if(c) url.searchParams.set('utm_campaign',c);
  const link=url.toString();
  linkOut.textContent=link;
  try{await navigator.clipboard.writeText(link);makeLink.textContent='Đã sao chép';setTimeout(()=>makeLink.textContent='Tạo & sao chép',1600)}catch{}
});

const {data}=await supabaseClient.auth.getSession();data.session?showApp():showLogin();
