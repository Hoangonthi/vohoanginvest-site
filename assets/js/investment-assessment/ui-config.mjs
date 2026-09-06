export const draftKey = "vh_investment_reality_draft_v1";
export const resultKey = "vh_investment_reality_latest_v1";

export const stageLabels = ["Mục tiêu", "Nguồn vốn", "Đòn bẩy", "Chi phí", "Dòng tiền", "An toàn", "Xác nhận"];

export function defaultState() {
  return {
    screen: "start",
    stage: 0,
    confirmed: false,
    input: {
      purposeCode: "MONTHLY_INCOME",
      targetCashMonthly: 5000000,
      investmentCapital: 100000000,
      externalLoan: 0,
      annualExternalInterest: 0,
      marginAmountWhenUsed: 0,
      marginFrequency: 0,
      marginRate: 0.13,
      turnoverMonthly: 1,
      incomeItems: [{ type: "TOTAL_ESTIMATE", amountMonthly: 25000000 }],
      expenseItems: [{ type: "TOTAL_ESTIMATE", amountMonthly: 25000000 }],
      dependentsCount: 0,
      liquidReserve: 100000000,
      nearTermInvestmentBurden: 0,
      deficitFundingInvestmentShare: 0,
      goalPayload: { cash_monthly: 5000000 }
    },
    incomeMode: "TOTAL",
    expenseMode: "TOTAL"
  };
}

export const purposeOptions = [
  ["MONTHLY_INCOME", "Tạo thêm thu nhập hàng tháng", "Tài khoản cần tạo dòng tiền định kỳ."],
  ["LONG_TERM_WEALTH", "Gia tăng tài sản dài hạn", "Tập trung vào thời gian và quy mô vốn."],
  ["IDLE_CASH", "Quản lý tiền nhàn rỗi", "Muốn vốn được vận hành có nguyên tắc."],
  ["LEARNING", "Học hỏi và trải nghiệm", "Ưu tiên hiểu thị trường mà không gây áp lực đời sống."],
  ["NO_CLEAR_GOAL", "Chưa xác định rõ", "Ghi nhận trung thực để hệ thống không gán sai mục tiêu."]
];

export const marginChoices = [
  [0, "Không dùng", "0% thời gian"],
  [0.1, "Hiếm khi", "≈ 10% thời gian"],
  [0.25, "Thỉnh thoảng", "≈ 25%"],
  [0.5, "Khá thường xuyên", "≈ 50%"],
  [0.75, "Gần như liên tục", "≈ 75%"]
];

export const turnoverChoices = [
  [0.25, "Rất thấp", "<0,5 vòng/tháng"],
  [1, "Thấp", "≈1 vòng/tháng"],
  [2, "Trung bình", "≈2 vòng/tháng"],
  [4, "Cao", "≈4 vòng/tháng"],
  [5, "Rất cao", "≈5 vòng/tháng trở lên"]
];

export const incomeTypes = [["SALARY", "Lương"], ["SPOUSE_CONTRIBUTION", "Thu nhập vợ/chồng"], ["BUSINESS", "Kinh doanh"], ["RENTAL", "Cho thuê"], ["OTHER", "Khác"]];
export const expenseTypes = [["HOUSING", "Nhà ở"], ["FOOD", "Ăn uống/sinh hoạt"], ["CHILDREN_EDUCATION", "Con cái/giáo dục"], ["DEBT_REPAYMENT", "Trả nợ"], ["INSURANCE", "Bảo hiểm"], ["TRANSPORT", "Đi lại"], ["DEPENDENTS", "Hỗ trợ gia đình"], ["OTHER", "Khác"]];

