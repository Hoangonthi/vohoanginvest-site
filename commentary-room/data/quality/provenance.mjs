const QUALITY = new Set(['EXACT','DERIVED_EXACT','APPROXIMATE','UNAVAILABLE']);
const FRESH = new Set(['FRESH','AGING','STALE','INVALID','CLOSED_SNAPSHOT']);
function isoOrNull(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();}
export function makeProvenance({source='UNKNOWN',source_path=null,source_timestamp=null,received_at=null,freshness_seconds=null,freshness_status='INVALID',quality='UNAVAILABLE',derived_from=[]}={}){
  if(!QUALITY.has(quality))throw new TypeError(`Invalid quality ${quality}`);if(!FRESH.has(freshness_status))throw new TypeError(`Invalid freshness ${freshness_status}`);
  return {source,source_path,source_timestamp:isoOrNull(source_timestamp),received_at:isoOrNull(received_at),freshness_seconds:freshness_seconds==null?null:Number(freshness_seconds),freshness_status,quality,derived_from:[...derived_from]};
}
export function metric(value, provenance){return {value:value==null?null:value,provenance:makeProvenance(provenance)};}
export function unavailable(source_path=null,source='UNKNOWN'){return metric(null,{source,source_path,freshness_status:'INVALID',quality:'UNAVAILABLE'});}
export function derivedMetric(value,{source_path,as_of,received_at=as_of,freshness_status='FRESH',freshness_seconds=0,derived_from=[]}){return metric(value,{source:'CALCULATED',source_path,source_timestamp:as_of,received_at,freshness_seconds,freshness_status,quality:'DERIVED_EXACT',derived_from});}
