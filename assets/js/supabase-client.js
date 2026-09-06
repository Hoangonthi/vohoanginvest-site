export const SUPABASE_URL = "https://elmrbnewlukxscbcfizg.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mmZzpw346GxIlWQRzasTHA_7JhDHC9g";

if (!window.supabase?.createClient) {
  throw new Error("Supabase JS chưa được tải.");
}

export const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export const pendingAssessmentKey = "vh_pending_assessment_id";
export const pendingClaimTokenKey = "vh_pending_claim_token";
export const latestGuestResultKey = "vh_latest_guest_assessment_result";

export function getFriendlyError(error, fallback = "Đã có lỗi xảy ra. Vui lòng thử lại.") {
  if (error) {
    console.error(error);
  }
  return fallback;
}

export function showToast(message) {
  const toast = document.querySelector("[data-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}

export function openModal(name) {
  const modal = document.querySelector(`[data-modal="${name}"]`);
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

export function closeModals() {
  document.querySelectorAll("[data-modal]").forEach((modal) => {
    modal.hidden = true;
  });
  document.body.classList.remove("modal-open");
}

export function formatDateVN(value) {
  if (!value) return "Chưa có ngày";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function getAssessmentDate(row) {
  return row?.completed_at || row?.completedAt || row?.submitted_at || row?.created_at || row?.assessment_date || row?.inserted_at;
}

export function getCooldownInfo(row) {
  const dateValue = getAssessmentDate(row);
  if (!dateValue) return { isBlocked: false, daysRemaining: 0, nextDate: null };
  const completedAt = new Date(dateValue);
  if (Number.isNaN(completedAt.getTime())) return { isBlocked: false, daysRemaining: 0, nextDate: null };
  const nextDate = new Date(completedAt);
  nextDate.setDate(nextDate.getDate() + 30);
  const diff = nextDate.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(diff / 86400000));
  return {
    isBlocked: diff > 0,
    daysRemaining,
    nextDate,
  };
}

export const dimensionLabels = {
  MONEY: "Nền tảng tài chính",
  RISK: "Quản trị rủi ro",
  PORTFOLIO: "Cấu trúc danh mục",
  STRATEGY: "Chiến lược",
  BEHAVIOUR: "Kỷ luật & hành vi",
  SYSTEM: "Hệ thống đầu tư",
};

export const levelLabels = {
  GOOD: "Tốt",
  WATCH: "Cần theo dõi",
  GAP: "Cần cải thiện",
  HIGH_GAP: "Cần ưu tiên",
};

export const severityLabels = {
  LOW: "Cần theo dõi",
  MEDIUM: "Cần cải thiện",
  HIGH: "Cần ưu tiên",
  CRITICAL: "Ưu tiên xử lý",
};
