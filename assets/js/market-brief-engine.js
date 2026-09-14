const PHILOSOPHIES = {
  defensive: [
    "Không phải phiên nào cũng cần kiếm tiền; có phiên chỉ cần tránh một quyết định tệ.",
    "Khi thị trường yếu, giữ tiền cũng là một quyết định.",
    "Bảo toàn vốn là để còn sức mua khi cơ hội tốt hơn xuất hiện.",
    "Thị trường có thể hồi bất cứ lúc nào, nhưng chỉ nên mua thêm khi dòng tiền và độ rộng cùng tốt lên.",
    "Khi phần lớn cổ phiếu còn yếu, ưu tiên giữ tài khoản an toàn trước khi nghĩ đến lợi nhuận."
  ],
  rebound: [
    "Một nhịp hồi đáng tin hơn khi số mã tăng, dòng tiền và nhóm dẫn dắt cùng cải thiện.",
    "Chỉ số bật lên là tín hiệu để quan sát; chưa phải lý do để vội mua thêm.",
    "Không phủ nhận nhịp hồi, nhưng cần xem dòng tiền có thực sự quay lại hay không.",
    "Một phiên xanh là tín hiệu tốt; nhiều tín hiệu cùng tốt mới đáng để tăng tỷ trọng.",
    "Thị trường đổi rất nhanh; quan điểm cũng phải đổi theo dữ liệu."
  ],
  neutral: [
    "Không hành động cũng là một quyết định khi điều kiện chưa đủ rõ.",
    "Chờ đúng điều kiện thường khó hơn tìm một lý do để mua.",
    "Khi dữ liệu chưa rõ, kiên nhẫn là một phần của hệ thống.",
    "Không cần phải có quan điểm mạnh ở mọi thời điểm.",
    "Có cơ hội thì làm; chưa rõ thì giữ tiền và chờ thêm."
  ],
  constructive: [
    "Khi thị trường tốt dần lên, có thể mua thêm từng bước thay vì tăng tỷ trọng quá nhanh.",
    "Xu hướng tốt cho phép chủ động hơn, nhưng không bỏ qua quản trị vốn.",
    "Dòng tiền và độ rộng tốt lên là lý do để tin hơn, không phải lý do để mua bằng mọi giá.",
    "Thị trường thuận hơn vẫn cần chọn đúng cổ phiếu và đúng điểm mua.",
    "Một nhịp tăng đáng tin hơn khi nhiều nhóm cùng tham gia, không chỉ vài mã riêng lẻ."
  ],
  positive: [
    "Thị trường thuận giúp cơ hội nhiều hơn, nhưng điểm mua vẫn phải hợp lý.",
    "Tích cực không có nghĩa là mua mọi thứ; vẫn phải chọn lọc.",
    "Khi dòng tiền và độ rộng cùng tốt, ưu tiên cổ phiếu đang khỏe hơn thị trường.",
    "Kỷ luật vẫn quan trọng nhất khi mọi thứ đang thuận lợi.",
    "Có thể tăng tỷ trọng khi điều kiện đủ, nhưng luôn phải biết mức cắt lỗ và giới hạn vốn."
  ],
  stretched: [
    "Cơ hội tốt không mất đi chỉ vì mình không mua ở cây nến đầu tiên.",
    "Bỏ lỡ một điểm mua còn dễ sửa hơn mua đuổi ở vùng giá không còn đẹp.",
    "Giá càng chạy nhanh, càng phải rõ mức cắt lỗ và tỷ trọng.",
    "Khi thị trường hưng phấn, hệ thống càng cần chậm lại một nhịp.",
    "Không mua đuổi là chờ một điểm vào có tỷ lệ lời/lỗ hợp lý hơn."
  ]
};

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

function findIndex(data, symbol) {
  return Array.isArray(data?.indexes)
    ? data.indexes.find((x) => String(x?.symbol || "") === symbol)
    : null;
}

