import { calculateInvestmentAssessment } from './calculation-engine.mjs';

export const SCENARIO_FIELD_MAP = Object.freeze({
  externalLoan: 'externalLoan',
  external_loan: 'externalLoan',
  external_loan_amount: 'externalLoan',
  externalBorrowingRate: 'externalBorrowingRate',
  external_borrowing_rate: 'externalBorrowingRate',
  marginAmountWhenUsed: 'marginAmountWhenUsed',
  margin_amount_when_used: 'marginAmountWhenUsed',
  marginAmount: 'marginAmountWhenUsed',
  margin_amount: 'marginAmountWhenUsed',
  marginFrequency: 'marginFrequency',
  margin_frequency: 'marginFrequency',
  marginRate: 'marginRate',
  margin_rate: 'marginRate',
  turnoverMonthly: 'turnoverMonthly',
  turnover_monthly: 'turnoverMonthly',
  turnover: 'turnoverMonthly',
  deficitFundingInvestmentShare: 'deficitFundingInvestmentShare',
  deficit_funding_investment_share: 'deficitFundingInvestmentShare',
  targetCashMonthly: 'targetCashMonthly',
  target_cash_monthly: 'targetCashMonthly',
  investmentCapital: 'investmentCapital',
  investment_capital: 'investmentCapital',
  nearTermInvestmentBurden: 'nearTermInvestmentBurden',
  near_term_investment_burden: 'nearTermInvestmentBurden',
  horizonYears: 'horizonYears',
  horizon_years: 'horizonYears'
});

export const KEY_SCENARIO_METRICS = Object.freeze([
  'investment_break_even_return',
  'required_return_maintain',
  'required_return_target_total',
  'required_return_target_own'
]);

export function runInvestmentScenario(baseInput, scenarioInput = {}, options = {}) {
  const preparedScenario = applyScenarioDelta(baseInput, scenarioInput);
  const baseResult = calculateInvestmentAssessment(baseInput, options.assumptionOverrides || {});
  const scenarioResult = calculateInvestmentAssessment(preparedScenario.input, options.assumptionOverrides || {});
  const comparedMetrics = compareScenarioMetrics(baseResult.metrics, scenarioResult.metrics, options.metrics || KEY_SCENARIO_METRICS);

  return {
    scenarioName: scenarioInput.scenarioName || scenarioInput.scenario_name || null,
    scenarioInputJson: preparedScenario.persistedInput,
    baseInput,
    scenarioInput: preparedScenario.input,
    calculationVersion: scenarioResult.calculationVersion,
    baseMetrics: pickMetrics(baseResult.metrics, options.metrics || KEY_SCENARIO_METRICS),
    scenarioMetrics: pickMetrics(scenarioResult.metrics, options.metrics || KEY_SCENARIO_METRICS),
    comparedMetrics,
    outputMetrics: {
      calculation_version: scenarioResult.calculationVersion,
      metrics: comparedMetrics
    },
    errors: [...baseResult.errors, ...scenarioResult.errors]
  };
}

export function runScenarioSet(baseInput, scenarios, options = {}) {
  return scenarios.map((scenario) => runInvestmentScenario(baseInput, scenario, options));
}

export function applyScenarioDelta(baseInput, scenarioInput = {}) {
  const next = deepClone(baseInput || {});
  const persistedInput = {};

  for (const [rawKey, rawValue] of Object.entries(scenarioInput || {})) {
    if (['scenarioName', 'scenario_name'].includes(rawKey)) {
      persistedInput[rawKey] = rawValue;
      continue;
    }
    if (rawKey === 'output_metrics' || rawKey === 'outputMetrics') {
      continue;
    }
    const key = SCENARIO_FIELD_MAP[rawKey];
    if (!key) continue;
    const value = applyDeltaValue(next[key], rawValue);
    if (key === 'externalBorrowingRate') {
      next.annualExternalInterest = (Number(next.externalLoan) || 0) * Number(value || 0);
      persistedInput.externalBorrowingRate = value;
      persistedInput.annualExternalInterest = next.annualExternalInterest;
    } else {
      const previousValue = next[key];
      next[key] = value;
      persistedInput[key] = value;
      if (key === 'externalLoan') {
        if (Object.prototype.hasOwnProperty.call(scenarioInput, 'externalBorrowingRate') || Object.prototype.hasOwnProperty.call(scenarioInput, 'external_borrowing_rate')) {
          const rate = Number(scenarioInput.externalBorrowingRate || scenarioInput.external_borrowing_rate || 0);
          next.annualExternalInterest = next.externalLoan * rate;
        } else if ((Number(previousValue) || 0) > 0) {
          next.annualExternalInterest = (Number(next.annualExternalInterest) || 0) * ((Number(next.externalLoan) || 0) / Number(previousValue));
        } else if ((Number(next.externalLoan) || 0) === 0) {
          next.annualExternalInterest = 0;
        }
        persistedInput.annualExternalInterest = next.annualExternalInterest;
      }
    }
  }

  return { input: next, persistedInput };
}

export function compareScenarioMetrics(baseMetrics, scenarioMetrics, metricCodes = KEY_SCENARIO_METRICS) {
  const rows = {};
  for (const metricCode of metricCodes) {
    const baseValue = baseMetrics[metricCode];
    const scenarioValue = scenarioMetrics[metricCode];
    rows[metricCode] = {
      base_value: baseValue,
      scenario_value: scenarioValue,
      delta: numericDelta(scenarioValue, baseValue),
      delta_percentage_points: isRatioMetric(metricCode) ? numericDelta(scenarioValue, baseValue) : null
    };
  }
  return rows;
}

function pickMetrics(metrics, keys) {
  return Object.fromEntries(keys.map((key) => [key, metrics[key]]));
}

function applyDeltaValue(baseValue, scenarioValue) {
  if (scenarioValue && typeof scenarioValue === 'object' && !Array.isArray(scenarioValue)) {
    if (Object.prototype.hasOwnProperty.call(scenarioValue, 'set')) return scenarioValue.set;
    if (Object.prototype.hasOwnProperty.call(scenarioValue, 'value')) return scenarioValue.value;
    if (Object.prototype.hasOwnProperty.call(scenarioValue, 'delta')) return (Number(baseValue) || 0) + Number(scenarioValue.delta || 0);
    if (Object.prototype.hasOwnProperty.call(scenarioValue, 'multiply')) return (Number(baseValue) || 0) * Number(scenarioValue.multiply || 0);
  }
  return scenarioValue;
}

function numericDelta(a, b) {
  return typeof a === 'number' && typeof b === 'number' ? a - b : null;
}

function isRatioMetric(metricCode) {
  return metricCode.includes('return') || metricCode.includes('ratio');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

