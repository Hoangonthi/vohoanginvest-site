import { openModal, showToast, supabaseClient } from "./supabase-client.js";
import { setContactContext } from "./contact.js";
import { claimInvestmentAssessment, confirmInvestmentAssessment, listInvestmentAssessmentHistory, loadInvestmentAssessment, runInvestmentAssessmentScenario, saveInvestmentAssessmentDraft, startInvestmentAssessment } from "./investment-assessment/edge-client.mjs";
import { adaptServerConfirmResult } from "./investment-assessment/server-result-adapter.mjs";
import { buildAssessmentModel, formatMoney, formatPercent, parseMoney } from "./investment-assessment/ui-model.mjs";
import { defaultState, draftKey, expenseTypes, incomeTypes, marginChoices, purposeOptions, recoCopy, resultKey, ruleCopy, stageLabels, turnoverChoices } from "./investment-assessment/ui-config.mjs";

export const realityCheckServerSessionKey = "vh_investment_reality_server_session_v1";
export const realityCheckServerResultKey = "vh_investment_reality_server_result_v1";

const terminalLoadStatuses = new Set([401, 403, 404]);
const terminalSaveStatuses = new Set([401, 403, 404, 409]);
const terminalScenarioStatuses = new Set([401, 403, 404, 409]);
const serverInputFields = [
  "purposeCode",
  "purpose_code",
  "targetCashMonthly",
  "target_cash_monthly",
  "investmentCapital",
  "investment_capital",
  "externalLoan",
  "external_loan",
  "annualExternalInterest",
  "annual_external_interest",
  "marginAmountWhenUsed",
  "margin_amount_when_used",
  "marginFrequency",
  "margin_frequency",
  "marginRate",
  "margin_rate",
  "turnoverMonthly",
  "turnover_monthly",
  "incomeItems",
  "income_items",
  "expenseItems",
  "expense_items",
  "dependentsCount",
  "dependents_count",
  "liquidReserve",
  "liquid_reserve",
  "nearTermInvestmentBurden",
  "near_term_investment_burden",
  "deficitFundingInvestmentShare",
  "deficit_funding_investment_share",
  "goalPayload",
  "goal_payload",
];

let state = defaultState();
let saveTimer = null;
let isSaving = false;
let lastError = "";
let serverSaveInFlight = false;
let pendingServerInput = null;
let serverSavePromise = null;
let serverConfirmInFlight = false;
let serverScenarioInFlight = false;
let serverScenarioResult = null;
let serverHistoryRows = [];
let serverHistoryLoaded = false;

function root() { return document.querySelector("[data-assessment-root]"); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function hasDraft() { return Boolean(localStorage.getItem(draftKey)); }
function model() { return buildAssessmentModel(state.input); }

export async function ensureRealityCheckServerSession(options = {}) {
  const storage = options.storage || localStorage;
  const startFn = options.startFn || startInvestmentAssessment;
  const loadFn = options.loadFn || loadInvestmentAssessment;
  const renderFn = options.renderFn || render;
  const now = options.now || (() => new Date().toISOString());
  const existing = readServerSession(storage);
  if (existing?.assessment_id) {
    const loadResult = await loadServerSession(existing, { storage, loadFn, renderFn });
    return { ok: loadResult.ok, session: existing, reused: true, ...loadResult };
  }

  try {
    const result = await startFn();
    const assessmentId = result?.assessment?.id || result?.assessment_id || null;
    if (!assessmentId) return { ok: false, reused: false };
    const timestamp = now();
    const session = {
      assessment_id: assessmentId,
      mode: result?.access_token ? "ANONYMOUS" : "AUTHENTICATED",
      created_at: timestamp,
      updated_at: timestamp,
    };
    if (result?.access_token) session.access_token = result.access_token;
    storage.setItem(realityCheckServerSessionKey, JSON.stringify(session));
    return { ok: true, session, reused: false };
  } catch {
    return { ok: false, reused: false };
  }
}

async function loadServerSession(session, { storage, loadFn, renderFn }) {
  try {
    const loaded = await loadFn({ assessmentId: session.assessment_id, accessToken: session.access_token });
    const hydrated = !hasUsableLocalDraft(storage) && hydrateServerInput(loaded?.input);
    if (hydrated) renderFn();
    return { ok: true, loaded: true, hydrated, cleared: false };
  } catch (error) {
    if (terminalLoadStatuses.has(Number(error?.status))) {
      storage.removeItem(realityCheckServerSessionKey);
      return { ok: false, loaded: false, hydrated: false, cleared: true };
    }
    return { ok: false, loaded: false, hydrated: false, cleared: false };
  }
}

function readServerSession(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(realityCheckServerSessionKey) || "null");
    return parsed?.assessment_id ? parsed : null;
  } catch {
    return null;
  }
}

function hasUsableLocalDraft(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(draftKey) || "null");
    return Boolean(parsed?.input);
  } catch {
    return false;
  }
}

function hydrateServerInput(input) {
  if (!input || typeof input !== "object") return false;
  const safeInput = {};
  for (const key of serverInputFields) {
    if (Object.prototype.hasOwnProperty.call(input, key)) safeInput[key] = input[key];
  }
  if (!Object.keys(safeInput).length) return false;
  state.input = { ...defaultState().input, ...safeInput };
  state.screen = "flow";
  return true;
}

export function queueRealityCheckServerDraftSave(input, options = {}) {
  const storage = options.storage || localStorage;
  const session = readServerSession(storage);
  if (!session?.assessment_id) return { queued: false, reason: "NO_SERVER_SESSION" };
  pendingServerInput = sanitizedUserInput(input);
  if (!serverSaveInFlight) serverSavePromise = flushRealityCheckServerDraftSave({ storage, saveFn: options.saveFn || saveInvestmentAssessmentDraft });
  return { queued: true, promise: serverSavePromise };
}

