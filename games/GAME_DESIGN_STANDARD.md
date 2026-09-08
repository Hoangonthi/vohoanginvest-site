# GAME DESIGN STANDARD — VÕ HOÀNG FINANCIAL GAMES

Áp dụng cho toàn bộ hệ 50 financial games.

## 1. Mục tiêu
Mỗi game phải xác định rõ người chơi cần học hoặc bộc lộ điều gì: Risk, Timing, Allocation, Money, Discipline, System, Stock Picking, FOMO, định giá, dòng tiền...

## 2. Bối cảnh ban đầu
Phải có nhân vật, vốn, tài sản đang nắm, margin, trạng thái thị trường, mục tiêu và ràng buộc đời sống/tài chính.

## 3. Time Engine
Game phải chạy theo thời gian thật sự. Mỗi game config riêng: base tick, horizon, speed x1/x2/x5/x10, pause, auto-pause, skip to next material event.

## 4. Dữ kiện xuất hiện dần
Không đưa toàn bộ thông tin từ đầu. Giá, volume, VN-Index, breadth, ngành, dòng tiền, tin tức, room chat, BCTC, KQKD, ROE/ROIC, nợ, cashflow, định giá, cổ tức, phát hành, M&A, quản trị, lãi suất, tỷ giá, chính sách, khủng hoảng... phải xuất hiện theo timeline.

## 5. Information latency
Thông tin không xuất hiện đồng thời: giá có thể chạy trước, volume tăng sau, room lan tin, báo chí đăng, doanh nghiệp xác nhận sau cùng.

## 6. Noise Engine
Phải có tin đáng tin, tin chưa xác minh, dữ kiện vô nghĩa, mâu thuẫn và dữ kiện dễ gây hiểu sai.

## 7. Portfolio/Risk Engine
Theo dõi liên tục: cash, holdings, cost basis, P&L, exposure, position weight, margin, buying power, drawdown, stop, concentration.

## 8. Action freedom
Người chơi được hành động bất kỳ lúc nào: mua, bán, mua thêm, giảm tỷ trọng, giữ, không làm gì, margin, giảm margin, đặt/nâng stop, chốt một phần, chuyển tài sản. Không dùng A/B/C/D làm cơ chế chính.

## 9. No action = decision
Không hành động cũng là một quyết định và phải được ghi nhận trong timeline khi có sự kiện material.

## 10. Time-dependent decisions
Cùng một hành động ở ngày 10, 30, 60 phải có hậu quả khác nhau.

## 11. Path dependency
Quyết định trước thay đổi cơ hội/ràng buộc sau. Margin sớm có thể làm mất sức mua khi cơ hội tốt xuất hiện.

## 12. Consequence continues
Sau quyết định game không dừng để giảng giải. Thị trường tiếp tục chạy; hậu quả có thể xuất hiện vài ngày, tháng hoặc năm sau.

## 13. Open simulation
Không có một đường đi cố định. Cùng scenario, người chơi khác nhau có thể lời, hòa vốn hoặc cháy tài khoản.

## 14. Decision Quality ≠ Outcome Quality
Một quyết định tốt vẫn có thể lỗ; quyết định tệ vẫn có thể lời. Hai nhóm điểm phải tách biệt.

## 15. Multi-dimensional scoring
Tối thiểu: Stock Picking, Timing, Risk, Allocation, Money, Discipline, System.

## 16. Risk metrics
Tối thiểu: return, max drawdown, volatility, exposure, margin usage, rule breaks, loss streak, concentration risk.

## 17. Memory Hook
Mỗi game phải có một điểm nhớ: cú giảm ngày 31, lệnh thứ 7, BCTC quý III, margin call...

## 18. Realistic events
Ưu tiên sự kiện thật hoặc gần thật của thị trường Việt Nam nhưng có thể hư cấu tên để tránh sao chép nguyên mẫu.

## 19. Character & story
Game có nhân vật, mục tiêu và hoàn cảnh để người chơi nhớ bối cảnh thay vì chỉ nhìn số.

## 20. Psychology state
Ghi nhận chuỗi thắng/thua, FOMO, revenge trade, bỏ lỡ cơ hội, quá tự tin, áp lực gỡ lỗ.

## 21. Unexpected events
Tin xấu, gap down, thay CEO, chính sách mới, phủ nhận tin đồn, khủng hoảng... không được báo trước.

## 22. Long horizon support
Nếu game yêu cầu, phải chạy được 1/3/5/10 năm.

## 23. Long-term data
Horizon dài phải có business quality, growth, ROIC, debt, cashflow, valuation, dividends, dilution, competition, industry cycle, rates, policy, governance.

## 24. Horizon-aware weighting
3 ngày ưu tiên price/volume; 6 tháng ưu tiên earnings/industry; 5 năm ưu tiên business quality/valuation/capital allocation.

## 25. Auto-pause
Material event có thể tự pause hoặc giảm tốc.

## 26. Skip to next material event
Người chơi dài hạn không phải nhìn từng ngày.

## 27. Replay value
Game phải đáng chơi lại với chiến lược khác.

## 28. Timeline review
Cuối game phải tua lại các điểm mua, margin, stop, FOMO, drawdown, missed opportunity.

## 29. Causal explanation
Không chỉ báo kết quả mà phải giải thích chuỗi nguyên nhân: “Tài khoản không gãy ở ngày 31; nó bắt đầu từ tăng margin ngày 12.”

## 30. Investor Passport
Sau mỗi game cập nhật Risk, Timing, Allocation, Money, Discipline, System, Stock Picking.

## 31. Next game recommendation
Game tiếp theo được đề xuất dựa trên điểm yếu Passport.

## 32. Difficulty
BEGINNER / INTERMEDIATE / ADVANCED / PRO.

## 33. Per-game speed config
Không ép toàn bộ game dùng cùng một tick.

## 34. Shared Time Engine
Một engine dùng chung, config riêng mỗi game.

## 35. Shared Event Engine
Quản lý market/company/macro/social/personal events.

## 36. Shared Portfolio/Risk Engine
Không code lại trạng thái tài khoản và risk logic cho từng game.

## 37. Ending is not Win/Lose
Kết thúc phải có return, drawdown, decision quality, discipline, risk, best/worst decisions, mistakes.

## 38. Explain “Why did I get this result?”
Mỗi game bắt buộc trả lời được câu này.

## 39. One unforgettable lesson
Người chơi phải nhớ ít nhất một bài học cụ thể.

## 40. Core principle
Không hỏi người chơi họ sẽ làm gì. Đặt họ vào một thế giới tài chính đang vận động và để chuỗi quyết định của họ tạo ra kết quả.

---

## Definition of Done cho một game hoàn chỉnh
Một game chỉ được đánh dấu READY khi có đủ: mục tiêu, scenario, time config, event schedule + noise, portfolio/risk state, free actions, path dependency, material auto-pause, replay, decision log, decision/outcome scoring tách biệt, timeline review, memory hook, passport update, next-game recommendation, analytics events và mobile UX.
