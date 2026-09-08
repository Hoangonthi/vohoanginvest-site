import { TimeEngine } from './engine/time-engine.js';
import { EventEngine } from './engine/event-engine.js';
import { PortfolioEngine } from './engine/portfolio-engine.js';
import { scoreGame } from './engine/scoring-engine.js';
import { supabaseClient, getLeadSource } from '../assets/js/supabase-client.js';

const $=s=>document.querySelector(s);
const sessionKey=(()=>{const k='vh_fin_game_session_v1';let v=localStorage.getItem(k);if(!v){v=crypto.randomUUID().replaceAll('-','');localStorage.setItem(k,v)}return v})();
const prices={ABC:20};
const priceHistory=[20];
const decisions=[];
let runId=null;
let social='Yên ắng',volume=1,breadth='Trung tính',sector='Bình thường',ended=false;
const portfolio=new PortfolioEngine({cash:600_000_000,marginLimit:.5});

const events=new EventEngine([
 {time:8,code:'ROOM_RUMOR',type:'SOCIAL',materiality:'NOISE',title:'Room chat bắt đầu lan tin',text:'Một số room nói ABC sắp ký hợp đồng lớn. Chưa có xác nhận từ doanh nghiệp.',apply:()=>{social='Tin đồn tăng nhanh'}},
 {time:15,code:'VOLUME_SPIKE',type:'MARKET',materiality:'MATERIAL',title:'Volume tăng mạnh',text:'Khối lượng ABC tăng lên hơn 3 lần trung bình, giá tiếp tục bứt phá.',apply:()=>{volume=3.2;sector='Dòng tiền vào mạnh'}},
 {time:23,code:'MEDIA_PICKUP',type:'MEDIA',materiality:'MATERIAL',title:'Báo chí bắt đầu nhắc đến câu chuyện',text:'Một số bài báo nói về kỳ vọng đơn hàng mới, nhưng doanh nghiệp chưa xác nhận quy mô.',apply:()=>{social='FOMO cao';breadth='Tích cực'}},
 {time:31,code:'GAP_DOWN',type:'MARKET',materiality:'CRITICAL',title:'Cú giảm ngày 31',text:'Thị trường gap down. ABC giảm mạnh cùng nhóm đầu cơ. Chưa có thông tin doanh nghiệp mới.',apply:()=>{volume=4.6;breadth='Rất xấu';sector='Rút tiền mạnh'}},
 {time:42,code:'DENIAL',type:'COMPANY',materiality:'MATERIAL',title:'Doanh nghiệp lên tiếng',text:'ABC xác nhận có đàm phán nhưng phủ nhận con số hợp đồng đang lan truyền trên room.',apply:()=>{social='Tranh cãi';volume=2.1}},
 {time:57,code:'EARNINGS',type:'COMPANY',materiality:'MATERIAL',title:'BCTC quý công bố',text:'Doanh thu tăng 18%, lợi nhuận tăng 9%, dòng tiền kinh doanh yếu hơn cùng kỳ.',apply:()=>{breadth='Trung tính';sector='Phân hóa'}},
 {time:74,code:'RATE_CUT',type:'MACRO',materiality:'MATERIAL',title:'Lãi suất giảm nhẹ',text:'Thanh khoản toàn thị trường cải thiện. Dòng tiền quay lại một số nhóm tăng trưởng.',apply:()=>{breadth='Tích cực';sector='Cải thiện'}},
 {time:96,code:'SECOND_WAVE',type:'MARKET',materiality:'MATERIAL',title:'ABC có nhịp tăng thứ hai',text:'Giá vượt nền ngắn hạn với volume tốt hơn nhưng định giá đã cao hơn đáng kể.',apply:()=>{volume=2.7;social='Hưng phấn trở lại'}},
 {time:112,code:'PLACEMENT',type:'COMPANY',materiality:'CRITICAL',title:'Kế hoạch phát hành riêng lẻ',text:'Doanh nghiệp công bố phương án phát hành thêm, tạo rủi ro pha loãng nhưng có thêm vốn cho dự án.',apply:()=>{social='Mâu thuẫn';breadth='Phân hóa'}}
]);

