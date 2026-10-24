import React from 'react';

const ADMIN_SCRIPTS = [
  '/js/api/api.js',
  '/js/core/cauhinh.js',
  '/js/core/dulieu.js',
  '/js/core/tienich.js',
  '/js/core/xeplich.js',
  '/js/pages/giaodien.js',
  '/js/pages/hienthi.js',
  '/js/api/ketnoi-sql.js',
  '/js/events/hanhdong.js',
  '/js/events/thaydoi.js'
];

const LECTURER_SCRIPTS = [
  '/js/core/cauhinh.js',
  '/js/user.js'
];

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-legacy-src="${src}"]`);
    if (existing?.dataset.loaded === 'true') return resolve();
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Không tải được ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.legacySrc = src;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Không tải được ${src}`));
    document.body.appendChild(script);
  });
}

export default function LegacyAppHost({ entry }) {
  const [loadError, setLoadError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    const scripts = entry === 'user' ? LECTURER_SCRIPTS : ADMIN_SCRIPTS;
    (async () => {
      try {
        for (const src of scripts) {
          await loadClassicScript(src);
          if (cancelled) return;
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Không khởi động được giao diện.');
      }
    })();
    return () => { cancelled = true; };
  }, [entry]);

  if (loadError) {
    return <main className="framework-error" role="alert">{loadError}</main>;
  }

  return <div id="app" />;
}
