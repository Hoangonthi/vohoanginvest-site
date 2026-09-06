const SEVERITY_WEIGHT = Object.freeze({ CRITICAL: 4, HIGH: 3, WATCH: 2, INFO: 1 });
const NUMERIC_EVIDENCE_FALLBACKS = ['investment_capital', 'required_return_target_total', 'required_return_maintain', 'total_investment_cost'];

export const DEFAULT_DIAGNOSIS_RULES = Object.freeze([
  rule('NO_CLEAR_GOAL', any(eq('purpose_code', 'NO_CLEAR_GOAL'), isNull('goal_payload')), 'INFO', 3, 'Bạn đang giao dịch mà chưa có một mục tiêu tài chính rõ', ['purpose_code', 'goal_payload', 'investment_capital', 'required_return_maintain']),
  rule('EXPECTATION_STRETCH', cmp('target_return_before_cost', '>', assumption('PLANNING_REFERENCE_RETURN')), 'WATCH', 3, 'Mục tiêu đang cao hơn mốc kế hoạch tham chiếu', ['target_return_before_cost', 'planning_reference_return']),
  rule('EXPECTATION_VERY_HIGH', cmp('target_return_before_cost', '>=', assumptionMultiplier('PLANNING_REFERENCE_RETURN', 2)), 'HIGH', 2, 'Một con số tiền nhỏ có thể đang đòi hỏi tỷ suất rất lớn', ['target_annual_cash', 'investment_capital', 'target_return_before_cost']),
  rule('DOUBLE_LEVERAGE', all(cmp('external_loan', '>', 0), cmp('avg_margin_est', '>', 0)), 'HIGH', 1, 'Bạn đang dùng hai lớp đòn bẩy', ['external_loan', 'avg_margin_est', 'annual_external_interest', 'annual_margin_interest']),
  rule('INVESTMENT_COST_HIGH', cmp('investment_break_even_return', '>=', assumptionMultiplier('PLANNING_REFERENCE_RETURN', 0.5)), 'WATCH', 2, 'Chi phí đang ăn đáng kể vào lợi nhuận', ['total_investment_cost', 'investment_break_even_return', 'planning_reference_return']),
  rule('INVESTMENT_COST_EXCEEDS_PLAN', cmp('investment_break_even_return', '>=', assumption('PLANNING_REFERENCE_RETURN')), 'HIGH', 1, 'Chỉ hòa vốn đầu tư đã cần mức lợi nhuận rất cao', ['investment_break_even_return', 'planning_reference_return', 'total_investment_cost']),
  rule('TRADING_FRICTION_HIGH', cmp('annual_trading_friction_ratio', '>=', assumption('TRADING_FRICTION_WATCH_RATE')), 'WATCH', 3, 'Tần suất giao dịch đang tạo ma sát đáng kể', ['turnover_monthly', 'annual_trading_friction', 'investment_capital']),
  rule('CASHFLOW_DEFICIT', cmp('monthly_surplus', '<', 0), 'WATCH', 2, 'Dòng tiền gia đình đang thiếu hụt hàng tháng', ['monthly_non_investment_income', 'monthly_family_expense', 'monthly_deficit']),
  rule('INVESTMENT_FUNDS_LIVING_COST', cmp('annual_cashflow_burden', '>', 0), 'HIGH', 1, 'Tài khoản đầu tư đang phải gánh một phần cuộc sống', ['monthly_deficit', 'deficit_funding_investment_share', 'annual_cashflow_burden']),
  rule('LOW_RESERVE', cmp('reserve_months', '<', assumption('RESERVE_HIGH_RISK_MONTHS')), 'HIGH', 1, 'Lớp đệm tiền mặt đang mỏng', ['liquid_reserve', 'monthly_family_expense', 'reserve_months']),
  rule('RESERVE_WATCH', all(cmp('reserve_months', '>=', assumption('RESERVE_HIGH_RISK_MONTHS')), cmp('reserve_months', '<', assumption('RESERVE_WATCH_MONTHS'))), 'WATCH', 3, 'Quỹ dự phòng chưa thật sự dày', ['reserve_months']),
  rule('NEAR_TERM_LIABILITY', cmp('near_term_investment_burden', '>', 0), 'WATCH', 2, 'Có khoản tiền sắp cần rút khỏi tài khoản', ['near_term_investment_burden']),
  rule('REQUIRED_RETURN_HIGH', cmp('required_return_target_total', '>=', assumptionMultiplier('PLANNING_REFERENCE_RETURN', 2)), 'HIGH', 1, 'Khoảng cách tới mục tiêu không nên chỉ giải bằng trade tốt hơn', ['required_return_target_total', 'planning_reference_return']),
  rule('REQUIRED_RETURN_EXTREME', cmp('required_return_target_total', '>=', assumptionMultiplier('PLANNING_REFERENCE_RETURN', 3)), 'CRITICAL', 1, 'Cấu trúc hiện tại đang yêu cầu tài khoản làm một nhiệm vụ quá nặng', ['required_return_target_total', 'planning_reference_return', 'total_investment_cost']),
  rule('OWN_CAPITAL_PRESSURE', cmp('required_return_target_own', '>', fieldMultiplier('required_return_target_total', 1.25)), 'HIGH', 2, 'Áp lực trên vốn thật cao hơn nhiều so với cảm giác nhìn số dư tài khoản', ['own_capital', 'investment_capital', 'required_return_target_total', 'required_return_target_own'])
]);