export async function flushRealityCheckServerDraftSave(options = {}) {
  if (serverSaveInFlight) return serverSavePromise || { flushed: false, reason: "IN_FLIGHT" };
  const storage = options.storage || localStorage;
  const saveFn = options.saveFn || saveInvestmentAssessmentDraft;
  const run = (async () => {
    if (!readServerSession(storage)?.assessment_id || !pendingServerInput) return { flushed: false, reason: "NOTHING_TO_SAVE" };
    serverSaveInFlight = true;
    try {
      while (pendingServerInput && readServerSession(storage)?.assessment_id) {
        const session = readServerSession(storage);
        const input = pendingServerInput;
        pendingServerInput = null;
        try {
          await saveFn({ assessmentId: session.assessment_id, accessToken: session.access_token, input });
        } catch (error) {
          if (terminalSaveStatuses.has(Number(error?.status))) storage.removeItem(realityCheckServerSessionKey);
          return { flushed: false, reason: "SAVE_FAILED" };
        }
      }
      return { flushed: true };
    } finally {
      serverSaveInFlight = false;
    }
  })();
  const tracked = run.finally(() => {
    if (serverSavePromise === tracked) serverSavePromise = null;
  });
  serverSavePromise = tracked;
  return tracked;
}
export function sanitizedUserInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const clean = {};
  for (const key of Object.keys(defaultState().input)) {
    if (Object.prototype.hasOwnProperty.call(source, key)) clean[key] = cloneJsonSafe(source[key]);
  }
  return clean;
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
export async function claimRealityCheckServerSession(options = {}) {
  const storage = options.storage || localStorage;
  const claimFn = options.claimFn || claimInvestmentAssessment;
  const now = options.now || (() => new Date().toISOString());
  const session = readServerSession(storage);
  if (!session?.assessment_id || !session.access_token) return { claimed: false, reason: "NO_GUEST_SESSION" };
  if (!await hasAuthenticatedSession(options.supabase || supabaseClient)) return { claimed: false, reason: "AUTH_REQUIRED" };
  try {
    const result = await claimFn({ assessmentId: session.assessment_id, accessToken: session.access_token });
    const claimedSession = { ...session, mode: "AUTHENTICATED", claimed_at: now(), updated_at: now() };
    delete claimedSession.access_token;
    storage.setItem(realityCheckServerSessionKey, JSON.stringify(claimedSession));
    return { claimed: true, result, session: claimedSession };
  } catch (error) {
    return { claimed: false, reason: Number(error?.status) === 401 ? "AUTH_REQUIRED" : "CLAIM_FAILED" };
  }
}

export async function loadRealityCheckHistory(options = {}) {
  const listFn = options.listFn || listInvestmentAssessmentHistory;
  const renderFn = options.renderFn || render;
  if (!await hasAuthenticatedSession(options.supabase || supabaseClient)) {
    serverHistoryRows = [];
    serverHistoryLoaded = false;
    return { ok: false, reason: "AUTH_REQUIRED" };
  }
  try {
    const result = await listFn({ customerId: options.customerId });
    serverHistoryRows = Array.isArray(result?.assessments) ? result.assessments : [];
    serverHistoryLoaded = true;
    if (options.render !== false) renderFn();
    return { ok: true, assessments: serverHistoryRows };
  } catch (error) {
    serverHistoryRows = [];
    serverHistoryLoaded = false;
    return { ok: false, reason: Number(error?.status) === 401 ? "AUTH_REQUIRED" : "HISTORY_FAILED" };
  }
}

export async function runRealityCheckServerScenario(scenarioInput, options = {}) {
  if (serverScenarioInFlight) return { ok: false, reason: "IN_FLIGHT" };
  const storage = options.storage || localStorage;
  const runFn = options.runFn || runInvestmentAssessmentScenario;
  const renderFn = options.renderFn || render;
  const selected = selectRealityCheckResult({ storage });
  const session = readServerSession(storage);
  if (selected.source !== "SERVER_CONFIRM_RESULT" || !session?.assessment_id || session.assessment_id !== selected.assessment_id) {
    return { ok: false, reason: "NO_SERVER_RESULT" };
  }
  serverScenarioInFlight = true;
  try {
    const result = await runFn({ assessmentId: session.assessment_id, accessToken: session.access_token, scenarioInput: sanitizeServerScenarioInput(scenarioInput) });
    serverScenarioResult = { assessment_id: session.assessment_id, result: normalizeServerScenarioResult(result) };
    if (options.render !== false) renderFn();
    return { ok: true, ...serverScenarioResult };
  } catch (error) {
    if (terminalScenarioStatuses.has(Number(error?.status))) return { ok: false, reason: "SCENARIO_DENIED" };
    return { ok: false, reason: "SCENARIO_FAILED" };
  } finally {
    serverScenarioInFlight = false;
  }
}

async function hasAuthenticatedSession(supabase) {
  try {
    const result = await supabase?.auth?.getSession?.();
    return Boolean(result?.data?.session?.access_token);
  } catch {
    return false;
  }
}
export async function confirmRealityCheckServerResult(options = {}) {
  if (serverConfirmInFlight) return { confirmed: false, reason: "IN_FLIGHT" };
  const storage = options.storage || localStorage;
  const saveFn = options.saveFn || saveInvestmentAssessmentDraft;
  const confirmFn = options.confirmFn || confirmInvestmentAssessment;
  const now = options.now || (() => new Date().toISOString());
  const session = readServerSession(storage);
  if (!session?.assessment_id) return { confirmed: false, reason: "NO_SERVER_SESSION" };

  const cached = readServerResult(storage);
  if (cached?.assessment_id === session.assessment_id && cached?.assessment?.status === "CONFIRMED") {
    return { confirmed: false, reason: "ALREADY_CONFIRMED", cached };
  }

  serverConfirmInFlight = true;
  try {
    const queued = queueRealityCheckServerDraftSave(options.input || state.input, { storage, saveFn });
    if (queued?.promise) await queued.promise;
    else await flushRealityCheckServerDraftSave({ storage, saveFn });

    const latestSession = readServerSession(storage);
    if (!latestSession?.assessment_id) return { confirmed: false, reason: "SERVER_SESSION_UNUSABLE" };

    const result = await confirmFn({ assessmentId: latestSession.assessment_id, accessToken: latestSession.access_token });
    const cache = serverResultCache(latestSession.assessment_id, result, now());
    storage.setItem(realityCheckServerResultKey, JSON.stringify(cache));
    if (state.screen === "reveal") (options.renderFn || render)();
    return { confirmed: true, result, cache };
  } catch (error) {
    if (terminalLoadStatuses.has(Number(error?.status))) {
      clearInvalidServerSession(storage, session.assessment_id);
      return { confirmed: false, reason: "INVALID_SESSION" };
    }
    if (Number(error?.status) === 409) return { confirmed: false, reason: "CONFIRM_CONFLICT" };
    return { confirmed: false, reason: "CONFIRM_FAILED" };
  } finally {
    serverConfirmInFlight = false;
  }
}

function readServerResult(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(realityCheckServerResultKey) || "null");
    return parsed?.assessment_id ? parsed : null;
  } catch {
    return null;
  }
}

function clearInvalidServerSession(storage, assessmentId) {
  storage.removeItem(realityCheckServerSessionKey);
  const cached = readServerResult(storage);
  if (cached?.assessment_id === assessmentId) storage.removeItem(realityCheckServerResultKey);
}

