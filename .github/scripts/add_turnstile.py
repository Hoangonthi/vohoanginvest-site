from pathlib import Path

SITE_KEY = '0x4AAAAAAEYKnha19nmpaSeM'

# ================= shared popup =================
p = Path('assets/js/site-header.js')
s = p.read_text(encoding='utf-8')

marker = 'const FOOTER_HOST_ID = "siteFooter";\n'
add = f'''const FOOTER_HOST_ID = "siteFooter";\nconst TURNSTILE_SITE_KEY = "{SITE_KEY}";\nconst TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";\n'''
if marker not in s:
    raise SystemExit('header const marker not found')
s = s.replace(marker, add, 1)

marker = '''function currentPage() {'''
helpers = '''let turnstileLoaderPromise = null;

function loadTurnstile() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (turnstileLoaderPromise) return turnstileLoaderPromise;

  turnstileLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-vh-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
      existing.addEventListener('error', () => reject(new Error('TURNSTILE_LOAD_FAILED')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.dataset.vhTurnstile = '';
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('TURNSTILE_LOAD_FAILED'));
    document.head.appendChild(script);
  });

  return turnstileLoaderPromise;
}

'''
if marker not in s:
    raise SystemExit('currentPage marker not found')
s = s.replace(marker, helpers + marker, 1)

old = '''          <div class="vh-auth-message" data-popup-login-message aria-live="polite"></div>
          <button class="vh-auth-submit" type="submit" data-popup-login-submit>Đăng nhập</button>'''
new = '''          <div class="vh-turnstile" data-popup-turnstile></div>
          <div class="vh-auth-message" data-popup-login-message aria-live="polite"></div>
          <button class="vh-auth-submit" type="submit" data-popup-login-submit>Đăng nhập</button>'''
if old not in s:
    raise SystemExit('popup message block not found')
s = s.replace(old, new, 1)

old = '''    .vh-auth-mini{margin:0!important;font-size:9px!important;line-height:1.45;color:rgba(231,237,246,.46)!important}'''
new = '''    .vh-auth-mini{margin:0!important;font-size:9px!important;line-height:1.45;color:rgba(231,237,246,.46)!important}
    .vh-turnstile{min-height:65px;display:flex;justify-content:center;align-items:center;overflow:hidden}'''
if old not in s:
    raise SystemExit('popup css marker not found')
s = s.replace(old, new, 1)

old = '''  const otpInput = host.querySelector('[data-popup-otp-box] input[name="otp"]');
  const passwordForm = host.querySelector("[data-password-form]");'''
new = '''  const otpInput = host.querySelector('[data-popup-otp-box] input[name="otp"]');
  const turnstileBox = host.querySelector("[data-popup-turnstile]");
  const passwordForm = host.querySelector("[data-password-form]");
  let popupTurnstileId = null;
  let popupCaptchaToken = "";

  const ensurePopupTurnstile = async () => {
    try {
      const api = await loadTurnstile();
      if (popupTurnstileId !== null || !turnstileBox || !api?.render) return;
      popupTurnstileId = api.render(turnstileBox, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        size: "flexible",
        callback: (token) => { popupCaptchaToken = token || ""; },
        "expired-callback": () => { popupCaptchaToken = ""; },
        "error-callback": () => { popupCaptchaToken = ""; },
      });
    } catch (error) {
      console.warn("Không tải được Turnstile.", error);
    }
  };

  const resetPopupTurnstile = () => {
    popupCaptchaToken = "";
    if (popupTurnstileId !== null && window.turnstile?.reset) {
      try { window.turnstile.reset(popupTurnstileId); } catch (_) {}
    }
  };

  const requirePopupCaptcha = () => {
    if (popupCaptchaToken) return true;
    setMessage(loginMessage, "Vui lòng hoàn tất bước xác minh bảo mật.", "error");
    ensurePopupTurnstile();
    return false;
  };'''
if old not in s:
    raise SystemExit('popup vars marker not found')
s = s.replace(old, new, 1)

old = '''    if (!email || !password) {
      setMessage(loginMessage, "Vui lòng nhập đầy đủ email và mật khẩu.", "error");
      return;
    }

    loginSubmit.disabled = true;'''
new = '''    if (!email || !password) {
      setMessage(loginMessage, "Vui lòng nhập đầy đủ email và mật khẩu.", "error");
      return;
    }
    if (!requirePopupCaptcha()) return;

    loginSubmit.disabled = true;'''
if old not in s:
    raise SystemExit('popup password validation marker not found')
s = s.replace(old, new, 1)

old = '''    const result = await supabaseClient.auth.signInWithPassword({ email, password });
    loginSubmit.disabled = false;'''
new = '''    const result = await supabaseClient.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: popupCaptchaToken },
    });
    resetPopupTurnstile();
    loginSubmit.disabled = false;'''
if old not in s:
    raise SystemExit('popup signInWithPassword marker not found')
s = s.replace(old, new, 1)

old = '''    if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      setMessage(loginMessage, "Vui lòng nhập email hợp lệ trước khi gửi OTP.", "error");
      return;
    }

    otpSendButton.disabled = true;'''
