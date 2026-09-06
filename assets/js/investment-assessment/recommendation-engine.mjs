export const DEFAULT_RECOMMENDATION_RULES = Object.freeze([
  reco('R_CLARIFY_GOAL', ['NO_CLEAR_GOAL'], 1, 'goal_payload', 'DEFINE', 'Xác định mục tiêu đo lường trước khi tăng quy mô'),
  reco('R_REFRAME_EXPECTATION', ['EXPECTATION_VERY_HIGH', 'REQUIRED_RETURN_HIGH', 'REQUIRED_RETURN_EXTREME'], 1, 'target_cash_or_horizon', 'DECREASE_OR_EXTEND', 'Điều chỉnh kỳ vọng hoặc cách biểu diễn mục tiêu'),
  reco('R_REDUCE_EXTERNAL_LOAN', ['DOUBLE_LEVERAGE', 'INVESTMENT_COST_HIGH', 'INVESTMENT_COST_EXCEEDS_PLAN', 'OWN_CAPITAL_PRESSURE'], 2, 'external_loan_amount_or_rate', 'DECREASE', 'Giảm vốn vay ngoài hoặc giảm chi phí vay'),
  reco('R_REDUCE_MARGIN', ['DOUBLE_LEVERAGE', 'INVESTMENT_COST_HIGH', 'INVESTMENT_COST_EXCEEDS_PLAN'], 1, 'margin_amount_or_frequency', 'DECREASE', 'Giảm quy mô hoặc thời gian sử dụng margin'),
  reco('R_REDUCE_TURNOVER', ['TRADING_FRICTION_HIGH', 'INVESTMENT_COST_EXCEEDS_PLAN'], 3, 'turnover', 'DECREASE', 'Giảm vòng quay không cần thiết'),
  reco('R_SEPARATE_LIVING_CASH', ['INVESTMENT_FUNDS_LIVING_COST'], 1, 'deficit_investment_share', 'DECREASE', 'Giảm tỷ lệ chi phí sống lấy từ tài khoản đầu tư'),
  reco('R_BUILD_RESERVE', ['LOW_RESERVE'], 1, 'liquid_reserve', 'INCREASE', 'Tăng lớp đệm tiền mặt trước khi tăng rủi ro'),
  reco('R_PLAN_BIG_EXPENSE', ['NEAR_TERM_LIABILITY'], 2, 'near_term_liability_funding', 'DECREASE', 'Tách khoản tiền sắp cần dùng khỏi vốn chịu rủi ro'),
  reco('R_INCREASE_CAPITAL', ['REQUIRED_RETURN_HIGH', 'REQUIRED_RETURN_EXTREME'], 3, 'capital', 'INCREASE_SAFE_SOURCE_ONLY', 'Tính ngược quy mô vốn cần thiết ở mốc lợi nhuận kế hoạch'),
  reco('R_EXTEND_HORIZON', ['EXPECTATION_STRETCH'], 3, 'horizon', 'INCREASE', 'Kéo dài thời gian nếu mục tiêu là tích lũy tài sản')
]);

const PRESSURE_ORDER = Object.freeze([
  'R_REDUCE_MARGIN',
  'R_SEPARATE_LIVING_CASH',
  'R_REDUCE_EXTERNAL_LOAN',
  'R_PLAN_BIG_EXPENSE',
  'R_BUILD_RESERVE',
  'R_REFRAME_EXPECTATION',
  'R_EXTEND_HORIZON',
  'R_INCREASE_CAPITAL',
  'R_REDUCE_TURNOVER',
  'R_CLARIFY_GOAL'
]);

export function recommendInvestmentActions(diagnosisResult, calculationResult, options = {}) {
  const rules = options.rules || DEFAULT_RECOMMENDATION_RULES;
  const metrics = calculationResult?.metrics || calculationResult || {};
  const normalized = calculationResult?.normalized || {};
  const recommendationVersion = options.recommendationVersion || calculationResult?.recommendationVersion || 'recommendation_v1';
  const primaryInsights = diagnosisResult?.primaryInsights || [];
  const allInsights = diagnosisResult?.insights || primaryInsights;
  const triggeredCodes = new Set(allInsights.map((item) => item.rule_code));
  const primaryCodes = new Set(primaryInsights.map((item) => item.rule_code));

  const recommendations = [];
  for (const config of rules.map(normalizeRule)) {
    const linked = config.trigger_rules.filter((code) => triggeredCodes.has(code));
    if (linked.length === 0) continue;
    if (!hasRelevantDriver(config.reco_code, metrics, normalized)) continue;
    if (config.reco_code === 'R_INCREASE_CAPITAL' && hasForcedPressure(triggeredCodes)) {
      continue;
    }

    const primaryLinkCount = linked.filter((code) => primaryCodes.has(code)).length;
    const impact = estimateRecommendationImpact(config.reco_code, metrics, normalized);
    recommendations.push({
      reco_code: config.reco_code,
      priority: Number(config.priority),
      message_key: config.message_key,
      linked_diagnosis: linked,
      scenario_field: config.scenario_field,
      direction: config.direction,
      current_value: impact.current_value,
      suggested_direction: config.direction,
      expected_impact_json: impact.expected_impact_json,
      recommendation_version: recommendationVersion,
      rank_score: primaryLinkCount * 1000 + impact.impact_score
    });
  }

  recommendations.sort(compareRecommendations);
  return { recommendationVersion, recommendations };
}

