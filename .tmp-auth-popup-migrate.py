from pathlib import Path
import re

HEADER = Path("assets/js/site-header.js")
LOGIN = Path("dang-nhap.html")

text = HEADER.read_text(encoding="utf-8")

# Imports: reuse existing shared Supabase client + pending guest-assessment keys.
text = text.replace(
    'import { supabaseClient } from "./supabase-client.js";',
    'import { pendingAssessmentKey, pendingClaimTokenKey, supabaseClient } from "./supabase-client.js";'
)

# Signed-in dropdown: add password change without changing page content.
text = text.replace(
    '<a href="dang-nhap.html">Quản lý tài khoản</a>\n              <button type="button" data-sign-out>Đăng xuất</button>',
    '<a href="dang-nhap.html">Quản lý tài khoản</a>\n              <button type="button" data-change-password>Đổi mật khẩu</button>\n              <button type="button" data-sign-out>Đăng xuất</button>'
)

AUTH_CSS = r'''
    .vh-auth-backdrop{
      position:fixed;inset:0;z-index:560;display:grid;place-items:center;
      padding:18px;background:rgba(2,8,15,.78);backdrop-filter:blur(9px)
    }
    .vh-auth-backdrop[hidden]{display:none!important}
    .vh-auth-panel{
      width:min(430px,100%);border:1px solid rgba(224,187,99,.24);border-radius:20px;
      background:linear-gradient(180deg,#091c31,#061522);box-shadow:0 26px 80px rgba(0,0,0,.55);
      padding:22px;position:relative
    }
    .vh-auth-close{
      position:absolute;right:12px;top:12px;width:34px;height:34px;border:0;border-radius:10px;
      background:rgba(255,255,255,.05);color:#fff;font-size:20px;cursor:pointer
    }
    .vh-auth-kicker{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#f3cf74}
    .vh-auth-panel h2{margin:7px 36px 5px 0;font-size:24px;line-height:1.2;color:#fff}
    .vh-auth-panel>p{margin:0 0 16px;font-size:11px;line-height:1.55;color:rgba(231,237,246,.62)}
    .vh-auth-form{display:grid;gap:11px}
    .vh-auth-field{display:grid;gap:5px}
    .vh-auth-field label{font-size:10px;font-weight:700;color:rgba(255,255,255,.78)}
    .vh-auth-field input{
      width:100%;min-height:44px;border:1px solid rgba(255,255,255,.10);border-radius:11px;
      background:rgba(255,255,255,.035);color:#fff;padding:0 12px;outline:0;font:inherit;font-size:12px
    }
    .vh-auth-field input:focus{border-color:rgba(224,187,99,.52);box-shadow:0 0 0 3px rgba(224,187,99,.08)}
    .vh-auth-submit,.vh-auth-google{
      width:100%;min-height:44px;border-radius:11px;font:inherit;font-size:11.5px;font-weight:800;cursor:pointer
    }
    .vh-auth-submit{border:1px solid rgba(224,187,99,.45);background:linear-gradient(180deg,#f0cf79,#d8b254);color:#201703}
    .vh-auth-google{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);color:#fff}
    .vh-auth-submit:disabled,.vh-auth-google:disabled{opacity:.62;cursor:wait}
    .vh-auth-divider{display:flex;align-items:center;gap:9px;color:rgba(231,237,246,.35);font-size:9px;text-transform:uppercase}
    .vh-auth-divider::before,.vh-auth-divider::after{content:"";height:1px;flex:1;background:rgba(255,255,255,.08)}
    .vh-auth-message{min-height:16px;font-size:10px;line-height:1.45;color:#f3cf74}
    .vh-auth-message.is-error{color:#ff8b91}
    .vh-auth-message.is-success{color:#62dfa0}
    .vh-auth-links{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:2px}
    .vh-auth-links a{color:rgba(231,237,246,.68);font-size:10px;text-decoration:none}
    .vh-auth-links a:hover{color:#f3cf74}
    .vh-auth-note{margin-top:13px!important;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);font-size:9px!important;color:rgba(231,237,246,.44)!important}
    @media(max-width:680px){
      .vh-auth-backdrop{padding:10px;place-items:end center}
      .vh-auth-panel{width:100%;max-height:calc(100vh - 20px);overflow:auto;border-radius:18px 18px 12px 12px;padding:20px 16px}
      .vh-auth-panel h2{font-size:21px}
    }
'''
if ".vh-auth-backdrop{" not in text:
    text = text.replace("    .vh-search-backdrop{", AUTH_CSS + "\n    .vh-search-backdrop{")

