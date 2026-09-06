import {
  dimensionLabels,
  getFriendlyError,
  latestGuestResultKey,
  openModal,
  pendingAssessmentKey,
  pendingClaimTokenKey,
  showToast,
  supabaseClient,
} from "./supabase-client.js";
import { setContactContext } from "./contact.js";

const FORM_RPC = "get_investment_assessment_form";
const SUBMIT_RPC = "submit_investment_assessment";
const ASSESSMENT_SOURCE = "INVESTOR_PROFILE_ASSESSMENT";
const EXPECTED_QUESTION_COUNT = 17;

const dimensionCopy = {
  MONEY: "Nền tảng tài chính",
  RISK: "Quản trị rủi ro",
  PORTFOLIO: "Cấu trúc danh mục",
  STRATEGY: "Chiến lược",
  BEHAVIOUR: "Kỷ luật & hành vi",
  SYSTEM: "Hệ thống đầu tư",
};

const severityCopy = {
  GOOD: "Ổn định",
  WATCH: "Cần theo dõi",
  GAP: "Cần cải thiện",
  HIGH_GAP: "Cần ưu tiên",
  LOW: "Cần theo dõi",
  MEDIUM: "Cần cải thiện",
  HIGH: "Cần ưu tiên",
  CRITICAL: "Ưu tiên xử lý",
};

let state = {
  status: "idle",
  version: "",
  questions: [],
  answers: {},
  contact: { fullName: "", phone: "", email: "" },
  index: 0,
  result: null,
  error: "",
};
let loading = false;
let submitting = false;
let bound = false;

