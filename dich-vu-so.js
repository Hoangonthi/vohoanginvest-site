import { supabaseClient } from "./assets/js/supabase-client.js";

const form = document.querySelector("[data-service-form]");
const message = document.querySelector("[data-service-message]");
const submit = document.querySelector("[data-service-submit]");

function localDate(offsetDays = 1) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function friendlyError(error) {
  const text = `${error?.message || ""} ${error?.details || ""}`;
  if (text.includes("MEETING_INVALID_NAME")) return "Vui lòng nhập họ tên từ 2 ký tự trở lên.";
  if (text.includes("MEETING_INVALID_PHONE")) return "Vui lòng kiểm tra lại số điện thoại.";
  if (text.includes("MEETING_INVALID_EMAIL")) return "Email chưa đúng định dạng.";
  if (text.includes("MEETING_RATE_LIMIT")) return "Bạn đã gửi nhiều yêu cầu trong thời gian ngắn. Vui lòng nhắn Zalo để trao đổi trực tiếp.";
  if (text.includes("MEETING_DUPLICATE_REQUEST")) return "Yêu cầu đã được ghi nhận. Không cần gửi lại, tôi sẽ liên hệ sớm.";
  return "Chưa gửi được yêu cầu. Vui lòng thử lại hoặc nhắn Zalo 0928 007 302.";
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const fullName = String(data.get("fullName") || "").trim();
    const phone = normalizePhone(data.get("phone"));
    const email = String(data.get("email") || "").trim();
    const need = String(data.get("need") || "").trim();
    const urgency = String(data.get("urgency") || "NORMAL");

    if (fullName.length < 2) {
      message.textContent = "Vui lòng nhập họ và tên.";
      return;
    }
    if (phone.length < 9 || phone.length > 15) {
      message.textContent = "Vui lòng kiểm tra lại số điện thoại.";
      return;
    }
    if (need.length < 10) {
      message.textContent = "Anh/chị mô tả thêm một chút về việc đang cần xử lý nhé.";
      return;
    }

    message.textContent = "";
    submit.disabled = true;
    submit.textContent = "Đang gửi...";

    const note = `[SERVICE_REQUEST][${urgency}] ${need}`.slice(0, 1500);
    const { error } = await supabaseClient.rpc("submit_meeting_request", {
      p_assessment_id: null,
      p_claim_token: null,
      p_full_name: fullName,
      p_phone: phone,
      p_email: email || null,
      p_purpose: "OTHER",
      p_meeting_type: "PHONE",
      p_preferred_date: localDate(1),
      p_preferred_daypart: "FLEXIBLE",
      p_preferred_time: null,
      p_note: note,
      p_source: "SERVICE_PAGE",
    });

    submit.disabled = false;
    submit.textContent = "Gửi yêu cầu";

    if (error) {
      message.textContent = friendlyError(error);
      return;
    }

    form.reset();
    message.textContent = "Đã nhận yêu cầu. Tôi sẽ xem nội dung và liên hệ lại sớm nhất có thể.";
  });
}
