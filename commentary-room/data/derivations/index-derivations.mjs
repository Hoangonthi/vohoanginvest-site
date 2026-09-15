import { derivedMetric, unavailable } from '../quality/provenance.mjs';
const TARGETS={delta_1m:[60,45],delta_5m:[300,90],delta_15m:[900,120],delta_30m:[1800,180]};
function indexValue(frame){const p=frame?.payload||{};return p?.market?.vnindex?.value ?? p?.market?.vnindex?.last ?? p?.indexes?.vnindex?.value ?? null;}
export function deriveIndexMoves(current, history) {
  const out={}; const now=indexValue(current);
  for(const [key,[seconds,tol]] of Object.entries(TARGETS)){
    const prev=history.getNearestAtOrBefore(current.timestamp,seconds,tol); const pv=indexValue(prev);
    out[key]=(now!=null&&pv!=null)?derivedMetric(Number(now)-Number(pv),{source_path:`indexes.vnindex.${key}`,as_of:current.timestamp,derived_from:[`frame:${current.source_id}:indexes.vnindex.last`,`frame:${prev.source_id}:indexes.vnindex.last`]}):unavailable(`indexes.vnindex.${key}`,'CALCULATED');
  }
  return out;
}
function vnTime(iso){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(iso));}
export function deriveHighLowTime(current, history, currentHigh, currentLow, sessionDate, historyCompleteFromOpen){
  if(!historyCompleteFromOpen||currentHigh==null||currentLow==null)return{time_of_high:unavailable('indexes.vnindex.time_of_high','CALCULATED'),time_of_low:unavailable('indexes.vnindex.time_of_low','CALCULATED')};
  const frames=history.getSessionFrames(sessionDate).filter(f=>new Date(f.timestamp)<=new Date(current.timestamp));
  let hi=null,lo=null;
  for(const f of frames){const v=indexValue(f);if(v==null)continue;if(hi==null&&Math.abs(Number(v)-Number(currentHigh))<1e-6)hi=f;if(lo==null&&Math.abs(Number(v)-Number(currentLow))<1e-6)lo=f;}
  return{
    time_of_high:hi?derivedMetric(vnTime(hi.timestamp),{source_path:'indexes.vnindex.time_of_high',as_of:current.timestamp,derived_from:[`frame:${hi.source_id}`]}):unavailable('indexes.vnindex.time_of_high','CALCULATED'),
    time_of_low:lo?derivedMetric(vnTime(lo.timestamp),{source_path:'indexes.vnindex.time_of_low',as_of:current.timestamp,derived_from:[`frame:${lo.source_id}`]}):unavailable('indexes.vnindex.time_of_low','CALCULATED')
  };
}