function root() {
  return document.querySelector("[data-assessment-root]");
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function labelDimension(code) {
  return dimensionCopy[code] || dimensionLabels?.[code] || "Điểm cần cải thiện";
}

function labelSeverity(code) {
  return severityCopy[code] || "";
}

function normalizeOption(option, index) {
  return {
    code: option.option_code || option.code || option.value || String(index + 1),
    label: option.option_text || option.label || option.title || option.text || option.name || String(option.option_code || index + 1),
    sort: Number(option.sort_order ?? option.order ?? index + 1),
  };
}

function normalizeQuestion(row, index) {
  const code = row.question_code || row.code || row.questionCode || `Q${String(index + 1).padStart(2, "0")}`;
  return {
    code,
    text: row.question_text || row.text || row.question || row.title || code,
    dimension: row.dimension || row.dimension_code || "",
    required: row.required !== false,
    sort: Number(row.sort_order ?? row.order ?? index + 1),
    options: asArray(row.options || row.choices).map(normalizeOption).sort((a, b) => a.sort - b.sort),
  };
}

function normalizeForm(data) {
  const questions = asArray(data?.questions || data?.items || data?.data || data)
    .map(normalizeQuestion)
    .filter((question) => question.code && question.text)
    .sort((a, b) => a.sort - b.sort);
  return { version: data?.version || data?.assessment_version || "", questions };
}

function currentQuestion() {
  return state.questions[state.index];
}

function resetState(status = "loading") {
  state = {
    status,
    version: "",
    questions: [],
    answers: {},
    contact: { fullName: "", phone: "", email: "" },
    index: 0,
    result: null,
    error: "",
  };
}

export async function openInvestorProfileAssessment() {
  openModal("assessment");
  resetState("loading");
  render();
  await loadForm();
}

async function loadForm() {
  if (loading) return;
  loading = true;
  const { data, error } = await supabaseClient.rpc(FORM_RPC);
  loading = false;

  if (error) {
    state.status = "error";
    state.error = getFriendlyError(error, "Chưa thể tải bộ đánh giá hồ sơ nhà đầu tư. Vui lòng thử lại sau.");
    render();
    return;
  }

  const form = normalizeForm(data);
  if (form.questions.length !== EXPECTED_QUESTION_COUNT) {
    state.status = "error";
    state.error = `Bộ câu hỏi hiện có ${form.questions.length}/${EXPECTED_QUESTION_COUNT} câu. Cần kiểm tra lại source backend trước khi dùng.`;
    render();
    return;
  }

  state = { ...state, status: "intro", version: form.version, questions: form.questions, index: 0, result: null, error: "" };
  render();
}

function render() {
  const el = root();
  if (!el) return;
  if (state.status === "loading") return renderLoading(el);
  if (state.status === "error") return renderError(el);
  if (state.status === "intro") return renderIntro(el);
  if (state.status === "result") return renderResult(el);
  renderQuestion(el);
}

function renderLoading(el) {
  el.innerHTML = `<section class="profile-assessment-shell"><p class="eyebrow">Đánh giá hồ sơ nhà đầu tư</p><h2 id="assessment-title">Đang tải bộ câu hỏi...</h2></section>`;
}

function renderError(el) {
  el.innerHTML = `<section class="profile-assessment-shell"><p class="eyebrow">Đánh giá hồ sơ nhà đầu tư</p><h2 id="assessment-title">${esc(state.error)}</h2><div class="wizard-actions"><button class="button button-secondary" type="button" data-investor-profile-retry>Thử lại</button></div></section>`;
}

function renderIntro(el) {
  el.innerHTML = `
    <section class="profile-assessment-shell profile-assessment-intro" aria-labelledby="assessment-title">
      <p class="eyebrow">Đánh giá hồ sơ nhà đầu tư</p>
      <h2 id="assessment-title">17 câu để nhìn lại cách anh/chị đang đầu tư</h2>
      <p>17 câu ngắn để nhìn lại cách anh/chị ra quyết định, kiểm soát rủi ro và tổ chức danh mục. Kết quả giúp xác định điểm cần cải thiện trước khi xây dựng kế hoạch đầu tư phù hợp hơn.</p>
      <p class="profile-assessment-kicker">17 câu • Khoảng 3 phút • Kết quả cá nhân hóa</p>
      <div class="profile-contact-fields">
        <label class="field"><span>Họ và tên</span><input type="text" autocomplete="name" data-investor-profile-contact="fullName" value="${esc(state.contact.fullName)}" /></label>
        <label class="field"><span>Số điện thoại</span><input type="tel" autocomplete="tel" data-investor-profile-contact="phone" value="${esc(state.contact.phone)}" /></label>
        <label class="field"><span>Email</span><input type="email" autocomplete="email" data-investor-profile-contact="email" value="${esc(state.contact.email)}" /></label>
      </div>
      <p class="form-message" data-investor-profile-message></p>
      <div class="wizard-actions">
        <button class="button button-secondary" type="button" data-close-modal>Để sau</button>
        <button class="button button-primary" type="button" data-investor-profile-start>Bắt đầu đánh giá</button>
      </div>
    </section>
  `;
}

function renderQuestion(el) {
  const question = currentQuestion();
  if (!question) return;
  const selected = state.answers[question.code];
  const progress = ((state.index + 1) / state.questions.length) * 100;
  el.innerHTML = `
    <section class="profile-assessment-shell" aria-labelledby="assessment-title">
      <div class="wizard-progress">
        <span>Câu ${state.index + 1}/${state.questions.length}</span>
        <strong>${esc(labelDimension(question.dimension))}</strong>
        <div><i style="width:${progress}%"></i></div>
      </div>
      <p class="eyebrow">Đánh giá hồ sơ nhà đầu tư</p>
      <h2 id="assessment-title">${esc(question.text)}</h2>
      <div class="profile-question-options">
        ${question.options.map((option) => optionButton(question, option, selected)).join("")}
      </div>
      <p class="form-message" data-investor-profile-message></p>
      <div class="wizard-actions">
        <button class="button button-secondary" type="button" data-investor-profile-back>${state.index === 0 ? "Quay lại" : "Quay lại"}</button>
        <button class="button button-primary" type="button" data-investor-profile-next>${state.index === state.questions.length - 1 ? (submitting ? "Đang gửi..." : "Xem kết quả") : "Tiếp tục"}</button>
      </div>
    </section>
  `;
}

function optionButton(question, option, selected) {
  const active = String(selected) === String(option.code) ? " is-selected" : "";
  return `<button class="profile-question-option${active}" type="button" data-investor-profile-answer="${esc(question.code)}" data-value="${esc(option.code)}"><span>${esc(option.code)}</span><strong>${esc(option.label)}</strong></button>`;
}

function buildSubmitPayload() {
  return Object.fromEntries(state.questions.map((question) => [
    question.code,
    state.answers[question.code],
  ]));
}
function normalizeResult(data) {
  const row = Array.isArray(data) ? data[0] : data;
  return row || {};
}

function validateContact() {
  const fullName = state.contact.fullName.trim();
  const phone = state.contact.phone.trim();
  const email = state.contact.email.trim();
  if (!fullName || !phone || !email) return "Anh/chị nhập họ tên, số điện thoại và email trước khi bắt đầu nhé.";
  return "";
}

async function submitProfileAssessment() {
  if (submitting) return;
  const missing = state.questions.find((question) => question.required && !state.answers[question.code]);
  if (missing) {
    state.index = state.questions.indexOf(missing);
    render();
    const msg = document.querySelector("[data-investor-profile-message]");
    if (msg) msg.textContent = "Anh/chị chọn một phương án trước khi tiếp tục nhé.";
    return;
  }

  submitting = true;
  render();
  const { data, error } = await supabaseClient.rpc(SUBMIT_RPC, {
    p_full_name: state.contact.fullName.trim(),
    p_phone: state.contact.phone.trim(),
    p_email: state.contact.email.trim(),
    p_source: ASSESSMENT_SOURCE,
    p_answers: buildSubmitPayload(),
  });
  submitting = false;

  if (error) {
    render();
    const msg = document.querySelector("[data-investor-profile-message]");
    if (msg) msg.textContent = getFriendlyError(error, "Chưa thể gửi bài đánh giá. Vui lòng thử lại sau.");
    return;
  }

  state.status = "result";
  state.result = normalizeResult(data);
  persistResultContext(state.result);
  render();
  showToast("Đã hoàn tất đánh giá hồ sơ nhà đầu tư.");
}

function persistResultContext(result) {
  const assessmentId = result.assessment_id || result.id || null;
  const claimToken = result.claim_token || result.claimToken || null;
  if (assessmentId) localStorage.setItem(pendingAssessmentKey, assessmentId);
  if (claimToken) localStorage.setItem(pendingClaimTokenKey, claimToken);
  if (result && Object.keys(result).length) localStorage.setItem(latestGuestResultKey, JSON.stringify(result));
  setContactContext(ASSESSMENT_SOURCE, {
    source: ASSESSMENT_SOURCE,
    assessmentId,
    claimToken,
    primaryGap: result.primary_gap || null,
    reasonToMeet: result.reason_to_meet || "",
    prefill: {
      fullName: state.contact.fullName.trim(),
      phone: state.contact.phone.trim(),
      email: state.contact.email.trim(),
    },
  });
}

function renderResult(el) {
  const result = state.result || {};
  const score = result.overall_score ?? result.score ?? result.total_score ?? "-";
  const primaryGap = result.primary_gap || result.primary_gap_code || "";
  const secondaryGap = result.secondary_gap || result.secondary_gap_code || "";
  const severity = result.severity || result.primary_gap_severity || "";
  const reason = result.reason_to_meet || "";
  const nextAction = result.next_best_action || "";
  const scores = normalizeScores(result.scores);
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];

  el.innerHTML = `
    <section class="profile-assessment-shell profile-assessment-result" aria-labelledby="assessment-title" aria-live="polite">
      <p class="eyebrow">Kết quả hồ sơ nhà đầu tư</p>
      <h2 id="assessment-title">${esc(primaryGap ? labelDimension(primaryGap) : "Hồ sơ đã được ghi nhận")}</h2>
      <div class="profile-result-score"><span>Điểm đánh giá</span><strong>${esc(score)}</strong></div>
      <div class="profile-result-grid">
        ${resultMeta("Điểm cần ưu tiên trước", primaryGap ? labelDimension(primaryGap) : "Chưa xác định")}
        ${secondaryGap ? resultMeta("Điểm cần ưu tiên tiếp theo", labelDimension(secondaryGap)) : ""}
        ${severity ? resultMeta("Mức độ cần lưu ý", labelSeverity(severity)) : ""}
      </div>
      ${scores.length ? renderScores(scores) : ""}
      ${gaps.length ? renderGaps(gaps) : ""}
      ${reason ? `<section class="profile-result-block"><h3>Lý do nên trao đổi</h3><p>${esc(reason)}</p></section>` : ""}
      ${nextAction ? `<section class="profile-result-block"><h3>Việc nên làm tiếp theo</h3><p>${esc(nextAction)}</p></section>` : ""}
      <div class="wizard-actions profile-result-actions">
        <button class="button button-primary" type="button" data-open-contact data-contact-source="${ASSESSMENT_SOURCE}">Rà soát 1:1 cùng Võ Hoàng</button>
        <button class="button button-secondary" type="button" data-open-investor-profile>Làm lại đánh giá</button>
        <p class="assessment-micro-disclaimer">Kết quả mang tính tham khảo và được tính từ dữ liệu anh/chị cung cấp. <button type="button" data-open-legal="disclaimer">Xem miễn trừ trách nhiệm</button></p>
      </div>
    </section>
  `;
}

