# VÕ HOÀNG – Bình luận thị trường trực tiếp V3

## Mục tiêu

Không làm một bảng số tự động. V3 xây **mô hình câu chuyện của phiên**:

`VN-Index -> thế trận -> nhóm ngành -> cổ phiếu -> vùng kỹ thuật -> bối cảnh ngoài thị trường -> kịch bản cần theo dõi`

Nguyên tắc: AmiBroker cung cấp sự thật, máy local giữ ký ức dày, Event/Narrative Engine ghép quan hệ, AI chưa cần tham gia ở giai đoạn kiểm chứng.

## 1. AFL – “quả bóng” VN-Index

Gắn `amibroker/VH-Market-Live-Snapshot.afl` vào chart intraday realtime VN-Index.

CSV mặc định:

`C:\Users\USER\Desktop\AMIBRO\vh_market_live_snapshot.csv`

CSV chỉ có VN-Index là đúng thiết kế. Nó cung cấp giá hiện tại, high/low phiên, hồi từ đáy/lùi từ đỉnh, MA10/20/50, VWAP, RSI, MACD, đỉnh/đáy cũ, hỗ trợ/cản.

## 2. Watch Lists – “các tuyến và cầu thủ”

`push-live-commentary-v3.ps1` tự tìm thư mục WatchLists, ưu tiên database có nhiều file `.tls` nhất trong các đường dẫn phổ biến.

Tên Watch List có dấu tiếng Việt được chuẩn hóa trước khi nhận diện. Các nhóm hỗ trợ gồm Bất động sản, Bảo hiểm, Cao su, Cảng biển, Chứng khoán, Công nghệ viễn thông, Dịch vụ công ích, Giáo dục, Hàng không, Khoáng sản, Năng lượng điện khí, Ngân hàng, Thép, Dầu khí, Phân bón, Thực phẩm, Thương mại, Thủy sản, Vật liệu xây dựng, Xây dựng, Đầu tư phát triển.

Bridge đọc trực tiếp `.tls`; không tạo danh sách mới. Khi sửa Watch List trong AmiBroker, lần refresh tiếp theo hệ thống tự đi theo.

Mỗi nhóm được tính: biến động bình quân, tăng/đứng/giảm, độ rộng nhóm, độ phủ dữ liệu, top 3 tăng và top 3 giảm.

## 3. Ký ức local 5/15/30 phút

Raw 15 giây/lần nằm tại:

`ami-bridge\live-data\YYYY-MM-DD\market-live.ndjson`

Trạng thái mới nhất:

`ami-bridge\live-data\latest.json`

V3 giữ thêm memory trong RAM để so sánh 5/15/30 phút: VN-Index, độ rộng và chuyển động nhóm ngành. Đây là lớp giúp bình luận hiểu **thị trường vừa từ đâu đi tới hiện tại**.

Mặc định giữ raw local 45 ngày.

## 4. Supabase local-first

Bridge vẫn gửi qua `market-live-ingest`; endpoint này hiện chuyển tiếp sang `market-live-narrative-v3`.

Cloud chỉ giữ:

- `market_live_current`: 1 trạng thái hiện tại cho web;
- `market_live_snapshots`: khoảng 1 phút/lần và tại thời điểm có event;
- `market_live_events`: thay đổi đáng bình luận;
- `market_live_comments`: câu chuyện đã công bố.

Không đẩy toàn bộ raw 15 giây lên Supabase.

## 5. World Model V3

Narrative Engine hiểu các vai trò sau:

- **Ball / tỷ số:** VN-Index, thay đổi 5/15/30 phút, high/low, hồi từ đáy, lùi từ đỉnh.
- **Match / thế trận:** độ rộng, biến đổi độ rộng 15 phút, thanh khoản và tốc độ dòng tiền.
- **Lines / tuyến:** nhóm đang dẫn dắt, hỗ trợ, trung tính, gây áp lực.
- **Players / cầu thủ:** các mã nổi bật trong nhóm và VN30.
- **Zones / khu vực:** MA10/20/50, VWAP, support/resistance, đỉnh/đáy trước, high/low 20 phiên.
- **Driver confidence:** chỉ nói nhóm “đang đi cùng/nâng đỡ/gây áp lực” khi dữ liệu nhóm, độ rộng và mã thành phần đủ khớp; không tự khẳng định đóng góp điểm số.
- **Outside context:** phái sinh + tin quan trọng + neo vĩ mô. Đây chỉ là bối cảnh, không tự biến thành nguyên nhân của nhịp giá.

## 6. Event V3

Ngoài event V2, V3 thêm:

- thế trận chuyển tích cực/xấu đi khi VN-Index và độ rộng cùng đổi;
- nhóm dẫn dắt tăng tốc/yếu đi trong 15 phút;
- luân chuyển nhóm dẫn;
- tiến sát vùng cản/hỗ trợ quan trọng;
- chỉ số xanh nhưng mặt bằng cổ phiếu chưa theo kịp;
- recap định kỳ khoảng 18–20 phút nếu thị trường không có event lớn, để trang vẫn có câu chuyện liên tục.

Cùng loại event có cooldown 4–12 phút tùy mức độ để tránh spam.

## 7. Cấu trúc một bình luận tốt

Mỗi bình luận cố trả lời 4 câu:

1. Chuyện gì vừa xảy ra?
2. Nhóm/mã nào đang đi cùng thay đổi đó?
3. VN-Index đang ở khu vực kỹ thuật nào?
4. Điều kiện nào cần nhìn tiếp để xác nhận hoặc phủ định kịch bản?

Ví dụ cách diễn đạt:

> VN-Index đã hồi từ đáy và lấy lại sắc xanh. Độ rộng cải thiện so với 15 phút trước. Ngân hàng đang đi cùng nhịp hồi, nổi bật VCB/BID/CTG nếu dữ liệu thực tế xác nhận. Chỉ số đang tiến gần vùng cản phía trên. Nếu cản được vượt đồng thời độ rộng tiếp tục mở rộng, kịch bản tích cực được củng cố; nếu chỉ số không vượt và độ rộng thu hẹp, cần đề phòng nhịp hồi hụt hơi.

Không dùng câu “thị trường giảm vì tin X” nếu chưa có bằng chứng.

## 8. Khởi động phiên thử

Chạy lại `ami-bridge/run-amibridge.cmd` trước phiên. CMD tự tải và mở:

`VO HOANG - Live Commentary V3`

Log cần thấy:

`Watch Lists: ...`

`Watch Lists: xx nhom, xxx/xxx ma co du lieu...`

`Live V3 current OK.`

Khi có event:

`LIVE COMMENT V3: ...`

Trang xem:

`https://www.vohoanginvest.com/binh-luan-thi-truong-truc-tiep.html`

## 9. Phiên đầu cần đánh giá

Ưu tiên kiểm tra: (1) Watch List nhận đúng nhóm/mã; (2) diễn biến 5/15/30 phút khớp bảng điện; (3) nhóm được gọi là dẫn dắt/gây áp lực có hợp lý; (4) vùng kỹ thuật đúng AmiBroker; (5) bình luận không quá dày; (6) “Điểm cần nhìn tiếp” có thực sự giúp theo dõi phiên.
