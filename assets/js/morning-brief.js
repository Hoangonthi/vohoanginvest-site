import './morning-local-primary-router-v1.js?v=20260918-sourcefix1';
import './morning-decision-preboot-v1.js?v=20260918-brain10';
import './morning-brief-core.js?v=20260917-fed2';
import './morning-decision-dashboard-v5.js?v=20260918-brain11';
import './morning-decision-dashboard-v5-anchor.js?v=20260917-fed2';
import './morning-advisor-engine-v1.js?v=20260917-fed2';
import './morning-verdict-board-v2.js?v=20260918-brain6';
import './morning-macro-action-engine-v2.js?v=20260918-brain7';
import './morning-readable-type-v1.js?v=20260917-fed2';
import './morning-decision-ready-v1.js?v=20260917-fed2';
import './morning-live-patch-v1.js?v=20260918-brain7';
// Confirmed macro events must be the final authority after all normal V5/live render layers.
import './morning-macro-actual-event-v1.js?v=20260917-fed2';
// The derivatives card is exclusively VN30F1M. Never allow VN-Index/VN30 cash fallback here.
import './morning-derivatives-source-guard-v1.js?v=20260917-pslock1';
// The hot-stocks CTA must open the realtime notable-stocks list, not the personal watchlist.
import './morning-hotstocks-link-v1.js?v=20260917-hotlink1';
// Fill the hot-stocks card, color by signal strength and send overflow to the full realtime list.
import './morning-hotstocks-card-v2.js?v=20260917-hotcard2';