function normalizeScores(scores) {
  if (!scores) return [];
  if (Array.isArray(scores)) return scores;
  return Object.entries(scores).map(([dimension, item]) => ({
    dimension,
    ...(item && typeof item === "object" ? item : { score: item }),
  }));
}

function resultMeta(label, value) {
  return `<article><span>${esc(label)}</span><strong>${esc(value || "-")}</strong></article>`;
}

function renderScores(scores) {
  return `<section class="profile-result-block"><h3>Điểm theo trục</h3><div class="profile-score-grid">${scores.map((item) => {
    const code = item.dimension || item.dimension_code || item.code;
    const value = item.score ?? item.value ?? item.metric_value ?? 0;
    const levelLabel = item.level ? labelSeverity(item.level) : "";
    const level = levelLabel ? ` · ${levelLabel}` : "";
    return `<article><span>${esc(labelDimension(code))}${esc(level)}</span><strong>${esc(value)}/100</strong></article>`;
  }).join("")}</div></section>`;
}

function renderGaps(gaps) {
  return `<section class="profile-result-block"><h3>Điểm cần cải thiện</h3><div class="gap-list">${gaps.map((gap) => {
    const code = gap.gap_type || gap.dimension || gap.code;
    const severity = gap.severity ? ` · ${labelSeverity(gap.severity)}` : "";
    const copy = gap.description || gap.reason || gap.message || "";
    return `<article class="gap-card"><strong>${esc(labelDimension(code))}${esc(severity)}</strong>${copy ? `<p>${esc(copy)}</p>` : ""}</article>`;
  }).join("")}</div></section>`;
}

