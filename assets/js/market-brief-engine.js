const PHILOSOPHIES = {
  defensive: [
    "Khi rủi ro tăng, ưu tiên đầu tiên là giữ quyền lựa chọn cho những cơ hội tốt hơn.",
    "Không phải phiên nào cũng cần kiếm tiền; có phiên chỉ cần tránh một quyết định tệ.",
    "Khi dữ liệu chưa ủng hộ, giảm rủi ro luôn dễ sửa hơn tăng rủi ro quá sớm.",
    "Bảo toàn vốn không có nghĩa là bi quan; đó là giữ khả năng hành động khi điều kiện tốt lên.",
    "Thị trường yếu có thể hồi, nhưng mức độ chủ động chỉ nên tăng khi chất lượng hồi được xác nhận."
  ],
  rebound: [
    "Một nhịp hồi chỉ đáng tin hơn khi độ rộng, dòng tiền và nhóm dẫn dắt cùng xác nhận.",
    "Giá bật lên là tín hiệu để quan sát; xác nhận mới là lý do để tăng mức độ chủ động.",
    "Không phủ nhận một nhịp hồi, nhưng cũng không vội gọi nó là xu hướng khi dữ liệu chưa đủ.",
    "Sự cải thiện đầu tiên đáng chú ý; độ bền của cải thiện mới quyết định mức rủi ro nên dùng.",
    "Thị trường có thể đổi trạng thái rất nhanh; hệ thống cần đổi theo dữ liệu, không theo kỳ vọng."
  ],
  neutral: [
    "Không hành động cũng là một quyết định khi điều kiện chưa đủ rõ.",
    "Chờ đúng điều kiện thường khó hơn tìm một lý do để mua.",
    "Khi dữ liệu chưa đủ, kiên nhẫn là một phần của hệ thống.",
    "Thị trường không bắt buộc mình phải có quan điểm mạnh ở mọi thời điểm.",
    "Điều kiện chưa rõ không có nghĩa là không có cơ hội; nó chỉ yêu cầu mức độ chủ động thấp hơn."
  ],
  constructive: [
    "Khi xác suất thuận lợi tăng, có thể chủ động hơn nhưng vẫn phải biết mình sai ở đâu.",
    "Xu hướng tốt cho phép tăng mức chủ động, không cho phép bỏ qua quản trị rủi ro.",
    "Dòng tiền và độ rộng cải thiện là lý do để nâng mức tin cậy, không phải lý do để mua bằng mọi giá.",
    "Khi thị trường thuận hơn, chất lượng điểm mua vẫn quyết định chất lượng giao dịch.",
    "Sự cải thiện đáng để theo dõi khi nó lan tỏa và duy trì, không chỉ xuất hiện ở vài mã riêng lẻ."
  ],
  positive: [
    "Thị trường thuận giúp cơ hội nhiều hơn, nhưng không làm điểm mua kém trở thành điểm mua tốt.",
    "Tích cực không có nghĩa là mua mọi thứ; chất lượng cơ hội vẫn phải được chọn lọc.",
    "Khi dòng tiền và độ rộng cùng ủng hộ, ưu tiên đi cùng sức mạnh hơn là cố tìm mã chưa chạy.",
    "Kỷ luật vẫn quan trọng nhất khi mọi thứ đang thuận lợi.",
    "Có thể tăng mức chủ động khi điều kiện đủ, nhưng luôn phải giữ điểm sai và tỷ trọng trong tầm kiểm soát."
  ],
  stretched: [
    "Cơ hội tốt không mất giá trị chỉ vì mình không mua ở cây nến đầu tiên.",
    "Bỏ lỡ một điểm mua còn dễ sửa hơn mua sai một cấu trúc.",
    "Giá càng chạy nhanh, yêu cầu về điểm sai và tỷ trọng càng phải rõ.",
    "Khi cảm xúc thị trường tăng nhanh, hệ thống càng cần chậm lại một nhịp.",
    "Không mua đuổi không có nghĩa là bỏ lỡ; đó là chờ một điểm vào có tỷ lệ rủi ro hợp lý hơn."
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
  let headline = "Tôi ưu tiên đọc dữ liệu trước khi tăng mức độ chủ động.";
  let detail = "Trạng thái hiện tại chưa cần một dự báo mạnh; điều quan trọng là theo dõi độ rộng, dòng tiền và độ bền của nhóm dẫn dắt.";
  let action = "Giữ tỷ trọng phù hợp với mức xác nhận hiện tại và chỉ hành động khi điều kiện của từng vị thế đủ rõ.";
  let transition = "Nếu độ rộng, dòng tiền và nhóm dẫn dắt đồng thuận rõ hơn, mức độ chủ động có thể nâng dần; nếu các tín hiệu suy yếu, rủi ro nên được hạ xuống.";
  let watch = "độ rộng thị trường, chất lượng dòng tiền, độ bền của nhóm dẫn dắt và biến động điểm trạng thái";

  if (risk >= 4 || score < 32 || weakBreadth) {
    key = rebound && score >= 24 ? "rebound" : "defensive";
    headline = "Ở trạng thái hiện tại, tôi ưu tiên bảo toàn vốn hơn dự đoán đáy.";
    detail = rebound
      ? "Nhịp hồi đang đáng chú ý, nhưng chỉ nên làm quan điểm tích cực hơn khi độ rộng, dòng tiền và nhóm dẫn dắt cùng cải thiện đủ rõ."
      : "Dữ liệu hiện tại chưa ủng hộ việc mở rộng rủi ro. Một nhịp hồi nếu xuất hiện nên được xem là tín hiệu để kiểm chứng thêm, không phải lý do tự động tăng tỷ trọng.";
    action = "Ưu tiên kiểm soát đòn bẩy, xử lý vị thế vi phạm kế hoạch và hạn chế bình quân giá xuống chỉ vì giá đã giảm.";
    transition = "Nếu độ rộng cải thiện, dòng tiền xác nhận và nhóm dẫn dắt duy trì sức mạnh, có thể chuyển dần từ phòng thủ sang theo dõi cơ hội. Nếu các điều kiện đó chưa xuất hiện, tiếp tục ưu tiên kiểm soát rủi ro.";
    watch = "độ rộng có thu hẹp chênh lệch hay không, dòng tiền có xác nhận nhịp hồi hay không và nhóm dẫn dắt có giữ được sức mạnh hay không";
  } else if (score < 46 || flowWeak) {
    key = rebound ? "rebound" : "neutral";
    headline = "Thị trường đang có tín hiệu để quan sát, nhưng mức xác nhận vẫn chưa đủ mạnh.";
    detail = "Tôi không phủ nhận khả năng cải thiện, nhưng muốn thấy độ rộng và dòng tiền đi cùng trước khi tăng đáng kể mức rủi ro.";
    action = "Giữ tỷ trọng vừa phải, ưu tiên mã có sức mạnh riêng và tránh mở rộng vị thế chỉ vì chỉ số hồi.";
    transition = "Nếu điểm trạng thái, độ rộng và dòng tiền cùng cải thiện, có thể nâng dần mức chủ động. Nếu tín hiệu hồi suy yếu, quay lại ưu tiên phòng thủ.";
  } else if (score < 58) {
    key = "neutral";
    headline = "Thị trường đang ở vùng cần chờ thêm xác nhận hơn là vội kết luận.";
    detail = "Cơ hội có thể xuất hiện từng phần, nhưng mức độ chủ động nên đi cùng chất lượng của độ rộng, dòng tiền và nhóm dẫn dắt.";
    action = "Theo dõi cơ hội có sức mạnh rõ, giữ điểm sai cụ thể và chưa cần tăng tỷ trọng đồng loạt.";
    transition = "Nếu dữ liệu lan tỏa tích cực hơn, có thể tăng mức chủ động; nếu độ rộng hoặc dòng tiền suy yếu, giảm rủi ro trở lại.";
  } else if (score < 72 || !strongBreadth) {
    key = "constructive";
    headline = "Thị trường đang cải thiện và có thể chủ động hơn, nhưng vẫn cần chọn lọc.";
    detail = "Tôi ưu tiên những cơ hội có sức mạnh tương đối, dòng tiền hỗ trợ và điểm sai rõ ràng thay vì mở rộng rủi ro trên toàn bộ danh mục.";
    action = "Có thể tăng dần mức chủ động ở các cơ hội đạt điều kiện, đồng thời giữ tỷ trọng và điểm sai trong giới hạn kế hoạch.";
    transition = "Nếu độ rộng tiếp tục lan tỏa và dòng tiền duy trì, mức độ chủ động có thể tăng thêm. Nếu sự cải thiện mất độ bền, quay về quản trị vị thế.";
  } else if (stretched) {
    key = "stretched";
    headline = "Thị trường tích cực, nhưng càng hưng phấn càng cần kiểm soát giá mua và tỷ trọng.";
    detail = "Sức mạnh hiện tại đáng ghi nhận; điều tôi không muốn là biến một trạng thái tốt thành một giao dịch kém vì mua đuổi hoặc dùng tỷ trọng quá lớn.";
    action = "Ưu tiên đi cùng nhóm mạnh nhưng tránh mua bằng mọi giá; chỉ tăng tỷ trọng khi điểm vào và mức rủi ro vẫn hợp lý.";
    transition = "Nếu sức mạnh tiếp tục được xác nhận, có thể duy trì mức chủ động. Nếu độ rộng co lại hoặc dòng tiền hụt, cần hạ tốc độ giải ngân.";
  } else {
    key = "positive";
    headline = "Thị trường đang thuận hơn và cho phép mức độ chủ động cao hơn.";
    detail = "Khi độ rộng, dòng tiền và nhóm dẫn dắt cùng ủng hộ, tôi ưu tiên đi cùng sức mạnh nhưng vẫn giữ kỷ luật từng vị thế.";
    action = "Có thể chủ động với các cơ hội đạt điều kiện, nhưng không bỏ qua điểm sai, tỷ trọng và tổng rủi ro danh mục.";
    transition = "Nếu các tín hiệu tích cực được duy trì, tiếp tục theo kế hoạch; nếu độ rộng và dòng tiền suy yếu, giảm dần mức rủi ro thay vì cố giữ quan điểm cũ.";
  }

  return { headline, detail, action, transition, watch, philosophy: pickPhilosophy(data, key) };
}
