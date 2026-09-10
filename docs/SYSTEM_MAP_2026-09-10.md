# BẢN TIN MÔI GIỚI — KIẾN TRÚC SÁNG 10/09/2026

Nguồn tin
→ news-worker
→ normalize / dedupe
→ Supabase
→ Finance Gate / Review
→ News Intelligence
→ broker-brief-builder
→ DRAFT bản tin môi giới

Dữ liệu thị trường realtime
→ AmiBridge / VNDIRECT
→ market-feed
→ Market Score / breadth / value
→ broker-brief-builder

Ami cổ phiếu
→ tplus_pro_snapshot.csv
→ push-market.ps1
→ hot-stocks-feed
→ danh sách “Cổ phiếu nổi bật theo dòng tiền”

Ami phái sinh
→ psvn_trend_snapshot.csv
→ push-market.ps1
→ derivatives-feed
→ “Xu hướng phái sinh”

Frontend Bản tin Môi giới
→ market-live-blocks.js
→ ghép Hot Stocks + Phái sinh vào trang
→ phần News/Broker Brief chỉ publish khi qua review theo workflow DRAFT → REVIEWED → PUBLISHED.
