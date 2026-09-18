// Morning page source router v2.
// The canonical morning stack is now:
// market-feed -> morning-decision-test -> morning-snapshot-public.
// Do not rewrite these requests to the older local-primary snapshot path;
// market-feed already carries the current local/watchlist market relay and richer market context.
window.__VH_MORNING_SOURCE__={
  market:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed',
  decision:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-decision-test',
  snapshot:'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/morning-snapshot-public',
  mode:'CANONICAL_MARKET_FEED_PLUS_VERIFIED_EVENTS'
};
