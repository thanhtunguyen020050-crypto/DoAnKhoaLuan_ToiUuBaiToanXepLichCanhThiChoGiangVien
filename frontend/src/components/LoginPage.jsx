import React from 'react';
import { apiPost } from '../api/client.js';

function getLogo() {
  try {
    const state = JSON.parse(localStorage.getItem('huit-gacthi-v5') || 'null');
    if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(state?.logo || '')) return state.logo;
  } catch (_) {}
  return '/assets/logo-huit.png';
}

export default function LoginPage() {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      try {
        const admin = await apiPost('/auth/admin-login', { username: username.trim(), password });
        sessionStorage.setItem('authRole', 'admin');
        sessionStorage.setItem('authUsername', admin.username || username.trim());
        if (admin.token) sessionStorage.setItem('authToken', admin.token);
        sessionStorage.removeItem('lecturerSession');
        sessionStorage.removeItem('mustChangePassword');
        window.location.replace('/index.html');
        return;
      } catch (_) {
        const lecturer = await apiPost('/user/login', { ma_gv: username.trim(), password });
        sessionStorage.setItem('authRole', 'user');
        sessionStorage.setItem('lecturerSession', JSON.stringify(lecturer));
        if (lecturer.token) sessionStorage.setItem('authToken', lecturer.token);
        sessionStorage.removeItem('authUsername');
        if (lecturer.must_change_password) sessionStorage.setItem('mustChangePassword', '1');
        else sessionStorage.removeItem('mustChangePassword');
        window.location.replace('/user.html');
      }
    } catch (requestError) {
      setError(requestError.message || 'Tài khoản hoặc mật khẩu không đúng.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <section className="login-art">
        <div className="lb">
          <div className="logo-wrap"><img src={getLogo()} alt="Logo Trường Đại học Công Thương" width="64" height="64" /></div>
          <div className="uni">Trường Đại học Công Thương<br />Thành phố Hồ Chí Minh</div>
        </div>
        <div>
          <h2>Hệ thống xếp lịch gác thi</h2>
          <p>Đăng nhập để quản lý lịch gác thi hoặc tra cứu lịch cá nhân.</p>
        </div>
        <div className="mini" aria-hidden="true">{Array.from({ length: 40 }, (_, index) => <i key={index} className={index % 4 === 0 ? 'a' : ''} />)}</div>
      </section>
      <section className="login-form">
        <div>
          <h1>Đăng nhập</h1>
          <p className="muted" style={{ marginBottom: 18 }}>Nhập tài khoản được cấp. Hệ thống tự chuyển đến giao diện phù hợp.</p>
          <form onSubmit={handleSubmit}>
            <label className="f"><span>Tài khoản / Mã giảng viên</span><input type="text" value={username} onChange={event => setUsername(event.target.value)} required maxLength={120} autoComplete="username" /></label>
            <label className="f"><span>Mật khẩu</span><input value={password} onChange={event => setPassword(event.target.value)} type="password" required autoComplete="current-password" /></label>
            <div className="err" role="alert">{error}</div>
            <button className="btn pri" type="submit" disabled={submitting}>{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
          </form>
          <p className="hint">Giảng viên đăng nhập lần đầu bằng mật khẩu tạm 1 sẽ được yêu cầu đổi mật khẩu.</p>
        </div>
      </section>
    </div>
  );
}