new = '''    if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      setMessage(loginMessage, "Vui lòng nhập email hợp lệ trước khi gửi OTP.", "error");
      return;
    }
    if (!requirePopupCaptcha()) return;

    otpSendButton.disabled = true;'''
if old not in s:
    raise SystemExit('popup otp validation marker not found')
s = s.replace(old, new, 1)

old = '''        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });

    if (error) {'''
new = '''        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        captchaToken: popupCaptchaToken,
      },
    });
    resetPopupTurnstile();

    if (error) {'''
if old not in s:
    raise SystemExit('popup otp options marker not found')
s = s.replace(old, new, 1)

old = '''    openLogin(email = "") {
      setMessage(loginMessage);
      openDialog(loginDialog);
      const input = loginDialog.querySelector('input[name="email"]');'''
new = '''    openLogin(email = "") {
      setMessage(loginMessage);
      openDialog(loginDialog);
      ensurePopupTurnstile();
      const input = loginDialog.querySelector('input[name="email"]');'''
if old not in s:
    raise SystemExit('popup openLogin marker not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')

# ================= full account page =================
p = Path('dang-nhap.html')
h = p.read_text(encoding='utf-8')

old = '''              <div class="auth-tabs" role="tablist" aria-label="Tài khoản">
                <button class="auth-tab is-active" type="button" data-auth-mode="login">Đăng nhập</button>
                <button class="auth-tab" type="button" data-auth-mode="signup">Đăng ký</button>
                <button class="auth-tab" type="button" data-auth-mode="forgot">Quên mật khẩu</button>
              </div>'''
new = '''              <div class="auth-tabs" role="tablist" aria-label="Tài khoản">
                <button class="auth-tab is-active" type="button" data-auth-mode="login">Đăng nhập</button>
                <button class="auth-tab" type="button" data-auth-mode="signup">Đăng ký</button>
                <button class="auth-tab" type="button" data-auth-mode="forgot">Quên mật khẩu</button>
              </div>

              <div class="auth-turnstile-wrap">
                <div id="authTurnstile"></div>
                <span>Xác minh bảo mật trước khi gửi yêu cầu.</span>
              </div>'''
if old not in h:
    raise SystemExit('auth tabs marker not found')
h = h.replace(old, new, 1)

css_marker = '''    .auth-security-note{'''
css = '''    .auth-turnstile-wrap{
      display:grid;
      justify-items:center;
      gap:5px;
      min-height:72px;
      margin:12px 0 2px;
    }
    .auth-turnstile-wrap span{
      color:rgba(231,237,246,.42);
      font-size:9px;
      line-height:1.4;
      text-align:center;
    }

'''
if css_marker not in h:
    raise SystemExit('auth css marker not found')
h = h.replace(css_marker, css + css_marker, 1)

import_marker = '''    const formsWrap = document.getElementById("authForms");'''
helpers = f'''    const TURNSTILE_SITE_KEY = "{SITE_KEY}";
    const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    let authTurnstileId = null;
    let authCaptchaToken = "";
    let authTurnstileLoader = null;

    function loadAuthTurnstile() {{
      if(window.turnstile?.render) return Promise.resolve(window.turnstile);
      if(authTurnstileLoader) return authTurnstileLoader;
      authTurnstileLoader = new Promise((resolve, reject) => {{
        const existing = document.querySelector('script[data-auth-turnstile]');
        if(existing) {{
          existing.addEventListener('load', () => resolve(window.turnstile), {{ once:true }});
          existing.addEventListener('error', () => reject(new Error('TURNSTILE_LOAD_FAILED')), {{ once:true }});
          return;
        }}
        const script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT;
        script.async = true;
        script.defer = true;
        script.dataset.authTurnstile = '';
        script.onload = () => resolve(window.turnstile);
        script.onerror = () => reject(new Error('TURNSTILE_LOAD_FAILED'));
        document.head.appendChild(script);
      }});
      return authTurnstileLoader;
    }}

    async function initAuthTurnstile() {{
      try {{
        const api = await loadAuthTurnstile();
        const box = document.getElementById('authTurnstile');
        if(authTurnstileId !== null || !box || !api?.render) return;
        authTurnstileId = api.render(box, {{
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          size: 'flexible',
          callback: (token) => {{ authCaptchaToken = token || ''; }},
          'expired-callback': () => {{ authCaptchaToken = ''; }},
          'error-callback': () => {{ authCaptchaToken = ''; }},
        }});
      }} catch(error) {{
        console.warn('Không tải được Turnstile.', error);
      }}
    }}

    function resetAuthTurnstile() {{
      authCaptchaToken = '';
      if(authTurnstileId !== null && window.turnstile?.reset) {{
        try {{ window.turnstile.reset(authTurnstileId); }} catch(_) {{}}
      }}
    }}

    function requireAuthCaptcha() {{
      if(authCaptchaToken) return true;
      showMessage('Vui lòng hoàn tất bước xác minh bảo mật.', 'error');
      initAuthTurnstile();
      return false;
    }}

    const formsWrap = document.getElementById("authForms");'''
