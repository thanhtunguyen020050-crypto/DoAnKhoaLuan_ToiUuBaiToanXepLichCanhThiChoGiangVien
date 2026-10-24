import React from 'react';
import LoginPage from './components/LoginPage.jsx';
import LegacyAppHost from './components/LegacyAppHost.jsx';

function AccessDenied({ role }) {
  React.useEffect(() => {
    window.location.replace('/login.html');
  }, []);
  return <main className="framework-loading" role="status">Đang chuyển đến đăng nhập… ({role})</main>;
}

export default function App({ entry }) {
  if (entry === 'login') return <LoginPage />;

  const expectedRole = entry === 'user' ? 'user' : 'admin';
  const activeRole = sessionStorage.getItem('authRole');
  if (activeRole !== expectedRole) return <AccessDenied role={expectedRole} />;

  return <LegacyAppHost entry={entry} />;
}
