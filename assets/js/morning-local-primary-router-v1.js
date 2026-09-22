// Morning page source router v3.
// Realtime market truth must come from the canonical façade.
// market-feed is legacy and may be stale after local-primary cutover.
const VH_CANONICAL_MARKET_ENDPOINT='https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-context-public-v1';
window.VH_MARKET_ENDPOINT=VH_CANONICAL_MARKET_ENDPOINT;
window.__VH_MORNING_SOURCE__={
  market:VH_CANONICAL_MARKET_ENDPOINT,
  decision:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test',
  snapshot:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-snapshot-public',
  mode:'CANONICAL_LOCAL_PRIMARY_REALTIME_PLUS_VERIFIED_EVENTS'
};