const REDUNDANT_RULES = Object.freeze({
  REQUIRED_RETURN_EXTREME: ['REQUIRED_RETURN_HIGH'],
  INVESTMENT_COST_EXCEEDS_PLAN: ['INVESTMENT_COST_HIGH'],
  LOW_RESERVE: ['RESERVE_WATCH']
});

const PRIMARY_BUCKETS = Object.freeze([
  ['DOUBLE_LEVERAGE', 'INVESTMENT_FUNDS_LIVING_COST', 'REQUIRED_RETURN_EXTREME', 'OWN_CAPITAL_PRESSURE', 'INVESTMENT_COST_EXCEEDS_PLAN', 'NEAR_TERM_LIABILITY'],
  ['INVESTMENT_COST_HIGH', 'LOW_RESERVE', 'REQUIRED_RETURN_HIGH', 'EXPECTATION_VERY_HIGH'],
  ['TRADING_FRICTION_HIGH', 'CASHFLOW_DEFICIT', 'EXPECTATION_STRETCH', 'RESERVE_WATCH', 'NO_CLEAR_GOAL']
]);

export function diagnoseInvestmentAssessment(calculationResult, options = {}) {
  const context = buildDiagnosisContext(calculationResult);
  const rules = options.rules || DEFAULT_DIAGNOSIS_RULES;
  const diagnosisVersion = options.diagnosisVersion || calculationResult?.diagnosisVersion || 'diagnosis_v1';
  const triggered = [];

  for (const config of rules) {
    const normalizedRule = normalizeRule(config);
    if (!evaluateCondition(normalizedRule.condition_json, context)) continue;
    const evidence = buildEvidence(normalizedRule.evidence_fields, context);
    if (!hasNumericEvidence(evidence)) continue;
    const contributingMetrics = Object.keys(evidence).filter((key) => typeof evidence[key] === 'number' && Number.isFinite(evidence[key]));
    triggered.push({
      rule_code: normalizedRule.rule_code,
      severity: normalizedRule.severity,
      priority: Number(normalizedRule.priority),
      title: normalizedRule.message_key,
      message_key: normalizedRule.message_key,
      evidence_json: evidence,
      contributing_metrics: contributingMetrics,
      diagnosis_version: diagnosisVersion,
      financial_impact: estimateFinancialImpact(normalizedRule.rule_code, context),
      evidence_strength: contributingMetrics.length
    });
  }

  const filtered = removeRedundantInsights(triggered);
  const ranked = filtered.sort(compareInsights);
  const primaryCodes = selectPrimaryInsights(ranked, options.maxPrimary ?? 3).map((item) => item.rule_code);
  const insights = ranked.map((item) => ({
    ...item,
    is_primary: primaryCodes.includes(item.rule_code)
  }));

  return {
    diagnosisVersion,
    primaryInsights: insights.filter((item) => item.is_primary),
    secondaryInsights: insights.filter((item) => !item.is_primary),
    insights
  };
}

