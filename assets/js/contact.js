import { closeModals, dimensionLabels, openModal } from "./supabase-client.js";
import { renderMeetingForm } from "./meeting.js";

export const CONTACT_CONFIG = {
  phone: "0971853227",
  zalo: "0928007302",
  email: "vohoang.bank@gmail.com",
};

const contexts = new Map();
let activeContext = { source: "WEBSITE_CONTACT" };

function contactLink(type, value) {
  if (type === "zalo") return `https://zalo.me/${value}`;
  if (type === "phone") return `tel:${value}`;
  return `mailto:${value}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function root() {
  return document.querySelector("[data-contact-root]");
}

export function setContactContext(source, context) {
  if (!source) return;
  if (source === "WEBSITE_CONTACT" && context === null) {
    contexts.delete(source);
    return;
  }
  if (!context) return;
  contexts.set(source, context);
}

function resolveContext(source) {
  if (source === "WEBSITE_CONTACT") return { source: "WEBSITE_CONTACT" };
  return contexts.get(source) || { source: "WEBSITE_CONTACT" };
}

function renderAssessmentContext(context) {
  if (!context?.assessmentId && !context?.primaryGap) return "";
  const primary = context.primaryLabel || dimensionLabels[context.primaryGap] || "điểm cần cải thiện";
  return `
    <section class="contact-context contact-context-premium">
      <p>Kết quả của anh/chị cho thấy điểm nên ưu tiên rà soát là:</p>
      <strong>${escapeHtml(primary)}</strong>
      <small>${escapeHtml(context.reasonToMeet || "Điều anh/chị đang quan tâm có thể chưa hoàn toàn trùng với vấn đề nổi bật nhất hiện tại. Kết quả này giúp buổi trao đổi đi thẳng vào phần cần xử lý trước.")}</small>
    </section>
  `;
}

export function renderContactHome() {
  const el = root();
  if (!el) return;
  const actions = [
    { type: "meeting", label: "Hẹn một buổi trao đổi", value: "meeting" },
    { type: "zalo", label: "Zalo", value: CONTACT_CONFIG.zalo },
    { type: "phone", label: "Gọi điện", value: CONTACT_CONFIG.phone },
    { type: "email", label: "Email", value: CONTACT_CONFIG.email },
  ].filter((item) => item.value);

  el.innerHTML = `
    <p class="eyebrow">Liên hệ</p>
    <h2 id="contact-title">Trao đổi cùng Võ Hoàng</h2>
    <p class="modal-copy">Anh/chị có thể trao đổi trực tiếp về kết quả đánh giá hoặc vấn đề đang gặp trong cách đầu tư hiện tại.</p>
    ${renderAssessmentContext(activeContext)}
    <div class="contact-actions">
      ${actions.map((item) => {
        if (item.type === "meeting") {
          return `<button class="button button-primary contact-meeting-button" type="button" data-open-meeting>${item.label}</button>`;
        }
        return `
          <a class="button button-secondary" href="${contactLink(item.type, item.value)}" ${item.type === "zalo" ? 'target="_blank" rel="noopener"' : ""}>
            ${item.label}
          </a>
        `;
      }).join("")}
    </div>
  `;
}

export function openContactModal(context = null) {
  activeContext = context || { source: "WEBSITE_CONTACT" };
  closeModals();
  renderContactHome();
  openModal("contact");
}

export function initContact() {
  renderContactHome();

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-open-contact]");
    if (!target) return;
    event.preventDefault();
    if (target.dataset.contactSource === "WEBSITE_CONTACT") {
      setContactContext("WEBSITE_CONTACT", null);
    }
    openContactModal(resolveContext(target.dataset.contactSource));
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-open-meeting]");
    if (!target) return;
    event.preventDefault();
    renderMeetingForm(activeContext);
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-contact-home]");
    if (!target) return;
    event.preventDefault();
    renderContactHome();
  });
}
