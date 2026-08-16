// tools/serve.mjs — a zero-dependency static file server for local play.
//
// Serves the project over http://localhost so the ES-module app (index.html →
// src/main.js) and the optional music/ folder load correctly (file:// blocks
// module + audio loading in most browsers). Used by tools/launch.mjs, or run
// directly:  node tools/serve.mjs [--port N] [--no-open] [--root DIR]

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { sourceDigest, stampSource, readOrdinal, padOrdinal, VERSION_MODULE } from './buildversion.mjs';

const ROOT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

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
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

/** Open a URL in the default browser (best-effort; silent if headless). */
export function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
    }
  } catch {
    /* no browser available — the URL is printed regardless */
  }
}

/**
 * serve({ root, port, open, lan }) → Promise<{ server, url, port }>
 * Bumps to the next port if the requested one is in use. `lan: true` attaches
 * the Forsaken Together session layer (tools/lan.mjs: discovery + lobby WS).
 */
export function serve({ root = ROOT_DIR, port = 8080, open = true, lan = false } = {}) {
  const rootResolved = resolve(root);
  let lanLayer = null; // attached after listen (needs the final port)
  const server = createServer(async (req, res) => {
    try {
      if (lanLayer && (await lanLayer.handleHttp(req, res))) return;
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = normalize(urlPath).replace(/^([/\\]|\.\.([/\\]|$))+/, '');
      let filePath = rel ? join(rootResolved, rel) : rootResolved;
      if (!resolve(filePath).startsWith(rootResolved)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      let s;
      try {
        s = await stat(filePath);
      } catch {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      if (s.isDirectory()) filePath = join(filePath, 'index.html');
      let body = await readFile(filePath);
      // THE BUILD STAMP ON THE PATH CONSTANTINE ACTUALLY PLAYS.
      //
      // run.bat / run.sh build the bundle and then serve THE SOURCE TREE, so
      // the screen he looks at is this server's output, not build/. If only
      // tools/bundle.mjs stamped the version, every screen he ever sees would
      // read `UNSTAMPED` and the whole feature would exist for a file he does
      // not open. So the digest is derived here too — same function, one home
      // (tools/buildversion.mjs), never a second copy of the arithmetic.
      //
      // It is derived PER REQUEST rather than once at boot: the dev server
      // stays up while the tree is edited, and a stamp that froze at boot would
      // name a source that is no longer there. That is the same "agreement that
      // drifts" this whole mechanism exists against, one process in.
      //
      // A FAILURE HERE IS VISIBLE, NOT SILENT. If the markers are gone the page
      // gets the unstamped module and the player reads `0.4.0+UNSTAMPED` on
      // three screens — loud, and honest about knowing nothing.
      //
      // AND THIS PATH NEVER BUMPS THE ORDINAL — it only READS it. A dev server
      // stays up across edits and re-derives per request; if it bumped, every
      // reload of an edited tree would burn a build number and rewrite a
      // committed file underneath whoever is working. So the ordinal is passed
      // on only when the recorded digest still matches the tree in front of us.
      // When it does not, nothing is passed and the page keeps `UNBUMPED`: the
      // version drops its tail rather than wearing an older build's number,
      // because a missing component is honest and a stale one that sorts is a
      // lie with a sort order. The digest beside it still names this exact tree.
      if (rel.split(/[\\/]/).join('/') === VERSION_MODULE) {
        try {
          const digest = sourceDigest(rootResolved).digest;
          let ordinal = null;
          try {
            const rec = readOrdinal(rootResolved);
            if (rec.digest === digest) ordinal = padOrdinal(rec.ordinal);
          } catch { /* no ordinal home: the page says UNBUMPED, which is true */ }
          body = Buffer.from(stampSource(body.toString('utf8'), digest, ordinal), 'utf8');
        } catch (err) {
          console.error(`serve: could not stamp ${VERSION_MODULE} — ${err.message}`);
          console.error('       the page will read UNSTAMPED, which is what it now knows.');
        }
      }
      const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end('Server error');
    }
  });

  return new Promise((done) => {
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`serve: port ${port} in use — trying ${port + 1}`);
        port += 1;
        server.listen(port);
      } else {
        throw err;
      }
    });
    server.listen(port, async () => {
      const url = `http://localhost:${port}/`;
      console.log(`\n  ▸ Ashen Spire is live at ${url}`);
      console.log(`    Serving ${rootResolved}`);
      if (lan) {
        const { attachLan, lanAddress } = await import('./lan.mjs');
        lanLayer = attachLan(server, { port, root: rootResolved });
        server.on('close', () => lanLayer.close());
        console.log(`    LAN play: friends on your network can join at http://${lanAddress()}:${port}/`);
      }
      console.log('    Press Ctrl+C to stop.\n');
      if (open) openBrowser(url);
      done({ server, url, port });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const flag = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  serve({
    port: Number(flag('--port', 8080)),
    root: flag('--root', ROOT_DIR),
    open: !args.includes('--no-open'),
    lan: !args.includes('--no-lan'),
  });
}
