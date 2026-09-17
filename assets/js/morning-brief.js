// Khôi phục pipeline Decision Dashboard V5 đã chạy ổn trước ngày 15/09,
// nhưng route toàn bộ dữ liệu thị trường VN sang DataTick + Ami local-primary.
const V='20260917-v5-local-primary-restore-1';

await import(`./morning-local-primary-router-v1.js?v=${V}`);
await import(`./morning-decision-preboot-v1.js?v=${V}`);
await import(`./morning-brief-core.js?v=${V}`);
await import(`./morning-decision-dashboard-v5.js?v=${V}`);
await import(`./morning-decision-dashboard-v5-anchor.js?v=${V}`);
await import(`./morning-advisor-engine-v1.js?v=${V}`);
await import(`./morning-verdict-board-v2.js?v=${V}`);
await import(`./morning-macro-action-engine-v2.js?v=${V}`);
await import(`./morning-readable-type-v1.js?v=${V}`);
await import(`./morning-decision-ready-v1.js?v=${V}`);
await import(`./morning-stock-link-v1.js?v=${V}`);

// Không nạp morning-live-patch-v1 cũ ở đây: patch đó thuộc chuỗi nguồn cũ.
// Realtime VN hiện đi qua local-primary-market-public; lớp polling mới sẽ được nối riêng sau khi UI V5 ổn định.