export const ruleCopy = {
  NO_CLEAR_GOAL: ["Chưa có mục tiêu tài chính rõ", "Hoạt động đầu tư chưa được gắn với một mục tiêu đo lường cụ thể."],
  EXPECTATION_VERY_HIGH: ["Kỳ vọng đang rất cao so với vốn", "Mục tiêu tiền khi quy đổi về tỷ suất đang tạo nhiệm vụ lớn cho tài khoản."],
  REQUIRED_RETURN_EXTREME: ["Mức sinh lời cần thiết đang quá cao", "Cấu trúc hiện tại khiến tài khoản phải làm một nhiệm vụ rất nặng."],
  REQUIRED_RETURN_HIGH: ["Mức sinh lời cần thiết đang cao", "Khoảng cách tới mục tiêu không nên chỉ giải bằng giao dịch tốt hơn."],
  DOUBLE_LEVERAGE: ["Đòn bẩy kép", "Vay ngoài và margin cùng xuất hiện trong cấu trúc vốn."],
  INVESTMENT_FUNDS_LIVING_COST: ["Tài khoản đang gánh dòng tiền sống", "Một phần thiếu hụt hàng tháng đang rơi vào tài khoản đầu tư."],
  INVESTMENT_COST_HIGH: ["Chi phí đang ăn vào lợi nhuận", "Một phần đáng kể lợi nhuận kế hoạch dùng để bù lãi, phí và thuế."],
  INVESTMENT_COST_EXCEEDS_PLAN: ["Chỉ hòa vốn đã cần mức cao", "Riêng chi phí đầu tư đã bằng hoặc vượt mốc tham chiếu lập kế hoạch."],
  TRADING_FRICTION_HIGH: ["Vòng quay tạo ma sát đáng kể", "Phí và thuế ước tính đang làm tăng ngưỡng hòa vốn."],
  CASHFLOW_DEFICIT: ["Dòng tiền gia đình đang thiếu", "Thu nhập ngoài đầu tư chưa bao phủ toàn bộ chi phí gia đình."],
  LOW_RESERVE: ["Lớp đệm tiền mặt đang mỏng", "Quỹ dự phòng chưa đủ 3 tháng chi phí theo giả định V1."],
  RESERVE_WATCH: ["Quỹ dự phòng cần theo dõi", "Lớp đệm đang ở vùng tham chiếu 3-6 tháng."],
  NEAR_TERM_LIABILITY: ["Có khoản sắp cần rút", "Một nghĩa vụ trong 12 tháng tới dự kiến dùng tiền từ tài khoản đầu tư."],
  OWN_CAPITAL_PRESSURE: ["Áp lực trên vốn thật cao hơn", "Khi loại phần vốn vay, yêu cầu trên vốn tự có tăng mạnh."]
};

export const recoCopy = {
  R_CLARIFY_GOAL: ["Xác định mục tiêu đo lường", "Trước khi tăng vốn hoặc giao dịch nhiều hơn, hãy xác định số vốn này thực sự cần làm gì."],
  R_REFRAME_EXPECTATION: ["Điều chỉnh mục tiêu", "Thử giảm tiền cần rút hoặc kéo dài thời gian thay vì tìm cách giao dịch mạnh hơn."],
  R_REDUCE_EXTERNAL_LOAN: ["Giảm vốn vay ngoài", "Giảm giá vốn giúp tài khoản không phải bắt đầu từ một mức âm quá lớn."],
  R_REDUCE_MARGIN: ["Giảm margin", "Xem mức sinh lời cần thiết thay đổi ra sao nếu giảm hoặc bỏ margin."],
  R_REDUCE_TURNOVER: ["Giảm vòng quay không cần thiết", "Nếu chiến lược không cần giao dịch dày, giảm ma sát có thể cải thiện lợi nhuận ròng."],
  R_SEPARATE_LIVING_CASH: ["Tách chi phí sinh hoạt khỏi tài khoản", "Mục tiêu là giảm áp lực phải thắng trên thị trường để bù cuộc sống."],
  R_BUILD_RESERVE: ["Tăng lớp đệm tiền mặt", "Một lớp đệm dày hơn giúp tài khoản không phải bán/rút tiền vì nhu cầu ngắn hạn."],
  R_PLAN_BIG_EXPENSE: ["Tách khoản sắp cần dùng", "Tiền đã biết chắc sẽ dùng trong 12 tháng không nên được đối xử như vốn chịu rủi ro dài hạn."],
  R_INCREASE_CAPITAL: ["Tính lại quy mô vốn an toàn", "Chỉ minh họa vốn cần có từ nguồn an toàn, không khuyến khích vay thêm."],
  R_EXTEND_HORIZON: ["Kéo dài thời gian", "Thêm thời gian thường làm giảm tốc độ tăng trưởng cần thiết mỗi năm."]
};