export function compareRecommendations(a, b) {
  return pressureIndex(a.reco_code) - pressureIndex(b.reco_code)
    || (a.priority - b.priority)
    || ((b.rank_score || 0) - (a.rank_score || 0))
    || a.reco_code.localeCompare(b.reco_code);
}

function estimateRecommendationImpact(recoCode, metrics, normalized) {
  switch (recoCode) {
    case 'R_REDUCE_EXTERNAL_LOAN':
      return impact(normalized.externalLoan ?? metrics.external_loan, { annual_external_interest: metrics.annual_external_interest, affects: ['investment_break_even_return', 'required_return_target_total'] });
    case 'R_REDUCE_MARGIN':
      return impact(normalized.marginAmountWhenUsed ?? metrics.avg_margin_est, { annual_margin_interest: metrics.annual_margin_interest, affects: ['investment_break_even_return', 'required_return_target_total'] });
    case 'R_REDUCE_TURNOVER':
      return impact(metrics.turnover_monthly, { annual_trading_friction: metrics.annual_trading_friction, affects: ['investment_break_even_return'] });
    case 'R_SEPARATE_LIVING_CASH':
      return impact(metrics.deficit_funding_investment_share, { annual_cashflow_burden: metrics.annual_cashflow_burden, affects: ['required_return_maintain', 'required_return_target_total'] });
    case 'R_BUILD_RESERVE':
      return impact(metrics.reserve_months, { liquid_reserve: metrics.liquid_reserve, affects: ['reserve_months'] });
    case 'R_PLAN_BIG_EXPENSE':
      return impact(metrics.near_term_investment_burden, { affects: ['required_return_maintain', 'required_return_target_total'] });
    case 'R_REFRAME_EXPECTATION':
      return impact(metrics.target_annual_cash, { affects: ['required_return_target_total'] });
    case 'R_INCREASE_CAPITAL':
      return impact(metrics.investment_capital, { safe_source_only: true, affects: ['required_return_target_total', 'required_return_target_own'] });
    case 'R_EXTEND_HORIZON':
      return impact(null, { affects: ['long_term_cagr'] });
    default:
      return impact(null, {});
  }
}

function hasRelevantDriver(recoCode, metrics, normalized) {
  switch (recoCode) {
    case 'R_REDUCE_EXTERNAL_LOAN':
      return (metrics.external_loan || normalized.externalLoan || 0) > 0 || (metrics.annual_external_interest || normalized.annualExternalInterest || 0) > 0;
    case 'R_REDUCE_MARGIN':
      return (metrics.avg_margin_est || 0) > 0 || ((normalized.marginAmountWhenUsed || 0) > 0 && (normalized.marginFrequency || 0) > 0);
    case 'R_REDUCE_TURNOVER':
      return (metrics.annual_trading_friction || 0) > 0 && (metrics.turnover_monthly || normalized.turnoverMonthly || 0) > 0;
    case 'R_SEPARATE_LIVING_CASH':
      return (metrics.annual_cashflow_burden || 0) > 0;
    case 'R_BUILD_RESERVE':
      return true;
    case 'R_PLAN_BIG_EXPENSE':
      return (metrics.near_term_investment_burden || normalized.nearTermInvestmentBurden || 0) > 0;
    case 'R_REFRAME_EXPECTATION':
      return (metrics.target_annual_cash || 0) > 0;
    case 'R_INCREASE_CAPITAL':
      return (metrics.investment_capital || normalized.investmentCapital || 0) > 0;
    case 'R_EXTEND_HORIZON':
      return normalized.purposeCode === 'LONG_TERM_WEALTH' || normalized.purpose_code === 'LONG_TERM_WEALTH';
    default:
      return true;
  }
}

function hasForcedPressure(codes) {
  return ['DOUBLE_LEVERAGE', 'INVESTMENT_FUNDS_LIVING_COST', 'NEAR_TERM_LIABILITY', 'INVESTMENT_COST_EXCEEDS_PLAN'].some((code) => codes.has(code));
}

function pressureIndex(code) {
  const index = PRESSURE_ORDER.indexOf(code);
  return index === -1 ? PRESSURE_ORDER.length : index;
}

function impact(currentValue, extra) {
  const numericValues = Object.values(extra).filter((value) => typeof value === 'number' && Number.isFinite(value));
  return {
    current_value: typeof currentValue === 'number' && Number.isFinite(currentValue) ? currentValue : null,
    expected_impact_json: extra,
    impact_score: numericValues.reduce((sum, value) => sum + Math.abs(value), 0)
  };
}

function normalizeRule(config) {
  return {
    reco_code: config.reco_code || config.recoCode,
    trigger_rules: config.trigger_rules || config.triggerRules || [],
    scenario_field: config.scenario_field || config.scenarioField || null,
    direction: config.direction || null,
    priority: config.priority,
    message_key: config.message_key || config.messageKey || config.title || null
  };
}

function reco(recoCode, triggerRules, priority, scenarioField, direction, messageKey) {
  return { reco_code: recoCode, trigger_rules: triggerRules, priority, scenario_field: scenarioField, direction, message_key: messageKey };
}

