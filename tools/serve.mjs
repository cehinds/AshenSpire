// tools/serve.mjs — a tiny zero-dependency static server for the game.
//
// The game is vanilla ES modules; browsers block `import` over file:// (CORS),
// so it must be served over http. Rather than pull in `serve`/`http-server`
// (SPEC §1: no dependencies), this is ~50 lines of Node core. Serves the repo
// root (resolved from this file's location, so cwd doesn't matter).
//
// Run: node tools/serve.mjs [port]   (default 8000; also honors $PORT)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, normalize, extname, sep } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // tools/.. = repo root
const PORT = Number(process.argv[2] || process.env.PORT || 8000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if (urlPath === '/') urlPath = '/index.html';

    // Resolve within ROOT and reject path traversal.
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      res.writeHead(403).end('403 Forbidden');
      return;
    }

    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`404 Not Found: ${urlPath}`);
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    }).end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end(`500 ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`EldenSpire served at http://localhost:${PORT}/  (root: ${ROOT})`);
  console.log('Press Ctrl+C to stop.');
});
