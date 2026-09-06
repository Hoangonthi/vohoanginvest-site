import {
  closeModals,
  formatDateVN,
  pendingAssessmentKey,
  pendingClaimTokenKey,
  showToast,
  supabaseClient,
} from "./supabase-client.js";

const purposes = [
  { value: "REVIEW_ASSESSMENT", label: "Rà soát kết quả đánh giá" },
  { value: "REVIEW_PORTFOLIO", label: "Rà soát danh mục hiện tại" },
  { value: "BUILD_METHOD", label: "Xây dựng phương pháp đầu tư phù hợp" },
  { value: "OTHER", label: "Vấn đề khác" },
];

const meetingTypes = [
  { value: "PHONE", label: "Gọi điện", description: "Trao đổi ngắn qua điện thoại" },
  { value: "ONLINE", label: "Trao đổi online", description: "Google Meet / Zalo Call" },
  { value: "IN_PERSON", label: "Gặp trực tiếp", description: "Thời gian và địa điểm sẽ được xác nhận lại" },
];

const dayparts = [
  { value: "MORNING", label: "Sáng" },
  { value: "AFTERNOON", label: "Chiều" },
  { value: "EVENING", label: "Tối" },
  { value: "FLEXIBLE", label: "Linh hoạt" },
];

const meetingHours = ["06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"];
const meetingMinutes = ["00", "15", "30", "45"];

const errorMessages = {
  MEETING_INVALID_NAME: "Vui lòng kiểm tra lại họ và tên.",
  MEETING_INVALID_PHONE: "Vui lòng nhập số điện thoại hợp lệ.",
  MEETING_INVALID_EMAIL: "Email chưa đúng định dạng.",
  MEETING_DATE_REQUIRED: "Vui lòng chọn ngày mong muốn.",
  MEETING_DATE_IN_PAST: "Ngày hẹn không thể là ngày đã qua.",
  MEETING_DATE_TOO_FAR: "Vui lòng chọn ngày trong vòng 90 ngày tới.",
  MEETING_NOTE_TOO_LONG: "Ghi chú tối đa 1.500 ký tự.",
  MEETING_DUPLICATE_REQUEST: "Bạn vừa gửi một yêu cầu trao đổi. Võ Hoàng sẽ liên hệ xác nhận, không cần gửi lại.",
  MEETING_RATE_LIMIT: "Bạn đã gửi nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau.",
  MEETING_ASSESSMENT_NOT_OWNED: "Không thể liên kết kết quả đánh giá này. Bạn vẫn có thể gửi yêu cầu trao đổi mới.",
  MEETING_GUEST_ASSESSMENT_INVALID: "Không thể liên kết kết quả đánh giá này. Bạn vẫn có thể gửi yêu cầu trao đổi mới.",
};

const meetingDraftKey = "vh_meeting_draft_v1";
let meetingContext = null;
let isSubmitting = false;
let isMeetingFormOpen = false;
let isDirty = false;
let saveDraftTimer = null;

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

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function labelFor(collection, value) {
  return collection.find((item) => item.value === value)?.label || value || "";
}

function selectedValue(form, name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function contextKey(context) {
  if (context?.assessmentId) return `assessment:${context.assessmentId}`;
  return `source:${context?.source || "WEBSITE_CONTACT"}`;
}

function getFormValues(form) {
  const formData = new FormData(form);
  const isFlexible = formData.get("isFlexible") === "on";
  const hour = String(formData.get("preferredHour") || "");
  const minute = String(formData.get("preferredMinute") || "");
  return {
    purpose: selectedValue(form, "purpose"),
    meeting_type: selectedValue(form, "meetingType"),
    preferred_date: String(formData.get("preferredDate") || ""),
    preferred_hour: isFlexible ? "" : hour,
    preferred_minute: isFlexible ? "" : minute,
    flexible: isFlexible,
    full_name: String(formData.get("fullName") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    note: String(formData.get("note") || ""),
    source: meetingContext?.source || "WEBSITE_CONTACT",
    assessment_id: meetingContext?.assessmentId || null,
    context_key: contextKey(meetingContext),
  };
}

function readDraft(context) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(meetingDraftKey) || "null");
    if (!draft) return null;
    const currentKey = contextKey(context);
    if (draft.assessment_id && draft.assessment_id === (context?.assessmentId || null)) return draft;
    if (!draft.assessment_id && !(context?.assessmentId) && draft.context_key === currentKey) return draft;
    return null;
  } catch {
    sessionStorage.removeItem(meetingDraftKey);
    return null;
  }
}

