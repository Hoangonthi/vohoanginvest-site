const EPS=1e-12;

function finiteNumber(value,name){
  const n=Number(value);
  if(!Number.isFinite(n))throw new Error(name+' phải là số hợp lệ.');
  return n;
}
function positive(value,name,allowZero=false){
  const n=finiteNumber(value,name);
  if(allowZero?n<0:n<=0)throw new Error(name+(allowZero?' không được âm.':' phải lớn hơn 0.'));
  return n;
}
function percent(value,name,{allowZero=true,max=100}={}){
  const n=finiteNumber(value,name);
  if(n<0||(!allowZero&&n<=0)||n>max)throw new Error(name+' không hợp lệ.');
  return n;
}
function integer(value,name,{allowZero=false}={}){
  const n=finiteNumber(value,name);
  if(!Number.isInteger(n)||(allowZero?n<0:n<=0))throw new Error(name+' phải là số nguyên '+(allowZero?'không âm.':'dương.'));
  return n;
}
function safeDivide(a,b,message){
  if(Math.abs(b)<=EPS)throw new Error(message);
  return a/b;
}
function result(fn){
  try{return {ok:true,...fn()};}
  catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)};}
}

export function calcStopTargetRR(input={}){
  return result(()=>{
    const entry=positive(input.entry,'Giá mua');
    const stop=positive(input.stop,'Giá cắt lỗ');
    const target=positive(input.target,'Giá mục tiêu');
    const qty=integer(input.qty,'Số lượng');
    if(!(stop<entry&&entry<target))throw new Error('Với vị thế mua cổ phiếu cơ sở, cần Stop < Giá mua < Target.');
    const riskPerShare=entry-stop;
    const rewardPerShare=target-entry;
    const riskPct=safeDivide(riskPerShare,entry,'Giá mua không hợp lệ.')*100;
    const rewardPct=safeDivide(rewardPerShare,entry,'Giá mua không hợp lệ.')*100;
    const totalRisk=riskPerShare*qty;
    const totalReward=rewardPerShare*qty;
    const ratio=safeDivide(rewardPerShare,riskPerShare,'Khoảng cắt lỗ phải lớn hơn 0.');
    return {entry,stop,target,qty,riskPerShare,rewardPerShare,riskPct,rewardPct,totalRisk,totalReward,ratio};
  });
}

export function calcDeploymentPlan(input={}){
  return result(()=>{
    const buyFeePct=percent(input.buyFeePct??0,'Phí mua',{allowZero:true,max:20});
    const feeRate=buyFeePct/100;
    const lot=integer(input.lot??1,'Lô giao dịch');
    const rawLegs=Array.isArray(input.legs)?input.legs:[];
    if(!rawLegs.length)throw new Error('Cần ít nhất một nhịp giải ngân.');
    if(rawLegs.length>8)throw new Error('Tối đa 8 nhịp giải ngân.');

    const legs=[];
    for(let i=0;i<rawLegs.length;i++){
      const raw=rawLegs[i]||{};
      const price=positive(raw.price,'Giá nhịp '+(i+1));
      const hasQty=raw.qty!==''&&raw.qty!==null&&raw.qty!==undefined&&Number(raw.qty)>0;
      const hasAmount=raw.amount!==''&&raw.amount!==null&&raw.amount!==undefined&&Number(raw.amount)>0;
      if(hasQty===hasAmount)throw new Error('Nhịp '+(i+1)+': chỉ nhập một trong hai trường Số lượng hoặc Số tiền.');
      let qty;
      let budget=null;
      if(hasQty){
        qty=integer(raw.qty,'Số lượng nhịp '+(i+1));
        if(qty%lot!==0)throw new Error('Nhịp '+(i+1)+': số lượng phải chia hết cho lô giao dịch đã chọn.');
      }else{
        budget=positive(raw.amount,'Số tiền nhịp '+(i+1));
        const unitCost=price*(1+feeRate);
        qty=Math.floor((budget/unitCost)/lot)*lot;
        if(qty<=0)throw new Error('Nhịp '+(i+1)+': số tiền chưa đủ mua một lô sau phí.');
      }
      const gross=price*qty;
      const fee=gross*feeRate;
      const cost=gross+fee;
      legs.push({price,qty,budget,gross,fee,cost});
    }
    const totalQty=legs.reduce((s,x)=>s+x.qty,0);
    const grossValue=legs.reduce((s,x)=>s+x.gross,0);
    const totalFee=legs.reduce((s,x)=>s+x.fee,0);
    const totalCapital=legs.reduce((s,x)=>s+x.cost,0);
    const averageCost=safeDivide(totalCapital,totalQty,'Tổng số cổ phiếu phải lớn hơn 0.');
    return {buyFeePct,lot,legs,totalQty,grossValue,totalFee,totalCapital,averageCost};
  });
}

