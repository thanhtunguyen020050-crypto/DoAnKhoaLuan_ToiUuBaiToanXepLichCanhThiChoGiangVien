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
      } catch (adminError) {
        // Lecturer usernames also receive 401 from the admin endpoint. Only
        // then try lecturer login; surface networking/API failures directly.
        if (adminError.status !== 401) throw adminError;
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
        <div className="login-brand">
          <div className="login-logo-wrap"><img src={getLogo()} alt="Logo Trường Đại học Công Thương" width="64" height="64" /></div>
          <div className="login-university"><b>Trường Đại học Công Thương TP.HCM</b><span>Khoa Công nghệ Thông tin</span></div>
        </div>
        <div className="login-intro">
          <span className="login-kicker"><span aria-hidden="true">✦</span> Cổng thông tin điều phối khảo thí</span>
          <h2>Hệ thống xếp lịch gác thi tự động</h2>
          <p>Tối ưu phân công giảng viên coi thi, kiểm soát lịch trùng và tra cứu lịch cá nhân nhanh chóng, minh bạch.</p>
          <div className="login-feature-card">
            <div className="login-feature-heading"><span className="login-check" aria-hidden="true">✓</span><b>Công cụ hỗ trợ điều phối</b><span className="login-term">Khoa CNTT</span></div>
            <div className="login-feature-grid">
              <div><span>Phân công</span><b>Theo định mức</b></div>
              <div><span>Ràng buộc</span><b>Kiểm tra lịch</b></div>
              <div><span>Báo cáo</span><b>Xuất dữ liệu</b></div>
            </div>
          </div>
        </div>
        <div className="login-art-footer"><span>© {new Date().getFullYear()} Khoa CNTT – HUIT</span><span>Phiên bản ProMax</span></div>
      </section>
      <section className="login-form">
        <div className="login-card">
          <h1>Đăng nhập hệ thống</h1>
          <p className="login-description">Sử dụng tài khoản được cấp. Hệ thống sẽ tự nhận diện quyền <b>Quản trị viên</b> hoặc <b>Giảng viên</b>.</p>
          <form onSubmit={handleSubmit}>
            <label className="f login-field"><span>Tài khoản / Mã giảng viên</span><div className="login-control"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><input type="text" value={username} onChange={event => setUsername(event.target.value)} required maxLength={120} autoComplete="username" /></div></label>
            <label className="f login-field"><span>Mật khẩu</span><div className="login-control"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input value={password} onChange={event => setPassword(event.target.value)} type="password" required autoComplete="current-password" /></div></label>
            <div className="err" role="alert">{error}</div>
            <button className="btn pri login-submit" type="submit" disabled={submitting}>{submitting ? 'Đang đăng nhập…' : <>Đăng nhập <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></>}</button>
          </form>
          <div className="login-notice"><span aria-hidden="true">i</span><p><b>Lưu ý cho Giảng viên:</b> Khi đăng nhập lần đầu bằng mật khẩu tạm do Khoa cấp, hệ thống sẽ yêu cầu thiết lập mật khẩu mới.</p></div>
        </div>
      </section>
    </div>
  );
}
