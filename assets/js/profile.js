import {
  closeModals,
  dimensionLabels,
  formatDateVN,
  getAssessmentDate,
  getCooldownInfo,
  getFriendlyError,
  openModal,
  showToast,
  supabaseClient,
} from "./supabase-client.js";
import { setContactContext } from "./contact.js";

function root() {
  return document.querySelector("[data-profile-root]");
}

function profilePanel() {
  return document.querySelector('[data-modal="profile"] .modal-panel');
}

function resetProfileScroll() {
  const panel = profilePanel();
  if (panel) panel.scrollTop = 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeRows(data) {
  const rows = Array.isArray(data) ? data : [];
  return rows.sort((a, b) => {
    const left = new Date(getAssessmentDate(b) || 0);
    const right = new Date(getAssessmentDate(a) || 0);
    return left - right;
  });
}

function normalizeScores(scores) {
  if (!scores) return [];
  if (Array.isArray(scores)) return scores;
  return Object.entries(scores).map(([dimension, value]) => {
    if (typeof value === "number") {
      return { dimension, score: value };
    }
    return { dimension, ...value };
  });
}

function formatScore(value) {
  const score = Number(value ?? 0);
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatDelta(delta) {
  if (delta === null) return "";
  if (Math.abs(delta) < 0.05) return "Không thay đổi đáng kể so với lần trước";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)} điểm so với lần trước`;
}

function renderScores(scores) {
  const items = normalizeScores(scores);
  if (!items.length) return "";
  return `
    <div class="profile-score-grid">
      ${items.map((item) => {
        const dimension = item.dimension || item.code || item.dimension_code;
        const score = Number(item.score ?? item.value ?? 0);
        return `
          <article>
            <span>${escapeHtml(dimensionLabels[dimension] || dimension || "Trục")}</span>
            <strong>${formatScore(score)}/100</strong>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderCooldown(latest) {
  const info = getCooldownInfo(latest);
  if (!info.isBlocked) return "";
  return `
    <p class="profile-cooldown">
      Bạn có thể đánh giá lại sau ${info.daysRemaining} ngày${info.nextDate ? `, từ ${formatDateVN(info.nextDate)}` : ""}.
    </p>
  `;
}

function renderProfile(rows) {
  const el = root();
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = `
      <div class="profile-empty">
        <p class="eyebrow">Hồ sơ đầu tư của tôi</p>
        <h2 id="profile-title">Chưa có bài đánh giá nào.</h2>
        <p>Hãy bắt đầu bằng một bài đánh giá hệ thống đầu tư để tạo hồ sơ đầu tiên.</p>
        <button class="button button-primary" type="button" data-open-investor-profile>Đánh giá hồ sơ nhà đầu tư</button>
      </div>
    `;
    resetProfileScroll();
    return;
  }

  const latest = rows[0];
  const previous = rows[1];
  const latestScore = Number(latest.overall_score ?? 0);
  const previousScore = previous ? Number(previous.overall_score ?? 0) : null;
  const delta = previousScore === null ? null : latestScore - previousScore;
  const primaryGap = dimensionLabels[latest.primary_gap] || latest.primary_gap || "Chưa xác định";
  setContactContext("INVESTMENT_PROFILE", {
    source: "INVESTMENT_PROFILE",
    assessmentId: latest.assessment_id || null,
    claimToken: null,
    primaryGap: latest.primary_gap || null,
    reasonToMeet: latest.reason_to_meet || "",
    prefill: {
      fullName: latest.full_name || latest.customer_name || latest.name || "",
      phone: latest.phone || latest.customer_phone || "",
      email: latest.email || latest.customer_email || "",
    },
  });

  el.innerHTML = `
    <div class="profile-view">
      <p class="eyebrow">Hồ sơ đầu tư của tôi</p>
      <h2 id="profile-title">Lần đánh giá mới nhất</h2>
      <section class="profile-latest">
        <div>
          <strong>${formatScore(latestScore)}/100</strong>
          <span>${escapeHtml(formatDateVN(getAssessmentDate(latest)))}</span>
          ${delta === null ? "" : `<p>${escapeHtml(formatDelta(delta))}</p>`}
          ${renderCooldown(latest)}
        </div>
        <article>
          <p class="eyebrow">Điểm cần ưu tiên</p>
          <h3>${escapeHtml(primaryGap)}</h3>
          <p>${escapeHtml(latest.reason_to_meet || "")}</p>
          <p>${escapeHtml(latest.next_best_action || "")}</p>
          <button class="button button-primary profile-contact-button" type="button" data-open-contact data-contact-source="INVESTMENT_PROFILE">Trao đổi cùng Võ Hoàng</button>
        </article>
      </section>
      ${renderScores(latest.scores)}
      <section class="profile-history">
        <h3>Lịch sử đánh giá</h3>
        ${rows.map((row) => `
          <article>
            <span>${escapeHtml(formatDateVN(getAssessmentDate(row)))}</span>
            <strong>${formatScore(row.overall_score)}/100</strong>
          </article>
        `).join("")}
      </section>
      <section class="profile-contact-block">
        <h3>Bạn muốn rà soát sâu hơn kết quả này?</h3>
        <p>Kết quả đánh giá giúp xác định điểm cần ưu tiên trong cách bạn đang đầu tư. Một buổi trao đổi trực tiếp có thể giúp làm rõ cách xử lý phù hợp với vốn, mục tiêu và khả năng chịu rủi ro của bạn.</p>
        <button class="button button-primary" type="button" data-open-contact data-contact-source="INVESTMENT_PROFILE">Trao đổi cùng Võ Hoàng</button>
      </section>
    </div>
  `;
  resetProfileScroll();
}

async function openProfile() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session?.user) {
    openModal("auth");
    showToast("Vui lòng đăng nhập để xem hồ sơ đầu tư.");
    return;
  }

  openModal("profile");
  resetProfileScroll();
  const el = root();
  if (el) {
    el.innerHTML = `<div class="profile-empty"><p class="eyebrow">Đang tải</p><h2 id="profile-title">Đang tải hồ sơ đầu tư...</h2></div>`;
  }

  const { data, error } = await supabaseClient.rpc("get_my_investment_assessments");
  if (error) {
    if (el) {
      el.innerHTML = `
        <div class="profile-empty">
          <p class="eyebrow">Hồ sơ đầu tư</p>
          <h2 id="profile-title">Không thể tải hồ sơ.</h2>
          <p>${escapeHtml(getFriendlyError(error, "Không thể tải hồ sơ đầu tư. Vui lòng thử lại."))}</p>
        </div>
      `;
      resetProfileScroll();
    }
    return;
  }

  renderProfile(normalizeRows(data));
}

export function initProfile() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-open-profile]");
    if (!target) return;
    closeModals();
    openProfile();
  });

  document.addEventListener("vh:open-profile", openProfile);
}