function serverResultCache(assessmentId, result, cachedAt) {
  return {
    assessment_id: assessmentId,
    cached_at: cachedAt,
    assessment: cloneJsonSafe(result?.assessment || null),
    calculation: cloneJsonSafe(result?.calculation || null),
    diagnosis: cloneJsonSafe(result?.diagnosis || null),
    recommendations: cloneJsonSafe(result?.recommendations || null),
  };
}
export function selectRealityCheckResult(options = {}) {
  const storage = options.storage || localStorage;
  const session = readServerSession(storage);
  const cached = readServerResult(storage);
  if (session?.assessment_id && cached?.assessment_id === session.assessment_id) {
    try {
      const server = adaptServerConfirmResult(cached);
      return { ...server, presentationContext: { input: cloneJsonSafe(state.input) } };
    } catch {
      // Invalid server cache is ignored so the local fallback remains usable.
    }
  }
  const local = model();
  return { ...local, source: "LOCAL_FALLBACK", presentationContext: { input: local.input } };
}
function sanitizeServerScenarioInput(input) {
  const allowed = new Set(["scenarioName", "scenario_name", "externalLoan", "external_loan", "externalBorrowingRate", "external_borrowing_rate", "marginAmountWhenUsed", "margin_amount_when_used", "marginFrequency", "margin_frequency", "marginRate", "margin_rate", "turnoverMonthly", "turnover_monthly", "deficitFundingInvestmentShare", "deficit_funding_investment_share", "targetCashMonthly", "target_cash_monthly", "investmentCapital", "investment_capital", "nearTermInvestmentBurden", "near_term_investment_burden", "horizonYears", "horizon_years"]);
  const clean = {};
  for (const [key, value] of Object.entries(input || {})) if (allowed.has(key)) clean[key] = cloneJsonSafe(value);
  return clean;
}

function normalizeServerScenarioResult(payload) {
  const result = payload?.result || {};
  const row = payload?.scenario || {};
  const comparedMetrics = result.comparedMetrics || row.output_metrics?.metrics || row.outputMetrics?.metrics || {};
  return {
    scenarioName: result.scenarioName || row.scenario_name || row.scenarioName || "Kịch bản đã xác nhận",
    comparedMetrics,
  };
}

export async function restartRealityCheckAssessment(options = {}) {
  const storage = options.storage || localStorage;
  const startFn = options.startFn || startInvestmentAssessment;
  const renderFn = options.renderFn || render;
  storage.removeItem(draftKey);
  storage.removeItem(realityCheckServerSessionKey);
  storage.removeItem(realityCheckServerResultKey);
  state = defaultState();
  state.screen = "flow";
  pendingServerInput = null;
  serverSavePromise = null;
  serverSaveInFlight = false;
  serverConfirmInFlight = false;
  serverScenarioInFlight = false;
  serverScenarioResult = null;
  await ensureRealityCheckServerSession({ storage, startFn, renderFn: () => {} });
  try { storage.setItem(draftKey, JSON.stringify(state)); } catch {}
  refreshAssessmentCtas();
  renderFn();
  return { restarted: true, session: readServerSession(storage) };
}

function closeRestartModal() {
  document.querySelector("[data-irc-restart-modal]")?.remove?.();
}

function openRestartModal() {
  closeRestartModal();
  const modal = document.createElement("div");
  modal.className = "irc-restart-modal";
  modal.setAttribute("data-irc-restart-modal", "");
  modal.innerHTML = `<div class="irc-restart-backdrop" aria-hidden="true" data-irc-restart-cancel></div><section class="irc-restart-sheet" role="dialog" aria-modal="true" aria-labelledby="irc-restart-title"><button class="modal-close" type="button" data-irc-restart-cancel aria-label="Đóng">×</button><p class="eyebrow">Đánh giá lại</p><h3 id="irc-restart-title">Bắt đầu một bài đánh giá mới?</h3><p>Kết quả hiện tại vẫn được giữ lại.</p><div class="wizard-actions"><button class="button button-primary" type="button" data-irc-restart-confirm>Bắt đầu lại</button><button class="button button-secondary" type="button" data-irc-restart-cancel>Hủy</button></div></section>`;
  document.body?.appendChild?.(modal);
}
function renderHistoryPreview() {
  if (!serverHistoryLoaded || !serverHistoryRows.length) return "";
  return `<div class="irc-history-strip">${serverHistoryRows.slice(0, 3).map((row) => `<button type="button" class="irc-mini" data-irc-history-id="${escapeHtml(row.id)}">${escapeHtml(row.status || "Bài kiểm tra")} · ${escapeHtml(String(row.created_at || "").slice(0, 10))}</button>`).join("")}</div>`;
}
function saveDraft() {
  isSaving = true;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(state)); lastError = ""; queueRealityCheckServerDraftSave(state.input); }
    catch { lastError = "Chưa thể lưu dữ liệu lúc này. Thông tin trên màn hình vẫn được giữ lại."; }
    finally {
      isSaving = false;
      const status = document.querySelector(".irc-save-state");
      if (status) status.textContent = lastError || "";
      refreshAssessmentCtas();
    }
  }, 250);
}

function loadDraft() {
  try {
    const parsed = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (parsed?.input) state = { ...defaultState(), ...parsed, input: { ...defaultState().input, ...parsed.input } };
  } catch { localStorage.removeItem(draftKey); }
}

function render() {
  const el = root();
  if (!el) return;
  if (state.screen === "reveal") return renderReveal(el);
  if (state.screen === "flow") return renderStage(el);
  renderStart(el);
}

function renderStart(el) {
  el.innerHTML = `
    <section class="irc-shell irc-start" aria-labelledby="assessment-title">
      <p class="eyebrow">Bài kiểm tra thực tế đầu tư</p>
      <h2 id="assessment-title">Anh/chị đang thực sự yêu cầu số vốn của mình làm điều gì?</h2>
      <p>Một mục tiêu nghe nhỏ có thể đòi hỏi tỷ suất rất lớn khi đặt cạnh số vốn, chi phí và dòng tiền thực tế.</p>
      <div class="irc-benefits" aria-label="Lợi ích"><span>Kỳ vọng</span><span>Chi phí vốn</span><span>Dòng tiền sống</span></div>
      <p class="irc-note">Không có đáp án đúng hay sai. Kết quả được tính từ chính dữ liệu anh/chị cung cấp và các giả định được ghi rõ.</p>
      ${renderHistoryPreview()}
      <div class="wizard-actions">
        <button class="button button-primary" type="button" data-irc-start>Kiểm tra bức tranh của tôi</button>
        ${hasDraft() ? `<button class="button button-secondary" type="button" data-irc-resume>Tiếp tục bản nháp</button>` : ""}
      </div>
    </section>`;
}

