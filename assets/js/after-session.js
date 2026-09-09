import { SECTORS, esc, num, fmt, pct, todayVN, fmtDate, localGet, localSet, fetchMarket, marketContext, getSession, googleLogin, logout, supabaseClient, trackTool } from './investor-hub-shared.js';

const GUEST_KEY='vh_after_session_guest_v1';
let session=null,market=null,serverData=null;
const table=document.querySelector('#itemTable');
const resultBox=document.querySelector('#resultBox');
const statusEl=document.querySelector('#saveStatus');
const sectorOptions=['',...SECTORS.map(x=>x[1])];

function stateRisk(score){const s=num(score);if(s===null)return 3;if(s>=72)return 1;if(s>=58)return 2;if(s>=46)return 3;if(s>=32)return 4;return 5}
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v}
function inputVal(id){return document.getElementById(id)?.value??''}
function mood(){return document.querySelector('input[name="mood"]:checked')?.value||null}
function flags(){const out={};document.querySelectorAll('[data-flag]').forEach(x=>out[x.dataset.flag]=x.checked);return out}
function sectorBenchmark(name){return market?.sectors?.get(name)?.change??null}
function selectedFlags(){return Object.entries(flags()).filter(([,v])=>v).map(([k])=>k)}
const flagLabels={BUY_CHASE:'mua đuổi',AVERAGE_DOWN:'bình quân giá xuống',INCREASE_MARGIN:'tăng margin',PANIC_SELL:'bán vì hoảng',BREAK_STOP:'phá điểm cắt lỗ',NO_PLAN:'giao dịch không kế hoạch'};
const moodLabels={CALM:'bình tĩnh',WORRIED:'lo lắng',FOMO:'sợ mất cơ hội',FRUSTRATED:'bực bội',EXCITED:'hưng phấn',CONFUSED:'chưa biết nên làm gì'};

function renderMarket(){
  if(!market)return;
  const st=market.state||{};setText('marketScore',`${st.score??'—'}/100`);setText('marketState',st.label||'—');
  setText('vnChange',pct(market.vnChange));setText('vnValue',market.vnIndex===null?'—':`VN-Index ${fmt(market.vnIndex,2)}`);
  setText('breadthLabel',market.breadth?.label||'—');setText('breadthSub',market.breadth?.adv==null?'—':`${market.breadth.adv} tăng · ${market.breadth.flat} TC · ${market.breadth.dec} giảm`);
  setText('leaderName',market.leader?.name||'—');setText('leaderSub',market.leader?pct(market.leader.change_pct):'—');
  const fresh=market.freshness||{};document.getElementById('marketLive').innerHTML=`<b>${esc(fresh.label||'Dữ liệu thị trường')}</b> · ${esc(st.label||'—')} ${st.score??'—'}/100`;
}

function itemRow(item={}){
  const row=document.createElement('div');row.className='ih-row';row.dataset.item='1';
  row.innerHTML=`<input class="item-symbol" maxlength="12" placeholder="Mã" value="${esc(item.symbol||'')}"><div style="display:grid;grid-template-columns:.8fr 1.2fr;gap:4px"><select class="item-type"><option value="POSITION" ${item.item_type==='POSITION'?'selected':''}>Đang giữ</option><option value="WATCHLIST" ${item.item_type!=='POSITION'?'selected':''}>Theo dõi</option></select><select class="item-sector">${sectorOptions.map(s=>`<option value="${esc(s)}" ${s===(item.sector||'')?'selected':''}>${esc(s||'Chọn ngành')}</option>`).join('')}</select></div><input class="item-change" type="number" step="0.01" placeholder="%" value="${item.day_change_pct??''}"><input class="item-weight" type="number" step="0.1" min="0" max="100" placeholder="Tỷ trọng %" value="${item.weight_pct??''}"><span class="item-relative"><small>Nhập % để so</small></span><button class="ih-button danger item-remove" type="button">×</button>`;
  row.querySelector('.item-remove').addEventListener('click',()=>row.remove());
  row.querySelectorAll('.item-change,.item-sector').forEach(x=>x.addEventListener('input',()=>updateRelative(row)));
  table.appendChild(row);updateRelative(row);
}
function updateRelative(row){
  const ch=num(row.querySelector('.item-change').value);const sector=row.querySelector('.item-sector').value;const bench=sectorBenchmark(sector);const out=row.querySelector('.item-relative');
  if(ch===null){out.innerHTML='<small>Nhập % để so</small>';return}
  const relVn=market?.vnChange==null?null:ch-market.vnChange;const relSector=bench==null?null:ch-bench;
  const cls=relSector!==null?(relSector>=.3?'is-up':relSector<=-.3?'is-down':'is-warn'):(relVn>=.3?'is-up':relVn<=-.3?'is-down':'is-warn');
  out.innerHTML=`<b class="${cls}">${relSector===null?`vs VNI ${pct(relVn)}`:`vs ngành ${pct(relSector)}`}</b>`;
}
function readItems(){return [...document.querySelectorAll('[data-item]')].map(row=>({symbol:row.querySelector('.item-symbol').value.trim().toUpperCase(),item_type:row.querySelector('.item-type').value,sector:row.querySelector('.item-sector').value||null,day_change_pct:num(row.querySelector('.item-change').value),weight_pct:num(row.querySelector('.item-weight').value)})).filter(x=>x.symbol)}

