import {
  calcStopTargetRR,
  calcDeploymentPlan,
  calcMarginThresholds,
  calcActualLeverage,
  calcLosingStreak,
  calcPortfolioConcentration,
  calcDividendYield,
  calcCostBasisAfterRights
} from '../assets/js/investor-calculator-math.js';

const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
const assert=(cond,msg='Assertion failed')=>{if(!cond)throw new Error(msg);};
const approx=(actual,expected,tol=1e-9)=>{
  if(Math.abs(actual-expected)>tol*Math.max(1,Math.abs(expected))){
    throw new Error('Expected '+expected+', got '+actual);
  }
};

test('Stop/Target normal',()=>{
  const r=calcStopTargetRR({entry:100,stop:90,target:120,qty:100});
  assert(r.ok);approx(r.riskPct,10);approx(r.rewardPct,20);approx(r.totalRisk,1000);approx(r.totalReward,2000);approx(r.ratio,2);
});
test('Stop/Target boundary valid',()=>{
  const r=calcStopTargetRR({entry:100,stop:99,target:101,qty:1});
  assert(r.ok);approx(r.ratio,1);
});
test('Stop/Target invalid ordering',()=>assert(!calcStopTargetRR({entry:100,stop:100,target:120,qty:10}).ok));
test('Stop/Target manual 75/71/85',()=>{
  const r=calcStopTargetRR({entry:75000,stop:71000,target:85000,qty:1000});
  assert(r.ok);approx(r.totalRisk,4000000);approx(r.totalReward,10000000);approx(r.ratio,2.5);
});

test('Deployment quantity mode',()=>{
  const r=calcDeploymentPlan({buyFeePct:0,lot:1,legs:[{price:10,qty:100},{price:20,qty:200}]});
  assert(r.ok);approx(r.totalQty,300);approx(r.totalCapital,5000);approx(r.averageCost,5000/300);
});
test('Deployment amount mode respects lot',()=>{
  const r=calcDeploymentPlan({buyFeePct:0,lot:100,legs:[{price:10,amount:1050}]});
  assert(r.ok);approx(r.totalQty,100);approx(r.totalCapital,1000);
});
test('Deployment fee in cost basis',()=>{
  const r=calcDeploymentPlan({buyFeePct:1,lot:100,legs:[{price:10,qty:100}]});
  assert(r.ok);approx(r.totalFee,10);approx(r.averageCost,10.1);
});
test('Deployment rejects both qty and amount',()=>assert(!calcDeploymentPlan({buyFeePct:0,lot:1,legs:[{price:10,qty:100,amount:1000}]}).ok));
test('Deployment rejects quantity off lot',()=>assert(!calcDeploymentPlan({buyFeePct:0,lot:100,legs:[{price:10,qty:150}]}).ok));
test('Deployment rejects amount below one lot',()=>assert(!calcDeploymentPlan({buyFeePct:0,lot:100,legs:[{price:100,amount:9000}]}).ok));

test('Margin thresholds normal',()=>{
  const r=calcMarginThresholds({debt:200,marketValue:500,qty:10,callPct:30,forcePct:25});
  assert(r.ok);approx(r.currentRatioPct,60);approx(r.marginCall.value,200/0.7);approx(r.marginCall.price,20/0.7);approx(r.forceSell.value,200/0.75);
});
test('Margin thresholds zero debt',()=>{
  const r=calcMarginThresholds({debt:0,marketValue:500,qty:10,callPct:30,forcePct:25});
  assert(r.ok);approx(r.currentRatioPct,100);approx(r.marginCall.value,0);
});
test('Margin thresholds ordering remains configurable',()=>assert(calcMarginThresholds({debt:200,marketValue:500,qty:10,callPct:25,forcePct:30}).ok));
test('Margin thresholds already breached',()=>{
  const r=calcMarginThresholds({debt:400,marketValue:500,qty:10,callPct:30,forcePct:25});
  assert(r.ok);assert(r.alreadyBelowCall);assert(r.alreadyBelowForce);
});
test('Margin threshold manual price',()=>{
  const r=calcMarginThresholds({debt:210000000,marketValue:500000000,qty:10000,callPct:30,forcePct:20});
  assert(r.ok);approx(r.marginCall.price,30000);
});

