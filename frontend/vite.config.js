import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

function copyLegacyStaticFiles() {
  return {
    name: 'copy-legacy-static-files',
    apply: 'build',
    closeBundle() {
      for (const dir of ['js', 'css', 'assets']) {
        const source = resolve(frontendRoot, dir);
        const destination = resolve(frontendRoot, 'dist', dir);
        if (existsSync(source)) cpSync(source, destination, { recursive: true, force: true });
      }
    }
  };
}

export default defineConfig({
  root: frontendRoot,
  publicDir: false,
  plugins: [react(), copyLegacyStaticFiles()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        admin: resolve(frontendRoot, 'index.html'),
        login: resolve(frontendRoot, 'login.html'),
        lecturer: resolve(frontendRoot, 'user.html')
      }
    }
  }
});