export function buildDiagnosisContext(calculationResult = {}) {
  const metrics = calculationResult.metrics || calculationResult;
  const normalized = calculationResult.normalized || {};
  const assumptions = calculationResult.assumptions || {};
  return {
    ...normalized,
    ...metrics,
    purpose_code: normalized.purposeCode ?? normalized.purpose_code ?? calculationResult.purposeCode ?? calculationResult.purpose_code ?? null,
    goal_payload: normalized.goalPayload ?? normalized.goal_payload ?? calculationResult.goalPayload ?? calculationResult.goal_payload ?? null,
    planning_reference_return: metrics.planning_reference_return ?? assumptions.planningReferenceReturn ?? 0.15,
    RESERVE_HIGH_RISK_MONTHS: assumptions.reserveHighRiskMonths ?? 3,
    RESERVE_WATCH_MONTHS: assumptions.reserveWatchMonths ?? 6,
    PLANNING_REFERENCE_RETURN: assumptions.planningReferenceReturn ?? metrics.planning_reference_return ?? 0.15,
    TRADING_FRICTION_WATCH_RATE: assumptions.tradingFrictionWatchRate ?? 0.05
  };
}

export function evaluateCondition(condition, context) {
  if (!condition) return false;
  if (condition.all) return condition.all.every((child) => evaluateCondition(child, context));
  if (condition.any) return condition.any.some((child) => evaluateCondition(child, context));

  const left = readValue(context, condition.field);
  const right = resolveOperand(condition, context);

  switch (condition.op) {
    case '=': return left === right;
    case '!=': return left !== right;
    case '>': return Number(left) > Number(right);
    case '>=': return Number(left) >= Number(right);
    case '<': return Number(left) < Number(right);
    case '<=': return Number(left) <= Number(right);
    case 'is_null': return left === null || left === undefined;
    case 'is_not_null': return left !== null && left !== undefined;
    default: throw new Error(`Unsupported diagnosis operator: ${condition.op}`);
  }
}

export function compareInsights(a, b) {
  return (a.priority - b.priority)
    || ((SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0))
    || ((b.financial_impact || 0) - (a.financial_impact || 0))
    || ((b.evidence_strength || 0) - (a.evidence_strength || 0))
    || a.rule_code.localeCompare(b.rule_code);
}

function comparePrimaryPressure(a, b) {
  return ((SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0))
    || ((b.financial_impact || 0) - (a.financial_impact || 0))
    || (a.priority - b.priority)
    || a.rule_code.localeCompare(b.rule_code);
}

function selectPrimaryInsights(ranked, maxPrimary) {
  const eligible = ranked.filter((item) => ['CRITICAL', 'HIGH'].includes(item.severity) || item.priority <= 2 || item.rule_code === 'NO_CLEAR_GOAL');
  const selected = [];

  for (const [bucketIndex, bucket] of PRIMARY_BUCKETS.entries()) {
    const bucketItems = eligible.filter((item) => bucket.includes(item.rule_code));
    const ordered = bucketIndex === 0
      ? bucketItems.sort(comparePrimaryPressure)
      : bucket.map((code) => bucketItems.find((item) => item.rule_code === code)).filter(Boolean);
    for (const item of ordered) {
      if (selected.length >= maxPrimary) return selected;
      if (!selected.some((existing) => existing.rule_code === item.rule_code)) selected.push(item);
    }
    if (selected.length >= maxPrimary) return selected;
  }

  for (const item of eligible) {
    if (selected.length >= maxPrimary) return selected;
    if (!selected.some((existing) => existing.rule_code === item.rule_code)) selected.push(item);
  }
  return selected;
}

function removeRedundantInsights(insights) {
  const triggered = new Set(insights.map((item) => item.rule_code));
  const suppressed = new Set();
  for (const [stronger, weakerList] of Object.entries(REDUNDANT_RULES)) {
    if (triggered.has(stronger)) weakerList.forEach((code) => suppressed.add(code));
  }
  return insights.filter((item) => !suppressed.has(item.rule_code));
}

function buildEvidence(fields, context) {
  const evidence = {};
  const requested = Array.isArray(fields) ? fields : [];
  for (const field of requested) {
    const key = normalizeFieldName(field);
    const value = readValue(context, key);
    if (value !== undefined) evidence[key] = value;
  }
  if (!hasNumericEvidence(evidence)) {
    for (const field of NUMERIC_EVIDENCE_FALLBACKS) {
      const value = readValue(context, field);
      if (typeof value === 'number' && Number.isFinite(value)) evidence[field] = value;
      if (hasNumericEvidence(evidence)) break;
    }
  }
  return evidence;
}

function hasNumericEvidence(evidence) {
  return Object.values(evidence).some((value) => typeof value === 'number' && Number.isFinite(value));
}

