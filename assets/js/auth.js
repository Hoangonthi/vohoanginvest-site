import {
  closeModals,
  getFriendlyError,
  openModal,
  pendingAssessmentKey,
  pendingClaimTokenKey,
  showToast,
  supabaseClient,
} from "./supabase-client.js";

let authMode = "login";
let claimInFlight = false;
const afterAuthProfileKey = "vh_after_auth_open_profile";

function setLoading(button, isLoading, label) {
  if (!button) return;
  button.disabled = isLoading;
  if (label) button.textContent = label;
}

function getUserLabel(user) {
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Tài khoản";
  return name.length > 22 ? `${name.slice(0, 20)}…` : name;
}

function renderAccount(user) {
  const trigger = document.querySelector("[data-auth-trigger]");
  const menu = document.querySelector("[data-account-menu]");
  if (!trigger) return;

  if (!user) {
    trigger.innerHTML = "Đăng nhập";
    trigger.dataset.state = "guest";
    if (menu) menu.hidden = true;
    return;
  }

  trigger.innerHTML = `<span class="account-avatar">${getUserLabel(user).charAt(0).toUpperCase()}</span><span>${getUserLabel(user)}</span>`;
  trigger.dataset.state = "signed-in";
}

function setAuthMode(mode) {
  authMode = mode;
  const title = document.querySelector("[data-auth-title]");
  const submit = document.querySelector("[data-auth-submit]");
  const toggle = document.querySelector("[data-auth-mode-toggle]");
  const confirm = document.querySelector("[data-confirm-field]");
  const password = document.querySelector('[data-auth-form] input[name="password"]');

  if (mode === "signup") {
    if (title) title.textContent = "Đăng ký";
    if (submit) submit.textContent = "Đăng ký";
    if (toggle) toggle.textContent = "Đã có tài khoản? Đăng nhập";
    if (confirm) confirm.hidden = false;
    if (password) password.autocomplete = "new-password";
  } else {
    if (title) title.textContent = "Đăng nhập";
    if (submit) submit.textContent = "Đăng nhập";
    if (toggle) toggle.textContent = "Chưa có tài khoản? Đăng ký";
    if (confirm) confirm.hidden = true;
    if (password) password.autocomplete = "current-password";
  }
}

async function claimPendingAssessment() {
  if (claimInFlight) return;
  const assessmentId = localStorage.getItem(pendingAssessmentKey);
  const claimToken = localStorage.getItem(pendingClaimTokenKey);
  if (!assessmentId || !claimToken) return;

  claimInFlight = true;
  const { error } = await supabaseClient.rpc("claim_guest_assessment", {
    p_assessment_id: assessmentId,
    p_claim_token: claimToken,
  });

  localStorage.removeItem(pendingClaimTokenKey);
  if (!error) {
    showToast("Hồ sơ đánh giá đã được lưu vào tài khoản.");
    if (localStorage.getItem(afterAuthProfileKey) === "1") {
      localStorage.removeItem(afterAuthProfileKey);
      document.dispatchEvent(new CustomEvent("vh:open-profile"));
    }
  } else {
    console.warn("Không thể claim hồ sơ guest. Có thể hồ sơ đã được lưu trước đó.", error);
  }
  claimInFlight = false;
}

async function refreshSession() {
  const { data } = await supabaseClient.auth.getSession();
  renderAccount(data.session?.user || null);
  if (data.session?.user) {
    await claimPendingAssessment();
  }
}

function currentPageUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export function initAuth() {
  const trigger = document.querySelector("[data-auth-trigger]");
  const menu = document.querySelector("[data-account-menu]");
  const authForm = document.querySelector("[data-auth-form]");
  const message = document.querySelector("[data-auth-message]");
  const googleButton = document.querySelector("[data-google-signin]");
  const resetButton = document.querySelector("[data-reset-password]");
  const modeToggle = document.querySelector("[data-auth-mode-toggle]");
  const signOutButton = document.querySelector("[data-sign-out]");

  document.addEventListener("click", (event) => {
    const closeTarget = event.target.closest("[data-close-modal]");
    if (!closeTarget) return;
    if (closeTarget.classList.contains("modal-backdrop")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    closeModals();
  });

  trigger?.addEventListener("click", async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session?.user) {
      setAuthMode("login");
      openModal("auth");
      return;
    }
    if (menu) menu.hidden = !menu.hidden;
  });

  modeToggle?.addEventListener("click", () => {
    if (message) message.textContent = "";
    setAuthMode(authMode === "login" ? "signup" : "login");
  });

  googleButton?.addEventListener("click", async () => {
    setLoading(googleButton, true, "Đang chuyển đến Google...");
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: currentPageUrl(),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error && message) {
      message.textContent = getFriendlyError(error, "Không thể đăng nhập Google. Vui lòng thử lại.");
      setLoading(googleButton, false, "Tiếp tục với Google");
    }
  });

  authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (message) message.textContent = "";

    const formData = new FormData(authForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const submit = document.querySelector("[data-auth-submit]");

    if (authMode === "signup" && password !== confirmPassword) {
      if (message) message.textContent = "Mật khẩu xác nhận chưa khớp.";
      return;
    }

    setLoading(submit, true, authMode === "signup" ? "Đang đăng ký..." : "Đang đăng nhập...");
    const result = authMode === "signup"
      ? await supabaseClient.auth.signUp({ email, password })
      : await supabaseClient.auth.signInWithPassword({ email, password });

    setLoading(submit, false, authMode === "signup" ? "Đăng ký" : "Đăng nhập");

    if (result.error) {
      if (message) message.textContent = getFriendlyError(result.error, "Không thể hoàn tất xác thực. Vui lòng kiểm tra thông tin.");
      return;
    }

    if (authMode === "signup") {
      if (message) message.textContent = "Vui lòng kiểm tra email để xác nhận tài khoản.";
      authForm.reset();
      return;
    }

    closeModals();
    showToast("Đăng nhập thành công.");
    await refreshSession();
    if (localStorage.getItem(afterAuthProfileKey) === "1") {
      localStorage.removeItem(afterAuthProfileKey);
      document.dispatchEvent(new CustomEvent("vh:open-profile"));
    }
  });

  resetButton?.addEventListener("click", async () => {
    const emailInput = document.querySelector('[data-auth-form] input[name="email"]');
    const email = emailInput?.value.trim();
    if (!email) {
      if (message) message.textContent = "Vui lòng nhập email để đặt lại mật khẩu.";
      return;
    }
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: currentPageUrl(),
    });
    if (message) {
      message.textContent = error
        ? getFriendlyError(error, "Không thể gửi email đặt lại mật khẩu.")
        : "Đã gửi email đặt lại mật khẩu.";
    }
  });

  signOutButton?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    if (menu) menu.hidden = true;
    renderAccount(null);
    showToast("Đã đăng xuất.");
  });

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    renderAccount(session?.user || null);
    if (event === "SIGNED_IN" && session?.user) {
      await claimPendingAssessment();
    }
  });

  refreshSession();
}
