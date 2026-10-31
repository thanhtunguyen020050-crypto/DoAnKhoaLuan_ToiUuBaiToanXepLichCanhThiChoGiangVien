import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const distRoot = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const apiPort = Number(process.env.DEMO_API_PORT || 8000);
const port = Number(process.env.DEMO_PORT || 8080);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  response.end(message);
}

const server = createServer(async (request, response) => {
  let pathname;
  let search;
  try {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    pathname = decodeURIComponent(url.pathname);
    search = url.search;
  } catch {
    sendText(response, 400, 'Đường dẫn không hợp lệ.');
    return;
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const headers = { ...request.headers };
    delete headers.connection;
    delete headers.host;
    const upstream = httpRequest(
      {
        hostname: '127.0.0.1',
        port: apiPort,
        path: `${pathname}${search}`,
        method: request.method,
        headers,
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      },
    );
    upstream.on('error', () => {
      if (!response.headersSent) sendText(response, 502, 'Không kết nối được FastAPI.');
      else response.destroy();
    });
    request.pipe(upstream);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Phương thức không được hỗ trợ.');
    return;
  }

  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = resolve(distRoot, `.${relativePath}`);
  const normalizedRoot = `${distRoot}${sep}`.toLowerCase();
  if (!filePath.toLowerCase().startsWith(normalizedRoot)) {
    sendText(response, 404, 'Không tìm thấy trang.');
    return;
  }

  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      sendText(response, 404, 'Không tìm thấy trang.');
      return;
    }
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': fileInfo.size,
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, 'Không tìm thấy trang. Hãy build frontend trước.');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Demo web: http://127.0.0.1:${port}`);
  console.log(`Chuyển tiếp /api đến FastAPI tại http://127.0.0.1:${apiPort}`);
  console.log('Máy chủ chỉ nghe trên máy này; dùng cloudflared để tạo link tạm.');
});
