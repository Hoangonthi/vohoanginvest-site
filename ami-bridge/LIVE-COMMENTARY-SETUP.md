# VÕ HOÀNG – Bình luận thị trường trực tiếp V1

## Kiến trúc

`AmiBroker -> VH-Market-Live-Snapshot.afl -> vh_market_live_snapshot.csv -> push-live-commentary.ps1 -> market-live-ingest -> market_live_* -> market-live-public -> binh-luan-thi-truong-truc-tiep.html`

AI chưa được bật ở V1. Event Engine dùng rule + template để kiểm tra hệ thống kể đúng diễn biến trước khi nối AI.

## 1. Bật AFL trên AmiBroker

Mở chart intraday của **VN-Index** đang dùng dữ liệu realtime, sau đó gắn công thức:

`amibroker/VH-Market-Live-Snapshot.afl`

Mặc định AFL ghi file:

`C:\Users\USER\Desktop\AMIBRO\vh_market_live_snapshot.csv`

Nếu thư mục máy khác, đổi tham số `Snapshot File` trong AFL.

AFL xuất: giá hiện tại, tham chiếu, high/low phiên, hồi từ đáy, giảm từ đỉnh, MA10/20/50 daily, VWAP intraday, RSI14, MACD, prev high/low, high/low 20 phiên và mốc kỹ thuật gần.

## 2. Khởi động AmiBridge như bình thường

Chạy:

`ami-bridge/run-amibridge.cmd`

Bản mới sẽ tự tải và mở thêm cửa sổ:

`VO HOANG - Live Commentary`

Bridge live chạy 15 giây/lần trong giờ giao dịch. Market context (độ rộng, nhóm ngành, VN30, dòng tiền) lấy lại từ `market-feed` khoảng 45 giây/lần để không tạo tải thừa.

Nếu AFL chưa chạy hoặc CSV quá cũ, bridge vẫn gửi market context fallback mỗi 30 giây; các chỉ báo kỹ thuật sẽ để trống thay vì dùng số cũ.

## 3. Mở trang web

`https://www.vohoanginvest.com/binh-luan-thi-truong-truc-tiep.html`

Trang hỏi `market-live-public` khoảng 10 giây/lần. Không reload toàn trang; chỉ cập nhật snapshot hiện tại và chèn bình luận mới.

## Event V1

- VN-Index đỏ -> xanh / xanh -> đỏ, yêu cầu trạng thái giữ qua 2 snapshot.
- Hồi 4 / 7 / 10 điểm từ đáy phiên.
- Lùi 4 / 7 / 10 điểm từ đỉnh phiên.
- Lấy lại / mất MA10, MA20, VWAP.
- Độ rộng cải thiện hoặc xấu đi rõ so với khoảng 15 phút trước.
- Nhóm dẫn dắt đổi vai.
- Chỉ số xanh nhưng độ rộng yếu.
- Dòng tiền 15 phút tăng tốc.

Mỗi snapshot phát tối đa 1 bình luận; cùng loại event có cooldown để tránh spam.

## Database

- `market_live_snapshots`: sự thật theo thời gian.
- `market_live_events`: sự kiện Event Engine phát hiện.
- `market_live_comments`: câu bình luận được công bố + căn cứ.

Ba bảng bật RLS và không mở quyền đọc trực tiếp cho anon/authenticated. Website chỉ đọc qua `market-live-public`.

## Khi kiểm tra ngày đầu

Ưu tiên kiểm tra 4 việc:

1. CSV AFL có thay đổi mỗi khi chart refresh.
2. Cửa sổ Live Commentary có dòng `Live snapshot OK`.
3. Supabase có row mới trong `market_live_snapshots`.
4. Khi có biến động đủ ngưỡng, console hiện `LIVE COMMENT: ...` và trang web có timeline mới.
