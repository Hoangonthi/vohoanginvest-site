from pathlib import Path

p = Path('dang-nhap.html')
s = p.read_text(encoding='utf-8')

if 'AUTH_EMAIL_COOLDOWN_SECONDS' in s:
    raise SystemExit('already patched')

marker = '''    function setLoading(button, loading, normalText, loadingText){
      if(!button) return;
      button.disabled = loading;
      button.textContent = loading ? loadingText : normalText;
    }
'''
insert = marker + '''
    const AUTH_EMAIL_COOLDOWN_SECONDS = 65;
    const authCooldownTimers = new Map();

    function cooldownKey(action,email){
      return `vh_auth_cooldown_${action}_${normalizeEmail(email)}`;
    }

    function getCooldownRemaining(action,email){
      const until = Number(localStorage.getItem(cooldownKey(action,email)) || 0);
      return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    }

    function setAuthEmailCooldown(action,email,seconds = AUTH_EMAIL_COOLDOWN_SECONDS){
      const until = Date.now() + Math.max(1, Number(seconds || AUTH_EMAIL_COOLDOWN_SECONDS)) * 1000;
      localStorage.setItem(cooldownKey(action,email), String(until));
      return until;
    }

    function startCooldownButton(button, action, email, normalText, seconds = AUTH_EMAIL_COOLDOWN_SECONDS){
      if(!button) return;
      setAuthEmailCooldown(action,email,seconds);
      const timerId = `${action}:${normalizeEmail(email)}:${button.id || normalText}`;
      if(authCooldownTimers.has(timerId)) clearInterval(authCooldownTimers.get(timerId));
      const render = () => {
        const remaining = getCooldownRemaining(action,email);
        if(remaining <= 0){
          button.disabled = false;
          button.textContent = normalText;
          if(authCooldownTimers.has(timerId)) clearInterval(authCooldownTimers.get(timerId));
          authCooldownTimers.delete(timerId);
          return;
        }
        button.disabled = true;
        button.textContent = `Gửi lại sau ${remaining}s`;
      };
      render();
      authCooldownTimers.set(timerId, setInterval(render, 1000));
    }

    function guardCooldown(action,email,button,normalText){
      const remaining = getCooldownRemaining(action,email);
      if(remaining <= 0) return false;
      startCooldownButton(button,action,email,normalText,remaining);
      showMessage(`Email xác thực vừa được yêu cầu. ACE vui lòng chờ khoảng ${remaining} giây rồi gửi lại.`, "info");
      return true;
    }

    function rateLimitSeconds(error, fallback = AUTH_EMAIL_COOLDOWN_SECONDS){
      const text = String(error?.message || error || "").toLowerCase();
      const match = text.match(/(?:after|in|wait)\\s+(\\d+)\\s*(?:seconds?|secs?|s)/i);
      return match ? Math.max(1, Number(match[1])) : fallback;
    }

    function isRateLimitError(error){
      const text = String(error?.message || error || "").toLowerCase();
      return text.includes("rate") || text.includes("too many") || text.includes("security purposes") || text.includes("wait") || text.includes("seconds");
    }
'''
if marker not in s:
    raise SystemExit('setLoading marker not found')
s = s.replace(marker, insert, 1)

old = '''      if(!emailCheck.ok){
        showMessage(emailCheck.message, "error");
        return;
      }
      if(!requireAuthCaptcha()) return;

      showMessage("");
      setLoading(otpSendBtn, true, "Đăng nhập bằng mã OTP email", "Đang gửi mã...");
'''
new = '''      if(!emailCheck.ok){
        showMessage(emailCheck.message, "error");
        return;
      }
      if(guardCooldown("otp", email, otpSendBtn, "Đăng nhập bằng mã OTP email")) return;
      if(!requireAuthCaptcha()) return;

      showMessage("");
      setLoading(otpSendBtn, true, "Đăng nhập bằng mã OTP email", "Đang gửi mã...");
'''
if old not in s:
    raise SystemExit('otp guard marker not found')
s = s.replace(old, new, 1)

old = '''      if(error){
        setLoading(otpSendBtn, false, "Đăng nhập bằng mã OTP email", "Đang gửi mã...");
        showMessage("Chưa thể gửi mã xác thực. Vui lòng thử lại sau.", "error");
        return;
      }

      otpBox.hidden = false;
      otpSendBtn.textContent = "Đã gửi mã / liên kết xác thực";
      showMessage("Hãy kiểm tra email. Nếu email có mã OTP, nhập mã bên dưới; nếu có liên kết xác thực, bạn có thể bấm trực tiếp liên kết đó.", "success");
      otpCode?.focus();
      window.setTimeout(() => {
        otpSendBtn.disabled = false;
        otpSendBtn.textContent = "Gửi lại mã OTP";
      }, 60000);
'''
new = '''      if(error){
        setLoading(otpSendBtn, false, "Đăng nhập bằng mã OTP email", "Đang gửi mã...");
        if(isRateLimitError(error)){
          const wait = rateLimitSeconds(error);
          startCooldownButton(otpSendBtn, "otp", email, "Gửi lại mã OTP", wait);
          showMessage(`Hệ thống đang giới hạn gửi email liên tiếp để bảo vệ tài khoản. ACE vui lòng chờ khoảng ${wait} giây rồi thử lại.`, "info");
        }else{
          showMessage("Chưa thể gửi mã xác thực. Vui lòng thử lại sau.", "error");
        }
        return;
      }

      otpBox.hidden = false;
      showMessage("Đã gửi email xác thực. ACE hãy kiểm tra hộp thư đến và thư rác; có thể nhập mã OTP bên dưới hoặc bấm liên kết trong email.", "success");
      otpCode?.focus();
      startCooldownButton(otpSendBtn, "otp", email, "Gửi lại mã OTP");
'''
if old not in s:
    raise SystemExit('otp result marker not found')
