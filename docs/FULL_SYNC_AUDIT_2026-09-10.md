# FULL SYNC AUDIT — 10/09/2026

Đã đối chiếu trực tiếp với Supabase production trước khi đóng gói.

## 1) Tin tức
- Edge Function `news-worker`: ACTIVE, version 4.
- Collector chỉ thu thập/normalize/dedupe, không tự xuất bản nhận định môi giới.
- Cron `news_worker_cycle_5m`: active, `*/5 * * * *`.
- Cron `news_cleanup_retention_hourly`: active, `17 * * * *`.
- Retention đã chốt: REJECT 24h, WATCH 7d, CONSIDER 14d, PRIORITY 30d; raw payload compact sau 48h.
- Finance Gate và candidate scoring nằm trong DB/RPC production.

## 2) Bản tự động dành cho môi giới
- Edge Function `broker-brief-builder`: ACTIVE, version 1.
- Cron `broker_brief_builder_morning`: active, `*/15 23,0,1 * * *`.
- Builder kết hợp Market Feed + News candidate, tạo DRAFT.
- Không ghi đè khi brief đã REVIEWED/PUBLISHED.
- Audit ngày 10/09/2026: có brief DRAFT, trạng thái thị trường THẬN TRỌNG, score 45.

## 3) Cổ phiếu cơ sở nổi bật theo dòng tiền
- Edge Function `hot-stocks-feed`: ACTIVE, version 1.
- Windows bridge V2.3 đọc `tplus_pro_snapshot.csv`.
- Chỉ đẩy các dòng đạt điều kiện nội bộ từ scanner.
- Public chỉ trả danh sách mã + CTA, không lộ tScore, stoploss hay class nội bộ.
- Audit production: snapshot đang nhận dữ liệu thật từ AmiBroker.

## 4) Phái sinh realtime
- Edge Function `derivatives-feed`: ACTIVE, version 1.
- Windows bridge kiểm tra snapshot phái sinh mỗi 2 giây.
- Public dùng đúng ngôn ngữ:
  - Xu hướng
  - Giá hệ thống báo
  - Mục tiêu xu hướng T1/T2/T3
  - Đảo chiều xu hướng
- Audit production: feed fresh, VN30F1M, xu hướng Tăng.

## 5) Frontend
- `assets/js/market-live-blocks.js` là file mới để gắn Hot Stocks + Phái sinh vào trang Bản tin Môi giới.
- Nếu dữ liệu stale thì tự ẩn, không hiển thị dữ liệu cũ.

## 6) Bảo mật
- Không chứa service-role key, scheduler key, bridge key plaintext hoặc Telegram token trong gói.
- AFL lưu trên repo đã loại Telegram token/chat id.
- Source Hot Stocks/Derivatives trong repo-ready dùng biến môi trường `VH_BRIDGE_KEY`.