function bindEvents() {
  if (bound) return;
  bound = true;
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, a");
    if (!target) return;
    if (target.matches("[data-open-investor-profile]")) {
      event.preventDefault();
      openInvestorProfileAssessment();
    } else if (target.matches("[data-investor-profile-retry]")) {
      event.preventDefault();
      loadForm();
    } else if (target.matches("[data-investor-profile-start]")) {
      event.preventDefault();
      const message = validateContact();
      if (message) {
        const msg = document.querySelector("[data-investor-profile-message]");
        if (msg) msg.textContent = message;
        return;
      }
      state.status = "ready";
      state.index = 0;
      render();
    } else if (target.matches("[data-investor-profile-answer]")) {
      event.preventDefault();
      state.answers[target.dataset.investorProfileAnswer] = target.dataset.value;
      render();
    } else if (target.matches("[data-investor-profile-back]")) {
      event.preventDefault();
      if (state.status === "ready" && state.index > 0) state.index -= 1;
      else if (state.status === "ready") state.status = "intro";
      render();
    } else if (target.matches("[data-investor-profile-next]")) {
      event.preventDefault();
      if (state.index < state.questions.length - 1) {
        state.index += 1;
        render();
      } else {
        submitProfileAssessment();
      }
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const key = target.dataset.investorProfileContact;
    if (!key) return;
    state.contact[key] = target.value;
  });
}

export function initInvestorProfileAssessment() {
  bindEvents();
}
