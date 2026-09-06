export const MONEY_FIELDS = [
  'targetCashMonthly',
  'investmentCapital',
  'externalLoan',
  'annualExternalInterest',
  'marginAmountWhenUsed',
  'monthlyIncome',
  'monthlyExpense',
  'liquidReserve',
  'nearTermInvestmentBurden'
];

export const RATIO_FIELDS = [
  'marginFrequency',
  'marginRate',
  'turnoverMonthly',
  'deficitFundingInvestmentShare'
];

function isNil(value) {
  return value === null || value === undefined || value === '';
}

export function toNumber(value, field, errors, { min = null, defaultValue = 0 } = {}) {
  if (isNil(value)) return defaultValue;
  const numberValue = typeof value === 'number'
    ? value
    : Number(String(value).replace(/,/g, '').trim());

  if (!Number.isFinite(numberValue)) {
    errors.push({ field, code: 'INVALID_NUMBER', message: `${field} must be a finite number.` });
    return defaultValue;
  }

  if (min !== null && numberValue < min) {
    errors.push({ field, code: 'VALUE_BELOW_MIN', message: `${field} must be >= ${min}.` });
  }

  return numberValue;
}

export function sumMonthlyItems(items, amountKey = 'amountMonthly') {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.reduce((sum, item) => sum + Number(item?.[amountKey] || 0), 0);
}

export function normalizeExpenseTotal(raw) {
  const items = Array.isArray(raw.expenseItems) ? raw.expenseItems : [];
  const totalEstimateItems = items.filter((item) => item?.type === 'TOTAL_ESTIMATE' || item?.expenseType === 'TOTAL_ESTIMATE');

  if (totalEstimateItems.length > 0) {
    return sumMonthlyItems(totalEstimateItems);
  }

  const itemTotal = sumMonthlyItems(items);
  return itemTotal === null ? raw.monthlyExpense : itemTotal;
}

export function normalizeIncomeTotal(raw) {
  const items = Array.isArray(raw.incomeItems) ? raw.incomeItems : [];
  const totalEstimateItems = items.filter((item) => item?.type === 'TOTAL_ESTIMATE' || item?.incomeType === 'TOTAL_ESTIMATE');

  if (totalEstimateItems.length > 0) {
    return sumMonthlyItems(totalEstimateItems);
  }

  const itemTotal = sumMonthlyItems(items);
  return itemTotal === null ? raw.monthlyIncome : itemTotal;
}

export function normalizeInvestmentAssessmentInput(raw = {}, assumptions = {}) {
  const errors = [];
  const normalized = {};

  for (const field of MONEY_FIELDS) {
    normalized[field] = toNumber(raw[field], field, errors, { min: 0, defaultValue: 0 });
  }

  normalized.monthlyIncome = toNumber(normalizeIncomeTotal(raw), 'monthlyIncome', errors, { min: 0, defaultValue: 0 });
  normalized.monthlyExpense = toNumber(normalizeExpenseTotal(raw), 'monthlyExpense', errors, { min: 0, defaultValue: 0 });

  normalized.marginFrequency = toNumber(raw.marginFrequency, 'marginFrequency', errors, { min: 0, defaultValue: 0 });
  normalized.marginRate = toNumber(
    raw.marginRate,
    'marginRate',
    errors,
    { min: 0, defaultValue: assumptions.defaultMarginRate ?? 0.13 }
  );
  normalized.turnoverMonthly = toNumber(raw.turnoverMonthly, 'turnoverMonthly', errors, { min: 0, defaultValue: 0 });
  normalized.deficitFundingInvestmentShare = toNumber(
    raw.deficitFundingInvestmentShare,
    'deficitFundingInvestmentShare',
    errors,
    { min: 0, defaultValue: 0 }
  );

  if (normalized.marginFrequency > 1) {
    errors.push({ field: 'marginFrequency', code: 'RATIO_ABOVE_ONE', message: 'marginFrequency must be <= 1.' });
  }

  if (normalized.deficitFundingInvestmentShare > 1) {
    errors.push({
      field: 'deficitFundingInvestmentShare',
      code: 'RATIO_ABOVE_ONE',
      message: 'deficitFundingInvestmentShare must be <= 1.'
    });
  }

  normalized.purposeCode = raw.purposeCode || raw.purpose_code || null;
  normalized.goalPayload = raw.goalPayload || raw.goal_payload || null;
  normalized.dependentsCount = toNumber(raw.dependentsCount, 'dependentsCount', errors, { min: 0, defaultValue: 0 });

  return { normalized, errors };
}