AUTH_FUNCTIONS = r'''
async function claimPendingAssessmentAfterLogin() {
  const assessmentId = localStorage.getItem(pendingAssessmentKey);
  const claimToken = localStorage.getItem(pendingClaimTokenKey);
  if (!assessmentId || !claimToken) return;

  try {
    const { error } = await supabaseClient.rpc("claim_guest_assessment", {
      p_assessment_id: assessmentId,
      p_claim_token: claimToken,
    });
    if (!error) {
      localStorage.removeItem(pendingAssessmentKey);
      localStorage.removeItem(pendingClaimTokenKey);
    }
  } catch (error) {
    console.warn("Không thể lưu hồ sơ guest vào tài khoản.", error);
  }
}

function createAccountDialogs() {
  if (document.querySelector("[data-vh-auth-dialogs]")) return;

  const host = document.createElement("div");
  host.setAttribute("data-vh-auth-dialogs", "");
  host.innerHTML = `
    <div class="vh-auth-backdrop" data-login-dialog hidden>
      <section class="vh-auth-panel" role="dialog" aria-modal="true" aria-labelledby="vhLoginTitle">
        <button class="vh-auth-close" type="button" aria-label="Đóng" data-auth-close>×</button>
        <div class="vh-auth-kicker">VÕ HOÀNG ACCOUNT</div>
        <h2 id="vhLoginTitle">Đăng nhập</h2>
        <p>Đăng nhập nhanh mà không rời trang đang xem.</p>
        <form class="vh-auth-form" data-popup-login-form novalidate>
          <div class="vh-auth-field">
            <label>Email</label>
            <input name="email" type="email" autocomplete="email" required placeholder="email@example.com">
          </div>
          <div class="vh-auth-field">
            <label>Mật khẩu</label>
            <input name="password" type="password" autocomplete="current-password" required placeholder="Nhập mật khẩu">
          </div>
          <div class="vh-auth-message" data-popup-login-message aria-live="polite"></div>
          <button class="vh-auth-submit" type="submit" data-popup-login-submit>Đăng nhập</button>
          <div class="vh-auth-divider">hoặc</div>
          <button class="vh-auth-google" type="button" data-popup-google>Tiếp tục với Google</button>
          <div class="vh-auth-links">
            <a href="dang-nhap.html?mode=forgot">Quên mật khẩu?</a>
            <a href="dang-nhap.html">Trang tài khoản đầy đủ →</a>
          </div>
        </form>
        <p class="vh-auth-note">Không lưu mật khẩu trên website. Không cung cấp mật khẩu hoặc mã OTP cho bất kỳ ai.</p>
      </section>
    </div>

    <div class="vh-auth-backdrop" data-password-dialog hidden>
      <section class="vh-auth-panel" role="dialog" aria-modal="true" aria-labelledby="vhPasswordTitle">
        <button class="vh-auth-close" type="button" aria-label="Đóng" data-auth-close>×</button>
        <div class="vh-auth-kicker">BẢO MẬT TÀI KHOẢN</div>
        <h2 id="vhPasswordTitle">Đổi mật khẩu</h2>
        <p>Hệ thống xác minh lại mật khẩu hiện tại trước khi đổi.</p>
        <form class="vh-auth-form" data-password-form novalidate>
          <div class="vh-auth-field"><label>Mật khẩu hiện tại</label><input name="currentPassword" type="password" autocomplete="current-password" required></div>
          <div class="vh-auth-field"><label>Mật khẩu mới</label><input name="newPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Tối thiểu 8 ký tự"></div>
          <div class="vh-auth-field"><label>Nhập lại mật khẩu mới</label><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></div>
          <div class="vh-auth-message" data-password-message aria-live="polite"></div>
          <button class="vh-auth-submit" type="submit" data-password-submit>Cập nhật mật khẩu</button>
          <div class="vh-auth-links"><a href="dang-nhap.html?mode=forgot">Không nhớ mật khẩu? Đặt lại qua email</a></div>
        </form>
        <p class="vh-auth-note">Đổi thành công sẽ đăng xuất các phiên để giảm rủi ro tài khoản còn mở trên thiết bị khác.</p>
      </section>
    </div>`;

  document.body.appendChild(host);

  const loginDialog = host.querySelector("[data-login-dialog]");
  const passwordDialog = host.querySelector("[data-password-dialog]");
  const loginForm = host.querySelector("[data-popup-login-form]");
  const loginMessage = host.querySelector("[data-popup-login-message]");
  const loginSubmit = host.querySelector("[data-popup-login-submit]");
  const googleButton = host.querySelector("[data-popup-google]");
  const passwordForm = host.querySelector("[data-password-form]");
  const passwordMessage = host.querySelector("[data-password-message]");
  const passwordSubmit = host.querySelector("[data-password-submit]");

  const setMessage = (el, value = "", type = "") => {
    if (!el) return;
    el.textContent = value;
    el.classList.remove("is-error", "is-success");
    if (type) el.classList.add(`is-${type}`);
  };

  const closeDialog = (dialog) => {
    if (!dialog) return;
    dialog.hidden = true;
    document.body.style.overflow = "";
    dialog.querySelectorAll('input[type="password"]').forEach((input) => { input.value = ""; });
  };

  const openDialog = (dialog) => {
    if (!dialog) return;
    host.querySelectorAll(".vh-auth-backdrop").forEach((item) => { item.hidden = true; });
    dialog.hidden = false;
    document.body.style.overflow = "hidden";
  };

  host.querySelectorAll("[data-auth-close]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.closest(".vh-auth-backdrop")));
  });
  host.querySelectorAll(".vh-auth-backdrop").forEach((dialog) => {
    dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!loginDialog.hidden) closeDialog(loginDialog);
    if (!passwordDialog.hidden) closeDialog(passwordDialog);
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(loginMessage);
    const data = new FormData(loginForm);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    if (!email || !password) {
      setMessage(loginMessage, "Vui lòng nhập đầy đủ email và mật khẩu.", "error");
      return;
    }

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Đang đăng nhập...";
    const result = await supabaseClient.auth.signInWithPassword({ email, password });
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Đăng nhập";

    if (result.error) {
      setMessage(loginMessage, "Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.", "error");
      return;
    }

    await claimPendingAssessmentAfterLogin();
    renderAccount(result.data.user);
    setMessage(loginMessage, "Đăng nhập thành công.", "success");
    window.setTimeout(() => closeDialog(loginDialog), 300);
  });

  googleButton.addEventListener("click", async () => {
    setMessage(loginMessage);
    googleButton.disabled = true;
    googleButton.textContent = "Đang chuyển đến Google...";
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      googleButton.disabled = false;
      googleButton.textContent = "Tiếp tục với Google";
      setMessage(loginMessage, "Không thể đăng nhập Google. Vui lòng thử lại.", "error");
    }
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(passwordMessage);
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const user = sessionData.session?.user;

    if (!user?.email) {
      closeDialog(passwordDialog);
      window.VHAccount?.openLogin();
      return;
    }

    const data = new FormData(passwordForm);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (!currentPassword) { setMessage(passwordMessage, "Vui lòng nhập mật khẩu hiện tại.", "error"); return; }
    if (newPassword.length < 8) { setMessage(passwordMessage, "Mật khẩu mới cần có ít nhất 8 ký tự.", "error"); return; }
    if (newPassword !== confirmPassword) { setMessage(passwordMessage, "Mật khẩu nhập lại chưa khớp.", "error"); return; }
    if (currentPassword === newPassword) { setMessage(passwordMessage, "Mật khẩu mới cần khác mật khẩu hiện tại.", "error"); return; }

    passwordSubmit.disabled = true;
    passwordSubmit.textContent = "Đang xác minh...";

    const verified = await supabaseClient.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verified.error) {
      passwordSubmit.disabled = false;
      passwordSubmit.textContent = "Cập nhật mật khẩu";
      setMessage(passwordMessage, "Mật khẩu hiện tại chưa đúng. Nếu dùng Google, hãy đặt lại mật khẩu qua email.", "error");
      return;
    }

    passwordSubmit.textContent = "Đang cập nhật...";
    const updated = await supabaseClient.auth.updateUser({ password: newPassword });
    if (updated.error) {
      passwordSubmit.disabled = false;
      passwordSubmit.textContent = "Cập nhật mật khẩu";
      setMessage(passwordMessage, "Chưa thể đổi mật khẩu. Vui lòng thử lại hoặc đặt lại qua email.", "error");
      return;
    }

    setMessage(passwordMessage, "Đã đổi mật khẩu. Bạn cần đăng nhập lại.", "success");
    await supabaseClient.auth.signOut({ scope: "global" });
    renderAccount(null);
    passwordForm.reset();
    passwordSubmit.disabled = false;
    passwordSubmit.textContent = "Cập nhật mật khẩu";

    window.setTimeout(() => {
      closeDialog(passwordDialog);
      window.VHAccount?.openLogin(user.email);
    }, 700);
  });

  window.VHAccount = {
    openLogin(email = "") {
      setMessage(loginMessage);
      openDialog(loginDialog);
      const input = loginDialog.querySelector('input[name="email"]');
      if (email && input) input.value = email;
      requestAnimationFrame(() => input?.focus());
    },
    openPasswordChange() {
      setMessage(passwordMessage);
      openDialog(passwordDialog);
      requestAnimationFrame(() => passwordDialog.querySelector('input[name="currentPassword"]')?.focus());
    },
    close() {
      closeDialog(loginDialog);
      closeDialog(passwordDialog);
    },
  };
}

'''