export function calcMarginThresholds(input={}){
  return result(()=>{
    const debt=positive(input.debt,'Dư nợ',true);
    const marketValue=positive(input.marketValue,'Giá trị thị trường tài sản');
    const qty=input.qty===undefined||input.qty===null||input.qty===''?0:integer(input.qty,'Số cổ phiếu',{allowZero:true});
    const callPct=percent(input.callPct,'Ngưỡng Margin Call',{allowZero:false,max:99.999});
    const forcePct=percent(input.forcePct,'Ngưỡng Force Sell',{allowZero:false,max:99.999});
    const currentRatio=(marketValue-debt)/marketValue;
    const threshold=(pct)=>{
      const r=pct/100;
      const value=safeDivide(debt,1-r,'Ngưỡng tỷ lệ phải nhỏ hơn 100%.');
      return {pct,value,price:qty>0?value/qty:null};
    };
    const marginCall=threshold(callPct);
    const forceSell=threshold(forcePct);
    return {debt,marketValue,qty,currentRatioPct:currentRatio*100,marginCall,forceSell,alreadyBelowCall:currentRatio*100<=callPct,alreadyBelowForce:currentRatio*100<=forcePct};
  });
}

export function calcActualLeverage(input={}){
  return result(()=>{
    const exposure=positive(input.exposure,'Giá trị danh mục chịu biến động',true);
    const cash=positive(input.cash,'Tiền mặt/tài sản không biến động',true);
    const debt=positive(input.debt,'Dư nợ',true);
    const totalAssets=exposure+cash;
    if(totalAssets<=0)throw new Error('Tổng tài sản phải lớn hơn 0.');
    const nav=totalAssets-debt;
    if(nav<=0)throw new Error('NAV phải lớn hơn 0 sau khi trừ dư nợ.');
    const leverage=exposure/nav;
    const debtToNav=debt/nav;
    const changes=Array.isArray(input.scenarios)&&input.scenarios.length?input.scenarios:[-10,-5,-3,3,5,10];
    const scenarios=changes.map(changePct=>{
      const change=finiteNumber(changePct,'Kịch bản biến động')/100;
      const newExposure=exposure*(1+change);
      const newAssets=newExposure+cash;
      const newNav=newAssets-debt;
      return {changePct:Number(changePct),newExposure,newAssets,newNav,navChange:newNav-nav,navChangePct:(newNav/nav-1)*100};
    });
    return {exposure,cash,debt,totalAssets,nav,leverage,debtToNav,scenarios};
  });
}

export function calcLosingStreak(input={}){
  return result(()=>{
    const capital=positive(input.capital,'Vốn ban đầu');
    const riskPct=percent(input.riskPct,'Rủi ro mỗi lệnh',{allowZero:false,max:99.999});
    const milestones=Array.isArray(input.milestones)&&input.milestones.length?input.milestones:[3,5,7,10,15,20];
    const r=riskPct/100;
    const rows=milestones.map(n=>{
      const losses=integer(n,'Số lệnh thua');
      const remaining=capital*Math.pow(1-r,losses);
      const drawdownPct=(1-remaining/capital)*100;
      const lossMoney=capital-remaining;
      return {losses,remaining,drawdownPct,lossMoney};
    });
    return {capital,riskPct,rows};
  });
}

export function calcPortfolioConcentration(input={}){
  return result(()=>{
    const rawPositions=Array.isArray(input.positions)?input.positions:[];
    const positions=[];
    for(let i=0;i<rawPositions.length;i++){
      const x=rawPositions[i]||{};
      const symbol=String(x.symbol||'').trim().toUpperCase();
      const rawValue=Number(x.value||0);
      if(!symbol&&rawValue<=0)continue;
      if(!symbol)throw new Error('Vị thế '+(i+1)+': cần nhập mã.');
      const value=positive(x.value,'Giá trị vị thế '+(i+1));
      positions.push({
        symbol,
        sector:String(x.sector||'Chưa phân nhóm').trim()||'Chưa phân nhóm',
        value
      });
    }
    if(!positions.length)throw new Error('Nhập ít nhất một vị thế có mã và giá trị lớn hơn 0.');
    if(positions.length>12)throw new Error('Tối đa 12 vị thế.');
    const seenSymbols=new Set();
    for(const p of positions){
      if(seenSymbols.has(p.symbol))throw new Error('Mã '+p.symbol+' đang bị nhập lặp. Hãy gộp về một giá trị vị thế.');
      seenSymbols.add(p.symbol);
    }
    const total=positions.reduce((s,x)=>s+x.value,0);
    const weighted=positions.map(x=>({...x,weight:x.value/total}));
    const sorted=[...weighted].sort((a,b)=>b.weight-a.weight);
    const top1=sorted[0].weight;
    const top3=sorted.slice(0,3).reduce((s,x)=>s+x.weight,0);
    const hhi=weighted.reduce((s,x)=>s+x.weight*x.weight,0);
    const effectivePositions=safeDivide(1,hhi,'HHI không hợp lệ.');
    const sectorMap=new Map();
    for(const x of weighted)sectorMap.set(x.sector,(sectorMap.get(x.sector)||0)+x.value);
    const sectors=[...sectorMap.entries()].map(([sector,value])=>({sector,value,weight:value/total})).sort((a,b)=>b.weight-a.weight);
    return {positions:weighted,total,top1,top3,hhi,effectivePositions,sectors};
  });
}

