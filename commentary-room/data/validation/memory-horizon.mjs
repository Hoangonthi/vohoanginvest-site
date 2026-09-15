export const HORIZON_RULES = Object.freeze({
  m5: { target:300, min:210, max:450 },
  m15:{ target:900, min:660, max:1140 },
  m30:{ target:1800,min:1440,max:2160 }
});
export function validateMemoryHorizon(currentTimestamp, memoryPoint, horizon) {
  const rule=HORIZON_RULES[horizon]; if(!rule)throw new TypeError(`Unknown horizon ${horizon}`);
  if(!memoryPoint?.captured_at)return {status:'MISSING',valid:false,gap_seconds:null,reason:'NO_TIMESTAMP'};
  const c=new Date(currentTimestamp).getTime(), p=new Date(memoryPoint.captured_at).getTime();
  if(Number.isNaN(c)||Number.isNaN(p))return {status:'INVALID_HORIZON',valid:false,gap_seconds:null,reason:'INVALID_TIMESTAMP'};
  const gap=(c-p)/1000;
  if(gap<rule.min||gap>rule.max)return {status:'INVALID_HORIZON',valid:false,gap_seconds:gap,reason:gap<=5?'SAME_AS_CURRENT_OR_TOO_CLOSE':'OUTSIDE_TOLERANCE'};
  return {status:'VALID',valid:true,gap_seconds:gap,reason:null};
}
export function validateLegacyMemory(currentTimestamp, memory={}) { return Object.fromEntries(['m5','m15','m30'].map(k=>[k,validateMemoryHorizon(currentTimestamp,memory?.[k],k)])); }