s = s.replace(old, new, 1)

old = '''      if(!termsChecked){
        showMessage("Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.", "error");
        return;
      }
      if(!requireAuthCaptcha()) return;
'''
new = '''      if(!termsChecked){
        showMessage("Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.", "error");
        return;
      }
      if(guardCooldown("signup", email, button, "Tạo tài khoản")) return;
      if(!requireAuthCaptcha()) return;
'''
if old not in s:
    raise SystemExit('signup guard marker not found')
s = s.replace(old, new, 1)

old = '''        if(message.includes("already") || message.includes("registered")){
          showMessage("Email này đã có tài khoản. Bạn hãy chuyển sang Đăng nhập.", "error");
        }else if(message.includes("rate")){
          showMessage("Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại.", "error");
        }else{
'''
new = '''        if(message.includes("already") || message.includes("registered")){
          showMessage("Email này đã có tài khoản. Bạn hãy chuyển sang Đăng nhập.", "error");
        }else if(isRateLimitError(error)){
          const wait = rateLimitSeconds(error);
          startCooldownButton(button, "signup", email, "Tạo tài khoản", wait);
          showMessage(`Hệ thống đang giới hạn gửi email đăng ký liên tiếp. ACE vui lòng chờ khoảng ${wait} giây rồi thử lại.`, "info");
        }else{
'''
if old not in s:
    raise SystemExit('signup rate marker not found')
s = s.replace(old, new, 1)

old = '''      }else{
        showMessage(
          "Đã tạo yêu cầu đăng ký. Vui lòng mở email và bấm liên kết xác nhận trước khi đăng nhập.",
          "success"
        );
      }
'''
new = '''      }else{
        startCooldownButton(button, "signup", email, "Tạo tài khoản");
        showMessage(
          "Đã gửi email xác nhận đăng ký. ACE vui lòng mở email và bấm liên kết xác nhận trước khi đăng nhập; nếu chưa thấy hãy kiểm tra thư rác.",
          "success"
        );
      }
'''
if old not in s:
    raise SystemExit('signup success marker not found')
s = s.replace(old, new, 1)

pos = s.find('// QUÊN MẬT KHẨU')
if pos < 0:
    raise SystemExit('forgot section not found')
head, tail = s[:pos], s[pos:]
old = '''      if(!emailCheck.ok){
        showMessage(emailCheck.message, "error");
        return;
      }

      if(!requireAuthCaptcha()) return;
'''
new = '''      if(!emailCheck.ok){
        showMessage(emailCheck.message, "error");
        return;
      }

      if(guardCooldown("recovery", email, button, "Gửi email đặt lại mật khẩu")) return;
      if(!requireAuthCaptcha()) return;
'''
if old not in tail:
    raise SystemExit('forgot guard marker not found')
tail = tail.replace(old, new, 1)
s = head + tail

old = '''      if(error){
        const message = String(error.message || "").toLowerCase();

        if(message.includes("rate")){
          showMessage("Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại.", "error");
        }else{
          showMessage("Chưa thể gửi email đặt lại mật khẩu. Vui lòng thử lại.", "error");
        }
        return;
      }

      // Không tiết lộ email có tồn tại hay không.
      showMessage(
        "Nếu email này có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư rác.",
        "success"
      );
'''
new = '''      if(error){
        if(isRateLimitError(error)){
          const wait = rateLimitSeconds(error);
          startCooldownButton(button, "recovery", email, "Gửi email đặt lại mật khẩu", wait);
          showMessage(`Hệ thống đang giới hạn gửi email khôi phục liên tiếp để bảo vệ tài khoản. ACE vui lòng chờ khoảng ${wait} giây rồi thử lại.`, "info");
        }else{
          showMessage("Chưa thể gửi email đặt lại mật khẩu. Vui lòng thử lại.", "error");
        }
        return;
      }

      startCooldownButton(button, "recovery", email, "Gửi email đặt lại mật khẩu");
      // Không tiết lộ email có tồn tại hay không.
      showMessage(
        "Yêu cầu đã được gửi. Nếu email này có tài khoản, ACE sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra cả hộp thư đến và thư rác.",
        "success"
      );
'''
if old not in s:
    raise SystemExit('forgot result marker not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('patched dang-nhap.html')