function seededNoise(day){const x=Math.sin(day*12.9898)*43758.5453;return (x-Math.floor(x))-.5}
function dailyReturn(day){
 let drift=.002;
 if(day<15) drift=.006;
 else if(day<24) drift=.012;
 else if(day<31) drift=.018;
 else if(day===31) return -.18;
 else if(day<42) drift=-.012;
 else if(day<57) drift=-.004;
 else if(day<74) drift=.001;
 else if(day<96) drift=.004;
 else if(day<108) drift=.011;
 else if(day<113) drift=-.002;
 else drift=-.009;
 return drift+seededNoise(day)*.035;
}
function indexLevel(day){let base=1000+day*1.2;if(day>=31&&day<50)base-=75;if(day>=74)base+=35;return Math.round(base+seededNoise(day+9)*18)}
function fmtMoney(v){return `${(v/1e6).toFixed(1)}tr`}
function pct(v){return `${Number(v||0).toFixed(1)}%`}
function snapshot(){return portfolio.snapshot(prices)}

async function startRun(){
 const {data,error}=await supabaseClient.rpc('financial_game_start_run',{p_session_key:sessionKey,p_game_code:'FG-01',p_game_version:'v1',p_difficulty:'INTERMEDIATE',p_source:getLeadSource('FINANCIAL_GAME'),p_horizon_label:'120 ngày',p_initial_state:{cash:600000000,asset:'ABC',price:20,margin_limit:.5,goal:'Tăng tài sản nhưng drawdown không quá 25%'}});
 if(!error) runId=data;
}
async function saveDecision(d){
 if(!runId)return;
 supabaseClient.rpc('financial_game_record_decision',{p_run_id:runId,p_session_key:sessionKey,p_game_time:d.gameTime,p_game_time_label:`Ngày ${d.gameTime}`,p_action_type:d.action,p_asset_code:d.asset||null,p_quantity:d.quantity||null,p_price:d.price||null,p_decision_payload:d,p_market_snapshot:{price:prices.ABC,index:indexLevel(d.gameTime),volume,breadth,sector,social},p_portfolio_snapshot:snapshot(),p_decision_quality:{}}).catch(()=>{});
}
async function saveEvent(e,time){
 if(!runId)return;
 supabaseClient.rpc('financial_game_record_event',{p_run_id:runId,p_session_key:sessionKey,p_game_time:time,p_event_code:e.code,p_event_type:e.type,p_materiality:e.materiality,p_visible_payload:{title:e.title,text:e.text}}).catch(()=>{});
}
function logDecision(d){decisions.push(d);const el=document.createElement('div');el.className='row';el.innerHTML=`<span>Ngày ${d.gameTime} · ${d.label}</span><strong>${d.price?d.price.toFixed(2):''}</strong>`;$('#timeline').prepend(el);saveDecision(d)}
function addEvent(e){const el=document.createElement('div');el.className=`event ${e.materiality==='CRITICAL'?'critical':e.materiality==='MATERIAL'?'material':''}`;el.innerHTML=`<strong>Ngày ${time.time} · ${e.title}</strong><div>${e.text}</div>`;$('#feed').prepend(el)}
function updateChart(){const min=Math.min(...priceHistory)*.94,max=Math.max(...priceHistory)*1.06,range=Math.max(.01,max-min);const pts=priceHistory.map((p,i)=>`${i/(Math.max(1,priceHistory.length-1))*800},${220-(p-min)/range*200}`).join(' ');$('#line').setAttribute('points',pts)}
function render(){const s=snapshot();$('#day').textContent=time.time;$('#price').textContent=prices.ABC.toFixed(2);$('#index').textContent=indexLevel(time.time);$('#equity').textContent=fmtMoney(s.equity);$('#cash').textContent=fmtMoney(s.cash);$('#dd').textContent=pct(s.maxDrawdownPct);$('#margin').textContent=pct(s.marginUsagePct);$('#volume').textContent=`${volume.toFixed(1)}x`;$('#breadth').textContent=breadth;$('#sector').textContent=sector;$('#social').textContent=social;const p=portfolio.position('ABC');$('#positions').innerHTML=p.qty?`<div class="row"><span>ABC · Giá vốn ${p.avg.toFixed(2)}</span><strong>${fmtMoney(p.qty*prices.ABC)} · ${(p.qty*(prices.ABC-p.avg)/1e6).toFixed(1)}tr P&L</strong></div><div class="row"><span>Stop</span><strong>${portfolio.stopByAsset.ABC?.toFixed(2)||'Chưa đặt'}</strong></div>`:'<div class="row"><span>Chưa nắm ABC</span><strong>100% tiền mặt</strong></div>';updateChart()}
function onTick(day){
 prices.ABC=Math.max(2,prices.ABC*(1+dailyReturn(day)));priceHistory.push(prices.ABC);
 const due=events.getDue(day);for(const e of due){e.apply?.();addEvent(e);events.markSeen(e.code);saveEvent(e,day);if(['MATERIAL','CRITICAL'].includes(e.materiality))time.pause()}
 const stops=portfolio.checkStops(prices);for(const a of stops){portfolio.sell(a,1,prices[a],prices);logDecision({gameTime:day,action:'SELL',asset:a,price:prices[a],label:'Stop được kích hoạt',ruleBreak:null});delete portfolio.stopByAsset[a]}
 render();
}
async function finish(){if(ended)return;ended=true;time.pause();const final=snapshot();const scores=scoreGame({decisions,finalState:final,context:{fomoWindowStart:23}});const worstMargin=decisions.find(d=>d.useMargin&&d.gameTime<31);const memory='Cú giảm ngày 31';const lesson=worstMargin?'Tài khoản chịu áp lực lớn không chỉ vì cú giảm ngày 31, mà vì margin đã được dùng trước khi câu chuyện doanh nghiệp được xác minh.':'Kết quả phụ thuộc vào việc anh giữ được bao nhiêu sức mua và kỷ luật trước cú giảm ngày 31.';$('#resultText').innerHTML=`<p><strong>Return:</strong> ${pct(final.returnPct)} · <strong>Max drawdown:</strong> ${pct(final.maxDrawdownPct)} · <strong>Max margin:</strong> ${pct(final.maxMarginUsagePct)} · <strong>Max exposure:</strong> ${pct(final.maxExposurePct)}</p><p><strong>Decision Quality:</strong> ${scores.decision_quality}/100 · <strong>Outcome Quality:</strong> ${scores.outcome_quality}/100. Hai con số này cố ý tách riêng.</p><p>${lesson}</p>`;$('#scores').innerHTML=Object.entries({Timing:scores.timing,Risk:scores.risk,Allocation:scores.allocation,Money:scores.money,Discipline:scores.discipline,System:scores.system}).map(([k,v])=>`<div class="score"><span>${k}</span><b>${v}</b></div>`).join('');$('#memory').textContent=`${memory}: hãy nhớ điều gì đã xảy ra trước cú giảm, không chỉ bản thân cú giảm.`;$('#review').innerHTML=decisions.length?decisions.map(d=>`<div class="row"><span>Ngày ${d.gameTime} · ${d.label}</span><strong>${d.price?d.price.toFixed(2):''}</strong></div>`).join(''):'<p>Không giao dịch cũng là một quyết định: anh đã giữ tiền mặt xuyên suốt game.</p>';$('#result').classList.add('show');$('#result').scrollIntoView({behavior:'smooth'});if(runId){await supabaseClient.rpc('financial_game_complete_run',{p_run_id:runId,p_session_key:sessionKey,p_final_state:final,p_score_json:scores,p_memory_hook:memory,p_lesson_summary:lesson}).catch(()=>{})}}