export function calcDividendYield(input={}){
  return result(()=>{
    const marketPrice=positive(input.marketPrice,'Giá thị trường');
    const parValue=positive(input.parValue,'Mệnh giá');
    const dividendPct=percent(input.dividendPct,'Tỷ lệ cổ tức trên mệnh giá',{allowZero:true,max:1000});
    const dividendPerShare=parValue*dividendPct/100;
    const yieldPct=dividendPerShare/marketPrice*100;
    return {marketPrice,parValue,dividendPct,dividendPerShare,yieldPct};
  });
}

function applyFraction(value,rule){
  if(rule==='KEEP_DECIMAL')return value;
  if(rule==='FLOOR')return Math.floor(value+EPS);
  throw new Error('Quy tắc cổ phiếu lẻ không hợp lệ.');
}

export function calcCostBasisAfterRights(input={}){
  return result(()=>{
    const oldQty=positive(input.oldQty,'Số cổ phiếu đang có');
    const oldAvgCost=positive(input.oldAvgCost,'Giá vốn hiện tại');
    const bonusPct=percent(input.bonusPct??0,'Tỷ lệ cổ phiếu nhận thêm',{allowZero:true,max:1000});
    const ratioOld=input.ratioOld===undefined||input.ratioOld===null||input.ratioOld===''?0:positive(input.ratioOld,'Tỷ lệ quyền - số cổ phiếu cũ',true);
    const ratioNew=input.ratioNew===undefined||input.ratioNew===null||input.ratioNew===''?0:positive(input.ratioNew,'Tỷ lệ quyền - số cổ phiếu mới',true);
    const subPrice=input.subPrice===undefined||input.subPrice===null||input.subPrice===''?0:positive(input.subPrice,'Giá mua theo quyền',true);
    const actualSubQty=input.actualSubQty===undefined||input.actualSubQty===null||input.actualSubQty===''?0:positive(input.actualSubQty,'Số cổ phiếu thực mua theo quyền',true);
    const relatedFee=input.relatedFee===undefined||input.relatedFee===null||input.relatedFee===''?0:positive(input.relatedFee,'Phí liên quan',true);
    const fractionRule=input.fractionRule||'FLOOR';

    const oldCostBasis=oldQty*oldAvgCost;
    const rawBonusQty=oldQty*bonusPct/100;
    const bonusQty=applyFraction(rawBonusQty,fractionRule);

    let entitledSubQty=0;
    if(ratioOld>0||ratioNew>0){
      if(ratioOld<=0||ratioNew<=0)throw new Error('Tỷ lệ quyền mua phải nhập đầy đủ cả hai vế dương, ví dụ 5:1 hoặc 10:3.');
      entitledSubQty=applyFraction(oldQty*ratioNew/ratioOld,fractionRule);
    }
    if(fractionRule==='FLOOR'&&!Number.isInteger(actualSubQty))throw new Error('Với quy tắc làm tròn xuống, số cổ phiếu thực mua theo quyền phải là số nguyên.');
    if(actualSubQty>entitledSubQty+EPS)throw new Error('Số cổ phiếu thực mua theo quyền vượt số lượng được quyền mua theo tỷ lệ đã nhập.');
    if(actualSubQty>0&&subPrice<=0)throw new Error('Cần nhập giá mua theo quyền khi có mua thêm cổ phiếu.');

    const subscriptionCost=actualSubQty*subPrice;
    const newCostBasis=oldCostBasis+subscriptionCost+relatedFee;
    const totalQty=oldQty+bonusQty+actualSubQty;
    const newAvgCost=safeDivide(newCostBasis,totalQty,'Tổng số cổ phiếu sau quyền phải lớn hơn 0.');
    return {oldQty,oldAvgCost,oldCostBasis,bonusPct,rawBonusQty,bonusQty,ratioOld,ratioNew,entitledSubQty,actualSubQty,subPrice,subscriptionCost,relatedFee,totalQty,newCostBasis,newAvgCost,fractionRule};
  });
}
