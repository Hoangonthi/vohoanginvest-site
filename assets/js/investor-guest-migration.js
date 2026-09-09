import { getSession, localGet, supabaseClient, trackTool } from './investor-hub-shared.js';

const AFTER_KEY='vh_after_session_guest_v1';
const WATCH_KEY='vh_watchlist_guest_v1';
const GUARD='vh_guest_migration_reload_v1';

async function migrateAfterSession(){
  const rows=localGet(AFTER_KEY,[]);
  if(!Array.isArray(rows)||!rows.length)return 0;
  let moved=0;
  for(const row of rows.slice().reverse()){
    const c=row?.checkin||row||{};
    const payload={
      market_date:c.market_date||null,
      account_value:c.account_value??null,
      account_return_pct:c.account_return_pct??null,
      cash_pct:c.cash_pct??null,
      margin_pct:c.margin_pct??null,
      mood:c.mood??null,
      primary_worry:c.primary_worry??null,
      followed_plan:c.followed_plan??null,
      behavior_flags:c.behavior_flags||{},
      note:c.note??null,
      items:Array.isArray(row?.items)?row.items:Array.isArray(c.items)?c.items:[]
    };
    const {error}=await supabaseClient.rpc('investor_save_daily_checkin_v1',{p_payload:payload});
    if(error)throw error;
    moved++;
  }
  localStorage.removeItem(AFTER_KEY);
  return moved;
}

async function migrateWatchlist(){
  const rows=localGet(WATCH_KEY,[]);
  if(!Array.isArray(rows)||!rows.length)return 0;
  let moved=0;
  for(const row of rows){
    const payload={symbol:row.symbol,sector:row.sector??null,thesis:row.thesis??null,trigger_price:row.trigger_price??null,invalidation_price:row.invalidation_price??null,note:row.note??null};
    const {error}=await supabaseClient.rpc('investor_upsert_watchlist_v1',{p_payload:payload});
    if(error)throw error;
    moved++;
  }
  localStorage.removeItem(WATCH_KEY);
  return moved;
}

async function migrate(){
  const session=await getSession();
  if(!session)return;
  if(sessionStorage.getItem(GUARD)==='1'){sessionStorage.removeItem(GUARD);return}
  try{
    const [after,watch]=await Promise.all([migrateAfterSession(),migrateWatchlist()]);
    if(after||watch){
      trackTool('INVESTOR_RETENTION','GUEST_MIGRATED',{resultCode:'SUCCESS',metadata:{after_session:after,watchlist:watch}});
      sessionStorage.setItem(GUARD,'1');
      location.reload();
    }
  }catch(error){
    console.warn('Guest migration skipped',error);
    trackTool('INVESTOR_RETENTION','GUEST_MIGRATION_ERROR',{resultCode:'ERROR',metadata:{error:String(error?.message||error).slice(0,120)}});
  }
}

migrate();