function payload(){return {market_date:inputVal('marketDate')||todayVN(),account_return_pct:num(inputVal('accountReturn')),cash_pct:num(inputVal('cashPct')),margin_pct:num(inputVal('marginPct')),mood:mood(),primary_worry:inputVal('primaryWorry')||null,followed_plan:document.getElementById('followedPlan').checked,behavior_flags:flags(),note:inputVal('sessionNote')||null,items:readItems()}}

function diagnosis(p){
  const account=p.account_return_pct,vn=market?.vnChange,delta=account!==null&&vn!==null?account-vn:null,risk=stateRisk(market?.state?.score),badFlags=selectedFlags(),items=p.items||[];
  let headline='Hãy nhập % thay đổi của tài khoản để đối chiếu.';let tone='warning';let explain='Kết quả sẽ có ý nghĩa hơn khi có số liệu tài khoản thực tế.';
  if(account!==null&&vn!==null){if(delta<=-.6){headline='Danh mục đang yếu hơn thị trường.';tone='danger';explain=`Tài khoản ${pct(account)} trong khi VN-Index ${pct(vn)}. Chênh lệch ${pct(delta)} cho thấy phần yếu không chỉ đến từ chỉ số chung.`}else if(delta>=.6){headline='Danh mục đang khỏe hơn thị trường.';tone='positive';explain=`Tài khoản ${pct(account)} so với VN-Index ${pct(vn)}. Lợi thế tương đối ${pct(delta)} đáng giữ, nhưng không phải lý do để tăng rủi ro ngoài kế hoạch.`}else{headline='Biến động tài khoản khá gần thị trường.';tone='warning';explain=`Tài khoản ${pct(account)} và VN-Index ${pct(vn)} không lệch nhiều. Phần lớn biến động hôm nay có thể đến từ bối cảnh chung.`}}
  const insights=[];
  insights.push({tone,title:'Thị trường hay danh mục?',text:explain});
  const scored=items.map(x=>{const sec=sectorBenchmark(x.sector);const relSec=x.day_change_pct!==null&&sec!==null?x.day_change_pct-sec:null;const relVn=x.day_change_pct!==null&&vn!==null?x.day_change_pct-vn:null;const contribution=x.day_change_pct!==null&&x.weight_pct!==null?x.day_change_pct*x.weight_pct/100:null;return {...x,relSec,relVn,contribution}}).filter(x=>x.day_change_pct!==null);
  const weakest=[...scored].sort((a,b)=>(a.relSec??a.relVn??0)-(b.relSec??b.relVn??0))[0];const strongest=[...scored].sort((a,b)=>(b.relSec??b.relVn??0)-(a.relSec??a.relVn??0))[0];
  if(weakest&&(weakest.relSec??weakest.relVn)!==null&&weakest!==strongest)insights.push({tone:(weakest.relSec??weakest.relVn)<-.3?'danger':'warning',title:`${weakest.symbol} cần được nhìn lại`,text:`Mã này đang ${pct(weakest.day_change_pct)}; sức mạnh tương đối ${weakest.sector&&weakest.relSec!==null?`so với ngành là ${pct(weakest.relSec)}`:`so với VN-Index là ${pct(weakest.relVn)}`}. Đừng kết luận chỉ từ màu đỏ/xanh.`});
  if(strongest&&(strongest.relSec??strongest.relVn)!==null)insights.push({tone:'positive',title:`${strongest.symbol} đang có sức mạnh tương đối`,text:`Biến động ${pct(strongest.day_change_pct)}; ${strongest.sector&&strongest.relSec!==null?`khỏe hơn ngành ${pct(strongest.relSec)}`:`khỏe hơn VN-Index ${pct(strongest.relVn)}`}. Chỉ giữ lợi thế nếu cấu trúc và kế hoạch vẫn còn đúng.`});
  if(p.margin_pct!==null){if(p.margin_pct>=50||risk>=5&&p.margin_pct>0)insights.push({tone:'danger',title:'Margin đang khuếch đại rủi ro',text:`Margin ${fmt(p.margin_pct,1)}% trong trạng thái ${market?.state?.label||'hiện tại'}. Ưu tiên sức chịu tài khoản và phương án hạ đòn bẩy trước khi nghĩ tới mua thêm.`});else if(risk>=4&&p.margin_pct>=20)insights.push({tone:'warning',title:'Chưa phải lúc mở rộng margin',text:`Market Score ${market?.state?.score??'—'}/100 và margin ${fmt(p.margin_pct,1)}%. Hệ thống nghiêng về giữ dư địa thay vì tăng áp lực.`});}
  if(badFlags.length)insights.push({tone:badFlags.includes('BREAK_STOP')||badFlags.includes('NO_PLAN')?'danger':'warning',title:'Lỗi quy trình đáng chú ý',text:`Hôm nay có: ${badFlags.map(x=>flagLabels[x]).join(', ')}. Nếu lặp lại nhiều phiên, đây có thể là nguyên nhân lớn hơn việc chọn mã.`});
  else if(p.followed_plan)insights.push({tone:'positive',title:'Kỷ luật đang được giữ',text:'Không phát hiện vi phạm lớn trong phần tự rà soát và anh/chị xác nhận vẫn theo kế hoạch. Đây là thứ cần giữ ngay cả khi kết quả một phiên chưa đẹp.'});
  if(p.mood&&p.mood!=='CALM')insights.push({tone:'warning',title:`Cảm xúc hôm nay: ${moodLabels[p.mood]||p.mood}`,text:`Cảm xúc không đồng nghĩa quyết định sai, nhưng nên tách nó khỏi quyết định ngày mai. ${p.primary_worry?`Điều đang băn khoăn nhất: “${p.primary_worry}”.`:''}`});
  let next='Ngày mai chưa cần đoán chỉ số. Hãy giữ nguyên tắc: mã khỏe thì theo kế hoạch, mã yếu hơn ngành cần rà soát, và không tăng rủi ro khi chưa có lợi thế rõ.';
  if(delta!==null&&delta<-.6)next='Ngày mai ưu tiên tìm nguyên nhân danh mục yếu hơn thị trường: mã nào kéo tài khoản xuống, tỷ trọng nào quá lớn và vị thế nào đã vi phạm giả định ban đầu.';
  if(badFlags.includes('BREAK_STOP')||badFlags.includes('NO_PLAN'))next='Việc đầu tiên ngày mai không phải tìm mã mới. Hãy khôi phục kỷ luật: xác định lại điểm sai, mức rủi ro và điều kiện được phép giao dịch.';
  return {headline,tone,insights,next,delta,scored};
}

