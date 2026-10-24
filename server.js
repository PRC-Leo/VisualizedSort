// 零依赖静态服务器：仅使用 Node 内置模块，根目录为 ./public
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(PROJECT_ROOT, 'config.json');

// 全部可调参数集中在根目录 config.json，这里只读一次
function loadConfig() {
  let raw;
  try {
    raw = readFileSync(CONFIG_FILE, 'utf8');
  } catch (error) {
    console.error(`[启动失败] 读不到配置文件 ${CONFIG_FILE}：${error.message}`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[启动失败] config.json 不是合法 JSON：${error.message}`);
    process.exit(1);
  }
}

const CONFIG = loadConfig();
const PUBLIC_ROOT = path.join(PROJECT_ROOT, CONFIG.server?.staticRoot ?? 'public');
// 浏览器侧的配置入口：从项目根读取，不放进 public/，避免两份 config 各自漂移
const CONFIG_URL = CONFIG.server?.configUrl ?? '/config.json';
const CACHE_CONTROL = CONFIG.server?.cacheControl ?? 'no-cache';
const PORT = Number.parseInt(process.env.PORT ?? '', 10) || Number(CONFIG.server?.port) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function log(method, requestPath, statusCode) {
  console.log(`${method} ${requestPath} -> ${statusCode}`);
}

function sendText(res, method, requestPath, statusCode, message, extraHeaders = {}) {
  const body = Buffer.from(message, 'utf8');
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': CACHE_CONTROL,
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  log(method, requestPath, statusCode);
  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
}

// 解析请求路径：保留原始编码前的形态，便于识别目录穿越
function parseRequestPath(rawUrl) {
  const rawPath = (rawUrl || '/').split('?')[0].split('#')[0];
  let pathname;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    return { rawPath, pathname: null };
  }
  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }
  return { rawPath, pathname };
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  const { rawPath, pathname } = parseRequestPath(req.url);

  if (method !== 'GET' && method !== 'HEAD') {
    sendText(res, method, rawPath, 405, '405 不支持的请求方法，仅支持 GET 与 HEAD。', {
      Allow: 'GET, HEAD',
    });
    return;
  }

  if (pathname === null || pathname.includes('\0')) {
    sendText(res, method, rawPath, 400, '400 请求路径无效。');
    return;
  }

  if (pathname === CONFIG_URL) {
    try {
      const data = await readFile(CONFIG_FILE);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': data.length,
        'Cache-Control': CACHE_CONTROL,
        'X-Content-Type-Options': 'nosniff',
      });
      log(method, rawPath, 200);
      if (method === 'HEAD') {
        res.end();
        return;
      }
      res.end(data);
    } catch (error) {
      console.error(`[读取失败] ${CONFIG_FILE}`, error);
      sendText(res, method, rawPath, 500, '500 读取配置失败。');
    }
    return;
  }

  // 第一层防护：显式拒绝任何 .. 路径段
  if (pathname.split('/').includes('..')) {
    sendText(res, method, rawPath, 403, '403 禁止访问：检测到目录穿越。');
    return;
  }

  const relativePath = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
  const filePath = path.resolve(PUBLIC_ROOT, '.' + relativePath);

  // 第二层防护：解析后的绝对路径必须位于 public 目录内
  if (filePath !== PUBLIC_ROOT && !filePath.startsWith(PUBLIC_ROOT + path.sep)) {
    sendText(res, method, rawPath, 403, '403 禁止访问：路径超出站点根目录。');
    return;
  }

  let data;
  try {
    data = await readFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'EISDIR') {
      sendText(res, method, rawPath, 404, `404 未找到资源：${pathname}`);
      return;
    }
    console.error(`[读取失败] ${filePath}`, error);
    sendText(res, method, rawPath, 500, '500 服务器内部错误。');
    return;
  }

  const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': data.length,
    'Cache-Control': CACHE_CONTROL,
    'X-Content-Type-Options': 'nosniff',
  });
  log(method, rawPath, 200);

  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(data);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[启动失败] 端口 ${PORT} 已被占用。请关闭占用该端口的进程，或换端口启动：PORT=${PORT + 1} node server.js（也可修改 config.json 的 server.port）`
    );
  } else if (error.code === 'EACCES') {
    console.error(`[启动失败] 没有权限监听端口 ${PORT}，请更换端口后重试。`);
  } else {
    console.error('[服务器错误]', error);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`静态服务器已启动：http://localhost:${PORT}`);
  console.log(`站点根目录：${PUBLIC_ROOT}`);
  console.log(`配置文件：${CONFIG_FILE}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
