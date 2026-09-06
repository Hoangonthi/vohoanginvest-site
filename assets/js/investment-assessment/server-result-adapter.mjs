import { recoCopy, ruleCopy } from "./ui-config.mjs";

export class ServerResultAdapterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ServerResultAdapterError";
    this.code = code;
  }
}

export function adaptServerConfirmResult(serverResult, options = {}) {
  const requireConfirmed = options.requireConfirmed !== false;
  const source = unwrapServerResult(serverResult);
  const assessment = cloneJsonSafe(source.assessment || null);
  const assessmentId = source.assessment_id || assessment?.id || null;
  if (!assessmentId) throw new ServerResultAdapterError("ASSESSMENT_ID_MISSING", "Server result is missing assessment_id.");
  if (!assessment || typeof assessment !== "object") throw new ServerResultAdapterError("ASSESSMENT_MISSING", "Server result is missing assessment.");
  if (requireConfirmed && assessment.status !== "CONFIRMED") throw new ServerResultAdapterError("ASSESSMENT_NOT_CONFIRMED", "Server result is not confirmed.");

  const calculation = cloneJsonSafe(source.calculation || null);
  if (!calculation?.metrics || typeof calculation.metrics !== "object" || Array.isArray(calculation.metrics)) {
    throw new ServerResultAdapterError("METRICS_MISSING", "Server result is missing calculation.metrics.");
  }

  const diagnosis = normalizeDiagnosis(source.diagnosis);
  const recommendations = normalizeRecommendations(source.recommendations);

  return {
    source: "SERVER_CONFIRM_RESULT",
    assessment_id: assessmentId,
    assessment,
    input: null,
    calculation,
    diagnosis,
    recommendations,
    scenarios: [],
    missing: {
      input: true,
      scenarios: true,
    },
  };
}

function unwrapServerResult(serverResult) {
  if (!serverResult || typeof serverResult !== "object") {
    throw new ServerResultAdapterError("SERVER_RESULT_MISSING", "Server result is missing.");
  }
  return serverResult.result && typeof serverResult.result === "object" ? serverResult.result : serverResult;
}

function normalizeDiagnosis(diagnosis) {
  const source = diagnosis && typeof diagnosis === "object" ? diagnosis : {};
  const insights = arrayOrThrow(source.insights, "DIAGNOSIS_INSIGHTS_MALFORMED").map((item) => decorateInsight(item));
  const primaryInsights = Array.isArray(source.primaryInsights)
    ? source.primaryInsights.map((item) => decorateInsight(item))
    : insights.filter((item) => item.is_primary);
  const secondaryInsights = Array.isArray(source.secondaryInsights)
    ? source.secondaryInsights.map((item) => decorateInsight(item))
    : insights.filter((item) => !item.is_primary);
  return {
    ...cloneJsonSafe(source),
    insights,
    primaryInsights,
    secondaryInsights,
  };
}

function normalizeRecommendations(recommendations) {
  const source = recommendations && typeof recommendations === "object" ? recommendations : {};
  const rows = arrayOrThrow(source.recommendations, "RECOMMENDATIONS_MALFORMED").map((item) => decorateRecommendation(item));
  return {
    ...cloneJsonSafe(source),
    recommendations: rows,
  };
}

function decorateInsight(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new ServerResultAdapterError("DIAGNOSIS_INSIGHTS_MALFORMED", "Diagnosis insight is malformed.");
  }
  const row = cloneJsonSafe(item);
  const [localTitle, localCopy] = ruleCopy[row.rule_code] || ["Điểm cần cải thiện", row.message || "Nhận định được xác nhận bằng số liệu của anh/chị."];
  row.presentation = {
    title: row.title || localTitle,
    copy: row.copy || row.message || localCopy,
  };
  return row;
}

function decorateRecommendation(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new ServerResultAdapterError("RECOMMENDATIONS_MALFORMED", "Recommendation is malformed.");
  }
  const row = cloneJsonSafe(item);
  const [localTitle, localCopy] = recoCopy[row.reco_code] || ["Việc nên làm tiếp theo", row.message || "Nên được rà soát trong buổi trao đổi 1:1."];
  row.presentation = {
    title: row.title || localTitle,
    copy: row.copy || row.message || localCopy,
  };
  return row;
}

function arrayOrThrow(value, code) {
  if (!Array.isArray(value)) throw new ServerResultAdapterError(code, "Server result array is malformed.");
  return value;
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}