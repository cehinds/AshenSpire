// tools/serve.mjs — a zero-dependency static file server for local play.
//
// Serves the project over http://localhost so the ES-module app (index.html →
// src/main.js) and the optional music/ folder load correctly (file:// blocks
// module + audio loading in most browsers). Used by tools/launch.mjs, or run
// directly:  node tools/serve.mjs [--port N] [--no-open] [--no-lan] [--host ADDR] [--root DIR] [--watch]
//
// WHERE IT LISTENS. Without --host it listens on every interface, as it always
// has (LAN play needs that). --host ADDR binds only ADDR; `--host localhost`
// binds the loopback interfaces 127.0.0.1 and, where the machine has it, ::1,
// so http://localhost:PORT answers whichever one the browser resolves first.
// --no-lan only turns off the LAN session layer; it does not change the bind.
//
// THE ART COMES FROM THE FETCHED RELEASE (docs/EXTERNAL-ASSETS-PLAN.md steps 12
// and 13). Serving a checkout (a root with art-release.json), a request under
// /assets/ (the high pack), /assets-mobile/ (light), or /assets/fonts/, /music/
// or /map-detail/ (common) is answered from .art-cache/<tag>/<pack>/ through
// tools/art-source.mjs: the trees left this repository at step 13. When the
// high pack is not fetched (node tools/fetch-art.mjs --pack light,common, the
// fresh-clone fetch), /assets/<id> is answered with the light pack's twin, so
// the source still plays with art; `--pack all` (CI's) serves the high files
// the browser gates measure. A pack that is not fetched at all answers 404 and
// the game draws its placeholders (SPEC §2.4). Any other root (a build folder)
// is served as it is on disk.
//
// --watch (opt-in, off by default; tools/launch.mjs does not pass it) is live
// reload for editing. It watches src, styles, content, games, engine and
// index.html (fs.watch, recursive where the platform supports it, else one
// watcher per directory), waits 150 ms for the writes to settle, and sends
// `event: reload` (data: the changed path) down GET /__dev/events, an
// EventSource stream. A change under content/config/ (*.json) first runs
// `node tools/config-build.mjs` (and, for ui/tokens.json, then
// `node tools/tokens-css.mjs`), one under content/hud-layout/ (*.json) runs
// `node tools/hud-layout-css.mjs`, one under content/framework/ (*.json) runs
// `node tools/framework-data-build.mjs`, one under content/source/ runs
// `node tools/content-build.mjs`, and one under games/ or engine/modules/ runs
// `node tools/game-config.mjs build` (last: it reads the other outputs), one
// build at a time with the newest change winning; a failed build sends `event: error` (data: the last 20 lines of its
// stderr) and no reload. Files a build writes itself (generated/, *.generated.js,
// *.generated.css, game.lock.json, src/framework/data/) are not edits and are
// ignored by name; an edit made while a build runs is queued and gets its own round. In watch mode the served
// index.html (that file only) gets a small inline script before </body> that
// reloads the page on `reload` and shows `error` text in a banner. Without --watch nothing here exists: no
// endpoint, no watcher, and every response is byte-identical to before.

import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, normalize, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { sourceDigest, stampSource, readOrdinal, padOrdinal, VERSION_MODULE, RUN_PATH_SERVE } from './buildversion.mjs';
import { saveFirstStepDefaults } from './prologue-editor-save.mjs';
import { artPath, packTreeOf, HIGH_TREE } from './art-source.mjs';
import { existsSync, readdirSync, statSync, watch as fsWatch } from 'node:fs';

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

// ---- --watch: live reload for the source tree (see the header comment) ------
export const DEV_EVENTS_PATH = '/__dev/events';
const WATCH_TARGETS = ['src', 'styles', 'content', 'games', 'engine', 'index.html'];
const WATCH_DEBOUNCE_MS = 150;
const WATCH_SKIP = /(^|\/)(\.|node_modules(\/|$))|~$|\.sw[px]$|\.tmp$/;