function renderStage(el) {
  const current = model();
  const progress = ((state.stage + 1) / stageLabels.length) * 100;
  el.innerHTML = `
    <section class="irc-shell" aria-labelledby="assessment-title">
      <div class="wizard-progress irc-progress"><span>Bước ${state.stage + 1}/7</span><strong>${escapeHtml(stageLabels[state.stage])}</strong><div><i style="width:${progress}%"></i></div></div>
      <div class="irc-stage-body">${renderStageContent(current)}</div>
      ${lastError ? `<p class="form-note irc-save-state" aria-live="polite">${escapeHtml(lastError)}</p>` : ""}
      <div class="wizard-actions irc-actions">
        <button class="button button-secondary" type="button" data-irc-back>${state.stage === 0 ? "Quay lại" : "Bước trước"}</button>
        <button class="button button-primary" type="button" data-irc-next>${state.stage === stageLabels.length - 1 ? "Xem con số thực tế" : "Tiếp tục"}</button>
      </div>
    </section>`;
}

function renderStageContent(current) {
  const m = current.calculation.metrics;
  if (state.stage === 0) return `
    <p class="eyebrow">Điều tôi đang tin</p><h2 id="assessment-title">Anh/chị bước vào thị trường chủ yếu để làm gì?</h2>
    <div class="irc-choice-grid">${purposeOptions.map(([v, t, c]) => choice("purposeCode", v, t, c, state.input.purposeCode === v)).join("")}</div>
    ${state.input.purposeCode !== "NO_CLEAR_GOAL" && state.input.purposeCode !== "LEARNING" ? moneyField("targetCashMonthly", "Anh/chị muốn tài khoản mang lại khoảng bao nhiêu mỗi tháng?", state.input.targetCashMonthly) : ""}
    <p class="irc-micro">${state.input.targetCashMonthly > 0 ? `${formatMoney(state.input.targetCashMonthly, true)}/tháng sẽ được quy đổi tự động trước khi tính chi phí.` : "Hệ thống sẽ không gắn cảnh báo lợi nhuận cao khi chưa có mục tiêu tiền cụ thể."}</p>`;
  if (state.stage === 1) {
    const loanRate = state.input.externalLoan > 0 ? (state.input.annualExternalInterest / state.input.externalLoan) * 100 : 12;
    return `<p class="eyebrow">Nguồn vốn</p><h2 id="assessment-title">Anh/chị đang giao nhiệm vụ đó cho bao nhiêu vốn?</h2>${moneyField("investmentCapital", "Tổng vốn đang dành cho chứng khoán", state.input.investmentCapital)}<div class="irc-toggle-row" role="group" aria-label="Tiền vay ngoài"><button type="button" class="irc-toggle ${state.input.externalLoan > 0 ? "is-selected" : ""}" data-irc-loan="yes">Có vay ngoài</button><button type="button" class="irc-toggle ${state.input.externalLoan <= 0 ? "is-selected" : ""}" data-irc-loan="no">Không vay ngoài</button></div>${state.input.externalLoan > 0 ? `${moneyField("externalLoan", "Số tiền vay ngoài", state.input.externalLoan)}${percentField("externalLoanRate", "Lãi vay", loanRate)}` : ""}<p class="irc-micro">Trong ${formatMoney(m.investment_capital, true)} đang đầu tư, khoảng ${formatMoney(m.own_capital, true)} là vốn của anh/chị.</p>`;
  }
  if (state.stage === 2) return `<p class="eyebrow">Đòn bẩy</p><h2 id="assessment-title">Anh/chị có đang khuếch đại vốn bằng margin?</h2><div class="irc-choice-grid compact">${marginChoices.map(([v, t, c]) => choice("marginFrequency", v, t, c, Number(state.input.marginFrequency) === v)).join("")}</div>${Number(state.input.marginFrequency) > 0 ? `${moneyField("marginAmountWhenUsed", "Khi dùng margin thường vay thêm", state.input.marginAmountWhenUsed)}${percentField("marginRate", "Lãi suất margin", Number(state.input.marginRate || 0) * 100)}<p class="irc-micro">Margin sử dụng bình quân đang được ước tính khoảng ${formatMoney(m.avg_margin_est, true)}.</p>` : `<p class="irc-micro">Nếu không dùng margin, hệ thống bỏ toàn bộ câu hỏi chi tiết margin.</p>`}`;
  if (state.stage === 3) return `<p class="eyebrow">Chi phí thật</p><h2 id="assessment-title">Trong một tháng, anh/chị thường xoay vòng danh mục bao nhiêu lần?</h2><div class="irc-choice-grid compact">${turnoverChoices.map(([v, t, c]) => choice("turnoverMonthly", v, t, c, Number(state.input.turnoverMonthly) === v)).join("")}</div><div class="irc-derived-grid">${metricCard("Lãi vay ngoài/năm", formatMoney(m.annual_external_interest), "")}${metricCard("Lãi margin/năm", formatMoney(m.annual_margin_interest), "Ước tính")}${metricCard("Phí và thuế/năm", formatMoney(m.annual_trading_friction), "Ước tính")}</div><p class="irc-micro">Phí và thuế được ước tính từ mức xoay vòng đã chọn để anh/chị nhìn rõ chi phí giao dịch hằng năm.</p>`;
  if (state.stage === 4) return `<p class="eyebrow">Dòng tiền gia đình</p><h2 id="assessment-title">Ngoài chứng khoán, tiền đang chảy vào và ra như thế nào?</h2>${itemEditor("income", "Nguồn thu ngoài đầu tư", incomeTypes, state.incomeMode, state.input.incomeItems)}${itemEditor("expense", "Chi phí gia đình", expenseTypes, state.expenseMode, state.input.expenseItems)}<label class="irc-field"><span>Số người phụ thuộc tài chính</span><input inputmode="numeric" type="number" min="0" value="${Number(state.input.dependentsCount || 0)}" data-irc-number="dependentsCount" /></label><p class="irc-micro">${m.monthly_deficit > 0 ? `Dòng tiền hiện đang thiếu khoảng ${formatMoney(m.monthly_deficit, true)}/tháng sau khi trừ chi phí gia đình.` : `Dòng tiền hiện đang cân bằng: thu ${formatMoney(m.monthly_non_investment_income, true)} - chi ${formatMoney(m.monthly_family_expense, true)} mỗi tháng.`}</p>`;
  if (state.stage === 5) {
    const deficit = Number(m.monthly_deficit || 0) > 0;
    return `<p class="eyebrow">Lớp đệm</p><h2 id="assessment-title">Nếu thị trường không tạo ra tiền ngay, anh/chị có lớp đệm bao lâu?</h2>${moneyField("liquidReserve", "Tiền dự phòng ngoài tài khoản đầu tư", state.input.liquidReserve)}${moneyField("nearTermInvestmentBurden", "Khoản chi lớn 12 tháng tới lấy từ tài khoản đầu tư", state.input.nearTermInvestmentBurden)}${deficit ? `<label class="irc-field"><span>Phần thiếu hụt thường lấy từ tài khoản đầu tư</span><input type="range" min="0" max="100" value="${Math.round(Number(state.input.deficitFundingInvestmentShare || 0) * 100)}" data-irc-range="deficitFundingInvestmentShare" /><b>${Math.round(Number(state.input.deficitFundingInvestmentShare || 0) * 100)}%</b></label><p class="irc-micro">Không phải toàn bộ thiếu hụt đều tính là áp lực lên tài khoản. Chỉ phần thực sự bù từ đầu tư mới được tính: khoảng ${formatMoney(m.annual_cashflow_burden, true)}/năm.</p>` : `<p class="irc-micro">Hiện dòng tiền ngoài đầu tư chưa tạo áp lực thiếu hụt.</p>`}<p class="irc-micro">Quỹ dự phòng hiện tương đương khoảng ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(m.reserve_months || 0)} tháng chi phí.</p>`;
  }
  return `<p class="eyebrow">Trước khi xem kết quả</p><h2 id="assessment-title">Trước khi xem kết quả, hãy nhìn lại 6 con số đang quyết định áp lực đầu tư của anh/chị.</h2><div class="irc-summary-grid">${metricCard("Vốn đầu tư", formatMoney(m.investment_capital), "")}${metricCard("Vay ngoài", formatMoney(m.external_loan), "")}${metricCard("Margin bình quân", formatMoney(m.avg_margin_est), "Ước tính")}${metricCard("Thu nhập ngoài đầu tư", `${formatMoney(m.monthly_non_investment_income, true)}/tháng`, "")}${metricCard("Chi phí gia đình", `${formatMoney(m.monthly_family_expense, true)}/tháng`, "")}${metricCard("Quỹ dự phòng", formatMoney(m.liquid_reserve), "")}</div><p class="irc-note">Nếu có con số nào chưa đúng, anh/chị có thể quay lại điều chỉnh trước khi xem bức tranh thực tế.</p>`;
}

