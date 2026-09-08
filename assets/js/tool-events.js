import { supabaseClient, getLeadSource } from './supabase-client.js';
const KEY='vh_tool_session_v1';
export function toolSession(){let id=localStorage.getItem(KEY);if(!id){id=(crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-]/g,'').slice(0,64);localStorage.setItem(KEY,id)}return id}
export async function trackTool(toolCode,eventType,{resultCode=null,score=null,metadata={}}={}){
  try{
    await supabaseClient.rpc('track_engagement_event_v1',{
      p_session_id:toolSession(),p_tool_code:toolCode,p_event_type:eventType,p_result_code:resultCode,p_score:score,p_source:getLeadSource('TOOL_GAME'),p_metadata:metadata||{}
    });
  }catch(e){console.warn('trackTool failed',e)}
}
export function smartBack(){if(document.referrer&&document.referrer.includes(location.host))history.back();else location.href='cong-cu-tro-choi.html'}