const time=new TimeEngine({start:0,end:120,tickMs:1000,onTick,onEnd:finish});
$('.controls').addEventListener('click',e=>{const b=e.target.closest('[data-speed]');if(b){time.setSpeed(Number(b.dataset.speed));time.play()}});
$('#play').onclick=()=>time.play();$('#pause').onclick=()=>time.pause();$('#nextEvent').onclick=()=>{const e=events.nextMaterialAfter(time.time);if(e){time.pause();time.jumpTo(e.time)}};
$('#buy').onclick=()=>{const p=Number($('#pct').value)/100;const amount=snapshot().buyingPower*p;if(portfolio.buy('ABC',amount,prices.ABC,false,prices))logDecision({gameTime:time.time,action:'BUY',asset:'ABC',price:prices.ABC,quantity:amount/prices.ABC,label:`Mua ${Math.round(p*100)}% sức mua`,useMargin:false});render()};
$('#buyMargin').onclick=()=>{const p=Number($('#pct').value)/100;const amount=snapshot().buyingPower*p;if(portfolio.buy('ABC',amount,prices.ABC,true,prices))logDecision({gameTime:time.time,action:'BUY',asset:'ABC',price:prices.ABC,quantity:amount/prices.ABC,label:`Mua ${Math.round(p*100)}% sức mua + margin`,useMargin:true});render()};
$('#sell').onclick=()=>{const f=Number($('#pct').value)/100;if(portfolio.sell('ABC',f,prices.ABC,prices))logDecision({gameTime:time.time,action:'SELL',asset:'ABC',price:prices.ABC,label:`Bán ${Math.round(f*100)}% vị thế`});render()};
$('#setStop').onclick=()=>{const s=Number($('#stop').value);if(s>0){portfolio.setStop('ABC',s);logDecision({gameTime:time.time,action:'SET_STOP',asset:'ABC',price:s,label:`Đặt/nâng stop ${s.toFixed(2)}`});render()}};

await startRun();render();