function saveDraft(form, immediate = false) {
  if (!form) return;
  window.clearTimeout(saveDraftTimer);
  if (immediate) {
    sessionStorage.setItem(meetingDraftKey, JSON.stringify(getFormValues(form)));
    return;
  }
  saveDraftTimer = window.setTimeout(() => {
    sessionStorage.setItem(meetingDraftKey, JSON.stringify(getFormValues(form)));
  }, 250);
}

function clearDraft() {
  window.clearTimeout(saveDraftTimer);
  sessionStorage.removeItem(meetingDraftKey);
}

function parseDateValue(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function isSameLocalDate(left, right) {
  return left?.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function isFutureDate(value) {
  const date = parseDateValue(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date && date > today;
}

function isToday(value) {
  const date = parseDateValue(value);
  return Boolean(date && isSameLocalDate(date, new Date()));
}

function timeToMinutes(hour, minute) {
  if (!hour || !minute) return null;
  return Number(hour) * 60 + Number(minute);
}

function isFutureTime(dateValue, hour, minute) {
  const selected = timeToMinutes(hour, minute);
  if (selected === null) return false;
  if (isFutureDate(dateValue)) return true;
  if (!isToday(dateValue)) return false;
  const now = new Date();
  return selected > now.getHours() * 60 + now.getMinutes();
}

function hasEnabledMinute(dateValue, hour) {
  return meetingMinutes.some((minute) => isFutureTime(dateValue, hour, minute));
}

function splitTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  return match ? { hour: match[1], minute: match[2] } : { hour: "", minute: "" };
}

function normalizedDraft(draft, context) {
  if (!draft) return null;
  const fallback = splitTime(draft.preferred_time);
  const value = {
    ...draft,
    preferred_hour: draft.preferred_hour || fallback.hour,
    preferred_minute: draft.preferred_minute || fallback.minute,
    flexible: Boolean(draft.flexible ?? draft.is_flexible),
  };
  if (!isFutureDate(value.preferred_date) && !isToday(value.preferred_date)) {
    return { ...value, preferred_date: localDate(1), preferred_hour: "", preferred_minute: "" };
  }
  if (!value.flexible && value.preferred_hour && value.preferred_minute && !isFutureTime(value.preferred_date, value.preferred_hour, value.preferred_minute)) {
    return { ...value, preferred_hour: "", preferred_minute: "" };
  }
  return {
    ...value,
    context_key: value.context_key || contextKey(context),
  };
}

function composeTime(hour, minute, isFlexible) {
  if (isFlexible) return "";
  return hour && minute ? `${hour}:${minute}` : "";
}

function deriveDaypart(hour, isFlexible) {
  if (isFlexible || !hour) return "FLEXIBLE";
  const value = Number(hour);
  if (value <= 11) return "MORNING";
  if (value <= 17) return "AFTERNOON";
  return "EVENING";
}

function renderHourOptions(dateValue, selectedHour, isFlexible) {
  return `
    <option value="">Giờ</option>
    ${meetingHours.map((hour) => {
      const disabled = !dateValue || isFlexible || !hasEnabledMinute(dateValue, hour);
      return `<option value="${hour}" ${hour === selectedHour ? "selected" : ""} ${disabled ? "disabled" : ""}>${hour}</option>`;
    }).join("")}
  `;
}

function renderMinuteOptions(dateValue, selectedHour, selectedMinute, isFlexible) {
  return `
    <option value="">Phút</option>
    ${meetingMinutes.map((minute) => {
      const disabled = !dateValue || !selectedHour || isFlexible || !isFutureTime(dateValue, selectedHour, minute);
      return `<option value="${minute}" ${minute === selectedMinute ? "selected" : ""} ${disabled ? "disabled" : ""}>${minute}</option>`;
    }).join("")}
  `;
}

function syncTimeControls(form, changedField = "") {
  const dateInput = form.querySelector('input[name="preferredDate"]');
  const hourSelect = form.querySelector("[data-preferred-hour]");
  const minuteSelect = form.querySelector("[data-preferred-minute]");
  const flexibleInput = form.querySelector("[data-flexible-time]");
  if (!dateInput || !hourSelect || !minuteSelect || !flexibleInput) return;

  const dateValue = dateInput.value;
  const isFlexible = flexibleInput.checked;
  let selectedHour = hourSelect.value;
  let selectedMinute = minuteSelect.value;

  if (changedField === "date" || isFlexible || !dateValue || !hasEnabledMinute(dateValue, selectedHour)) {
    selectedHour = "";
    selectedMinute = "";
  }
  if (changedField === "hour" || !selectedHour || !isFutureTime(dateValue, selectedHour, selectedMinute)) {
    selectedMinute = "";
  }

  hourSelect.innerHTML = renderHourOptions(dateValue, selectedHour, isFlexible);
  hourSelect.value = selectedHour;
  hourSelect.disabled = !dateValue || isFlexible;

  minuteSelect.innerHTML = renderMinuteOptions(dateValue, selectedHour, selectedMinute, isFlexible);
  minuteSelect.value = selectedMinute;
  minuteSelect.disabled = !dateValue || !selectedHour || isFlexible;
}

function readStoredGuestLink() {
  return {
    assessmentId: localStorage.getItem(pendingAssessmentKey) || null,
    claimToken: localStorage.getItem(pendingClaimTokenKey) || null,
  };
}

function safeMeetingError(error) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`;
  const key = Object.keys(errorMessages).find((code) => text.includes(code));
  return key ? errorMessages[key] : "Không thể gửi yêu cầu lúc này. Vui lòng thử lại.";
}

function renderChoiceGroup(name, items, selected, className = "") {
  return `
    <div class="meeting-choice-grid ${className}">
      ${items.map((item) => `
        <label class="meeting-choice">
          <input type="radio" name="${name}" value="${item.value}" ${item.value === selected ? "checked" : ""} />
          <span>
            <strong>${escapeHtml(item.label)}</strong>
            ${item.description ? `<small>${escapeHtml(item.description)}</small>` : ""}
          </span>
        </label>
      `).join("")}
    </div>
  `;
}

async function getPrefill(context) {
  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user;
  return {
    fullName: context?.prefill?.fullName || user?.user_metadata?.full_name || user?.user_metadata?.name || "",
    phone: context?.prefill?.phone || "",
    email: context?.prefill?.email || user?.email || "",
  };
}

export async function renderMeetingForm(context = null) {
  meetingContext = context;
  const el = root();
  if (!el) return;
  const prefill = await getPrefill(context);
  const draft = normalizedDraft(readDraft(context), context);
  const defaultPurpose = context?.assessmentId ? "REVIEW_ASSESSMENT" : "REVIEW_PORTFOLIO";
  const values = {
    purpose: draft?.purpose || defaultPurpose,
    meetingType: draft?.meeting_type || "ONLINE",
    preferredDate: draft?.preferred_date || localDate(1),
    preferredHour: draft?.preferred_hour || "",
    preferredMinute: draft?.preferred_minute || "",
    isFlexible: Boolean(draft?.flexible),
    fullName: draft?.full_name ?? prefill.fullName,
    phone: draft?.phone ?? prefill.phone,
    email: draft?.email ?? prefill.email,
    note: draft?.note || "",
  };
  isMeetingFormOpen = true;
  isDirty = Boolean(draft);

  el.innerHTML = `
    <form class="meeting-form" data-meeting-form novalidate>
      <button class="contact-back" type="button" data-contact-home>← Quay lại</button>
      <p class="eyebrow">Trao đổi quản trị tài sản cá nhân</p>
      <h2 id="contact-title">Hẹn một buổi trao đổi</h2>
      <p class="modal-copy">Chọn nội dung và thời gian phù hợp. Võ Hoàng sẽ xác nhận lại trước buổi trao đổi.</p>

      <fieldset>
        <legend>Bạn muốn trao đổi về điều gì?</legend>
        ${renderChoiceGroup("purpose", purposes, values.purpose)}
      </fieldset>

      <fieldset>
        <legend>Hình thức trao đổi</legend>
        ${renderChoiceGroup("meetingType", meetingTypes, values.meetingType, "meeting-choice-grid-3")}
      </fieldset>

      <div class="meeting-field-grid">
        <label>
          <span>Ngày mong muốn</span>
          <input name="preferredDate" type="date" min="${localDate(0)}" max="${localDate(90)}" value="${escapeHtml(values.preferredDate)}" required />
        </label>
        <div class="meeting-time-field">
          <span>Giờ mong muốn</span>
          <div class="meeting-time-selects">
            <select class="meeting-time-select" name="preferredHour" ${!values.preferredDate || values.isFlexible ? "disabled" : ""} data-preferred-hour>
              ${renderHourOptions(values.preferredDate, values.preferredHour, values.isFlexible)}
            </select>
            <b aria-hidden="true">:</b>
            <select class="meeting-time-select" name="preferredMinute" ${!values.preferredDate || !values.preferredHour || values.isFlexible ? "disabled" : ""} data-preferred-minute>
              ${renderMinuteOptions(values.preferredDate, values.preferredHour, values.preferredMinute, values.isFlexible)}
            </select>
          </div>
        </div>
      </div>

      <label class="meeting-flexible">
        <input name="isFlexible" type="checkbox" ${values.isFlexible ? "checked" : ""} data-flexible-time />
        <span>Thời gian linh hoạt, Võ Hoàng có thể liên hệ xác nhận giờ phù hợp.</span>
      </label>

      <div class="meeting-field-grid">
        <label>
          <span>Họ và tên *</span>
          <input name="fullName" type="text" autocomplete="name" value="${escapeHtml(values.fullName)}" required />
        </label>
        <label>
          <span>Số điện thoại *</span>
          <input name="phone" type="tel" autocomplete="tel" value="${escapeHtml(values.phone)}" required />
        </label>
      </div>

      <label>
        <span>Email</span>
        <input name="email" type="email" autocomplete="email" value="${escapeHtml(values.email)}" />
      </label>

      <label>
        <span>Bạn muốn Võ Hoàng chuẩn bị hoặc xem trước vấn đề gì?</span>
        <textarea name="note" maxlength="1500" placeholder="Ví dụ: Tôi muốn rà soát cách sử dụng margin và mức lỗ hiện tại..." data-note-input>${escapeHtml(values.note)}</textarea>
        <small class="meeting-counter"><span data-note-count>${values.note.length}</span>/1500 ký tự</small>
      </label>

      <p class="form-note" data-meeting-message aria-live="polite"></p>
      <button class="button button-primary meeting-submit" type="submit" data-meeting-submit>Gửi yêu cầu trao đổi</button>
    </form>
  `;
}

function renderCloseConfirm() {
  const el = root();
  if (!el) return;
  el.innerHTML = `
    <div class="meeting-close-confirm">
      <p class="eyebrow">Thông tin chưa gửi</p>
      <h2 id="contact-title">Bạn đang có thông tin chưa gửi.</h2>
      <p class="modal-copy">Nội dung đang nhập sẽ được giữ lại trong phiên này. Bạn có muốn đóng cửa sổ hẹn không?</p>
      <div class="wizard-actions">
        <button class="button button-primary" type="button" data-meeting-continue>Tiếp tục điền</button>
        <button class="button button-secondary" type="button" data-meeting-close-confirmed>Đóng cửa sổ</button>
      </div>
    </div>
  `;
}

function renderSuccess(summary, linkedAssessment) {
  const el = root();
  if (!el) return;
  isMeetingFormOpen = false;
  isDirty = false;
  el.innerHTML = `
    <div class="meeting-success">
      <p class="eyebrow">Yêu cầu trao đổi</p>
      <h2 id="contact-title">Đã nhận yêu cầu của bạn</h2>
      <p class="modal-copy">Võ Hoàng sẽ liên hệ để xác nhận lại thời gian trước buổi trao đổi.</p>
      <dl class="meeting-summary">
        <div><dt>Mục đích</dt><dd>${escapeHtml(labelFor(purposes, summary.purpose))}</dd></div>
        <div><dt>Hình thức</dt><dd>${escapeHtml(labelFor(meetingTypes, summary.meetingType))}</dd></div>
        <div><dt>Ngày</dt><dd>${escapeHtml(formatDateVN(summary.preferredDate))}</dd></div>
        <div><dt>Khung giờ</dt><dd>${escapeHtml(labelFor(dayparts, summary.daypart))}</dd></div>
        ${summary.preferredTime ? `<div><dt>Giờ mong muốn</dt><dd>${escapeHtml(summary.preferredTime)}</dd></div>` : ""}
      </dl>
      ${linkedAssessment ? `<p class="meeting-linked-note">Kết quả đánh giá của bạn đã được đính kèm để buổi trao đổi đi thẳng vào vấn đề cần ưu tiên.</p>` : ""}
      <div class="wizard-actions">
        <button class="button button-primary" type="button" data-close-modal>Hoàn tất</button>
      </div>
    </div>
  `;
}

async function submitMeeting(form) {
  if (isSubmitting) return;
  const message = form.querySelector("[data-meeting-message]");
  const submit = form.querySelector("[data-meeting-submit]");
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const isAuthenticated = Boolean(sessionData.session?.user);
  const storedGuestLink = readStoredGuestLink();
  const formData = new FormData(form);
  const isFlexible = formData.get("isFlexible") === "on";
  const preferredHour = String(formData.get("preferredHour") || "");
  const preferredMinute = String(formData.get("preferredMinute") || "");
  const summary = {
    purpose: selectedValue(form, "purpose"),
    meetingType: selectedValue(form, "meetingType"),
    preferredDate: String(formData.get("preferredDate") || ""),
    preferredHour,
    preferredMinute,
    preferredTime: composeTime(preferredHour, preferredMinute, isFlexible),
    isFlexible,
  };
  summary.daypart = deriveDaypart(summary.preferredHour, summary.isFlexible);
  if (!summary.preferredDate) {
    if (message) message.textContent = "Vui lòng chọn ngày mong muốn.";
    return;
  }
  if (!summary.isFlexible && !summary.preferredHour) {
    if (message) message.textContent = "Vui lòng chọn giờ mong muốn.";
    return;
  }
  if (!summary.isFlexible && !summary.preferredMinute) {
    if (message) message.textContent = "Vui lòng chọn phút.";
    return;
  }
  if (!summary.isFlexible && !isFutureTime(summary.preferredDate, summary.preferredHour, summary.preferredMinute)) {
    if (message) message.textContent = "Thời gian mong muốn không thể là thời gian đã qua.";
    return;
  }
  const assessmentId = meetingContext?.assessmentId || null;
  const claimToken = isAuthenticated
    ? null
    : meetingContext?.claimToken || (assessmentId === storedGuestLink.assessmentId ? storedGuestLink.claimToken : null);

  isSubmitting = true;
  if (message) message.textContent = "";
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Đang gửi yêu cầu...";
  }

  const { error } = await supabaseClient.rpc("submit_meeting_request", {
    p_assessment_id: assessmentId,
    p_claim_token: claimToken,
    p_full_name: String(formData.get("fullName") || "").trim(),
    p_phone: String(formData.get("phone") || "").trim(),
    p_email: String(formData.get("email") || "").trim() || null,
    p_purpose: summary.purpose,
    p_meeting_type: summary.meetingType,
    p_preferred_date: summary.preferredDate,
    p_preferred_daypart: summary.daypart,
    p_preferred_time: summary.preferredTime || null,
    p_note: String(formData.get("note") || "").trim() || null,
    p_source: meetingContext?.source || "WEBSITE_CONTACT",
  });

  isSubmitting = false;
  if (submit) {
    submit.disabled = false;
    submit.textContent = "Gửi yêu cầu trao đổi";
  }

  if (error) {
    const friendly = safeMeetingError(error);
    if (message) message.textContent = friendly;
    if (/liên kết kết quả/.test(friendly)) {
      meetingContext = { ...meetingContext, assessmentId: null, claimToken: null };
    }
    return;
  }

  clearDraft();
  showToast("Yêu cầu trao đổi đã được gửi.");
  renderSuccess(summary, Boolean(assessmentId));
}

function requestCloseFromMeeting() {
  if (!isMeetingFormOpen) return false;
  const form = document.querySelector("[data-meeting-form]");
  if (form) saveDraft(form, true);
  if (isSubmitting) return true;
  if (isDirty) {
    renderCloseConfirm();
    return true;
  }
  isMeetingFormOpen = false;
  closeModals();
  return true;
}

export function initMeeting() {
  document.addEventListener("click", (event) => {
    const homeButton = event.target.closest("[data-contact-home]");
    if (!homeButton || !isMeetingFormOpen) return;
    const form = document.querySelector("[data-meeting-form]");
    if (form) saveDraft(form, true);
    isMeetingFormOpen = false;
  }, true);

  document.addEventListener("click", (event) => {
    const closeTarget = event.target.closest("[data-close-modal]");
    if (!closeTarget || !isMeetingFormOpen) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const isBackdrop = closeTarget.classList.contains("modal-backdrop");
    if (isBackdrop) return;
    requestCloseFromMeeting();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isMeetingFormOpen) return;
    event.preventDefault();
    event.stopPropagation();
    requestCloseFromMeeting();
  }, true);

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-meeting-form]");
    if (!form) return;
    event.preventDefault();
    submitMeeting(form);
  });

  document.addEventListener("input", (event) => {
    const form = event.target.closest("[data-meeting-form]");
    if (!form) return;
    isDirty = true;
    saveDraft(form);
    if (event.target.matches("[data-note-input]")) {
      const counter = document.querySelector("[data-note-count]");
      if (counter) counter.textContent = String(event.target.value.length);
    }
  });

  document.addEventListener("change", (event) => {
    const form = event.target.closest("[data-meeting-form]");
    if (!form) return;
    isDirty = true;
    if (event.target.matches('input[name="preferredDate"]')) {
      syncTimeControls(form, "date");
    }
    if (event.target.matches("[data-preferred-hour]")) {
      syncTimeControls(form, "hour");
    }
    if (event.target.matches("[data-flexible-time]")) {
      syncTimeControls(form, "flexible");
    }
    saveDraft(form);
  });

  document.addEventListener("click", (event) => {
    const continueButton = event.target.closest("[data-meeting-continue]");
    if (continueButton) {
      event.preventDefault();
      renderMeetingForm(meetingContext);
      return;
    }

    const closeButton = event.target.closest("[data-meeting-close-confirmed]");
    if (!closeButton) return;
    event.preventDefault();
    isMeetingFormOpen = false;
    closeModals();
  });
}