function pickPhilosophy(data, key) {
  const pool = PHILOSOPHIES[key] || PHILOSOPHIES.neutral;
  const raw = String(data?.updated_at || data?.relay_received_at || new Date().toISOString()).slice(0, 13) + key;
  let hash = 0;
  for (const c of raw) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}

export function getAdaptiveMarketBrief(data) {
  const mi = data?.market_intelligence || {};
  const state = mi.state || {};
  const breadth = mi.breadth || {};
  const flow = mi.flow || {};
  const vn = findIndex(data, "VN-INDEX") || {};

  const score = num(state.score) ?? 50;
  const risk = num(state.risk_level) ?? 3;
  const delta = num(state.score_delta_15m);
  const vnPct = num(vn.change_pct);
  const adv = num(breadth.adv);
  const dec = num(breadth.dec);
  const same = num(flow.same_time_ratio);
  const pace = num(flow.pace_ratio_15m);

  const weakBreadth = adv !== null && dec !== null && dec > Math.max(adv * 1.6, adv + 70);
  const strongBreadth = adv !== null && dec !== null && adv > Math.max(dec * 1.35, dec + 40);
  const flowWeak = (same !== null && same < 0.82) || (pace !== null && pace < 0.82);
  const rebound = (delta !== null && delta >= 3) || (vnPct !== null && vnPct >= 0.7);
  const stretched = score >= 72 && vnPct !== null && vnPct >= 1.5 && strongBreadth;

  let key = "neutral";
  let headline = "Ad ưu tiên đọc dữ liệu trước khi quyết định có mua thêm hay không.";
  let detail = "Lúc này chưa cần đoán thị trường sẽ đi đâu. Quan trọng hơn là xem số mã tăng/giảm, dòng tiền và nhóm dẫn dắt đang thay đổi thế nào.";
  let action = "ACE giữ tỷ trọng phù hợp và chỉ mua thêm khi điều kiện của từng cổ phiếu đủ rõ.";
  let transition = "Nếu độ rộng, dòng tiền và nhóm dẫn dắt cùng tốt lên, có thể tăng tỷ trọng từng bước. Nếu các tín hiệu xấu đi, ưu tiên giảm tỷ trọng và giữ tiền.";
  let watch = "số mã tăng/giảm, dòng tiền, nhóm dẫn dắt và sự thay đổi của điểm trạng thái";

  if (risk >= 4 || score < 32 || weakBreadth) {
    key = rebound && score >= 24 ? "rebound" : "defensive";
    headline = "Ở trạng thái hiện tại, Ad ưu tiên cùng ACE giữ an toàn cho tài khoản hơn là cố đoán đáy.";
    detail = rebound
      ? "Thị trường đang có nhịp hồi đáng chú ý, nhưng cần thấy số mã tăng, dòng tiền và nhóm dẫn dắt cùng tốt lên trước khi mua thêm."
      : "Dữ liệu hiện tại chưa phù hợp để tăng tỷ trọng cổ phiếu. Nếu thị trường hồi, cần nhìn thêm độ rộng và dòng tiền; chỉ số xanh trở lại chưa đủ để vội mua thêm.";
    action = "ACE ưu tiên giữ tỷ trọng an toàn, hạn chế margin, xử lý các cổ phiếu đã vi phạm kế hoạch và chưa bình quân giá xuống chỉ vì giá đã giảm.";
    transition = "Quan điểm sẽ tích cực hơn khi số mã tăng cải thiện, dòng tiền quay lại và nhóm dẫn dắt giữ được sức mạnh. Nếu chưa có các tín hiệu này, tiếp tục ưu tiên giữ tài khoản an toàn.";
    watch = "số mã tăng có cải thiện hay không, dòng tiền có quay lại hay không và nhóm dẫn dắt có giữ được sức mạnh hay không";
  } else if (score < 46 || flowWeak) {
    key = rebound ? "rebound" : "neutral";
    headline = "Thị trường có dấu hiệu hồi, nhưng chưa đủ mạnh để vội tăng tỷ trọng.";
    detail = "Ad muốn cùng ACE thấy số mã tăng và dòng tiền cải thiện rõ hơn trước khi mua thêm đáng kể.";
    action = "ACE giữ tỷ trọng vừa phải, ưu tiên cổ phiếu khỏe hơn thị trường và không mua thêm chỉ vì VN-Index hồi.";
    transition = "Nếu điểm trạng thái, số mã tăng và dòng tiền cùng tốt lên, có thể mua thêm từng bước. Nếu nhịp hồi yếu đi, quay lại ưu tiên giữ tiền.";
  } else if (score < 58) {
    key = "neutral";
    headline = "Thị trường đang ở vùng cần quan sát thêm, chưa cần vội kết luận.";
    detail = "Cơ hội vẫn có thể xuất hiện ở từng cổ phiếu, nhưng chưa phù hợp để tăng tỷ trọng đồng loạt.";
    action = "ACE ưu tiên cổ phiếu có sức mạnh rõ, xác định sẵn mức cắt lỗ và chưa cần mua thêm trên diện rộng.";
    transition = "Nếu số mã tăng và dòng tiền tốt lên, có thể tăng tỷ trọng từng bước; nếu chúng yếu đi, giảm tỷ trọng trở lại.";
  } else if (score < 72 || !strongBreadth) {
    key = "constructive";
    headline = "Thị trường đang cải thiện và có thể mua thêm từng bước, nhưng vẫn cần chọn lọc.";
    detail = "Ad ưu tiên cùng ACE chọn cổ phiếu khỏe hơn thị trường, có dòng tiền hỗ trợ và mức cắt lỗ rõ ràng thay vì mua dàn trải.";
    action = "ACE có thể tăng tỷ trọng từng bước ở các cơ hội đạt điều kiện, đồng thời giữ quy mô mỗi vị thế trong giới hạn kế hoạch.";
    transition = "Nếu số mã tăng tiếp tục lan rộng và dòng tiền duy trì, có thể tăng thêm tỷ trọng. Nếu đà hồi yếu đi, quay lại quản lý chặt các vị thế đang nắm giữ.";
  } else if (stretched) {
    key = "stretched";
    headline = "Thị trường tích cực, nhưng càng hưng phấn càng phải kiểm soát giá mua và tỷ trọng.";
    detail = "Sức mạnh hiện tại đáng ghi nhận; điều cần tránh là biến một trạng thái tốt thành một giao dịch kém vì mua đuổi hoặc dùng tỷ trọng quá lớn.";
    action = "ACE có thể ưu tiên nhóm mạnh nhưng không mua bằng mọi giá; chỉ tăng tỷ trọng khi điểm vào và mức cắt lỗ vẫn hợp lý.";
    transition = "Nếu sức mạnh tiếp tục được duy trì, giữ kế hoạch hiện tại. Nếu số mã tăng co lại hoặc dòng tiền hụt, giảm tốc độ giải ngân.";
  } else {
    key = "positive";
    headline = "Thị trường đang thuận hơn và cho phép tăng tỷ trọng có chọn lọc.";
    detail = "Khi số mã tăng, dòng tiền và nhóm dẫn dắt cùng ủng hộ, Ad ưu tiên cùng ACE đi theo cổ phiếu mạnh nhưng vẫn giữ kỷ luật từng vị thế.";
    action = "ACE có thể chủ động với các cơ hội đạt điều kiện, nhưng luôn xác định trước mức cắt lỗ, tỷ trọng và tổng vốn đang sử dụng.";
    transition = "Nếu các tín hiệu tích cực được duy trì, tiếp tục theo kế hoạch; nếu độ rộng và dòng tiền yếu đi, giảm dần tỷ trọng thay vì cố giữ quan điểm cũ.";
  }

  return { headline, detail, action, transition, watch, philosophy: pickPhilosophy(data, key) };
}
