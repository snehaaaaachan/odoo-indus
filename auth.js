// ===================================================
// AUTH VIEWS – Login, Sign Up, OTP Password Reset
// ===================================================

const Auth = {
  currentOTP: null,
  resetEmail: null,

  render() {
    document.getElementById('auth-root').classList.remove('hidden');
    document.getElementById('app-root').classList.add('hidden');
    this.showLogin();
  },

  showLogin() {
    document.getElementById('auth-root').innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">📦</div>
          <span>Inventory Pro</span>
        </div>
        <div class="auth-title">Welcome back</div>
        <div class="auth-subtitle">Sign in to your inventory workspace</div>
        <form onsubmit="Auth.handleLogin(event)">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <div class="input-group">
              <span class="input-icon">✉️</span>
              <input id="login-email" type="email" class="form-control" placeholder="admin@inventorypro.com" value="admin@inventorypro.com" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="input-group">
              <span class="input-icon">🔒</span>
              <input id="login-pass" type="password" class="form-control" placeholder="Enter password" value="admin123" required>
              <span class="input-icon-right" onclick="Auth.togglePwd('login-pass')">👁️</span>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
            <a class="auth-link" style="font-size:13px;" onclick="Auth.showForgot()">Forgot password?</a>
          </div>
          <button type="submit" class="btn btn-primary btn-full btn-lg">Sign In →</button>
        </form>
        <div class="auth-divider">or</div>
        <p style="text-align:center;font-size:13px;color:var(--text-muted)">
          Don't have an account? <a class="auth-link" onclick="Auth.showSignup()">Create one</a>
        </p>
      </div>`;
  },

  showSignup() {
    document.getElementById('auth-root').innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">📦</div>
          <span>Inventory Pro</span>
        </div>
        <div class="auth-title">Create account</div>
        <div class="auth-subtitle">Start managing your inventory today</div>
        <form onsubmit="Auth.handleSignup(event)">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <div class="input-group">
              <span class="input-icon">👤</span>
              <input id="su-name" type="text" class="form-control" placeholder="Your full name" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <div class="input-group">
              <span class="input-icon">✉️</span>
              <input id="su-email" type="email" class="form-control" placeholder="you@company.com" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="input-group">
              <span class="input-icon">🔒</span>
              <input id="su-pass" type="password" class="form-control" placeholder="Min. 6 characters" required minlength="6">
              <span class="input-icon-right" onclick="Auth.togglePwd('su-pass')">👁️</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <div class="input-group">
              <span class="input-icon">🔒</span>
              <input id="su-confirm" type="password" class="form-control" placeholder="Repeat password" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full btn-lg" style="margin-top:6px;">Create Account →</button>
        </form>
        <div class="auth-divider">or</div>
        <p style="text-align:center;font-size:13px;color:var(--text-muted)">
          Already have an account? <a class="auth-link" onclick="Auth.showLogin()">Sign in</a>
        </p>
      </div>`;
  },

  showForgot() {
    document.getElementById('auth-root').innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">🔑</div>
          <span>Reset Password</span>
        </div>
        <div class="auth-title">Forgot your password?</div>
        <div class="auth-subtitle">Enter your email and we'll send you an OTP</div>
        <form onsubmit="Auth.sendOTP(event)">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <div class="input-group">
              <span class="input-icon">✉️</span>
              <input id="reset-email" type="email" class="form-control" placeholder="you@company.com" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full btn-lg">Send OTP</button>
        </form>
        <div class="auth-divider">or</div>
        <p style="text-align:center;font-size:13px;color:var(--text-muted)">
          <a class="auth-link" onclick="Auth.showLogin()">← Back to Sign In</a>
        </p>
      </div>`;
  },

  showOTP(email) {
    this.resetEmail = email;
    document.getElementById('auth-root').innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">🔐</div>
          <span>Verify OTP</span>
        </div>
        <div class="auth-title">Check your inbox</div>
        <div class="auth-subtitle">We sent a 6-digit code to <strong>${email}</strong><br>
          <span style="color:var(--secondary);font-weight:700;font-size:14px;cursor:pointer" onclick="Auth.revealOTP()">Click here to see demo OTP</span>
        </div>
        <div id="otp-display" style="display:none;background:#f0fdf4;border:1.5px solid var(--success);border-radius:8px;padding:10px;text-align:center;margin-bottom:12px;font-weight:700;font-size:20px;color:var(--success);letter-spacing:8px;">${this.currentOTP}</div>
        <div class="otp-inputs">
          ${[1,2,3,4,5,6].map(i=>`<input class="otp-input" id="otp-${i}" maxlength="1" type="text" oninput="Auth.otpNext(this,${i})" onkeydown="Auth.otpBack(event,${i})">`).join('')}
        </div>
        <button class="btn btn-primary btn-full btn-lg" onclick="Auth.verifyOTP()">Verify Code</button>
        <p style="text-align:center;margin-top:16px;font-size:13px;color:var(--text-muted)">
          <a class="auth-link" onclick="Auth.sendOTP(null,'${email}')">Resend OTP</a> &nbsp;·&nbsp;
          <a class="auth-link" onclick="Auth.showLogin()">Cancel</a>
        </p>
      </div>`;
    document.getElementById('otp-1').focus();
  },

  showNewPassword() {
    document.getElementById('auth-root').innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">🔒</div>
          <span>New Password</span>
        </div>
        <div class="auth-title">Set new password</div>
        <div class="auth-subtitle">Choose a strong password for your account</div>
        <form onsubmit="Auth.resetPassword(event)">
          <div class="form-group">
            <label class="form-label">New Password</label>
            <div class="input-group">
              <span class="input-icon">🔒</span>
              <input id="new-pass" type="password" class="form-control" placeholder="Min. 6 characters" required minlength="6">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <div class="input-group">
              <span class="input-icon">🔒</span>
              <input id="new-confirm" type="password" class="form-control" placeholder="Repeat password" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full btn-lg">Update Password</button>
        </form>
      </div>`;
  },

  // ---- Handlers ----
  handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const user  = AppState.users.find(u => u.email === email && u.password === pass);
    if (user) {
      AppState.currentUser = user;
      App.launch();
    } else {
      Toast.show('error', 'Login Failed', 'Invalid email or password.');
    }
  },

  handleSignup(e) {
    e.preventDefault();
    const name    = document.getElementById('su-name').value.trim();
    const email   = document.getElementById('su-email').value.trim();
    const pass    = document.getElementById('su-pass').value;
    const confirm = document.getElementById('su-confirm').value;
    if (pass !== confirm) { Toast.show('error','Mismatch','Passwords do not match.'); return; }
    if (AppState.users.find(u => u.email === email)) { Toast.show('warning','Exists','Email already registered.'); return; }
    const id = AppState._seqs.User++;
    const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    AppState.users.push({ id, name, email, password: pass, role: 'Staff', avatar: initials, otp: null });
    AppState.currentUser = AppState.users[AppState.users.length - 1];
    Toast.show('success','Welcome!',`Account created for ${name}`);
    App.launch();
  },

  sendOTP(e, emailOverride) {
    if (e) e.preventDefault();
    const email = emailOverride || document.getElementById('reset-email').value.trim();
    const user  = AppState.users.find(u => u.email === email);
    if (!user) { Toast.show('error','Not Found','No account with that email.'); return; }
    this.currentOTP = String(Math.floor(100000 + Math.random() * 900000));
    user.otp = this.currentOTP;
    Toast.show('info','OTP Sent',`Demo OTP generated (click to reveal)`);
    this.showOTP(email);
  },

  revealOTP() { document.getElementById('otp-display').style.display = 'block'; },

  otpNext(el, idx) {
    if (el.value && idx < 6) document.getElementById(`otp-${idx+1}`)?.focus();
  },
  otpBack(e, idx) {
    if (e.key === 'Backspace' && !e.target.value && idx > 1) document.getElementById(`otp-${idx-1}`)?.focus();
  },

  verifyOTP() {
    const entered = [1,2,3,4,5,6].map(i=>document.getElementById(`otp-${i}`).value).join('');
    const user = AppState.users.find(u => u.email === this.resetEmail);
    if (user && user.otp === entered) {
      Toast.show('success','Verified','OTP confirmed!');
      this.showNewPassword();
    } else {
      Toast.show('error','Invalid OTP','The code entered is incorrect.');
    }
  },

  resetPassword(e) {
    e.preventDefault();
    const newPass = document.getElementById('new-pass').value;
    const confirm = document.getElementById('new-confirm').value;
    if (newPass !== confirm) { Toast.show('error','Mismatch','Passwords do not match.'); return; }
    const user = AppState.users.find(u => u.email === this.resetEmail);
    if (user) { user.password = newPass; user.otp = null; }
    Toast.show('success','Password Updated','You can now sign in with your new password.');
    this.showLogin();
  },

  togglePwd(id) {
    const el = document.getElementById(id);
    el.type = el.type === 'password' ? 'text' : 'password';
  }
};

window.Auth = Auth;
