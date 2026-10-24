export const API_BASE = import.meta.env.VITE_API_BASE_URL || window.API_BASE_URL || 'http://127.0.0.1:8000/api';

export async function apiPost(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === 'string' ? detail : detail?.message || 'Yêu cầu thất bại.');
  }
  return data;
}