function renderReveal(el) {
  const current = selectRealityCheckResult();
  const m = current.calculation.metrics;
  const primary = current.diagnosis.primaryInsights || [];
  const recos = current.recommendations.recommendations || [];
  const topInsights = primary.slice(0, 3);
  const topActions = recos.slice(0, 2);
  const presentationInput = current.presentationContext?.input || current.input || state.input;
  setContactContext("INVESTMENT_REALITY_RESULT", { source: "INVESTMENT_REALITY_RESULT", assessmentId: current.assessment_id || null, requiredReturnTarget: m.required_return_target_total, primaryInsights: primary.map((i) => i.rule_code), primaryLabel: resultHeadline(m, topInsights), reasonToMeet: spreadSentence(m) });
  el.innerHTML = `<section class="irc-shell irc-result irc-executive-result" aria-labelledby="assessment-title" aria-live="polite"><p class="eyebrow">KẾT QUẢ KIỂM TRA THỰC TẾ ĐẦU TƯ</p><h2 id="assessment-title">${escapeHtml(resultHeadline(m, topInsights))}</h2><p class="irc-result-lead">${escapeHtml(resultLead(m))}</p>${executiveSummary(m)}<section class="irc-overview-story" aria-label="Tổng quan kết quả"><div class="irc-story-panel"><p class="eyebrow">Tôi đang ở đâu?</p><h3>Hiện trạng</h3><div class="irc-fact-rows">${factRow("Vốn của anh/chị", formatMoney(m.own_capital))}${factRow("Vay ngoài", formatMoney(m.external_loan))}${factRow("Margin", formatMoney(m.avg_margin_est))}${factRow("Dòng tiền gia đình", cashflowLabel(m))}${factRow("Quỹ dự phòng", reserveLabel(m))}</div></div><div class="irc-story-panel is-focus"><p class="eyebrow">Mục tiêu đang đòi hỏi gì?</p><h3>Mục tiêu & yêu cầu thực tế</h3><div class="irc-fact-rows">${factRow("Mục tiêu ban đầu", `${formatMoney(presentationInput.targetCashMonthly, true)}/tháng`)}${factRow("Để đạt mục tiêu", `${formatPercent(m.required_return_target_total)}/năm`)}${factRow("Chi phí hòa vốn", `${formatPercent(m.investment_break_even_return)}/năm`)}</div><p class="irc-interpretation"><strong>${escapeHtml(spreadSentence(m))}</strong></p></div></section><section class="irc-overview-grid"><div>${overviewInsights(topInsights)}</div><div>${overviewActions(topActions)}</div></section><section class="irc-result-cta"><div><h3>Muốn biết nên điều chỉnh điểm nào trước?</h3><p>Một buổi rà soát 1:1 giúp đặt các con số này vào đúng bối cảnh tài chính, danh mục và mục tiêu của anh/chị.</p></div><div class="wizard-actions irc-result-actions"><button class="button button-primary" type="button" data-open-contact data-contact-source="INVESTMENT_REALITY_RESULT">Rà soát 1:1 cùng Võ Hoàng</button><button class="button button-secondary" type="button" data-irc-toggle-detail>Xem phân tích chi tiết</button><button class="button button-tertiary" type="button" data-irc-save-result>Lưu kết quả</button><button class="button button-tertiary irc-tertiary-text-action" type="button" data-irc-restart>Làm lại bài đánh giá</button></div></section><p class="assessment-micro-disclaimer">Kết quả mang tính tham khảo và được tính từ dữ liệu anh/chị cung cấp. <button type="button" data-open-legal="disclaimer">Xem miễn trừ trách nhiệm</button></p><details class="irc-detail-accordion" data-irc-detail><summary>Phân tích chi tiết</summary><div class="irc-report-grid">${revealStructure(m)}${revealCost(m)}${revealCashflow(m)}${revealGoal(m, presentationInput)}</div><section class="irc-reveal-block irc-report-wide"><h3>Điểm cần cải thiện</h3><div class="irc-card-list">${primary.length ? primary.map(diagnosisCard).join("") : healthyCard()}</div></section><section class="irc-reveal-block irc-report-wide irc-actions-report"><h3>Gợi ý hành động</h3><div class="irc-card-list">${recos.length ? recos.map(recommendationCard).join("") : calmCard()}</div></section></details></section>`;
}
function resultHeadline(m, insights = []) { if (insights[0]?.presentation?.title) return insights[0].presentation.title; if (Number(m.required_return_target_total || 0) >= 0.5) return "Mục tiêu hiện tại đang tạo áp lực lớn lên số vốn của anh/chị."; if (Number(m.investment_break_even_return || 0) >= 0.1) return "Chi phí đầu tư đang nâng ngưỡng hòa vốn của anh/chị."; if (Number(m.annual_cashflow_burden || 0) > 0) return "Dòng tiền gia đình đang tạo thêm áp lực cho tài khoản đầu tư."; return "Cấu trúc hiện tại tương đối cân bằng, nhưng vẫn nên có nguyên tắc rõ."; }
function resultLead(m) { if (Number(m.required_return_target_total || 0) > 0) return `Để đạt mục tiêu đã đặt, tài khoản cần vượt qua cả chi phí hòa vốn và phần lợi nhuận mục tiêu. Điểm quan trọng không phải giao dịch nhiều hơn, mà là hiểu áp lực đang nằm ở đâu.`; return "Kết quả này giúp anh/chị nhìn lại vốn, chi phí và dòng tiền trước khi quyết định chiến lược tiếp theo."; }
function executiveSummary(m) { const spread = Number(m.required_return_target_total || 0) - Number(m.investment_break_even_return || 0); return `<section class="irc-executive-summary"><article><span>VỐN ĐẦU TƯ</span><strong>${formatMoney(m.investment_capital)}</strong></article><article><span>CHI PHÍ HÒA VỐN</span><strong>${formatPercent(m.investment_break_even_return)}/năm</strong></article><article class="is-primary"><span>ĐỂ ĐẠT MỤC TIÊU</span><strong>${formatPercent(m.required_return_target_total)}/năm</strong></article><article><span>KHOẢNG CÁCH</span><strong>${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Math.max(0, spread * 100))} điểm %</strong></article></section>`; }
function factRow(label, value) { return `<div class="irc-fact-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function cashflowLabel(m) { const deficit = Number(m.monthly_deficit || 0); if (deficit > 0) return `Thiếu ${formatMoney(deficit, true)}/tháng`; return "Cân bằng"; }
function reserveLabel(m) { return `khoảng ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(m.reserve_months || 0))} tháng`; }
function spreadSentence(m) { const spread = Math.max(0, (Number(m.required_return_target_total || 0) - Number(m.investment_break_even_return || 0)) * 100); return `Khoảng cách ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(spread)} phần trăm chính là phần áp lực mà mục tiêu đang đặt lên số vốn hiện tại.`; }
function overviewInsights(items) { return `<section class="irc-overview-section"><h3>Điều đáng lưu ý nhất</h3><div class="irc-priority-list">${items.length ? items.map((item, index) => priorityItem(index + 1, item.presentation?.title || "Điểm cần cải thiện", item.presentation?.copy || "Nhận định được xác nhận bằng số liệu của anh/chị.")).join("") : `<article><span>01</span><div><strong>Cấu trúc hiện tại tương đối cân bằng</strong><p>Không có cảnh báo chính trong dữ liệu hiện tại.</p></div></article>`}</div></section>`; }
function overviewActions(items) { return `<section class="irc-overview-section"><h3>Việc nên làm trước</h3><div class="irc-priority-list">${items.length ? items.map((item, index) => priorityItem(index + 1, item.presentation?.title || "Gợi ý hành động", item.presentation?.copy || "Hành động lập kế hoạch dựa trên điểm cần lưu ý.")).join("") : `<article><span>01</span><div><strong>Tiếp tục giữ nguyên tắc</strong><p>Chưa có hành động khẩn cấp, nhưng mục tiêu và rủi ro vẫn nên được rà soát định kỳ.</p></div></article>`}</div></section>`; }
function priorityItem(number, title, copy) { return `<article><span>${String(number).padStart(2, "0")}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div></article>`; }
function revealStructure(m) { return `<section class="irc-reveal-block"><h3>Cấu trúc vốn</h3><div class="irc-number-row">${truthNumber("Tổng vốn", m.investment_capital)}${truthNumber("Vốn của anh/chị", m.own_capital)}${truthNumber("Vay ngoài", m.external_loan)}${truthNumber("Margin bình quân", m.avg_margin_est)}</div></section>`; }
function revealCost(m) { return `<section class="irc-reveal-block"><h3>Chi phí đầu tư</h3><div class="irc-derived-grid">${metricCard("Lãi vay", formatMoney(m.annual_external_interest), "")}${metricCard("Lãi margin", formatMoney(m.annual_margin_interest), "Ước tính")}${metricCard("Phí và thuế", formatMoney(m.annual_trading_friction), "Ước tính")}</div><div class="irc-hero-number"><span>Để hòa vốn trước khi có lợi nhuận thực</span><strong>${formatPercent(m.investment_break_even_return)}</strong><small>Đây chưa phải mục tiêu lợi nhuận, chỉ là mức cần đạt để bù chi phí hiện tại.</small></div></section>`; }
function revealCashflow(m) { return `<section class="irc-reveal-block"><h3>Dòng tiền gia đình</h3><div class="irc-number-row">${truthNumber("Thu nhập/tháng", m.monthly_non_investment_income)}${truthNumber("Chi phí/tháng", m.monthly_family_expense)}${truthNumber("Thiếu hụt/tháng", m.monthly_deficit)}${truthNumber("Tài khoản đang bù/năm", m.annual_cashflow_burden)}</div><p>${Number(m.monthly_deficit || 0) > 0 ? `Dòng tiền hiện đang thiếu khoảng ${formatMoney(m.monthly_deficit, true)}/tháng sau khi trừ chi phí gia đình.` : `Dòng tiền hiện đang cân bằng: thu ${formatMoney(m.monthly_non_investment_income, true)} - chi ${formatMoney(m.monthly_family_expense, true)} mỗi tháng.`}</p></section>`; }
function revealGoal(m, input = state.input) { const spread = Math.max(0, (Number(m.required_return_target_total || 0) - Number(m.required_return_maintain || 0)) * 100); return `<section class="irc-reveal-block centered irc-goal-report"><h3>Mục tiêu và yêu cầu lợi nhuận</h3><p>Lúc bắt đầu, anh/chị nói mục tiêu là ${formatMoney(input.targetCashMonthly, true)}/tháng, tương đương ${formatMoney(m.target_annual_cash, true)}/năm.</p><div class="irc-kpi-row">${kpi("Duy trì cấu trúc", formatPercent(m.required_return_maintain))}${kpi(`Để đạt ${formatMoney(input.targetCashMonthly, true)}/tháng`, formatPercent(m.required_return_target_total))}</div>${m.external_loan > 0 ? `<p class="irc-note"><strong>Trên vốn tự có:</strong> ${formatPercent(m.required_return_target_own)}/năm.</p>` : ""}<p class="irc-note"><strong>Khoảng cách ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(spread)} điểm phần trăm.</strong> Khoảng cách này chính là phần áp lực mà mục tiêu đang đặt lên số vốn hiện tại.</p><p class="irc-note">Con số cao không có nghĩa là anh/chị nên giao dịch mạnh hơn. Nó là tín hiệu để xem lại cấu trúc vốn, dòng tiền và mục tiêu.</p></section>`; }
function choice(name, value, title, copy, selected) { return `<button type="button" class="irc-choice ${selected ? "is-selected" : ""}" data-irc-choice="${escapeHtml(name)}" data-value="${escapeHtml(value)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></button>`; }
function moneyField(name, label, value) { return `<label class="irc-field"><span>${escapeHtml(label)}</span><input type="text" inputmode="numeric" autocomplete="off" value="${escapeHtml(formatMoney(value))}" data-irc-money="${escapeHtml(name)}" /><small>≈ ${escapeHtml(formatMoney(value, true))}</small></label>`; }
function percentField(name, label, value) { return `<label class="irc-field"><span>${escapeHtml(label)}</span><input type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${Number(value || 0).toFixed(1)}" data-irc-percent="${escapeHtml(name)}" /><small>% / năm</small></label>`; }
function metricCard(label, value, tag) { const tagHtml = tag ? `<span>${escapeHtml(tag)}</span>` : ""; return `<article class="irc-metric-card">${tagHtml}<strong>${escapeHtml(value)}</strong><p>${escapeHtml(label)}</p></article>`; }
function truthNumber(label, value) { return `<article class="irc-truth-number"><span>${escapeHtml(label)}</span><strong>${formatMoney(value)}</strong></article>`; }
function kpi(label, value) { return `<article class="irc-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)} / năm</strong></article>`; }
function healthyCard() { return `<article class="irc-soft-card"><strong>Cấu trúc hiện tại tương đối cân bằng</strong><p>Không có cảnh báo chính. Điều này không đảm bảo lợi nhuận, nhưng tài khoản ít bị buộc phải thắng vì nhu cầu ngoài thị trường.</p></article>`; }
function calmCard() { return `<article class="irc-soft-card"><strong>Không cần hành động khẩn cấp</strong><p>Tiếp tục đặt mục tiêu và mức rủi ro phù hợp với chiến lược.</p></article>`; }
function labelIrcSeverity(value) { return ({ LOW: "Theo dõi", MEDIUM: "Cần cải thiện", HIGH: "Cần ưu tiên", CRITICAL: "Ưu tiên cao" })[value] || "Nhận định"; }
function labelIrcDirection(value) { return ({ ACTION: "Hành động", REDUCE_RISK: "Giảm áp lực", BUILD_RESERVE: "Tăng lớp đệm", REFRAME: "Điều chỉnh mục tiêu" })[value] || "Hành động"; }
function diagnosisCard(item) { const [fallbackTitle, fallbackCopy] = ruleCopy[item.rule_code] || ["Điểm cần cải thiện", "Nhận định được xác nhận bằng số liệu của anh/chị."]; const title = item.presentation?.title || fallbackTitle; const copy = item.presentation?.copy || fallbackCopy; return `<article class="irc-soft-card severity-${String(item.severity || "").toLowerCase()}"><span>${escapeHtml(labelIrcSeverity(item.severity))}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></article>`; }
function recommendationCard(item) { const [fallbackTitle, fallbackCopy] = recoCopy[item.reco_code] || ["Gợi ý hành động", "Hành động lập kế hoạch dựa trên điểm cần lưu ý."]; const title = item.presentation?.title || fallbackTitle; const copy = item.presentation?.copy || fallbackCopy; return `<article class="irc-soft-card"><span>${escapeHtml(labelIrcDirection(item.direction))}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></article>`; }
function itemEditor(kind, title, types, mode, items) { const modeAttr = kind === "income" ? "data-irc-income-mode" : "data-irc-expense-mode"; const itemAttr = kind === "income" ? "data-irc-income-item" : "data-irc-expense-item"; const total = items.find((i) => i.type === "TOTAL_ESTIMATE" || i.incomeType === "TOTAL_ESTIMATE" || i.expenseType === "TOTAL_ESTIMATE")?.amountMonthly || 0; return `<section class="irc-editor"><div class="irc-editor-head"><strong>${escapeHtml(title)}</strong><div><button type="button" class="irc-mini ${mode === "TOTAL" ? "is-selected" : ""}" ${modeAttr}="TOTAL">Nhập tổng</button><button type="button" class="irc-mini ${mode === "DETAIL" ? "is-selected" : ""}" ${modeAttr}="DETAIL">Theo nhóm</button></div></div>${mode === "TOTAL" ? moneyField(`${kind}Total`, "Tổng mỗi tháng", total) : `<div class="irc-item-grid">${types.map(([type, label]) => { const row = items.find((i) => i.type === type || i.incomeType === type || i.expenseType === type) || { amountMonthly: 0 }; return `<label><span>${escapeHtml(label)}</span><input type="text" inputmode="numeric" value="${escapeHtml(formatMoney(row.amountMonthly))}" ${itemAttr}="${escapeHtml(type)}" /></label>`; }).join("")}</div>`}</section>`; }
function evidenceLine(evidence) { const entries = Object.entries(evidence || {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v)).slice(0, 3); if (!entries.length) return "Có dữ liệu minh chứng đi kèm."; return entries.map(([k, v]) => `${humanMetric(k)}: ${k.includes("return") || k.includes("ratio") || k.includes("share") ? formatPercent(v) : formatMoney(v, true)}`).join(" · "); }
function humanMetric(key) { return ({ external_loan: "Vay ngoài", avg_margin_est: "Margin bình quân", annual_cashflow_burden: "Áp lực dòng tiền/năm", required_return_target_total: "Mức sinh lời cần thiết", required_return_target_own: "Trên vốn tự có", total_investment_cost: "Chi phí đầu tư", reserve_months: "Tháng dự phòng", near_term_investment_burden: "Khoản sắp cần" })[key] || key.replaceAll("_", " "); }