function renderDiagnosis(d){
  resultBox.innerHTML=`<div class="ih-result-head"><span class="ih-label">KẾT LUẬN SAU PHIÊN</span><strong class="${d.tone==='positive'?'is-up':d.tone==='danger'?'is-down':'is-warn'}">${esc(d.headline)}</strong><p>${esc(d.next)}</p></div><div class="ih-insight-list">${d.insights.map(x=>`<div class="ih-insight ${x.tone}"><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div>`).join('')}</div>`;
}

function renderHistory(rows){
  const box=document.getElementById('historyBox');if(!rows?.length){box.innerHTML='<div class="ih-empty">Chưa có dữ liệu lịch sử. Sau vài phiên, đây sẽ là nơi phát hiện lỗi lặp lại.</div>';return}
  box.innerHTML=rows.slice(0,12).map(row=>{const c=row.checkin||row;const ret=num(c.account_return_pct),vn=num(c.vn_change_pct),delta=ret!==null&&vn!==null?ret-vn:null;return `<div class="ih-history-row"><time>${esc(fmtDate(c.market_date))}</time><b>${esc(c.market_state||'Thị trường')} ${c.market_score??'—'}/100</b><span class="${delta!==null&&delta>=0?'is-up':'is-down'}">TK ${pct(ret)}${delta===null?'':` · vs VNI ${pct(delta)}`}</span></div>`}).join('');
}

