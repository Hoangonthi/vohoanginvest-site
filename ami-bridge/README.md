# VÕ HOÀNG AmiBridge V1

AmiBridge là cầu nối **chỉ đọc** giữa AmiBroker trên máy Windows và website VÕ HOÀNG.

## Database mặc định

`C:\AmiBroker\Data\fpts`

## Chạy nhanh

1. Mở AmiBroker và để database FPTS hoạt động bình thường.
2. Chạy `run-amibridge.cmd`.
3. Mở trình duyệt trên chính máy đó:
   - `http://127.0.0.1:8765/health`
   - `http://127.0.0.1:8765/market/overview`
   - `http://127.0.0.1:8765/stock/FPT`

Nếu các URL trả về JSON có `ok: true`, phần đọc AmiBroker đã hoạt động.

## Nguyên tắc vận hành

- AmiBridge không đặt lệnh, không sửa dữ liệu và không tự giao dịch.
- Dữ liệu realtime được đọc từ AmiBroker **khi có request**.
- Cache mặc định 1,5 giây để nhiều người cùng xem không gọi COM dồn dập.
- Ngoài giờ giao dịch, website về sau sẽ ưu tiên snapshot cuối phiên trên cloud.
- Nếu AmiBridge hoặc máy Windows tắt, website phải fallback sang snapshot gần nhất.

## API local V1

### GET /health
Kiểm tra AmiBridge/AmiBroker/database.

### GET /market/overview
Trả các chỉ số VN-INDEX, VN30, VN100, HNX-INDEX nếu tìm thấy trong database.

### GET /stock/{symbol}
Ví dụ `/stock/FPT`. Trả quotation cuối và các trường cơ bản mà database AmiBroker thực sự có.

## Bước kế tiếp

Sau khi local API được kiểm tra đúng trên máy thật:

`Website -> Supabase Edge Proxy -> HTTPS tunnel -> AmiBridge -> AmiBroker`

Không nên nhúng secret hoặc URL riêng của máy Windows trực tiếp vào JavaScript public của website.