/** The order builders run in when one batch needs several. */
const BUILD_ORDER = ['config-build.mjs', 'tokens-css.mjs', 'hud-layout-css.mjs', 'framework-data-build.mjs', 'content-build.mjs',
  'game-config.mjs build']; // last: it hashes src/** and reads the other generated modules

/** Which build tool (in tools/) must run before a change under `rel` can be seen. */
export function buildToolFor(rel) {
  // A per-directory watcher reports a replaced authored tree by its own name,
  // not a descendant filename. That event still owes the tree's builder.
  const jsonTree = tree => rel === tree || (rel.startsWith(tree + '/') && rel.endsWith('.json'));
  if (jsonTree('content/config') || rel === 'content/config/ui') return 'config-build.mjs';
  if (rel === 'content/source' || rel.startsWith('content/source/')) return 'content-build.mjs';
  // content/hud-layout/*.json → styles/hud-layout.generated.css (no flag = --write).
  if (jsonTree('content/hud-layout')) return 'hud-layout-css.mjs';
  // content/framework/*.json → src/framework/data/*.js (no flag = compile + report).
  // Before content-build, whose stray-source sweep wants each JSON's mirror to exist.
  if (jsonTree('content/framework')) return 'framework-data-build.mjs';
  // games/** and every engine tree game-config.mjs reads (modules, foundation, the
  // game-profile contract, kernel, runtime) → src/content/generated/{gameProfiles,baseCards}.js
  // and games/ashenspire/game.lock.json. Needs the subcommand: bare, it only validates.
  if (rel === 'games' || rel.startsWith('games/') || /^engine\/(modules|foundation|contracts|kernel|runtime)(?:\/|$)/.test(rel)) return 'game-config.mjs build';
  return null;
}

/**
 * Every build tool a change under `rel` owes, in no particular order (the run
 * order is BUILD_ORDER). Usually the one buildToolFor names; a change that can
 * touch ui/tokens.json also owes tokens-css.mjs, which reads it.
 */
export function buildToolsFor(rel) {
  const tool = buildToolFor(rel);
  // ui/tokens.json itself, or any directory above it that a watcher may report
  // as replaced (content/config, content/config/ui): both could hold new tokens.
  if (tool === 'config-build.mjs' && TOKENS_JSON_AND_ANCESTORS.includes(rel)) {
    return [tool, 'tokens-css.mjs'];
  }
  return tool ? [tool] : [];
}
const TOKENS_JSON_AND_ANCESTORS = ['content/config', 'content/config/ui', 'content/config/ui/tokens.json'];

/** Last 20 lines of a tool's output, for the error banner. */
function tailLines(text, n = 20) {
  return String(text || '').trimEnd().split(/\r?\n/).slice(-n).join('\n');
}

/** Run `node <root>/tools/<tool> [args]` once → null on success, else the message to show. `tool` may carry arguments ('game-config.mjs build'). */
function runBuild(root, command) {
  const [tool, ...args] = command.split(' ');
  const script = join(root, 'tools', tool);
  if (!existsSync(script)) return Promise.resolve(`serve --watch: ${tool} not found under ${join(root, 'tools')}`);
  return new Promise((done) => {
    execFile(process.execPath, [script, ...args], { cwd: root, maxBuffer: 1 << 23, timeout: 120000 }, (err, stdout, stderr) => {
      if (!err) { done(null); return; }
      done(tailLines(stderr) || tailLines(stdout) || `${tool} failed: ${err.message}`);
    });
  });
}

/** --watch only: what index.html gets before </body>. Plain DOM, no CSS file. */
const DEV_RELOAD_SCRIPT = `<script>
(function () {
  var es = new EventSource('${DEV_EVENTS_PATH}'), bar = null;
  es.addEventListener('reload', function () { location.reload(); });
  es.addEventListener('error', function (e) {
    if (!e.data) return; // a dropped connection, not a build error: EventSource retries by itself
    if (!bar) {
      bar = document.createElement('pre');
      bar.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:2147483647;margin:0;padding:8px 12px;' +
        'max-height:40vh;overflow:auto;background:#7a1010;color:#fff;font:12px/1.4 monospace;white-space:pre-wrap');
      bar.onclick = function () { bar.style.display = 'none'; };
      document.body.appendChild(bar);
    }
    bar.style.display = 'block';
    bar.textContent = 'Build failed (click to hide)\\n' + e.data;
  });
})();
</script>
`;