test('Leverage normal',()=>{
  const r=calcActualLeverage({exposure:600,cash:100,debt:200});
  assert(r.ok);approx(r.totalAssets,700);approx(r.nav,500);approx(r.leverage,1.2);approx(r.debtToNav,0.4);
  const s=r.scenarios.find(x=>x.changePct===-10);approx(s.newNav,440);approx(s.navChangePct,-12);
});
test('Leverage cash-only boundary',()=>{
  const r=calcActualLeverage({exposure:0,cash:100,debt:0});
  assert(r.ok);approx(r.leverage,0);for(const s of r.scenarios)approx(s.newNav,100);
});
test('Leverage invalid nonpositive NAV',()=>assert(!calcActualLeverage({exposure:100,cash:0,debt:100}).ok));
test('Leverage manual +10%',()=>{
  const r=calcActualLeverage({exposure:600,cash:100,debt:200});
  const s=r.scenarios.find(x=>x.changePct===10);approx(s.newNav,560);approx(s.navChangePct,12);
});

test('Losing streak normal',()=>{
  const r=calcLosingStreak({capital:500000000,riskPct:1,milestones:[3]});
  assert(r.ok);approx(r.rows[0].remaining,500000000*Math.pow(.99,3));
});
test('Losing streak high but valid risk',()=>{
  const r=calcLosingStreak({capital:100,riskPct:50,milestones:[1,2]});
  assert(r.ok);approx(r.rows[1].remaining,25);approx(r.rows[1].drawdownPct,75);
});
test('Losing streak rejects 100%',()=>assert(!calcLosingStreak({capital:100,riskPct:100,milestones:[3]}).ok));
test('Losing streak manual 10% two losses',()=>{
  const r=calcLosingStreak({capital:100,riskPct:10,milestones:[2]});
  assert(r.ok);approx(r.rows[0].remaining,81);approx(r.rows[0].drawdownPct,19);
});

test('Concentration normal',()=>{
  const r=calcPortfolioConcentration({positions:[
    {symbol:'A',value:60,sector:'X'},{symbol:'B',value:30,sector:'X'},{symbol:'C',value:10,sector:'Y'}
  ]});
  assert(r.ok);approx(r.top1,.6);approx(r.top3,1);approx(r.hhi,.46);approx(r.effectivePositions,1/.46);approx(r.sectors[0].weight,.9);
});
test('Concentration single position',()=>{
  const r=calcPortfolioConcentration({positions:[{symbol:'A',value:100,sector:'X'}]});
  assert(r.ok);approx(r.hhi,1);approx(r.effectivePositions,1);
});
test('Concentration rejects duplicate symbol',()=>assert(!calcPortfolioConcentration({positions:[{symbol:'A',value:50},{symbol:'A',value:50}]}).ok));
test('Concentration rejects missing symbol with value',()=>assert(!calcPortfolioConcentration({positions:[{symbol:'',value:50}]}).ok));
test('Concentration manual equal four',()=>{
  const r=calcPortfolioConcentration({positions:[
    {symbol:'A',value:25},{symbol:'B',value:25},{symbol:'C',value:25},{symbol:'D',value:25}
  ]});
  assert(r.ok);approx(r.hhi,.25);approx(r.effectivePositions,4);
});

