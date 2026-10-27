export const API_BASE = import.meta.env.VITE_API_BASE_URL || window.API_BASE_URL || 'http://127.0.0.1:8000/api';

function friendlyError(message, status) {
  if (status >= 500 || /SQL Server|ODBC|SQLExecDirect|SQLDriverConnect|invalid object name|stored procedure|dbo\.|database|SQLSTATE|Microsoft/i.test(String(message || ''))) {
    return 'Chưa thể hoàn tất thao tác. Vui lòng thử lại; nếu lỗi tiếp diễn, hãy liên hệ quản trị viên.';
  }
  return String(message || 'Yêu cầu không thành công.');
}

export async function apiPost(path, payload) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    throw new Error('Không thể gửi yêu cầu đăng nhập. Vui lòng thử lại sau.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(friendlyError(typeof detail === 'string' ? detail : detail?.message || 'Yêu cầu thất bại.', response.status));
  }
  return data;
}
