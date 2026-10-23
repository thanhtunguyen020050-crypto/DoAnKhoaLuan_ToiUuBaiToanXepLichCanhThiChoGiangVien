(() => {
  const $ = s => document.querySelector(s);
  const base = window.API_BASE_URL || 'http://127.0.0.1:8000/api';
  async function post(path, payload) {
    const r = await fetch(base + path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const d = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Đăng nhập thất bại.');
    return d;
  }
  function loginLogo() {
    try {
      const state = JSON.parse(localStorage.getItem('huit-gacthi-v5') || 'null');
      const src = state && typeof state.logo === 'string' ? state.logo : '';
      if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(src)) {
        return `<img src="${src}" alt="Logo Trường Đại học Công Thương" style="width:64px;height:64px;object-fit:contain">`;
      }
    } catch (_) {}
    return '<img src="assets/logo-huit.png" alt="Logo Trường Đại học Công Thương" style="width:64px;height:64px;object-fit:contain">';
  }
  function show() {
    $('#app').innerHTML = `<div class="login">
      <section class="login-art"><div class="lb"><div class="logo-wrap">${loginLogo()}</div><div class="uni">Trường Đại học Công Thương<br>Thành phố Hồ Chí Minh</div></div>
      <div><h2>Hệ thống xếp lịch gác thi</h2><p>Đăng nhập để quản lý lịch gác thi hoặc tra cứu lịch cá nhân.</p></div><div class="mini" aria-hidden="true">${'<i class="a"></i>'.repeat(40)}</div></section>
      <section class="login-form"><div>
      <div id="loginPanel"><h1>Đăng nhập</h1><p class="muted" style="margin-bottom:18px">Nhập tài khoản được cấp. Hệ thống tự chuyển đến giao diện phù hợp.</p>
      <form id="loginForm"><label class="f"><span>Tài khoản / Mã giảng viên</span><input id="username" type="text" required maxlength="120" autocomplete="username"></label>
      <label class="f"><span>Mật khẩu</span><input id="password" type="password" required autocomplete="current-password"></label>
      <div class="err" id="error" role="alert"></div><button class="btn pri" type="submit">Đăng nhập</button></form>
      <p class="hint">Giảng viên đăng nhập lần đầu bằng mật khẩu tạm 1 sẽ được yêu cầu đổi mật khẩu.</p><div class="hint" id="loginNotice" hidden></div></div>
      </div></section></div>`;
    $('#loginForm').onsubmit = async e => {
      e.preventDefault();
      const username = $('#username').value.trim(), password = $('#password').value, err = $('#error');
      err.textContent = '';
      try {
        // Thử xác thực Admin trước; nếu không khớp thì thử đăng nhập giảng viên.
        try {
          const a = await post('/auth/admin-login', {username, password});
          sessionStorage.setItem('authRole', 'admin');
          sessionStorage.setItem('authUsername', a.username || username);
          if (a.token) sessionStorage.setItem('authToken', a.token);
          sessionStorage.removeItem('lecturerSession');
          location.replace('index.html');
          return;
        } catch (adminError) {
          const u = await post('/user/login', {ma_gv:username, password});
          sessionStorage.setItem('authRole', 'user');
          sessionStorage.setItem('lecturerSession', JSON.stringify(u));
          if (u.token) sessionStorage.setItem('authToken', u.token);
          sessionStorage.removeItem('authUsername');
          if (u.must_change_password) sessionStorage.setItem('mustChangePassword','1');
          else sessionStorage.removeItem('mustChangePassword');
          location.replace('user.html');
        }
      } catch (userError) {
        err.textContent = userError.message || 'Tài khoản hoặc mật khẩu không đúng.';
      }
    };
  }
  document.addEventListener('DOMContentLoaded', show);
})();