/** One SSE message; a multi-line payload becomes one data: line per line. */
function sseMessage(event, text) {
  return `event: ${event}\n${String(text).split(/\r?\n/).map((line) => `data: ${line}`).join('\n')}\n\n`;
}

/**
 * Watch the source tree under `root`; after a 150 ms quiet spell, run any build
 * the change needs (one at a time, the newest change wins), then call
 * emit('reload', path) or, when the build failed, emit('error', stderr tail).
 * Strategy: fs.watch with { recursive: true } on each target that exists; where
 * that throws (Linux before Node 20), every directory under the target gets its
 * own non-recursive watcher, and new directories are picked up as they appear.
 * SERVE_WATCH_NO_RECURSIVE=1 forces that second strategy (the test uses it).
 */
/**
 * The path a reload names: the last FILE the batch saw. Windows reports a
 * directory as changed whenever a file inside it is written (the entry's
 * mtime moves), so a batch there reads [file, its directory] and the
 * directory would otherwise be the label; a path that is gone counts as a
 * file (a delete is an edit). A batch of directories alone keeps its last.
 */
/**
 * Windows reports a 'change' on a DIRECTORY whenever a file inside it is
 * written (its mtime moved); the file's own event already says everything.
 * A build's output write would otherwise land such an event on its parent
 * (games/ashenspire, src/framework/data) after the quiet window and start
 * another round. 'rename' on a directory (created, removed, replaced) is
 * real and is never dropped.
 */
function isDirectoryNoise(absPath) {
  try { return statSync(absPath).isDirectory(); } catch { return false; }
}

export function reloadLabel(root, batch) {
  for (let i = batch.length - 1; i >= 0; i--) {
    try { if (!statSync(join(root, batch[i])).isDirectory()) return batch[i]; } catch { return batch[i]; }
  }
  return batch[batch.length - 1];
}