if import_marker not in h:
    raise SystemExit('auth formsWrap marker not found')
h = h.replace(import_marker, helpers, 1)

old = '''      authTitle.textContent = titles[mode].title;
      authSubtitle.textContent = titles[mode].subtitle;
      showMessage("");'''
new = '''      authTitle.textContent = titles[mode].title;
      authSubtitle.textContent = titles[mode].subtitle;
      showMessage("");
      resetAuthTurnstile();'''
if old not in h:
    raise SystemExit('switchMode marker not found')
h = h.replace(old, new, 1)

old = '''      if(!password){
        showMessage("Vui lòng nhập mật khẩu.", "error");
        return;
      }

      showMessage("");'''
new = '''      if(!password){
        showMessage("Vui lòng nhập mật khẩu.", "error");
        return;
      }
      if(!requireAuthCaptcha()) return;

      showMessage("");'''
if old not in h:
    raise SystemExit('full login validation marker not found')
h = h.replace(old, new, 1)

old = '''      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      setLoading(button, false, "Đăng nhập", "Đang đăng nhập...");'''
new = '''      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken: authCaptchaToken }
      });
      resetAuthTurnstile();

      setLoading(button, false, "Đăng nhập", "Đang đăng nhập...");'''
if old not in h:
    raise SystemExit('full signInWithPassword marker not found')
h = h.replace(old, new, 1)

old = '''      if(!termsChecked){
        showMessage("Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.", "error");
        return;
      }

      showMessage("");'''
new = '''      if(!termsChecked){
        showMessage("Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.", "error");
        return;
      }
      if(!requireAuthCaptcha()) return;

      showMessage("");'''
if old not in h:
    raise SystemExit('signup terms marker not found')
h = h.replace(old, new, 1)

old = '''          data: {
            full_name: fullName
          },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`
        }
      });

      setLoading(button, false, "Tạo tài khoản", "Đang tạo tài khoản...");'''
new = '''          data: {
            full_name: fullName
          },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          captchaToken: authCaptchaToken
        }
      });
      resetAuthTurnstile();

      setLoading(button, false, "Tạo tài khoản", "Đang tạo tài khoản...");'''
if old not in h:
    raise SystemExit('signup options marker not found')
h = h.replace(old, new, 1)

# Forgot password: require captcha only in that handler.
forgot_anchor = '''    // QUÊN MẬT KHẨU'''
idx = h.find(forgot_anchor)
if idx < 0:
    raise SystemExit('forgot anchor not found')
before, tail = h[:idx], h[idx:]
old = '''      showMessage("");
      setLoading(
        button,
        true,
        "Gửi email đặt lại mật khẩu",'''
new = '''      if(!requireAuthCaptcha()) return;

      showMessage("");
      setLoading(
        button,
        true,
        "Gửi email đặt lại mật khẩu",'''
if old not in tail:
    raise SystemExit('forgot loading marker not found')
tail = tail.replace(old, new, 1)
h = before + tail

old = '''      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}`
      });

      setLoading('''
new = '''      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
        captchaToken: authCaptchaToken
      });
      resetAuthTurnstile();

      setLoading('''
if old not in h:
    raise SystemExit('forgot resetPassword marker not found')
h = h.replace(old, new, 1)

old = '''      if(!isValidEmail(email)){
        showMessage("Vui lòng nhập email hợp lệ trước khi gửi OTP.", "error");
        return;
      }

      showMessage("");'''
new = '''      if(!isValidEmail(email)){
        showMessage("Vui lòng nhập email hợp lệ trước khi gửi OTP.", "error");
        return;
      }
      if(!requireAuthCaptcha()) return;

      showMessage("");'''
if old not in h:
    raise SystemExit('full OTP validation marker not found')
h = h.replace(old, new, 1)

old = '''          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`
        }
      });

      if(error){'''
new = '''          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          captchaToken: authCaptchaToken
        }
      });
      resetAuthTurnstile();

      if(error){'''
if old not in h:
    raise SystemExit('full OTP options marker not found')
h = h.replace(old, new, 1)

init_marker = '''    const initialMode = new URLSearchParams(window.location.search).get("mode");'''
if init_marker in h:
    h = h.replace(init_marker, '''    initAuthTurnstile();\n\n''' + init_marker, 1)
else:
    fallback = '''    supabaseClient.auth.onAuthStateChange'''
    if fallback not in h:
        raise SystemExit('auth init marker not found')
    h = h.replace(fallback, '''    initAuthTurnstile();\n\n''' + fallback, 1)

p.write_text(h, encoding='utf-8')

# Cache-bust shared auth UI, no middle-content changes.
for html in Path('.').glob('*.html'):
    text = html.read_text(encoding='utf-8')
    for oldv in ('assets/js/site-header.js?v=20260913-5', 'assets/js/site-header.js?v=20260913-4', 'assets/js/site-header.js?v=20260913-3'):
        text = text.replace(oldv, 'assets/js/site-header.js?v=20260913-6')
    html.write_text(text, encoding='utf-8')
