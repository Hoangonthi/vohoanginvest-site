import { calculateInvestmentAssessment } from "./calculation-engine.mjs";
import { diagnoseInvestmentAssessment } from "./diagnosis-engine.mjs";
import { recommendInvestmentActions } from "./recommendation-engine.mjs";
import { runScenarioSet, runInvestmentScenario } from "./scenario-engine.mjs";

const SCENARIO_NO_MARGIN = "Kh\u00f4ng d\u00f9ng margin";
const SCENARIO_NO_DEFICIT_WITHDRAWAL = "Kh\u00f4ng r\u00fat ti\u1ec1n s\u1ed1ng t\u1eeb t\u00e0i kho\u1ea3n";
const SCENARIO_REDUCE_EXTERNAL_LOAN = "Gi\u1ea3m vay ngo\u00e0i";
const SCENARIO_REDUCE_CASH_GOAL = "M\u1ee5c ti\u00eau 3 tri\u1ec7u/th\u00e1ng";
const SCENARIO_COMBINED = "K\u1ecbch b\u1ea3n c\u1ea3i thi\u1ec7n k\u1ebft h\u1ee3p";
const SCENARIO_CUSTOM = "T\u1ef1 \u0111i\u1ec1u ch\u1ec9nh";
const MILLION_LABEL = "tri\u1ec7u";
const VND_SYMBOL = "\u20ab";

export function syncDerivedInput(input) {
  const next = structuredClone(input);
  if (next.purposeCode === "NO_CLEAR_GOAL" || next.purposeCode === "LEARNING") {
    next.targetCashMonthly = 0;
    next.goalPayload = null;
  } else {
    next.goalPayload = { cash_monthly: Number(next.targetCashMonthly || 0) };
  }
  if (Number(next.externalLoan || 0) <= 0) {
    next.externalLoan = 0;
    next.annualExternalInterest = 0;
  }
  if (Number(next.marginFrequency || 0) <= 0 || Number(next.marginAmountWhenUsed || 0) <= 0) {
    next.marginAmountWhenUsed = 0;
    next.marginFrequency = 0;
  }
  return next;
}

export function buildAssessmentModel(rawInput) {
  const input = syncDerivedInput(rawInput);
  const calculation = calculateInvestmentAssessment(input);
  const diagnosis = diagnoseInvestmentAssessment(calculation);
  const recommendations = recommendInvestmentActions(diagnosis, calculation);
  const scenarios = buildRelevantScenarios(input, diagnosis, recommendations);
  return { input, calculation, diagnosis, recommendations, scenarios };
}

export function buildRelevantScenarios(input, diagnosis, recommendations) {
  const recoCodes = new Set(recommendations.recommendations.map((item) => item.reco_code));
  const rows = [];
  if (Number(input.marginAmountWhenUsed || 0) > 0 && Number(input.marginFrequency || 0) > 0) rows.push({ scenarioName: SCENARIO_NO_MARGIN, marginAmountWhenUsed: 0, marginFrequency: 0 });
  if (Number(input.deficitFundingInvestmentShare || 0) > 0) rows.push({ scenarioName: SCENARIO_NO_DEFICIT_WITHDRAWAL, deficitFundingInvestmentShare: 0 });
  if (Number(input.externalLoan || 0) > 0) rows.push({ scenarioName: SCENARIO_REDUCE_EXTERNAL_LOAN, externalLoan: Math.round(Number(input.externalLoan) * 0.5) });
  if (Number(input.targetCashMonthly || 0) > 0 && (recoCodes.has("R_REFRAME_EXPECTATION") || diagnosis.primaryInsights.some((item) => item.rule_code.includes("RETURN")))) rows.push({ scenarioName: SCENARIO_REDUCE_CASH_GOAL, targetCashMonthly: Math.min(Number(input.targetCashMonthly), 3000000) });
  const combined = { scenarioName: SCENARIO_COMBINED };
  if (Number(input.marginAmountWhenUsed || 0) > 0) Object.assign(combined, { marginAmountWhenUsed: 0, marginFrequency: 0 });
  if (Number(input.deficitFundingInvestmentShare || 0) > 0) combined.deficitFundingInvestmentShare = 0;
  if (Number(input.externalLoan || 0) > 0) Object.assign(combined, { externalLoan: 0, annualExternalInterest: 0 });
  if (Number(input.targetCashMonthly || 0) > 3000000) combined.targetCashMonthly = 3000000;
  if (Object.keys(combined).length > 1) rows.push(combined);
  return runScenarioSet(input, rows.slice(0, 5));
}

export function buildCustomScenario(input) {
  return runInvestmentScenario(input, {
    scenarioName: SCENARIO_CUSTOM,
    marginAmountWhenUsed: Math.round(Number(input.marginAmountWhenUsed || 0) * 0.5),
    deficitFundingInvestmentShare: Math.max(0, Number(input.deficitFundingInvestmentShare || 0) - 0.25),
    targetCashMonthly: Number(input.targetCashMonthly || 0) > 0 ? Math.round(Number(input.targetCashMonthly) * 0.8) : 0
  });
}

export function formatMoney(value, compact = false) {
  const number = Number(value || 0);
  if (compact && Math.abs(number) >= 1000000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(number / 1000000)} ${MILLION_LABEL}`;
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(number))} ${VND_SYMBOL}`;
}

export function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value) * 100)}%`;
}

export function parseMoney(value) {
  const number = Number(String(value || "").replace(/[^0-9-]/g, ""));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