function startWatch(root, emit) {
  const closers = [];
  const dirs = new Map(); // per-directory fallback: absolute dir -> its fs.watch handle
  const pending = new Set();
  let timer = null;
  let running = false;
  const forceDirs = process.env.SERVE_WATCH_NO_RECURSIVE === '1';

  const owed = new Set(); // builders a failed round left unrun; they ride the next round
  async function flush() {
    if (running) return; // the loop below picks the new change up
    running = true;
    try {
      while (pending.size) {
        const batch = [...pending];
        pending.clear();
        // Fixed order, not arrival order: content-build rejects a stale config
        // module, so config-build must finish first. A builder an earlier
        // failure skipped stays owed until a round runs it.
        const wanted = new Set([...owed, ...batch.flatMap(buildToolsFor)]);
        const tools = BUILD_ORDER.filter((tool) => wanted.has(tool));
        let failure = null, at = 0;
        for (; at < tools.length; at++) {
          failure = await runBuild(root, tools[at]);
          if (failure) break;
          owed.delete(tools[at]);
        }
        if (failure) { for (const tool of tools.slice(at)) owed.add(tool); emit('error', failure); }
        else emit('reload', reloadLabel(root, batch));
      }
    } finally { running = false; }
  }

  function changed(rel) {
    rel = rel.split(sep).join('/');
    if (WATCH_SKIP.test(rel)) return;
    // A build's own output is recognised by name, never by timing, so an edit
    // made during a build (or just after it) is never dropped: it joins
    // `pending` and the loop in flush() runs another round for it.
    if (/(^|\/)generated\//.test(rel) || /\.generated\.(js|css)$/.test(rel)) return;
    if (rel.startsWith('src/framework/data/')) return; // framework-data-build / content-build output
    if (rel.endsWith('/game.lock.json')) return; // game-config build rewrites it, under the watched games/
    pending.add(rel);
    clearTimeout(timer);
    timer = setTimeout(flush, WATCH_DEBOUNCE_MS);
  }

  // Drops the watcher for `dir` and everything below it (the directory is gone,
  // or is about to be re-watched on a new inode).
  function unwatchDir(dir) {
    for (const [d, w] of dirs) {
      if (d === dir || d.startsWith(dir + sep)) { dirs.delete(d); try { w.close(); } catch { /* already closed */ } }
    }
  }

  function watchDir(dir) {
    // A rename on an already-watched name means the directory was replaced:
    // the old handle watches a dead inode, so re-attach rather than return.
    if (dirs.has(dir)) unwatchDir(dir);
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    try {
      const w = fsWatch(dir, (type, name) => {
        if (!name) return;
        const abs = join(dir, String(name));
        if (type === 'change' && isDirectoryNoise(abs)) return;
        changed(relative(root, abs));
        if (type !== 'rename') return;
        let isDir = false;
        try { isDir = statSync(abs).isDirectory(); } catch { unwatchDir(abs); return; }
        if (isDir && !WATCH_SKIP.test(String(name))) watchDir(abs);
      });
      w.on('error', () => unwatchDir(dir));
      dirs.set(dir, w);
    } catch { return; }
    for (const e of entries) if (e.isDirectory() && !WATCH_SKIP.test(e.name)) watchDir(join(dir, e.name));
  }

  for (const target of WATCH_TARGETS) {
    const abs = join(root, target);
    if (!existsSync(abs)) continue;
    const isDir = statSync(abs).isDirectory();
    try {
      if (!isDir || forceDirs) throw new Error('per-directory');
      const w = fsWatch(abs, { recursive: true }, (type, name) => {
        const full = name ? join(abs, String(name)) : abs;
        if (type === 'change' && isDirectoryNoise(full)) return;
        changed(relative(root, full));
      });
      w.on('error', () => {});
      closers.push(() => w.close());
    } catch {
      if (isDir) watchDir(abs);
      else {
        // A file-level watcher follows the inode, so an editor that saves by
        // renaming a temp file over it would fire once and go silent. Watch the
        // parent directory (not recursive) and filter on the name instead.
        try {
          const w = fsWatch(root, (type, name) => { if (String(name || '') === target) changed(target); });
          w.on('error', () => {});
          closers.push(() => w.close());
        } catch { /* unwatchable */ }
      }
    }
  }
  return { close() { clearTimeout(timer); for (const c of closers) c(); for (const w of dirs.values()) { try { w.close(); } catch { /* already closed */ } } dirs.clear(); } };
}

/**
 * serve({ root, port, open, lan, host, watch }) → Promise<{ server, url, port }>
 * `host` binds one address ('localhost': 127.0.0.1 and ::1); unset, every interface.
 * Bumps to the next port if the requested one is in use. `lan: true` attaches
 * the Forsaken Together session layer (tools/lan.mjs: discovery + lobby WS).
 */
export function serve({ root = ROOT_DIR, port = 8080, open = true, lan = false, editorWrite = false, quiet = false, host, watch = false } = {}) {
  const rootResolved = resolve(root);
  const checkout = existsSync(join(rootResolved, 'art-release.json'));
  const notedMissing = new Set(); // one note per missing pack, not one per request
  let lanLayer = null; // attached after listen (needs the final port)
  const devClients = new Set(); // --watch: open /__dev/events responses
  const server = createServer(async (req, res) => {
    try {
      if (lanLayer && (await lanLayer.handleHttp(req, res))) return;
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      // --watch only: the live-reload stream (events are sent by startWatch below).
      if (watch && urlPath === DEV_EVENTS_PATH) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff' });
        res.write('retry: 1000\n: connected\n\n');
        devClients.add(res);
        req.on('close', () => devClients.delete(res));
        return;
      }
      // Which folder this server serves, so the Workbench reuses it only for
      // its own project. Loopback only: the path is not for LAN clients.
      if (urlPath === '/__serve/info') {
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
        const ok = local && /^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host || '');
        res.writeHead(ok ? 200 : 403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify(ok ? { root: rootResolved } : { error: 'Local requests only.' }));
        return;
      }
      // Direct edits to the master JSON become native card data on refresh.
      if(editorWrite&&urlPath==='/src/content/cardComponents.generated.js'){
        const {refreshCardLayout}=await import('./card-layout-save.mjs');
        refreshCardLayout(rootResolved);
      }
      if(urlPath==='/__editor/card-layout'){
        const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||''),host=req.headers.host||'';
        const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
        if(!editorWrite||!local||!/^(localhost|127\.0\.0\.1):\d+$/.test(host)){reply(403,{error:'Game editing is unavailable on this server.'});return;}
        const {readCardLayout,saveCardLayout}=await import('./card-layout-save.mjs');
        if(req.method==='GET'){const saved=readCardLayout(rootResolved),download=new URL(req.url,`http://${host}`).searchParams.get('download');if(download){if(download!==saved.revision){reply(409,{error:'The game layout changed. Save again before exporting.'});return;}res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="ashen-card-layout.json"','Cache-Control':'no-store'});res.end(JSON.stringify(saved.document,null,2)+'\n');}else reply(200,{ok:true,...saved});return;}
        if(req.method!=='POST'||req.headers.origin!==`http://${host}`||!String(req.headers['content-type']).startsWith('application/json')){reply(403,{error:'Save from the local card editor.'});return;}
        try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>131072)throw Error('Card layout exceeds the save limit.');chunks.push(chunk);}reply(200,{ok:true,...saveCardLayout(rootResolved,JSON.parse(Buffer.concat(chunks).toString('utf8')))});}catch(error){reply(400,{error:error.message});}return;
      }
      if (urlPath === '/__editor/prologue-defaults') {
        const remote = req.socket.remoteAddress || '';
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
        const host = req.headers.host || '';
        const safeHost = /^(localhost|127\.0\.0\.1):\d+$/.test(host);
        const authorized = editorWrite && local && safeHost;
        const reply = (status, value) => {
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify(value));
        };
        if (!authorized) { reply(403, { ok: false, error: 'Project editing is unavailable on this server.' }); return; }
        if (req.method === 'GET') { reply(200, { ok: true, projectDefaults: true }); return; }
        if (req.method !== 'POST' || req.headers.origin !== `http://${host}` || !String(req.headers['content-type']).startsWith('application/json')) {
          reply(403, { ok: false, error: 'This save must come from the local scene editor.' }); return;
        }
        try {
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 65536) throw new Error('The scene changes are too large.');
            chunks.push(chunk);
          }
          const changes = JSON.parse(Buffer.concat(chunks).toString('utf8')).changes;
          reply(200, { ok: true, ...await saveFirstStepDefaults(rootResolved, changes) });
        } catch (error) { reply(400, { ok: false, error: error.message }); }
        return;
      }
      const rel = normalize(urlPath).replace(/^([/\\]|\.\.([/\\]|$))+/, '');
      let filePath = rel ? join(rootResolved, rel) : rootResolved;
      if (!resolve(filePath).startsWith(rootResolved)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const tree = checkout ? packTreeOf(rel) : null;
      if (tree && !(editorWrite && existsSync(filePath))) {
        try {
          filePath = artPath(rel, { root: rootResolved });
        } catch (err) {
          // The high tier, unfetched: its light twin (same id, smaller file).
          let twin = null;
          if (tree === HIGH_TREE) {
            try { twin = artPath(`assets-mobile/${rel.split(/[\\/]/g).join('/').slice(HIGH_TREE.length + 1)}`, { root: rootResolved }); } catch { /* the light pack is not fetched either */ }
          }
          if (!twin) {
            if (!notedMissing.has(tree)) { notedMissing.add(tree); console.error(`serve: ${err.message}`); }
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          if (!notedMissing.has('high-as-light')) { notedMissing.add('high-as-light'); console.error(`serve: ${err.message} — answering /assets/ with the light pack's twins meanwhile`); }
          filePath = twin;
        }
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
          // The ordinal and the date move together or not at all: both are
          // facts of the build that wrote buildordinal.json, so a tree that has
          // drifted from that record has neither, and half of a stale pair is
          // worse than none of it.
          let ordinal = null;
          let built = null;
          try {
            const rec = readOrdinal(rootResolved);
            if (rec.digest === digest) { ordinal = padOrdinal(rec.ordinal); built = rec.built; }
          } catch { /* no ordinal home: the page says UNBUMPED/UNDATED, which is true */ }
          // AND THIS PATH SAYS SO. Constantine plays the source tree through
          // this server; the bundle is a different artifact with different
          // bugs, and until now a screenshot could not tell them apart.
          body = Buffer.from(stampSource(body.toString('utf8'), digest, {
            ordinal, built, runPath: RUN_PATH_SERVE,
          }), 'utf8');
        } catch (err) {
          console.error(`serve: could not stamp ${VERSION_MODULE} — ${err.message}`);
          console.error('       the page will read UNSTAMPED, which is what it now knows.');
        }
      }
      // --watch only, and only the root's index.html: the live-reload listener.
      if (watch && resolve(filePath) === join(rootResolved, 'index.html')) {
        const html = body.toString('utf8');
        const at = html.toLowerCase().lastIndexOf('</body>');
        body = Buffer.from(at < 0 ? html + DEV_RELOAD_SCRIPT : html.slice(0, at) + DEV_RELOAD_SCRIPT + html.slice(at), 'utf8');
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
        listen();
      } else {
        throw err;
      }
    });
    const loopback = host === 'localhost';
    const listen = () => (host ? server.listen(port, loopback ? '127.0.0.1' : host) : server.listen(port));
    server.once('listening', async () => {
      // `port` 0 asks the OS for a free one; name the port it gave.
      port = server.address().port;
      if (loopback) {
        // Also answer on ::1, where localhost may resolve first; best-effort
        // (no IPv6, or the port taken there, leaves 127.0.0.1 alone).
        const v6 = createNetServer((socket) => server.emit('connection', socket));
        v6.on('error', () => {});
        v6.listen(port, '::1');
        server.on('close', () => v6.close());
      }
      const shown = !host || loopback || ['127.0.0.1', '::1', '0.0.0.0', '::'].includes(host) ? 'localhost' : host.includes(':') ? `[${host}]` : host;
      const url = `http://${shown}:${port}/`;
      const log = quiet ? () => {} : (line) => console.log(line);
      log(`\n  ▸ Ashen Spire is live at ${url}`);
      log(`    Serving ${rootResolved}`);
      if (lan) {
        const { attachLan, lanAddress } = await import('./lan.mjs');
        lanLayer = attachLan(server, { port, root: rootResolved });
        server.on('close', () => lanLayer.close());
        log(`    LAN play: friends on your network can join at http://${lanAddress()}:${port}/`);
      }
      if (watch) {
        const sendDev = (event, text) => { const msg = sseMessage(event, text); for (const c of devClients) c.write(msg); };
        const watcher = startWatch(rootResolved, sendDev);
        const beat = setInterval(() => { for (const c of devClients) c.write(': keep-alive\n\n'); }, 15000);
        beat.unref();
        const closeServer = server.close.bind(server);
        server.close = (cb) => { watcher.close(); clearInterval(beat); for (const c of devClients) c.end(); devClients.clear(); return closeServer(cb); };
        log('    Watching src, styles, content, games, engine and index.html: pages reload on change.');
      }
      log('    Press Ctrl+C to stop.\n');
      if (open) openBrowser(url);
      done({ server, url, port });
    });
    listen();
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
    editorWrite: args.includes('--editor-write'),
    host: flag('--host', undefined),
    watch: args.includes('--watch'),
  });
}