function estimateFinancialImpact(ruleCode, context) {
  const m = context;
  const impactMap = {
    DOUBLE_LEVERAGE: (m.external_loan || 0) + (m.avg_margin_est || 0) + (m.annual_external_interest || 0) + (m.annual_margin_interest || 0),
    INVESTMENT_FUNDS_LIVING_COST: m.annual_cashflow_burden || 0,
    REQUIRED_RETURN_EXTREME: m.required_cash_target || 0,
    REQUIRED_RETURN_HIGH: m.required_cash_target || 0,
    OWN_CAPITAL_PRESSURE: Math.max((m.required_return_target_own || 0) - (m.required_return_target_total || 0), 0) * (m.own_capital || m.investment_capital || 0),
    INVESTMENT_COST_EXCEEDS_PLAN: m.total_investment_cost || 0,
    INVESTMENT_COST_HIGH: m.total_investment_cost || 0,
    TRADING_FRICTION_HIGH: m.annual_trading_friction || 0,
    CASHFLOW_DEFICIT: (m.monthly_deficit || 0) * 12,
    LOW_RESERVE: Math.max((m.RESERVE_HIGH_RISK_MONTHS || 3) - (m.reserve_months || 0), 0) * (m.monthly_family_expense || 0),
    RESERVE_WATCH: Math.max((m.RESERVE_WATCH_MONTHS || 6) - (m.reserve_months || 0), 0) * (m.monthly_family_expense || 0),
    NEAR_TERM_LIABILITY: m.near_term_investment_burden || 0,
    EXPECTATION_VERY_HIGH: m.target_annual_cash || 0,
    EXPECTATION_STRETCH: m.target_annual_cash || 0,
    NO_CLEAR_GOAL: m.investment_capital || 0
  };
  return impactMap[ruleCode] || 0;
}

function normalizeRule(config) {
  return {
    rule_code: config.rule_code || config.ruleCode,
    condition_json: config.condition_json || config.conditionJson || config.condition,
    severity: config.severity,
    priority: config.priority,
    message_key: config.message_key || config.messageKey || config.title,
    evidence_fields: config.evidence_fields || config.evidenceFields || []
  };
}

function normalizeFieldName(field) {
  const key = String(field);
  const aliases = {
    target_return: 'target_return_before_cost',
    capital: 'investment_capital',
    avg_margin: 'avg_margin_est',
    investment_cost: 'total_investment_cost',
    break_even_return: 'investment_break_even_return',
    turnover: 'turnover_monthly',
    trading_friction: 'annual_trading_friction',
    monthly_income: 'monthly_non_investment_income',
    monthly_expense: 'monthly_family_expense',
    monthly_gap: 'monthly_deficit',
    reserve: 'liquid_reserve',
    amount: 'near_term_investment_burden',
    required_return_target: 'required_return_target_total',
    req_return_total: 'required_return_target_total',
    req_return_own: 'required_return_target_own',
    total_capital: 'investment_capital'
  };
  return aliases[key] || key;
}

function readValue(context, field) {
  if (!field) return undefined;
  return context[field] ?? context[toCamel(field)] ?? context[toSnake(field)];
}

function resolveOperand(condition, context) {
  if (Object.prototype.hasOwnProperty.call(condition, 'value')) return condition.value;
  if (condition.assumption) return readValue(context, condition.assumption);
  if (condition.assumption_multiplier) {
    return readValue(context, condition.assumption_multiplier.assumption) * condition.assumption_multiplier.multiplier;
  }
  if (condition.field_multiplier) {
    return readValue(context, condition.field_multiplier.field) * condition.field_multiplier.multiplier;
  }
  return undefined;
}

function rule(ruleCode, condition, severity, priority, messageKey, evidenceFields) {
  return { rule_code: ruleCode, condition_json: condition, severity, priority, message_key: messageKey, evidence_fields: evidenceFields };
}

function cmp(field, op, operand) {
  return typeof operand === 'object' && operand !== null
    ? { field, op, ...operand }
    : { field, op, value: operand };
}
function eq(field, value) { return { field, op: '=', value }; }
function isNull(field) { return { field, op: 'is_null' }; }
function all(...conditions) { return { all: conditions }; }
function any(...conditions) { return { any: conditions }; }
function assumption(name) { return { assumption: name }; }
function assumptionMultiplier(name, multiplier) { return { assumption_multiplier: { assumption: name, multiplier } }; }
function fieldMultiplier(field, multiplier) { return { field_multiplier: { field, multiplier } }; }
function toCamel(value) { return String(value).replace(/_([a-z])/g, (_, char) => char.toUpperCase()); }
function toSnake(value) { return String(value).replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`); }



