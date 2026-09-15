export const FRESHNESS_POLICIES = Object.freeze({
  MARKET_REALTIME: { fresh: 60, aging: 90, stale: 180 },
  MARKET_LIVE_SNAPSHOT: { fresh: 60, aging: 90, stale: 180 },
  AMI_AFL: { fresh: 60, aging: 120, stale: 300 },
  AMI_WATCHLIST: { fresh: 60, aging: 120, stale: 300 },
  AMI_LOCAL_STOCK: { fresh: 60, aging: 120, stale: 300 },
  DERIVATIVES_LOCAL: { fresh: 10, aging: 30, stale: 120 },
  CONTEXT: { fresh: 3600, aging: 21600, stale: 86400 },
  CALCULATED: { fresh: 60, aging: 120, stale: 300 }
});

export function classifyFreshness({ family='MARKET_LIVE_SNAPSHOT', asOf, sourceTimestamp, marketStatus='OPEN', available=true }) {
  if (!available) return { status:'INVALID', age_seconds:null };
  if (marketStatus === 'CLOSED' && family !== 'CONTEXT') return { status:'CLOSED_SNAPSHOT', age_seconds: sourceTimestamp ? Math.max(0,(new Date(asOf)-new Date(sourceTimestamp))/1000) : null };
  if (marketStatus === 'LUNCH' && family === 'DERIVATIVES_LOCAL') return { status:'CLOSED_SNAPSHOT', age_seconds: sourceTimestamp ? Math.max(0,(new Date(asOf)-new Date(sourceTimestamp))/1000) : null };
  if (!sourceTimestamp) return { status:'INVALID', age_seconds:null };
  const a=new Date(asOf).getTime(), s=new Date(sourceTimestamp).getTime();
  if(Number.isNaN(a)||Number.isNaN(s)||s>a+5000)return {status:'INVALID',age_seconds:null};
  const age=Math.max(0,(a-s)/1000), p=FRESHNESS_POLICIES[family]||FRESHNESS_POLICIES.MARKET_LIVE_SNAPSHOT;
  return {status:age<=p.fresh?'FRESH':age<=p.aging?'AGING':age<=p.stale?'STALE':'INVALID',age_seconds:Math.round(age*1000)/1000};
}