if "function createAccountDialogs() {" not in text:
    text = text.replace("function getUserLabel(user) {", AUTH_FUNCTIONS + "function getUserLabel(user) {")

text = text.replace(
    '  const signOut = document.querySelector("[data-sign-out]");',
    '  const signOut = document.querySelector("[data-sign-out]");\n  const changePassword = document.querySelector("[data-change-password]");'
)

# On the full login page, keep the normal link behavior. Everywhere else use popup.
text = text.replace(
    '    if (!user) return;\n\n    event.preventDefault();',
    '    if (!user) {\n      if (currentPage() === "dang-nhap.html") return;\n      event.preventDefault();\n      window.VHAccount?.openLogin();\n      return;\n    }\n\n    event.preventDefault();'
)

if "changePassword?.addEventListener" not in text:
    text = text.replace(
        '  signOut?.addEventListener("click", async () => {',
        '  changePassword?.addEventListener("click", () => {\n    if (accountMenu) accountMenu.hidden = true;\n    window.VHAccount?.openPasswordChange();\n  });\n\n  signOut?.addEventListener("click", async () => {'
    )

text = text.replace(
    '    createSearchOverlay();\n    bindHeaderEvents();',
    '    createSearchOverlay();\n    createAccountDialogs();\n    bindHeaderEvents();'
)

