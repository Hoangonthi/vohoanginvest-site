import { supabaseClient } from './assets/js/supabase-client.js';
import { esc,toolLabel } from './assets/js/admin-humanize.js';

const loginBox=document.querySelector('#loginBox'),app=document.querySelector('#app'),loginForm=document.querySelector('#loginForm'),googleLogin=document.querySelector('#googleLogin'),loginMsg=document.querySelector('#loginMsg'),logout=document.querySelector('#logout'),days=document.querySelector('#days'),refresh=document.querySelector('#refresh');
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function pct(n,d){return d?Math.round((Number(n)||0)/(Number(d)||1)*100)+'%':'0%';}

async function load(){
  refresh.disabled=true;
  refresh.textContent='Đang tải…';
  const {data,error}=await supabaseClient.rpc('admin_growth_retention_v1',{p_days:Number(days.value)||30});
  refresh.disabled=false;
  refresh.textContent='Làm mới';
  if(error){
    document.querySelector('#toolTable').innerHTML='<div class="admin-help">Không tải được dữ liệu: '+esc(error.message)+'</div>';
    return;
  }

  const s=data?.sessions||{},c=data?.conversions||{};
  setText('mTotal',s.total??0);
  setText('mReturn2',(s.returning_2d??0)+' · '+pct(s.returning_2d,s.total));
  setText('mMulti',(s.multi_tool??0)+' · '+pct(s.multi_tool,s.total));
  setText('mNorth',(s.north_star??0)+' · '+pct(s.north_star,s.total));
  setText('mLeads',c.market_leads??0);
  setText('cMeeting',c.meetings??0);
  setText('cAfter',c.after_session_saved??0);
  setText('cWatch',c.watchlist_items??0);
  setText('cLead',c.market_leads??0);

  const tools=data?.tool_usage||[];
  document.querySelector('#toolTable').innerHTML=tools.length
    ?'<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Công cụ</th><th>Người dùng</th><th>Lượt dùng</th><th>Hành động</th></tr></thead><tbody>'
      +tools.map(x=>'<tr><td><strong>'+esc(toolLabel(x.tool_code))+'</strong></td><td>'+Number(x.sessions||0)+'</td><td>'+Number(x.uses||0)+'</td><td>'+Number(x.actions||0)+'</td></tr>').join('')
      +'</tbody></table></div>'
    :'<div class="admin-help">Chưa có dữ liệu.</div>';

  const daily=data?.daily||[];
  document.querySelector('#dailyBox').innerHTML=daily.length
    ?'<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Ngày</th><th>Lượt truy cập</th><th>Thị trường hôm nay</th><th>Sau phiên</th><th>Danh sách theo dõi</th><th>Nhật ký</th></tr></thead><tbody>'
      +daily.map(x=>'<tr><td><strong>'+esc(x.event_day)+'</strong></td><td>'+Number(x.sessions||0)+'</td><td>'+Number(x.market_reader||0)+'</td><td>'+Number(x.after_session||0)+'</td><td>'+Number(x.watchlist||0)+'</td><td>'+Number(x.journal||0)+'</td></tr>').join('')
      +'</tbody></table></div>'
    :'<div class="admin-help">Chưa có dữ liệu theo ngày.</div>';
}

async function showApp(){loginBox.classList.add('hidden');app.classList.remove('hidden');logout.classList.remove('hidden');await load();}
function showLogin(){loginBox.classList.remove('hidden');app.classList.add('hidden');logout.classList.add('hidden');}
loginForm.addEventListener('submit',async e=>{e.preventDefault();loginMsg.textContent='Đang đăng nhập…';const {error}=await supabaseClient.auth.signInWithPassword({email:document.querySelector('#email').value.trim(),password:document.querySelector('#password').value});if(error){loginMsg.textContent='Không đăng nhập được. Có thể dùng Google.';return;}loginMsg.textContent='';await showApp();});
googleLogin?.addEventListener('click',async()=>{const redirectTo=window.location.origin+window.location.pathname;const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});if(error)loginMsg.textContent=error.message;});
logout.addEventListener('click',async()=>{await supabaseClient.auth.signOut();showLogin();});
days.addEventListener('change',load);
refresh.addEventListener('click',load);
const {data}=await supabaseClient.auth.getSession();
data.session?showApp():showLogin();