function validateStage() { const i = state.input; if (state.stage === 1 && Number(i.investmentCapital || 0) <= 0) return "Vốn đầu tư cần lớn hơn 0 để hệ thống tính được."; if (state.stage === 1 && Number(i.externalLoan || 0) > Number(i.investmentCapital || 0) * 5) return "Số tiền vay đang quá lớn so với quy mô vốn. Anh/chị kiểm tra lại giúp hệ thống."; if (state.stage === 2 && Number(i.marginRate || 0) > 1) return "Lãi suất margin nên nhập theo %/năm trong giới hạn hợp lý."; if (state.stage === 5 && Number(i.deficitFundingInvestmentShare || 0) > 1) return "Tỷ lệ bù thiếu từ tài khoản đầu tư không thể lớn hơn 100%."; return ""; }
function updateDetailItem(collection, type, amountMonthly) { const filtered = state.input[collection].filter((item) => item.type !== "TOTAL_ESTIMATE" && item.type !== type); if (amountMonthly > 0) filtered.push({ type, amountMonthly }); state.input[collection] = filtered; }
function updateInput(target) { if (target.dataset.ircChoice) { const key = target.dataset.ircChoice; const raw = target.dataset.value; state.input[key] = ["marginFrequency", "turnoverMonthly"].includes(key) ? Number(raw) : raw; if (key === "purposeCode" && (raw === "NO_CLEAR_GOAL" || raw === "LEARNING")) state.input.targetCashMonthly = 0; } if (target.dataset.ircMoney) { const key = target.dataset.ircMoney; const value = parseMoney(target.value); if (key === "incomeTotal") state.input.incomeItems = [{ type: "TOTAL_ESTIMATE", amountMonthly: value }]; else if (key === "expenseTotal") state.input.expenseItems = [{ type: "TOTAL_ESTIMATE", amountMonthly: value }]; else state.input[key] = value; target.value = formatMoney(value); } if (target.dataset.ircPercent) { const key = target.dataset.ircPercent; const value = Math.max(0, Number(target.value || 0)); if (key === "externalLoanRate") state.input.annualExternalInterest = Number(state.input.externalLoan || 0) * value / 100; else state.input[key] = value / 100; } if (target.dataset.ircRange) state.input[target.dataset.ircRange] = Number(target.value || 0) / 100; if (target.dataset.ircNumber) state.input[target.dataset.ircNumber] = Math.max(0, Number(target.value || 0)); if (target.hasAttribute("data-irc-income-item")) updateDetailItem("incomeItems", target.getAttribute("data-irc-income-item"), parseMoney(target.value)); if (target.hasAttribute("data-irc-expense-item")) updateDetailItem("expenseItems", target.getAttribute("data-irc-expense-item"), parseMoney(target.value)); saveDraft(); }

function bindEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, a"); if (!target) return;
    if (target.matches("[data-open-reality-check]")) { event.preventDefault(); openAssessment(); }
    else if (target.matches("[data-irc-start]")) { state = defaultState(); state.screen = "flow"; saveDraft(); render(); }
    else if (target.matches("[data-irc-resume]")) { loadDraft(); state.screen = state.screen === "reveal" ? "reveal" : "flow"; render(); }
    else if (target.matches("[data-irc-choice]")) { updateInput(target); render(); }
    else if (target.matches("[data-irc-loan]")) { if (target.dataset.ircLoan === "yes" && Number(state.input.externalLoan || 0) <= 0) { state.input.externalLoan = Math.round(Number(state.input.investmentCapital || 0) * 0.3); state.input.annualExternalInterest = state.input.externalLoan * 0.12; } else if (target.dataset.ircLoan === "no") { state.input.externalLoan = 0; state.input.annualExternalInterest = 0; } saveDraft(); render(); }
    else if (target.matches("[data-irc-income-mode]")) { state.incomeMode = target.dataset.ircIncomeMode; if (state.incomeMode === "TOTAL") state.input.incomeItems = [{ type: "TOTAL_ESTIMATE", amountMonthly: model().calculation.metrics.monthly_non_investment_income }]; saveDraft(); render(); }
    else if (target.matches("[data-irc-expense-mode]")) { state.expenseMode = target.dataset.ircExpenseMode; if (state.expenseMode === "TOTAL") state.input.expenseItems = [{ type: "TOTAL_ESTIMATE", amountMonthly: model().calculation.metrics.monthly_family_expense }]; saveDraft(); render(); }
    else if (target.matches("[data-irc-back]")) { if (state.stage === 0) state.screen = "start"; else state.stage -= 1; saveDraft(); render(); }
    else if (target.matches("[data-irc-next]")) { const error = validateStage(); if (error) { lastError = error; render(); return; } lastError = ""; if (state.stage >= stageLabels.length - 1) { state.confirmed = true; state.screen = "reveal"; localStorage.setItem(resultKey, JSON.stringify({ at: new Date().toISOString(), result: model() })); void confirmRealityCheckServerResult(); } else state.stage += 1; saveDraft(); render(); }
    else if (target.matches("[data-irc-save-result]")) { localStorage.setItem(resultKey, JSON.stringify({ at: new Date().toISOString(), result: model() })); showToast("Đã lưu kết quả trên thiết bị này."); }
    else if (target.matches("[data-irc-restart]")) { openRestartModal(); }
    else if (target.matches("[data-irc-restart-cancel]")) { closeRestartModal(); }
    else if (target.matches("[data-irc-restart-confirm]")) { closeRestartModal(); void restartRealityCheckAssessment(); }
    else if (target.matches("[data-irc-toggle-detail]")) { const detail = document.querySelector("[data-irc-detail]"); if (detail) detail.open = !detail.open; }
    else if (target.matches("[data-irc-history-id]")) { const assessmentId = target.getAttribute("data-irc-history-id"); if (assessmentId) { localStorage.setItem(realityCheckServerSessionKey, JSON.stringify({ assessment_id: assessmentId, mode: "AUTHENTICATED", updated_at: new Date().toISOString() })); state.screen = "flow"; void ensureRealityCheckServerSession(); render(); } }
  });
  document.addEventListener("change", (event) => { const target = event.target; if (target instanceof HTMLInputElement && target.closest(".irc-shell")) { updateInput(target); render(); } });
  document.addEventListener("blur", (event) => { const target = event.target; if (target instanceof HTMLInputElement && target.closest(".irc-shell")) { updateInput(target); render(); } }, true);
}

function openAssessment() { openModal("assessment"); void ensureRealityCheckServerSession(); void loadRealityCheckHistory({ render: false }); loadDraft(); if (state.screen !== "flow" && state.screen !== "reveal") state.screen = "start"; render(); }
export async function refreshAssessmentCtas() { document.querySelectorAll("[data-reality-check-cta]").forEach((cta) => { cta.textContent = "Kiểm tra thực tế đầu tư của tôi"; }); }
export function initRealityCheck() { bindEvents(); refreshAssessmentCtas(); }
