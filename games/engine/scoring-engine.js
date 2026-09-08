export function scoreGame({ decisions = [], finalState = {}, context = {} } = {}) {
  const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));
  let timing=60,risk=70,allocation=70,money=70,discipline=70,system=65,stockPicking=60;
  const marginDecisions=decisions.filter(d=>d.useMargin);
  const lateFomo=decisions.filter(d=>d.action==='BUY' && d.gameTime>=context.fomoWindowStart);
  const stopSet=decisions.some(d=>d.action==='SET_STOP');
  const stopIgnored=decisions.filter(d=>d.ruleBreak==='STOP_IGNORED').length;
  const concentration=Math.max(0,(finalState.maxExposurePct||0)-100);
  risk -= (finalState.maxDrawdownPct||0)*0.9 + (finalState.maxMarginUsagePct||0)*0.35 + stopIgnored*18;
  allocation -= concentration*0.4;
  money -= Math.max(0,(finalState.maxMarginUsagePct||0)-25)*0.6;
  discipline += stopSet?8:-8;
  discipline -= stopIgnored*20 + (finalState.ruleBreaks||0)*10;
  timing -= lateFomo.length*8;
  if ((finalState.returnPct||0)>0 && (finalState.maxDrawdownPct||0)<15) system += 8;
  if (marginDecisions.length && (finalState.maxDrawdownPct||0)>20) system -= 12;
  return {
    stock_picking:clamp(stockPicking), timing:clamp(timing), risk:clamp(risk), allocation:clamp(allocation), money:clamp(money), discipline:clamp(discipline), system:clamp(system),
    decision_quality:clamp((timing+risk+allocation+money+discipline+system+stockPicking)/7),
    outcome_quality:clamp(50+(finalState.returnPct||0)*1.5-(finalState.maxDrawdownPct||0)*0.8)
  };
}
