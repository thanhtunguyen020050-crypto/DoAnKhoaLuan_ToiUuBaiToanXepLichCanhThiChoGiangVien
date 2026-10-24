import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { API_BASE } from './api/client.js';
import './styles/framework.css';

window.API_BASE_URL = API_BASE;

const eyeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeOffIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a15.7 15.7 0 0 1-3.1 3.9M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.4 0 2.6-.3 3.7-.8"/></svg>';

function enhancePasswordFields(root = document) {
  const fields = [];
  if (root instanceof Element && root.matches('input[type="password"]')) fields.push(root);
  if (root.querySelectorAll) fields.push(...root.querySelectorAll('input[type="password"]'));

  fields.forEach(input => {
    if (input.dataset.passwordVisibilityReady) return;
    input.dataset.passwordVisibilityReady = 'true';
    input.classList.add('password-input');

    const wrapper = document.createElement('div');
    wrapper.className = 'password-field';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-visibility-toggle';
    toggle.innerHTML = eyeIcon;
    toggle.setAttribute('aria-label', 'Hiện mật khẩu');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.title = 'Hiện mật khẩu';
    toggle.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      toggle.innerHTML = visible ? eyeOffIcon : eyeIcon;
      toggle.setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      toggle.setAttribute('aria-pressed', String(visible));
      toggle.title = visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
      input.focus({ preventScroll: true });
    });
    wrapper.appendChild(toggle);
  });
}

enhancePasswordFields();
window.__passwordVisibilityObserver?.disconnect();
window.__passwordVisibilityObserver = new MutationObserver(records => {
  records.forEach(record => record.addedNodes.forEach(node => {
    if (node instanceof Element) enhancePasswordFields(node);
  }));
});
window.__passwordVisibilityObserver.observe(document.body, { childList: true, subtree: true });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App entry={root.dataset.entry || 'login'} />);
}