HEADER.write_text(text, encoding="utf-8")

# Add only the requested action to the existing signed-in account panel.
login = LOGIN.read_text(encoding="utf-8")
if 'id="changePasswordBtn"' not in login:
    login = login.replace(
        '<a class="auth-small-btn" href="kiem-tra-nhanh-tai-khoan.html">Mở hồ sơ đánh giá →</a>\n                <button class="auth-small-btn" id="signOutBtn" type="button">Đăng xuất</button>',
        '<a class="auth-small-btn" href="kiem-tra-nhanh-tai-khoan.html">Mở hồ sơ đánh giá →</a>\n                <button class="auth-small-btn" id="changePasswordBtn" type="button">Đổi mật khẩu</button>\n                <button class="auth-small-btn" id="signOutBtn" type="button">Đăng xuất</button>'
    )
    login = login.replace(
        '    const signOutBtn = document.getElementById("signOutBtn");',
        '    const signOutBtn = document.getElementById("signOutBtn");\n    const changePasswordBtn = document.getElementById("changePasswordBtn");'
    )
    login = login.replace(
        '    // ĐĂNG XUẤT\n    signOutBtn.addEventListener',
        '    changePasswordBtn?.addEventListener("click", () => {\n      window.VHAccount?.openPasswordChange();\n    });\n\n\n    // ĐĂNG XUẤT\n    signOutBtn.addEventListener'
    )
LOGIN.write_text(login, encoding="utf-8")

# Cache bump only; no middle-page edits.
for html in Path(".").glob("*.html"):
    src = html.read_text(encoding="utf-8")
    new = re.sub(r'assets/js/site-header\.js\?v=[0-9-]+', 'assets/js/site-header.js?v=20260913-4', src)
    if new != src:
        html.write_text(new, encoding="utf-8")

# Sanity checks before commit.
check = HEADER.read_text(encoding="utf-8")
assert 'data-login-dialog' in check
assert 'data-change-password' in check
assert 'openPasswordChange' in check
assert 'signInWithPassword({ email: user.email, password: currentPassword })' in check
assert 'signOut({ scope: "global" })' in check
assert 'id="changePasswordBtn"' in LOGIN.read_text(encoding="utf-8")

print("Auth popup migration ready")