test('Dividend yield normal',()=>{
  const r=calcDividendYield({marketPrice:50000,parValue:10000,dividendPct:20});
  assert(r.ok);approx(r.dividendPerShare,2000);approx(r.yieldPct,4);
});
test('Dividend yield zero dividend',()=>{
  const r=calcDividendYield({marketPrice:50000,parValue:10000,dividendPct:0});
  assert(r.ok);approx(r.yieldPct,0);
});
test('Dividend yield invalid market price',()=>assert(!calcDividendYield({marketPrice:0,parValue:10000,dividendPct:20}).ok));
test('Dividend yield manual 15% on 25k',()=>{
  const r=calcDividendYield({marketPrice:25000,parValue:10000,dividendPct:15});
  assert(r.ok);approx(r.dividendPerShare,1500);approx(r.yieldPct,6);
});

test('Cost basis bonus only',()=>{
  const r=calcCostBasisAfterRights({oldQty:1000,oldAvgCost:40000,bonusPct:20,ratioOld:0,ratioNew:0,subPrice:0,actualSubQty:0,relatedFee:0,fractionRule:'FLOOR'});
  assert(r.ok);approx(r.bonusQty,200);approx(r.totalQty,1200);approx(r.newAvgCost,40000000/1200);
});
test('Cost basis rights 5:1',()=>{
  const r=calcCostBasisAfterRights({oldQty:1000,oldAvgCost:40000,bonusPct:0,ratioOld:5,ratioNew:1,subPrice:10000,actualSubQty:200,relatedFee:0,fractionRule:'FLOOR'});
  assert(r.ok);approx(r.entitledSubQty,200);approx(r.newCostBasis,42000000);approx(r.totalQty,1200);approx(r.newAvgCost,35000);
});
test('Cost basis combined manual',()=>{
  const r=calcCostBasisAfterRights({oldQty:2000,oldAvgCost:40000,bonusPct:20,ratioOld:5,ratioNew:1,subPrice:10000,actualSubQty:400,relatedFee:0,fractionRule:'FLOOR'});
  assert(r.ok);approx(r.bonusQty,400);approx(r.entitledSubQty,400);approx(r.newCostBasis,84000000);approx(r.totalQty,2800);approx(r.newAvgCost,30000);
});
test('Cost basis fraction floor',()=>{
  const r=calcCostBasisAfterRights({oldQty:1001,oldAvgCost:10000,bonusPct:0,ratioOld:10,ratioNew:3,subPrice:0,actualSubQty:0,relatedFee:0,fractionRule:'FLOOR'});
  assert(r.ok);approx(r.entitledSubQty,300);
});
test('Cost basis fraction keep decimal',()=>{
  const r=calcCostBasisAfterRights({oldQty:1001,oldAvgCost:10000,bonusPct:0,ratioOld:10,ratioNew:3,subPrice:0,actualSubQty:0,relatedFee:0,fractionRule:'KEEP_DECIMAL'});
  assert(r.ok);approx(r.entitledSubQty,300.3);
});
test('Cost basis rejects over-exercise',()=>assert(!calcCostBasisAfterRights({oldQty:1000,oldAvgCost:10000,bonusPct:0,ratioOld:5,ratioNew:1,subPrice:10000,actualSubQty:201,relatedFee:0,fractionRule:'FLOOR'}).ok));
test('Cost basis rejects incomplete ratio',()=>assert(!calcCostBasisAfterRights({oldQty:1000,oldAvgCost:10000,bonusPct:0,ratioOld:5,ratioNew:0,subPrice:0,actualSubQty:0,relatedFee:0,fractionRule:'FLOOR'}).ok));
test('Cost basis includes related fee',()=>{
  const r=calcCostBasisAfterRights({oldQty:1000,oldAvgCost:10000,bonusPct:0,ratioOld:5,ratioNew:1,subPrice:5000,actualSubQty:200,relatedFee:100000,fractionRule:'FLOOR'});
  assert(r.ok);approx(r.newCostBasis,11100000);approx(r.newAvgCost,9250);
});

let passed=0;
for(const [name,fn] of tests){
  try{fn();passed++;}
  catch(error){console.error('FAIL:',name,'-',error.message);process.exitCode=1;}
}
console.log('Investor calculator math tests:',passed+'/'+tests.length,'passed');
