import { supabaseClient, getLeadSource } from "./supabase-client.js";
import { toolSession, trackTool } from "./tool-events.js";

let stylesReady = false;

function ensureStyles() {
  if (stylesReady || document.querySelector('link[data-market-lead-css]')) return;
  stylesReady = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./assets/css/market-lead.css";
  link.dataset.marketLeadCss = "";
  document.head.appendChild(link);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function phoneClean(value) {
  return String(value || "").replace(/\D/g, "");
}

function friendlyError(message) {
  const raw = String(message || "");
  if (raw.includes("CONSENT_REQUIRED")) return "Anh/chị cần đồng ý để nhận bản tin.";
  if (raw.includes("INVALID_NAME")) return "Vui lòng nhập họ tên từ 2 ký tự trở lên.";
  if (raw.includes("INVALID_PHONE")) return "Số điện thoại/Zalo chưa đúng.";
  if (raw.includes("INVALID_EMAIL")) return "Email chưa đúng định dạng.";
  return "Chưa gửi được đăng ký. Vui lòng thử lại sau ít phút.";
}

function sourceMeta(extra = {}) {
  const params = new URLSearchParams(location.search);
  return {
    page: location.pathname.split("/").pop() || "index.html",
    referrer: document.referrer ? new URL(document.referrer, location.href).hostname : "",
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    ...extra
  };
}

export function marketLeadFormHtml({ compact = false, source = "MARKET_BRIEF" } = {}) {
  return `<form class="market-lead-form${compact ? " is-compact" : ""}" data-market-lead-form data-lead-source="${esc(source)}" novalidate>
    <div class="market-lead-grid">
      <label><span>Họ tên</span><input name="full_name" autocomplete="name" maxlength="120" placeholder="Nguyễn Văn A" required></label>
      <label><span>SĐT / Zalo</span><input name="phone" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="09xx xxx xxx" required></label>
      <label class="market-lead-email"><span>Email <small>(không bắt buộc)</small></span><input name="email" type="email" autocomplete="email" maxlength="254" placeholder="email@example.com"></label>
      <label><span>Muốn nhận qua</span><select name="channel"><option value="ZALO">Zalo</option><option value="PHONE">Điện thoại</option><option value="EMAIL">Email</option></select></label>
    </div>
    <label class="market-lead-consent"><input name="consent" type="checkbox" required><span>Tôi đồng ý để Võ Hoàng liên hệ/gửi nội dung thị trường theo thông tin trên. Có thể yêu cầu dừng bất cứ lúc nào.</span></label>
    <div class="market-lead-submit-row">
      <button type="submit">NHẬN BẢN ĐỒ THỊ TRƯỜNG</button>
      <small>Không phím hàng · Không spam · Nội dung tập trung vào trạng thái, rủi ro và hành động.</small>
    </div>
    <p class="market-lead-message" data-market-lead-message aria-live="polite"></p>
  </form>`;
}

export function mountMarketLeadForm(container, options = {}) {
  if (!container) return;
  ensureStyles();
  if (!container.querySelector("[data-market-lead-form]")) {
    container.innerHTML = marketLeadFormHtml(options);
  }
  const form = container.querySelector("[data-market-lead-form]");
  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector("[data-market-lead-message]");
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const fullName = String(data.get("full_name") || "").trim();
    const phone = phoneClean(data.get("phone"));
    const email = String(data.get("email") || "").trim();
    const channel = String(data.get("channel") || "ZALO");
    const consent = data.get("consent") === "on";
    const source = String(form.dataset.leadSource || options.source || "MARKET_BRIEF");

    if (fullName.length < 2 || phone.length < 9 || !consent) {
      if (message) message.textContent = !consent ? "Vui lòng tích đồng ý trước khi đăng ký." : "Vui lòng nhập họ tên và SĐT/Zalo hợp lệ.";
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "ĐANG GỬI…";
    }
    if (message) message.textContent = "";

    try {
      const { data: result, error } = await supabaseClient.rpc("submit_market_brief_lead_v1", {
        p_full_name: fullName,
        p_phone: phone,
        p_email: email || null,
        p_channel: channel,
        p_source: getLeadSource(source),
        p_session_id: toolSession(),
        p_consent: consent,
        p_metadata: sourceMeta(options.metadata || {})
      });
      if (error) throw error;

      form.classList.add("is-success");
      form.innerHTML = `<div class="market-lead-success">
        <span>ĐÃ GHI NHẬN</span>
        <strong>Cảm ơn ${esc(fullName)}.</strong>
        <p>Thông tin đã vào hệ thống. Nội dung gửi đi sẽ ưu tiên: trạng thái thị trường, dòng tiền, rủi ro và việc nên làm tiếp theo.</p>
        <div class="market-lead-success-actions">
          <a href="https://zalo.me/0928007302" target="_blank" rel="noopener">Kết nối Zalo Võ Hoàng →</a>
          <a href="./?start=assessment&utm_source=market_brief">Làm đánh giá 17 câu →</a>
          <a href="thi-truong-hom-nay.html">Xem Bộ đọc realtime →</a>
        </div>
      </div>`;
      trackTool("MARKET_BRIEF", "LEAD_SUCCESS", { resultCode: result?.is_new ? "NEW" : "RETURNING", metadata: { channel, source } });
    } catch (error) {
      if (message) message.textContent = friendlyError(error?.message || error);
      trackTool("MARKET_BRIEF", "LEAD_ERROR", { resultCode: "ERROR", metadata: { source, error: String(error?.message || error).slice(0, 120) } });
      if (button) {
        button.disabled = false;
        button.textContent = "NHẬN BẢN ĐỒ THỊ TRƯỜNG";
      }
    }
  });
}

export function initAllMarketLeadForms() {
  ensureStyles();
  document.querySelectorAll("[data-market-lead-root]").forEach((root) => {
    mountMarketLeadForm(root, {
      compact: root.dataset.leadCompact === "1",
      source: root.dataset.leadSource || "MARKET_BRIEF"
    });
  });
}
