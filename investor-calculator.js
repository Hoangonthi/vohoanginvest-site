import { supabaseClient } from './assets/js/supabase-client.js';
import {
  calcStopTargetRR,
  calcDeploymentPlan,
  calcMarginThresholds,
  calcActualLeverage,
  calcLosingStreak,
  calcPortfolioConcentration,
  calcDividendYield,
  calcCostBasisAfterRights
} from './assets/js/investor-calculator-math.js?v=20260918-1';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const n=id=>Number($(id)?.value||0), fmt=v=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(Number(v||0)), money=v=>`${fmt(v)} đ`, pct=v=>`${Number(v||0).toFixed(1)}%`, num=v=>fmt(v);
const qtyFmt=v=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:4}).format(Number(v||0));
const ratioFmt=v=>new Intl.NumberFormat('vi-VN',{minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(v||0));
const hhiFmt=v=>new Intl.NumberFormat('vi-VN',{minimumFractionDigits:4,maximumFractionDigits:4}).format(Number(v||0));
const ceilLot=(q,l)=>Math.ceil(q/l)*l, floorLot=(q,l)=>Math.floor(q/l)*l;
function verdict(el,text,tone=''){if(!el)return;el.textContent=text;el.className=`verdict ${tone}`.trim()}
function clearValidation(id){if($(id))$(id).textContent=''} function validate(id,msg){if($(id))$(id).textContent=msg;return false}
function bind(id,fn){const el=$(id);if(el)el.addEventListener('submit',fn)}

const TOOL_GROUPS=[
  {id:'prebuy',title:'Trước mua',tools:['position','rr','starr','deployment']},
  {id:'holding',title:'Đang giữ / xử lý vị thế',tools:['average','breakeven','deleverage','recovercapital']},
  {id:'margin',title:'Margin',tools:['margin','margincost','mcall','leverage']},
  {id:'risk',title:'Rủi ro',tools:['drawdown','portfolio','streak','concentration']},
  {id:'rights',title:'Cổ tức / quyền',tools:['dividend','exright','divyield','costrights']}
];
function setToolGroupOpen(group,open){if(!group)return;group.classList.toggle('open',open);const toggle=group.querySelector('.tool-group-toggle');if(toggle)toggle.setAttribute('aria-expanded',String(open))}
function setupToolAccordion(){
  const dir=$('.terminal-tabs');if(!dir||dir.dataset.accordionReady==='1')return;
  const tabs=[...dir.querySelectorAll('.tab')],tabMap=new Map(tabs.map(t=>[t.dataset.tab,t]));
  dir.dataset.accordionReady='1';dir.innerHTML='';
  const head=document.createElement('div');head.className='tool-directory-head';
  head.innerHTML='<div><strong>Bộ máy tính đầu tư</strong><span>Chọn đúng nhóm rồi mở công cụ cần dùng.</span></div><div class="tool-directory-actions"><button type="button" data-tools-open>Mở tất cả</button><button type="button" data-tools-close>Thu gọn</button></div>';
  dir.appendChild(head);
  TOOL_GROUPS.forEach((cfg,index)=>{
    const group=document.createElement('section');group.className='tool-group';group.dataset.group=cfg.id;
    const toggle=document.createElement('button');toggle.type='button';toggle.className='tool-group-toggle';toggle.setAttribute('aria-expanded','false');
    toggle.innerHTML=`<span>${cfg.title}</span><small>${cfg.tools.length} công cụ</small><i aria-hidden="true">⌄</i>`;
    const panel=document.createElement('div');panel.className='tool-group-panel';
    cfg.tools.forEach(key=>{const tab=tabMap.get(key);if(tab)panel.appendChild(tab)});
    group.append(toggle,panel);dir.appendChild(group);
    toggle.addEventListener('click',()=>setToolGroupOpen(group,!group.classList.contains('open')));
    if(index===0&&window.innerWidth>560)setToolGroupOpen(group,true);
  });
  head.querySelector('[data-tools-open]').addEventListener('click',()=>$$('.tool-group').forEach(g=>setToolGroupOpen(g,true)));
  head.querySelector('[data-tools-close]').addEventListener('click',()=>$$('.tool-group').forEach(g=>setToolGroupOpen(g,false)));
}
setupToolAccordion();
$$('.tab').forEach(btn=>btn.addEventListener('click',()=>{const group=btn.closest('.tool-group');setToolGroupOpen(group,true);$$('.tab').forEach(x=>x.classList.toggle('active',x===btn));$$('.calc-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===btn.dataset.tab));history.replaceState(null,'',`#${btn.dataset.tab}`)}));
function activateFromHash(){const key=location.hash.replace('#','');const btn=$(`.tab[data-tab="${key}"]`);if(btn)btn.click()}

function newCalcError(validationId,res){
  clearValidation(validationId);
  if(res?.ok)return false;
  validate(validationId,res?.error||'Dữ liệu chưa hợp lệ.');
  return true;
}

const depRowsEl=$('#depRows');
function addDeploymentRow(values={}){
  if(!depRowsEl||depRowsEl.children.length>=8)return;
  const row=document.createElement('div');
  row.className='dynamic-row dep-row';
  const price=values.price??'';
  const qty=values.qty??'';
  const amount=values.amount??'';
  row.innerHTML='<input class="dep-price" type="number" min="0" step="any" placeholder="Giá" value="'+price+'">'
    +'<input class="dep-qty" type="number" min="0" step="1" placeholder="Số lượng" value="'+qty+'">'
    +'<input class="dep-amount" type="number" min="0" step="any" placeholder="Số tiền" value="'+amount+'">'
    +'<button class="row-remove" type="button" data-remove-dep aria-label="Xóa nhịp">×</button>';
  depRowsEl.appendChild(row);
}
if(depRowsEl){
  addDeploymentRow({price:75000,qty:500});
  addDeploymentRow({price:72000,qty:500});
  addDeploymentRow({price:68000,qty:500});
  $('#depAddLeg')?.addEventListener('click',()=>addDeploymentRow());
  depRowsEl.addEventListener('click',e=>{
    const b=e.target.closest('[data-remove-dep]');
    if(!b)return;
    if(depRowsEl.children.length<=1)return;
    b.closest('.dep-row')?.remove();
  });
}

const concRowsEl=$('#concRows');
function addConcentrationRow(values={}){
  if(!concRowsEl||concRowsEl.children.length>=12)return;
  const row=document.createElement('div');
  row.className='dynamic-row conc-row';
  const symbol=values.symbol??'';
  const value=values.value??'';
  const sector=values.sector??'';
  row.innerHTML='<input class="conc-symbol" type="text" maxlength="12" placeholder="Mã" value="'+symbol+'">'
    +'<input class="conc-value" type="number" min="0" step="any" placeholder="Giá trị" value="'+value+'">'
    +'<input class="conc-sector" type="text" maxlength="40" placeholder="Ngành / nhóm" value="'+sector+'">'
    +'<button class="row-remove" type="button" data-remove-conc aria-label="Xóa vị thế">×</button>';
  concRowsEl.appendChild(row);
}
if(concRowsEl){
  for(let i=0;i<4;i++)addConcentrationRow();
  $('#concAddRow')?.addEventListener('click',()=>addConcentrationRow());
  concRowsEl.addEventListener('click',e=>{
    const b=e.target.closest('[data-remove-conc]');
    if(!b)return;
    if(concRowsEl.children.length<=1)return;
    b.closest('.conc-row')?.remove();
  });
}

bind('#stForm',e=>{
  e.preventDefault();
  const res=calcStopTargetRR({
    entry:n('#stEntry'),
    stop:n('#stStop'),
    target:n('#stTarget'),
    qty:n('#stQty')
  });
  if(newCalcError('#stValidation',res))return;
  $('#stRatio').textContent='1 : '+ratioFmt(res.ratio);
  $('#stRiskPerShare').textContent=money(res.riskPerShare);
  $('#stRewardPerShare').textContent=money(res.rewardPerShare);
  $('#stRiskPct').textContent=pct(res.riskPct);
  $('#stRewardPct').textContent=pct(res.rewardPct);
  $('#stTotalRisk').textContent=money(res.totalRisk);
  $('#stTotalReward').textContent=money(res.totalReward);
  verdict($('#stVerdict'),'ĐÃ TÍNH THEO STOP / TARGET ĐÃ NHẬP');
  saveIfLogged('PRE_BUY','CALC_STOP_TARGET_RR',
    {entry:res.entry,stop:res.stop,target:res.target,qty:res.qty},
    {riskPerShare:res.riskPerShare,rewardPerShare:res.rewardPerShare,riskPct:res.riskPct,rewardPct:res.rewardPct,totalRisk:res.totalRisk,totalReward:res.totalReward,ratio:res.ratio},
    $('#stAction').textContent
  );
});

bind('#depForm',e=>{
  e.preventDefault();
  const legs=[...depRowsEl.querySelectorAll('.dep-row')].map(row=>({
    price:row.querySelector('.dep-price').value,
    qty:row.querySelector('.dep-qty').value,
    amount:row.querySelector('.dep-amount').value
  })).filter(x=>String(x.price).trim()||String(x.qty).trim()||String(x.amount).trim());
  const res=calcDeploymentPlan({buyFeePct:n('#depFeePct'),lot:n('#depLot'),legs});
  if(newCalcError('#depValidation',res))return;
  $('#depAvgCost').textContent=money(res.averageCost);
  $('#depCapital').textContent=money(res.totalCapital);
  $('#depQty').textContent=qtyFmt(res.totalQty);
  $('#depGross').textContent=money(res.grossValue);
  $('#depFees').textContent=money(res.totalFee);
  verdict($('#depVerdict'),'KẾ HOẠCH ĐÃ ĐƯỢC TÍNH ĐỦ PHÍ');
  saveIfLogged('PRE_BUY','CALC_DEPLOYMENT_PLAN',
    {buyFeePct:res.buyFeePct,lot:res.lot,legs},
    {totalQty:res.totalQty,grossValue:res.grossValue,totalFee:res.totalFee,totalCapital:res.totalCapital,averageCost:res.averageCost},
    $('#depAction').textContent
  );
});

bind('#mcallForm',e=>{
  e.preventDefault();
  const res=calcMarginThresholds({
    debt:n('#mcallDebt'),
    marketValue:n('#mcallMarketValue'),
    qty:$('#mcallQty').value,
    callPct:n('#mcallCallPct'),
    forcePct:n('#mcallForcePct')
  });
  if(newCalcError('#mcallValidation',res))return;
  $('#mcallCurrent').textContent=pct(res.currentRatioPct);
  $('#mcallCallValue').textContent=money(res.marginCall.value);
  $('#mcallCallPrice').textContent=res.marginCall.price===null?'—':money(res.marginCall.price);
  $('#mcallForceValue').textContent=money(res.forceSell.value);
  $('#mcallForcePrice').textContent=res.forceSell.price===null?'—':money(res.forceSell.price);
  if(res.alreadyBelowForce)verdict($('#mcallVerdict'),'ĐÃ THẤP HƠN NGƯỠNG FORCE SELL ĐÃ NHẬP','bad');
  else if(res.alreadyBelowCall)verdict($('#mcallVerdict'),'ĐÃ THẤP HƠN NGƯỠNG MARGIN CALL ĐÃ NHẬP','warn');
  else verdict($('#mcallVerdict'),'TRÊN CÁC NGƯỠNG ĐÃ NHẬP');
  saveIfLogged('HOLDING','CALC_MARGIN_THRESHOLDS',
    {debt:res.debt,marketValue:res.marketValue,qty:res.qty,callPct:res.marginCall.pct,forcePct:res.forceSell.pct},
    {currentRatioPct:res.currentRatioPct,marginCall:res.marginCall,forceSell:res.forceSell},
    $('#mcallAction').textContent
  );
});

bind('#levForm',e=>{
  e.preventDefault();
  const res=calcActualLeverage({
    exposure:n('#levExposure'),
    cash:n('#levCash'),
    debt:n('#levDebt')
  });
  if(newCalcError('#levValidation',res))return;
  $('#levNav').textContent=money(res.nav);
  $('#levAssets').textContent=money(res.totalAssets);
  $('#levRatio').textContent=ratioFmt(res.leverage)+'x';
  $('#levDebtNav').textContent=pct(res.debtToNav*100);
  $('#levExposureOut').textContent=money(res.exposure);
  $('#levScenarioBody').innerHTML=res.scenarios.map(s=>
    '<tr><td>'+(s.changePct>0?'+':'')+s.changePct+'%</td><td>'+money(s.newNav)+'</td><td>'+pct(s.navChangePct)+'</td></tr>'
  ).join('');
  verdict($('#levVerdict'),'ĐÃ TÍNH LẠI NAV THEO TỪNG KỊCH BẢN');
  saveIfLogged('HOLDING','CALC_ACTUAL_LEVERAGE',
    {exposure:res.exposure,cash:res.cash,debt:res.debt},
    {totalAssets:res.totalAssets,nav:res.nav,leverage:res.leverage,debtToNav:res.debtToNav,scenarios:res.scenarios},
    $('#levAction').textContent
  );
});

bind('#streakForm',e=>{
  e.preventDefault();
  const res=calcLosingStreak({
    capital:n('#streakCapital'),
    riskPct:n('#streakRiskPct'),
    milestones:[3,5,7,10,15,20]
  });
  if(newCalcError('#streakValidation',res))return;
  $('#streakBody').innerHTML=res.rows.map(r=>
    '<tr><td>'+r.losses+'</td><td>'+money(r.remaining)+'</td><td>'+pct(r.drawdownPct)+'</td><td>'+money(r.lossMoney)+'</td></tr>'
  ).join('');
  const r20=res.rows.find(r=>r.losses===20)||res.rows[res.rows.length-1];
  $('#streak20').textContent=money(r20.remaining);
  verdict($('#streakVerdict'),'MÔ PHỎNG THEO % NAV CÒN LẠI');
  saveIfLogged('PRE_BUY','CALC_LOSING_STREAK',
    {capital:res.capital,riskPct:res.riskPct},
    {rows:res.rows},
    $('#streakAction').textContent
  );
});

bind('#concForm',e=>{
  e.preventDefault();
  const positions=[...concRowsEl.querySelectorAll('.conc-row')].map(row=>({
    symbol:row.querySelector('.conc-symbol').value,
    value:row.querySelector('.conc-value').value,
    sector:row.querySelector('.conc-sector').value
  }));
  const res=calcPortfolioConcentration({positions});
  if(newCalcError('#concValidation',res))return;
  $('#concHhi').textContent=hhiFmt(res.hhi);
  $('#concTop1').textContent=pct(res.top1*100);
  $('#concTop3').textContent=pct(res.top3*100);
  $('#concEffective').textContent=ratioFmt(res.effectivePositions);
  $('#concTotal').textContent=money(res.total);
  $('#concSectors').innerHTML=res.sectors.map(s=>
    '<div class="sector-line"><span>'+escHtml(s.sector)+'</span><span>'+pct(s.weight*100)+'</span></div>'
  ).join('');
  verdict($('#concVerdict'),'KẾT QUẢ THUẦN TOÁN HỌC');
  saveIfLogged('HOLDING','CALC_PORTFOLIO_CONCENTRATION',
    {positions},
    {total:res.total,top1:res.top1,top3:res.top3,hhi:res.hhi,effectivePositions:res.effectivePositions,sectors:res.sectors},
    $('#concAction').textContent
  );
});

bind('#dyForm',e=>{
  e.preventDefault();
  const res=calcDividendYield({
    marketPrice:n('#dyMarket'),
    parValue:n('#dyPar'),
    dividendPct:n('#dyPct')
  });
  if(newCalcError('#dyValidation',res))return;
  $('#dyYield').textContent=pct(res.yieldPct);
  $('#dyPerShare').textContent=money(res.dividendPerShare);
  $('#dyDeclared').textContent=pct(res.dividendPct);
  $('#dyParOut').textContent=money(res.parValue);
  $('#dyMarketOut').textContent=money(res.marketPrice);
  verdict($('#dyVerdict'),'ĐÃ TÁCH MỆNH GIÁ VÀ GIÁ THỊ TRƯỜNG');
  saveIfLogged('HOLDING','CALC_DIVIDEND_YIELD',
    {marketPrice:res.marketPrice,parValue:res.parValue,dividendPct:res.dividendPct},
    {dividendPerShare:res.dividendPerShare,yieldPct:res.yieldPct},
    $('#dyAction').textContent
  );
});

bind('#crForm',e=>{
  e.preventDefault();
  const res=calcCostBasisAfterRights({
    oldQty:n('#crOldQty'),
    oldAvgCost:n('#crOldAvg'),
    bonusPct:n('#crBonusPct'),
    ratioOld:$('#crRatioOld').value,
    ratioNew:$('#crRatioNew').value,
    subPrice:$('#crSubPrice').value,
    actualSubQty:$('#crActualSubQty').value,
    relatedFee:$('#crRelatedFee').value,
    fractionRule:$('#crFractionRule').value
  });
  if(newCalcError('#crValidation',res))return;
  $('#crNewAvg').textContent=money(res.newAvgCost);
  $('#crOldBasis').textContent=money(res.oldCostBasis);
  $('#crBonusQty').textContent=qtyFmt(res.bonusQty);
  $('#crEntitledQty').textContent=qtyFmt(res.entitledSubQty);
  $('#crBoughtQty').textContent=qtyFmt(res.actualSubQty);
  $('#crNewBasis').textContent=money(res.newCostBasis);
  $('#crTotalQty').textContent=qtyFmt(res.totalQty);
  verdict($('#crVerdict'),'ĐÃ TÍNH LẠI COST BASIS');
  saveIfLogged('HOLDING','CALC_COST_BASIS_AFTER_RIGHTS',
    {
      oldQty:res.oldQty,oldAvgCost:res.oldAvgCost,bonusPct:res.bonusPct,
      ratioOld:res.ratioOld,ratioNew:res.ratioNew,subPrice:res.subPrice,
      actualSubQty:res.actualSubQty,relatedFee:res.relatedFee,fractionRule:res.fractionRule
    },
    {
      oldCostBasis:res.oldCostBasis,bonusQty:res.bonusQty,entitledSubQty:res.entitledSubQty,
      subscriptionCost:res.subscriptionCost,totalQty:res.totalQty,newCostBasis:res.newCostBasis,newAvgCost:res.newAvgCost
    },
    $('#crAction').textContent
  );
});

function escHtml(v=''){
  return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

bind('#positionForm',e=>{e.preventDefault();clearValidation('#posValidation');const capital=n('#posCapital'),riskPct=n('#posRiskPct'),budgetPct=n('#posPortfolioBudget'),usedPct=n('#posRiskUsed'),entry=n('#posEntry'),stop=n('#posStop'),maxPct=n('#posMaxPct'),lot=Math.max(1,n('#posLot'));if(capital<=0||entry<=0||stop<=0)return validate('#posValidation','Vốn, giá mua và giá cắt lỗ phải lớn hơn 0.');if(stop>=entry)return validate('#posValidation','Giá cắt lỗ phải thấp hơn giá mua.');if(riskPct<=0||budgetPct<=0||maxPct<=0)return validate('#posValidation','Các giới hạn rủi ro phải lớn hơn 0.');const roomPct=Math.max(0,budgetPct-usedPct),cashRisk=Math.min(capital*riskPct/100,capital*roomPct/100),riskPerShare=entry-stop,qtyRisk=Math.floor(cashRisk/riskPerShare),qtyWeight=Math.floor((capital*maxPct/100)/entry),qty=Math.max(0,floorLot(Math.min(qtyRisk,qtyWeight),lot)),value=qty*entry,loss=qty*riskPerShare,weight=value/capital*100,roomAfter=Math.max(0,roomPct-loss/capital*100);$('#posQty').textContent=num(qty);$('#posValue').textContent=money(value);$('#posLoss').textContent=money(loss);$('#posWeight').textContent=pct(weight);$('#posRoom').textContent=pct(roomAfter);if(roomPct<=0||qty===0){verdict($('#posVerdict'),'KHÔNG NÊN MỞ THÊM','bad');$('#posAction').textContent='Ngân sách rủi ro không còn đủ cho một lô hợp lệ. Giảm rủi ro vị thế hiện có hoặc bỏ lệnh.'}else if(qtyWeight<qtyRisk){verdict($('#posVerdict'),'BỊ GIỚI HẠN BỞI TỶ TRỌNG','warn');$('#posAction').textContent=`Giới hạn tỷ trọng/mã đang chặn quy mô ở khoảng ${pct(weight)}.`}else{verdict($('#posVerdict'),'TRONG GIỚI HẠN','good');$('#posAction').textContent=`Nếu luận điểm còn hiệu lực, quy mô tối đa khoảng ${num(qty)} cổ phiếu; lỗ tại cắt lỗ khoảng ${money(loss)}.`}saveIfLogged('PRE_BUY','CALC_POSITION_SIZE',{capital,riskPct,budgetPct,usedPct,entry,stop,maxPct,lot},{qty,value,loss,weight,roomAfter},$('#posAction').textContent)});

bind('#rrForm',e=>{e.preventDefault();clearValidation('#rrValidation');const entry=n('#rrEntry'),stop=n('#rrStop'),target=n('#rrTarget'),qty=n('#rrQty');if(entry<=0||stop<=0||target<=0||qty<=0)return validate('#rrValidation','Nhập đầy đủ giá mua, giá cắt lỗ, giá mục tiêu và số lượng.');if(stop>=entry||target<=entry)return validate('#rrValidation','Giá cắt lỗ phải dưới giá mua và giá mục tiêu phải trên giá mua.');const risk=(entry-stop)*qty,reward=(target-entry)*qty,ratio=reward/risk,be=100/(1+ratio),stopPct=(entry-stop)/entry*100;$('#rrRatio').textContent=`1 : ${ratio.toFixed(2)}`;$('#rrLoss').textContent=money(risk);$('#rrProfit').textContent=money(reward);$('#rrBreakeven').textContent=pct(be);$('#rrStopPct').textContent=pct(stopPct);if(ratio>=2){verdict($('#rrVerdict'),'TỶ LỆ TỐT','good');$('#rrAction').textContent='Tỷ lệ toán học tốt. Tiếp tục kiểm tra luận điểm và quy mô lệnh.'}else if(ratio>=1.3){verdict($('#rrVerdict'),'TỶ LỆ TRUNG BÌNH','warn');$('#rrAction').textContent='Không kéo mục tiêu xa chỉ để làm đẹp tỷ lệ.'}else{verdict($('#rrVerdict'),'KHÔNG HẤP DẪN VỀ TOÁN HỌC','bad');$('#rrAction').textContent='Chờ điểm vào tốt hơn, cắt lỗ hợp lý hơn hoặc bỏ lệnh.'}saveIfLogged('PRE_BUY','CALC_RR',{entry,stop,target,qty},{risk,reward,ratio,be,stopPct},$('#rrAction').textContent)});

bind('#avgForm',e=>{e.preventDefault();clearValidation('#avgValidation');const oldQty=n('#avgQty'),oldPrice=n('#avgPrice'),addPrice=n('#avgAddPrice'),addAmount=n('#avgAddAmount'),stop=n('#avgStop'),capital=n('#avgCapital');if(oldQty<=0||oldPrice<=0||addPrice<=0||addAmount<=0||capital<=0)return validate('#avgValidation','Nhập đầy đủ vị thế, giá mua thêm và vốn tài khoản.');const addQty=floorLot(addAmount/addPrice,100);if(addQty<=0)return validate('#avgValidation','Số tiền mua thêm chưa đủ một lô 100 cổ phiếu.');const totalQty=oldQty+addQty,newCost=oldQty*oldPrice+addQty*addPrice,newAvg=newCost/totalQty,weight=newCost/capital*100,risk=stop>0?Math.max(0,(newAvg-stop)*totalQty):0,riskPct=risk/capital*100;$('#avgAddQty').textContent=num(addQty);$('#avgNewPrice').textContent=money(newAvg);$('#avgWeight').textContent=pct(weight);$('#avgRisk').textContent=money(risk);$('#avgRiskPct').textContent=pct(riskPct);if(stop<=0){verdict($('#avgVerdict'),'CHƯA CÓ MỨC LUẬN ĐIỂM SAI','bad');$('#avgAction').textContent='Không bình quân khi chưa biết mức giá nào chứng minh luận điểm sai.'}else if(riskPct>2||weight>30){verdict($('#avgVerdict'),'RỦI RO TĂNG MẠNH','bad');$('#avgAction').textContent=`Sau mua thêm, vị thế lên ${pct(weight)} và rủi ro tới cắt lỗ khoảng ${pct(riskPct)} tài khoản.`}else{verdict($('#avgVerdict'),'CẦN XÁC NHẬN LUẬN ĐIỂM','warn');$('#avgAction').textContent=`Giá vốn mới ${money(newAvg)}; chỉ mua thêm nếu luận điểm mạnh hơn, không chỉ vì giá giảm.`}saveIfLogged('HOLDING','CALC_AVERAGE_DOWN',{oldQty,oldPrice,addPrice,addAmount,stop,capital},{addQty,totalQty,newAvg,weight,risk,riskPct},$('#avgAction').textContent)});

bind('#marginForm',e=>{e.preventDefault();clearValidation('#mValidation');const equity=n('#mEquity'),debt=n('#mDebt'),shock=n('#mShock'),limit=n('#mLimit');if(equity<=0||debt<0||shock<=0)return validate('#mValidation','Vốn tự có phải lớn hơn 0 và mức giảm phải hợp lệ.');const gross=equity+debt,loss=gross*shock/100,after=equity-loss,dd=loss/equity*100,debtRatio=after>0?debt/after*100:Infinity,scenario=s=>Math.max(0,equity-gross*s/100),marginPct=debt/equity*100;$('#mGross').textContent=money(gross);$('#mLoss').textContent=money(loss);$('#mAfter').textContent=after>0?money(after):'≤ 0 đ';$('#mDrawdown').textContent=pct(dd);$('#mDebtRatio').textContent=Number.isFinite(debtRatio)?pct(debtRatio):'Vốn tự có bị xóa';$('#mS5').textContent=money(scenario(5));$('#mS10').textContent=money(scenario(10));$('#mS15').textContent=money(scenario(15));if(after<=0||dd>=50){verdict($('#mVerdict'),'RỦI RO RẤT CAO','bad');$('#mAction').textContent='Giảm nợ hoặc tổng giá trị vị thế trước khi nghĩ tới lợi nhuận.'}else if(marginPct>limit||dd>=25){verdict($('#mVerdict'),'VƯỢT GIỚI HẠN','bad');$('#mAction').textContent=`Margin ${pct(marginPct)} vốn tự có; cú giảm ${shock}% làm vốn thật giảm ${pct(dd)}.`}else if(dd>=15){verdict($('#mVerdict'),'CẦN THẬN TRỌNG','warn');$('#mAction').textContent='Không tăng margin nếu chưa có phương án giảm vị thế khi thị trường đi ngược.'}else{verdict($('#mVerdict'),'TRONG NGƯỠNG','good');$('#mAction').textContent='Đòn bẩy vẫn trong giới hạn của kịch bản đã nhập.'}saveIfLogged('PRE_BUY','CALC_MARGIN_STRESS',{equity,debt,shock,limit},{gross,loss,after,dd,debtRatio,marginPct},$('#mAction').textContent)});

bind('#breakevenForm',e=>{e.preventDefault();clearValidation('#bValidation');const entry=n('#bEntry'),qty=n('#bQty'),buyFee=n('#bBuyFee')/100,sellFee=n('#bSellFee')/100,sellTax=n('#bSellTax')/100,interest=n('#bInterest');if(entry<=0||qty<=0)return validate('#bValidation','Giá mua và số lượng phải lớn hơn 0.');const buyGross=entry*qty,buyFeeMoney=buyGross*buyFee,totalCost=buyGross+buyFeeMoney+interest,sellRate=1-sellFee-sellTax;if(sellRate<=0)return validate('#bValidation','Tổng phí và thuế bán không hợp lệ.');const revenue=totalCost/sellRate,price=revenue/qty,sellCosts=revenue*(sellFee+sellTax),fees=buyFeeMoney+sellCosts+interest,needPct=(price/entry-1)*100;$('#bPrice').textContent=money(price);$('#bCost').textContent=money(totalCost);$('#bFees').textContent=money(fees);$('#bNeedPct').textContent=pct(needPct);$('#bRevenue').textContent=money(revenue);verdict($('#bVerdict'),'ĐÃ TÍNH ĐỦ CHI PHÍ','good');$('#bAction').textContent=`Giá phải tăng khoảng ${pct(needPct)} từ giá mua mới hòa vốn sau chi phí đã nhập.`;saveIfLogged('HOLDING','CALC_TRUE_BREAKEVEN',{entry,qty,buyFee,sellFee,sellTax,interest},{price,revenue,fees,needPct},$('#bAction').textContent)});

bind('#marginCostForm',e=>{e.preventDefault();clearValidation('#mcValidation');const debt=n('#mcDebt'),rate=n('#mcRate'),days=n('#mcDays'),position=n('#mcPosition');if(debt<0||rate<0||days<0)return validate('#mcValidation','Dư nợ, lãi suất và số ngày không được âm.');const daily=debt*(rate/100)/365,cost=daily*days,c30=daily*30,c90=daily*90,costPct=position>0?cost/position*100:0;$('#mcCost').textContent=money(cost);$('#mcDaily').textContent=money(daily);$('#mcPct').textContent=position>0?pct(costPct):'—';$('#mc30').textContent=money(c30);$('#mc90').textContent=money(c90);if(costPct>=2){verdict($('#mcVerdict'),'CHI PHÍ ĐÁNG KỂ','bad');$('#mcAction').textContent='Chi phí vốn đã ăn đáng kể vào kỳ vọng lợi nhuận; xem lại thời gian nắm giữ hoặc giảm dư nợ.'}else if(costPct>=0.5){verdict($('#mcVerdict'),'CẦN TÍNH VÀO HÒA VỐN','warn');$('#mcAction').textContent='Đưa khoản lãi này vào giá hòa vốn thật trước khi đặt mục tiêu bán.'}else{verdict($('#mcVerdict'),'CHI PHÍ CÒN THẤP','good');$('#mcAction').textContent='Tiếp tục theo dõi vì chi phí tăng theo số ngày vay.'}saveIfLogged('HOLDING','CALC_MARGIN_COST',{debt,rate,days,position},{daily,cost,c30,c90,costPct},$('#mcAction').textContent)});

bind('#deleverageForm',e=>{e.preventDefault();clearValidation('#dlValidation');const assets=n('#dlAssets'),debt=n('#dlDebt'),target=n('#dlTarget')/100,price=n('#dlPrice'),lot=Math.max(1,n('#dlLot'));if(assets<=0||debt<0||price<=0)return validate('#dlValidation','Danh mục, dư nợ và giá bán phải hợp lệ.');const equity=assets-debt;if(equity<=0)return validate('#dlValidation','Vốn tự có hiện không dương; cần xử lý rủi ro ngay.');const targetDebt=equity*target,needPay=Math.max(0,debt-targetDebt),qty=needPay>0?ceilLot(needPay/price,lot):0,sellValue=qty*price,newDebt=Math.max(0,debt-sellValue),afterRatio=newDebt/equity*100;$('#dlSellValue').textContent=money(sellValue);$('#dlEquity').textContent=money(equity);$('#dlTargetDebt').textContent=money(targetDebt);$('#dlQty').textContent=num(qty);$('#dlAfterRatio').textContent=pct(afterRatio);if(needPay<=0){verdict($('#dlVerdict'),'ĐÃ Ở TRONG MỤC TIÊU','good');$('#dlAction').textContent='Không cần bán chỉ để hạ margin theo mục tiêu đã nhập.'}else{verdict($('#dlVerdict'),'CẦN GIẢM ĐÒN BẨY','warn');$('#dlAction').textContent=`Cần thu về khoảng ${money(needPay)} để trả nợ; tương đương khoảng ${num(qty)} cổ phiếu.`}saveIfLogged('HOLDING','CALC_DELEVERAGE',{assets,debt,target,price,lot},{equity,targetDebt,needPay,qty,sellValue,afterRatio},$('#dlAction').textContent)});

bind('#recoverForm',e=>{e.preventDefault();clearValidation('#rcValidation');const qty=n('#rcQty'),cost=n('#rcCost'),price=n('#rcPrice'),fee=n('#rcFee')/100,tax=n('#rcTax')/100,lot=Math.max(1,n('#rcLot'));if(qty<=0||cost<=0||price<=0)return validate('#rcValidation','Số lượng, giá vốn và giá bán phải lớn hơn 0.');const original=qty*cost,netPerShare=price*(1-fee-tax);if(netPerShare<=0)return validate('#rcValidation','Phí và thuế không hợp lệ.');const sellQty=Math.min(qty,ceilLot(original/netPerShare,lot)),net=sellQty*netPerShare,remain=Math.max(0,qty-sellQty),remainValue=remain*price;$('#rcSellQty').textContent=num(sellQty);$('#rcOriginal').textContent=money(original);$('#rcNet').textContent=money(net);$('#rcRemain').textContent=num(remain);$('#rcRemainValue').textContent=money(remainValue);if(net<original){verdict($('#rcVerdict'),'CHƯA THỂ THU HỒI HẾT VỐN','bad');$('#rcAction').textContent='Bán toàn bộ ở giá hiện tại vẫn chưa thu hồi đủ vốn gốc sau phí/thuế.'}else{verdict($('#rcVerdict'),'CÓ THỂ THU HỒI VỐN','good');$('#rcAction').textContent=`Bán khoảng ${num(sellQty)} cổ phiếu để thu hồi vốn gốc; còn lại ${num(remain)} cổ phiếu.`}saveIfLogged('HOLDING','CALC_RECOVER_CAPITAL',{qty,cost,price,fee,tax,lot},{original,sellQty,net,remain,remainValue},$('#rcAction').textContent)});

bind('#drawdownForm',e=>{e.preventDefault();clearValidation('#ddValidation');const start=n('#ddStart'),now=n('#ddNow');if(start<=0||now<=0)return validate('#ddValidation','Vốn ban đầu và vốn hiện tại phải lớn hơn 0.');if(now>start)return validate('#ddValidation','Vốn hiện tại đang cao hơn vốn ban đầu.');const lossPct=(1-now/start)*100,recovery=(start/now-1)*100,moneyGap=start-now,afterMore=now*0.9,moreRecovery=(start/afterMore-1)*100;$('#ddRecovery').textContent=pct(recovery);$('#ddLossPct').textContent=pct(lossPct);$('#ddMoney').textContent=money(moneyGap);$('#ddMore10').textContent=money(afterMore);$('#ddMoreRecovery').textContent=pct(moreRecovery);if(lossPct>=30){verdict($('#ddVerdict'),'SỤT GIẢM SÂU','bad');$('#ddAction').textContent='Ưu tiên giảm rủi ro và sửa quy trình; tăng quy mô để gỡ làm rủi ro cao hơn.'}else if(lossPct>=15){verdict($('#ddVerdict'),'CẦN BẢO VỆ VỐN','warn');$('#ddAction').textContent=`Đã lỗ ${pct(lossPct)} nhưng cần tăng ${pct(recovery)} mới hòa vốn.`}else{verdict($('#ddVerdict'),'CÒN KHẢ NĂNG HỒI PHỤC TỐT','good');$('#ddAction').textContent='Giữ kỷ luật để tránh biến mức lỗ nhỏ thành lỗ lớn.'}saveIfLogged('WEEKLY_REVIEW','CALC_DRAWDOWN_RECOVERY',{start,now},{lossPct,recovery,moneyGap,afterMore,moreRecovery},$('#ddAction').textContent)});

bind('#portfolioForm',e=>{e.preventDefault();clearValidation('#pfValidation');const capital=n('#pfCapital'),budget=n('#pfBudget');if(capital<=0||budget<=0)return validate('#pfValidation','Vốn và ngân sách rủi ro phải lớn hơn 0.');const rows=[];for(let i=1;i<=5;i++){const symbol=$(`#pfS${i}`).value.trim().toUpperCase(),value=n(`#pfV${i}`),riskPct=n(`#pfR${i}`);if(value>0&&riskPct>=0)rows.push({symbol:symbol||`Vị thế ${i}`,value,riskPct,riskMoney:value*riskPct/100})}if(!rows.length)return validate('#pfValidation','Nhập ít nhất một vị thế.');const total=rows.reduce((s,r)=>s+r.riskMoney,0),riskPct=total/capital*100,room=Math.max(0,budget-riskPct),top=[...rows].sort((a,b)=>b.riskMoney-a.riskMoney)[0];$('#pfRiskMoney').textContent=money(total);$('#pfRiskPct').textContent=pct(riskPct);$('#pfRoom').textContent=pct(room);$('#pfTop').textContent=`${top.symbol} · ${money(top.riskMoney)}`;$('#pfCount').textContent=num(rows.length);if(riskPct>budget){verdict($('#pfVerdict'),'VƯỢT NGÂN SÁCH RỦI RO','bad');$('#pfAction').textContent=`Rủi ro tới các mức cắt lỗ là ${pct(riskPct)} tài khoản, vượt giới hạn ${pct(budget)}.`}else if(room<budget*0.2){verdict($('#pfVerdict'),'GẦN HẾT NGÂN SÁCH','warn');$('#pfAction').textContent=`Chỉ còn ${pct(room)} dư địa rủi ro. Vị thế đóng góp lớn nhất là ${top.symbol}.`}else{verdict($('#pfVerdict'),'CÒN DƯ ĐỊA RỦI RO','good');$('#pfAction').textContent=`Danh mục đang dùng ${pct(riskPct)} trên ngân sách ${pct(budget)}.`}saveIfLogged('HOLDING','CALC_PORTFOLIO_RISK',{capital,budget,rows},{total,riskPct,room,top:top.symbol},$('#pfAction').textContent)});

bind('#dividendForm',e=>{e.preventDefault();clearValidation('#dValidation');const qty=n('#dQty'),par=n('#dPar'),divPct=n('#dPct'),taxPct=n('#dTax'),market=n('#dMarket');if(qty<=0||par<=0||divPct<0)return validate('#dValidation','Số cổ phiếu, mệnh giá và tỷ lệ cổ tức phải hợp lệ.');const perShare=par*divPct/100,gross=qty*perShare,tax=gross*taxPct/100,net=gross-tax,yieldPct=market>0?perShare/market*100:0;$('#dPerShare').textContent=money(perShare);$('#dGross').textContent=money(gross);$('#dTaxMoney').textContent=money(tax);$('#dNet').textContent=money(net);$('#dYield').textContent=market>0?pct(yieldPct):'—';verdict($('#dVerdict'),'ĐÃ TÁCH MỆNH GIÁ VÀ GIÁ THỊ TRƯỜNG','good');$('#dAction').textContent=`Cổ tức ${divPct}% trên mệnh giá ${money(par)} tương đương ${money(perShare)}/cổ phiếu.`;saveIfLogged('HOLDING','CALC_CASH_DIVIDEND',{qty,par,divPct,taxPct,market},{perShare,gross,tax,net,yieldPct},$('#dAction').textContent)});

bind('#exrightForm',e=>{e.preventDefault();clearValidation('#xValidation');const price=n('#xPrice'),cash=n('#xCash'),stockPct=n('#xStockPct'),rightsPct=n('#xRightsPct'),subPrice=n('#xSubPrice'),qty=n('#xQty');if(price<=0||qty<=0)return validate('#xValidation','Giá trước quyền và số cổ phiếu phải lớn hơn 0.');if(cash>=price)return validate('#xValidation','Cổ tức tiền mặt/cổ phiếu phải nhỏ hơn giá cổ phiếu. Hãy kiểm tra đơn vị đồng.');const stockR=stockPct/100,rightsR=rightsPct/100,denom=1+stockR+rightsR,exPrice=(price-cash+rightsR*subPrice)/denom,bonusQty=Math.floor(qty*stockR),rightsQty=Math.floor(qty*rightsR),cashTotal=qty*cash,dropPct=(price-exPrice)/price*100;$('#xExPrice').textContent=money(exPrice);$('#xBonusQty').textContent=num(bonusQty);$('#xRightsQty').textContent=num(rightsQty);$('#xCashTotal').textContent=money(cashTotal);$('#xDropPct').textContent=pct(dropPct);verdict($('#xVerdict'),'GIÁ LÝ THUYẾT ĐÃ ĐIỀU CHỈNH','good');$('#xAction').textContent=`Giá lý thuyết sau quyền khoảng ${money(exPrice)}. Đây là điều chỉnh kỹ thuật.`;saveIfLogged('HOLDING','CALC_EX_RIGHTS',{price,cash,stockPct,rightsPct,subPrice,qty},{exPrice,bonusQty,rightsQty,cashTotal,dropPct},$('#xAction').textContent)});

async function saveIfLogged(stage,type,input,output,next){try{const {data}=await supabaseClient.auth.getSession();if(!data.session)return;await supabaseClient.rpc('investor_record_decision_v1',{p_stage:stage,p_type:type,p_input:input,p_output:output,p_next_best_action:next,p_decision_quality:null,p_position_id:null})}catch(e){console.warn('Bỏ qua lưu lịch sử',e)}}
async function initPassport(){try{const {data}=await supabaseClient.auth.getSession();if(!data.session)return;const {data:p,error}=await supabaseClient.rpc('investor_get_or_create_passport_v1');if(error||!p)return;$('#identityStatus').textContent=`Hồ sơ Nhà đầu tư · ${p.display_name||'Đã kết nối'}`;$('#loginBtn').textContent='Mở Hồ sơ Nhà đầu tư';$('#loginBtn').onclick=()=>location.href='investor-profile.html';const c=Number(p.investable_capital||p.total_capital||0);if(c>0)['#posCapital','#avgCapital','#mEquity','#pfCapital'].forEach(id=>{if($(id))$(id).value=c});if(Number(p.portfolio_risk_budget_pct)>0){$('#posPortfolioBudget').value=p.portfolio_risk_budget_pct;$('#pfBudget').value=p.portfolio_risk_budget_pct}if(Number(p.max_position_pct)>0)$('#posMaxPct').value=p.max_position_pct;if(Number(p.margin_limit_pct)>=0)$('#mLimit').value=p.margin_limit_pct}catch(e){console.warn(e)}}
if($('#loginBtn'))$('#loginBtn').onclick=async()=>{const {data}=await supabaseClient.auth.getSession();if(data.session){location.href='investor-profile.html';return}await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href,queryParams:{prompt:'select_account'}}})};
activateFromHash();initPassport();