async function saveAndAnalyze(){
  const p=payload();if(p.account_return_pct===null){statusEl.textContent='Vui lòng nhập % thay đổi tài khoản hôm nay.';return}
  const d=diagnosis(p);renderDiagnosis(d);statusEl.textContent=session?'Đang lưu vào tài khoản…':'Đã phân tích · dữ liệu đang lưu cục bộ trên thiết bị này.';
  if(session){const {data,error}=await supabaseClient.rpc('investor_save_daily_checkin_v1',{p_payload:p});if(error){statusEl.textContent='Đã phân tích nhưng chưa lưu được: '+error.message}else{statusEl.textContent='Đã lưu phiên hôm nay vào lịch sử của anh/chị.';await loadServer()}}
  else{let rows=localGet(GUEST_KEY,[]);rows=rows.filter(x=>(x.checkin?.market_date||x.market_date)!==p.market_date);rows.unshift({checkin:{...p,market_score:market?.state?.score??null,market_state:market?.state?.label??null,vn_change_pct:market?.vnChange??null},items:p.items});localSet(GUEST_KEY,rows.slice(0,30));renderHistory(rows)}
  trackTool('AFTER_SESSION','ANALYZE',{resultCode:d.tone.toUpperCase(),score:market?.state?.score??null,metadata:{delta:d.delta,margin_pct:p.margin_pct,flags:selectedFlags().length,items:p.items.length,auth:!!session}});
}

async function loadServer(){
  const {data,error}=await supabaseClient.rpc('investor_get_after_session_v1',{p_days:30});if(error)return;serverData=data||{};renderHistory(serverData.checkins||[]);
  if(!document.querySelector('[data-item]')){
    (serverData.positions||[]).forEach(x=>itemRow({symbol:x.symbol,item_type:'POSITION',sector:x.sector||''}));
    (serverData.watchlist||[]).filter(w=>!(serverData.positions||[]).some(p=>p.symbol===w.symbol)).forEach(x=>itemRow({symbol:x.symbol,item_type:'WATCHLIST',sector:x.sector||''}));
  }
}

async function initAuth(){
  session=await getSession();const auth=document.getElementById('authButton'),box=document.getElementById('loginBox'),login=document.getElementById('loginButton');
  if(session){auth.textContent='Đăng xuất';box.innerHTML=`<p><strong>Đã đăng nhập.</strong> Kết quả sau phiên sẽ được lưu vào lịch sử của tài khoản này.</p><span class="ih-status">${esc(session.user?.email||'')}</span>`;auth.onclick=async()=>{await logout();location.reload()};await loadServer()}
  else{auth.textContent='Đăng nhập';auth.onclick=()=>googleLogin();login?.addEventListener('click',()=>googleLogin());renderHistory(localGet(GUEST_KEY,[]))}
}

async function init(){
  document.getElementById('marketDate').value=todayVN();
  try{market=marketContext(await fetchMarket());renderMarket()}catch{document.getElementById('marketLive').textContent='Chưa cập nhật được dữ liệu thị trường'}
  await initAuth();
  if(!document.querySelector('[data-item]'))itemRow();
  document.getElementById('addItem').addEventListener('click',()=>itemRow());
  document.getElementById('analyzeButton').addEventListener('click',saveAndAnalyze);
  trackTool('AFTER_SESSION','VIEW',{metadata:{auth:!!session}});
}
init();
