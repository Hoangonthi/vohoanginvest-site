import { normalizeInvestmentAssessmentInput } from './normalizer.mjs';

export const DEFAULT_ASSUMPTIONS = Object.freeze({
  transactionFeeRate: 0.0015,
  sellingTaxRate: 0.001,
  defaultMarginRate: 0.13,
  planningReferenceReturn: 0.15,
  monthsPerYear: 12,
  reserveHighRiskMonths: 3,
  reserveWatchMonths: 6,
  targetHighMultiplier: 2,
  targetExtremeMultiplier: 3,
  investmentCostWatchRatio: 0.5,
  tradingFrictionWatchRate: 0.05
});

export function safeDivide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function roundTiny(value) {
  if (value === null || value === undefined) return value;
  return Math.abs(value) < 1e-9 ? 0 : value;
}

export function calculateInvestmentAssessment(rawInput, assumptionOverrides = {}) {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...assumptionOverrides };
  const { normalized, errors } = normalizeInvestmentAssessmentInput(rawInput, assumptions);
  const months = assumptions.monthsPerYear;

  const investmentCapital = normalized.investmentCapital;
  const externalLoan = normalized.externalLoan;
  const ownCapital = Math.max(investmentCapital - externalLoan, 0);
  const externalLoanRatio = safeDivide(externalLoan, investmentCapital);

  const targetAnnualCash = normalized.targetCashMonthly * months;
  const targetReturnBeforeCost = safeDivide(targetAnnualCash, investmentCapital);

  const avgMarginEst = normalized.marginAmountWhenUsed * normalized.marginFrequency;
  const annualMarginInterest = avgMarginEst * normalized.marginRate;

  const annualBuyValue = investmentCapital * normalized.turnoverMonthly * months;
  const annualSellValue = annualBuyValue;
  const annualTransactionFee = (annualBuyValue + annualSellValue) * assumptions.transactionFeeRate;
  const annualSellingTax = annualSellValue * assumptions.sellingTaxRate;
  const annualTradingFriction = annualTransactionFee + annualSellingTax;
  const annualTradingFrictionRatio = safeDivide(annualTradingFriction, investmentCapital);

  const totalInvestmentCost =
    normalized.annualExternalInterest +
    annualMarginInterest +
    annualTradingFriction;
  const investmentBreakEvenReturn = safeDivide(totalInvestmentCost, investmentCapital);

  const monthlySurplus = normalized.monthlyIncome - normalized.monthlyExpense;
  const monthlyDeficit = Math.max(normalized.monthlyExpense - normalized.monthlyIncome, 0);
  const annualCashflowBurden = monthlyDeficit * months * normalized.deficitFundingInvestmentShare;
  const reserveMonths = safeDivide(normalized.liquidReserve, normalized.monthlyExpense);

  const requiredCashMaintain =
    totalInvestmentCost +
    annualCashflowBurden +
    normalized.nearTermInvestmentBurden;
  const requiredReturnMaintain = safeDivide(requiredCashMaintain, investmentCapital);

  const requiredCashTarget =
    totalInvestmentCost +
    Math.max(targetAnnualCash, annualCashflowBurden) +
    normalized.nearTermInvestmentBurden;
  const requiredReturnTargetTotal = safeDivide(requiredCashTarget, investmentCapital);
  const requiredReturnTargetOwn = safeDivide(requiredCashTarget, ownCapital);

  const metrics = {
    target_annual_cash: targetAnnualCash,
    target_return_before_cost: targetReturnBeforeCost,
    investment_capital: investmentCapital,
    external_loan: externalLoan,
    own_capital: ownCapital,
    external_loan_ratio: externalLoanRatio,
    annual_external_interest: normalized.annualExternalInterest,
    avg_margin_est: avgMarginEst,
    annual_margin_interest: annualMarginInterest,
    turnover_monthly: normalized.turnoverMonthly,
    annual_buy_value: annualBuyValue,
    annual_sell_value: annualSellValue,
    annual_transaction_fee: annualTransactionFee,
    annual_selling_tax: annualSellingTax,
    annual_trading_friction: annualTradingFriction,
    annual_trading_friction_ratio: annualTradingFrictionRatio,
    total_investment_cost: totalInvestmentCost,
    investment_break_even_return: investmentBreakEvenReturn,
    monthly_non_investment_income: normalized.monthlyIncome,
    monthly_family_expense: normalized.monthlyExpense,
    monthly_surplus: roundTiny(monthlySurplus),
    monthly_deficit: monthlyDeficit,
    annual_cashflow_burden: annualCashflowBurden,
    liquid_reserve: normalized.liquidReserve,
    reserve_months: reserveMonths,
    near_term_investment_burden: normalized.nearTermInvestmentBurden,
    deficit_funding_investment_share: normalized.deficitFundingInvestmentShare,
    required_cash_maintain: requiredCashMaintain,
    required_return_maintain: requiredReturnMaintain,
    required_cash_target: requiredCashTarget,
    required_return_target_total: requiredReturnTargetTotal,
    required_return_target_own: requiredReturnTargetOwn,
    planning_reference_return: assumptions.planningReferenceReturn,
    has_cash_goal: targetAnnualCash > 0
  };

  return {
    calculationVersion: 'calc_v1',
    assumptionVersion: 'assumptions_v1',
    assumptions,
    normalized,
    metrics,
    errors
  };
}
