# VÕ HOÀNG – Bình luận thị trường trực tiếp V2 / Local-first

## Kiến trúc

`AmiBroker -> AFL VN-Index + Watch Lists -> push-live-commentary.ps1 -> local history + market-live-ingest -> current/history thưa/event/comment -> market-live-public -> binh-luan-thi-truong-truc-tiep.html`

AI chưa được bật. Event Engine dùng rule + template để kiểm tra hệ thống kể đúng diễn biến trước khi nối AI.

## 1. AFL chỉ phụ trách kỹ thuật VN-Index

Gắn:

`amibroker/VH-Market-Live-Snapshot.afl`

vào chart intraday realtime của **VN-Index**.

Mặc định AFL ghi:

`C:\Users\USER\Desktop\AMIBRO\vh_market_live_snapshot.csv`

CSV chỉ có VN-Index là đúng thiết kế. AFL xuất giá hiện tại, tham chiếu, high/low phiên, hồi từ đáy, giảm từ đỉnh, MA10/20/50 daily, VWAP intraday, RSI14, MACD, prev high/low, high/low 20 phiên và mốc kỹ thuật gần.

## 2. Các mã cổ phiếu lấy trực tiếp từ Watch Lists AmiBroker

Bridge tự tìm thư mục Watch Lists, ưu tiên:

`D:\AmiBroker\eod\WatchLists`

Các nhóm đang hỗ trợ trực tiếp gồm: Bất động sản, Bảo hiểm, Cao su, Cảng biển, Chứng khoán, Công nghệ viễn thông, Dịch vụ công ích, Giáo dục, Hàng không, Khoáng sản, Năng lượng điện khí, Ngân hàng, Thép, Dầu khí, Phân bón, Thực phẩm, Thương mại, Thủy sản, Vật liệu xây dựng, Xây dựng, Đầu tư phát triển.

Bridge đọc file `.tls` hiện có. Không tạo Watch List mới và không sao chép danh sách mã lên Supabase. Khi bạn thêm/bớt mã trong Watch List AmiBroker, lần refresh tiếp theo bridge tự đi theo danh sách mới.

Khoảng 45 giây/lần bridge đọc quote từng mã từ AmiBridge local rồi tính cho mỗi nhóm:

- số mã tăng / đứng giá / giảm;
- mức biến động bình quân của nhóm;
- độ phủ dữ liệu;
- top 3 tăng;
- top 3 giảm.

## 3. Local-first để tiết kiệm Supabase

Trong giờ giao dịch, dữ liệu thô được ghi khoảng 15 giây/lần tại:

`ami-bridge\live-data\YYYY-MM-DD\market-live.ndjson`

File:

`ami-bridge\live-data\latest.json`

luôn chứa trạng thái local gần nhất.

Local raw gồm kỹ thuật VN-Index, dữ liệu nhóm Watch List, quote các mã đã đọc và market context. Thư mục theo ngày được giữ mặc định 45 ngày rồi tự dọn.

Cloud không lưu từng raw snapshot 15 giây. Supabase dùng:

- `market_live_current`: 1 row hiện tại, được ghi đè để web đọc realtime;
- `market_live_snapshots`: khoảng 1 phút/lần + snapshot tại thời điểm có event;
- `market_live_events`: chỉ sự kiện đáng chú ý;
- `market_live_comments`: chỉ bình luận đã công bố.

Nhờ vậy dữ liệu đầy đủ nằm trên máy, còn Supabase chỉ giữ phần cần phục vụ web và lịch sử quan trọng.

## 4. Khởi động

Chạy:

`ami-bridge/run-amibridge.cmd`

File CMD tự tải bản mới nhất của `push-live-commentary.ps1`, nên không cần chép lại script mỗi ngày.

Cửa sổ live phải có tiêu đề:

`VO HOANG - Live Commentary`

Khi vào phiên, log V2 sẽ có các dạng:

`Watch Lists: 20 nhom, 2xx/2xx ma co du lieu...`

`Live current OK (raw history local).`

`Live current OK + cloud history.`

Khi Event Engine phát hiện thay đổi:

`LIVE COMMENT: ...`

## 5. Trang web

`https://www.vohoanginvest.com/binh-luan-thi-truong-truc-tiep.html`

Trang hỏi `market-live-public` khoảng 10 giây/lần. Không reload toàn trang. Snapshot hiện tại lấy từ `market_live_current`; timeline chỉ đọc event/comment.

## Event V2

- VN-Index đỏ -> xanh / xanh -> đỏ.
- Hồi 4 / 7 / 10 điểm từ đáy phiên.
- Lùi 4 / 7 / 10 điểm từ đỉnh phiên.
- Lấy lại / mất MA10, MA20, VWAP.
- Độ rộng cải thiện hoặc xấu đi rõ so với khoảng 15 phút trước.
- Nhóm Watch List dẫn đầu đổi vai.
- Một nhóm nổi bật tăng tốc rõ trong 15 phút.
- Chỉ số xanh nhưng độ rộng yếu.
- Dòng tiền 15 phút tăng tốc.

Mỗi lần chỉ phát tối đa 1 bình luận; cùng loại event có cooldown để tránh spam.

## Kiểm tra phiên đầu

1. `vh_market_live_snapshot.csv` tiếp tục có VN-Index và cập nhật.
2. Cửa sổ Live Commentary nhận đúng đường dẫn Watch Lists.
3. Sau khi thị trường có tick, log báo số nhóm và số mã có dữ liệu.
4. Thư mục `ami-bridge\live-data\YYYY-MM-DD` bắt đầu tăng dữ liệu local.
5. Trang web hiển thị nhóm mạnh/yếu từ chính Watch Lists AmiBroker.
6. Supabase current cập nhật nhanh nhưng `market_live_snapshots` chỉ tăng khoảng 1 row/phút, trừ khi có event.
