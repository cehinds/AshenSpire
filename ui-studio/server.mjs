// ui-studio/server.mjs — the local half of UI Studio.
//
//   node ui-studio/server.mjs [--project DIR] [--port 4319]
//
// Serves the studio on 127.0.0.1 only and gives the page four things a browser
// cannot do for itself: read the content/config tree, validate a proposed tree
// with the game's own compiler (tools/config-build.mjs compileEntries — the
// same refusals the build would raise), write the files back with a backup and
// an expected-hash check, and run the compiler so the live preview sees the
// change. Sketches and studio settings are kept under ui-studio/workspace/.
//
// The game preview is served under /game/ on the `localhost` origin while the
// studio and its API live on `127.0.0.1`, so a page inside the preview frame
// cannot reach the file API (the same split editor/server.mjs uses).

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { compileEntries, readConfigTree, CONFIG_DIR } from '../tools/config-build.mjs';
import { DEFAULT_SETTINGS, mergeSettings, settingsProblems, sketchProblems } from './model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.csv': 'text/csv', '.md': 'text/markdown' };
const STUDIO_FILES = ['index.html', 'app.mjs', 'canvas.mjs', 'model.mjs', 'studio.css'];
const CONFIG_REL = /^ui\/(tokens\.json|(scenes|components|screens|presentation)\/[\w-]+\.json)$/;
const SKETCH_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const hash = (text) => createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex');

/** A path under `root` with no traversal, hidden segments, or symlinks. */
export async function safePath(root, rel, { creating = false } = {}) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0') || rel.includes('\\') || path.isAbsolute(rel)) throw Error(`Refused path: ${rel}`);
  const parts = rel.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || p.startsWith('.') || p.includes(':'))) throw Error(`Refused path: ${rel}`);
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) throw Error(`Refused path: ${rel}`);
  // Every segment between the root and the file is checked, not only the
  // leaf: a symlinked directory half-way down is the one that escapes.
  let probe = root;
  for (const part of parts) {
    probe = path.join(probe, part);
    try {
      if ((await fs.lstat(probe)).isSymbolicLink()) throw Error(`Linked path refused: ${rel}`);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      if (!creating) throw Object.assign(Error(`Not found: ${rel}`), { code: 'ENOENT' });
      break;
    }
  }
  return abs;
}

/**
 * The studio's workspace: settings, sketches, config reads and guarded writes.
 * `stateDir` receives the backups. Writes are serialized through one queue.
 */
export class Workspace {
  constructor(root, stateDir) { this.root = root; this.stateDir = stateDir; this.queue = Promise.resolve(); }
  serialize(task) { const run = this.queue.then(task, task); this.queue = run.catch(() => {}); return run; }
  get workspaceDir() { return path.join(HERE, 'workspace'); }

  async settings() {
    let live = {};
    try { live = JSON.parse(await fs.readFile(path.join(this.workspaceDir, 'settings.json'), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const merged = mergeSettings(DEFAULT_SETTINGS, live);
    try {
      const { balance } = await import(pathToFileURL(path.join(this.root, 'src/content/balance.js')).href);
      if (balance && balance.ui && balance.ui.uiScale) merged.gameLayout = { ...merged.gameLayout, ...balance.ui.uiScale };
    } catch { /* an older checkout, or a headless import that fails: the defaults stand */ }
    return merged;
  }

  async saveSettings(settings) {
    const problems = settingsProblems(settings);
    if (problems.length) throw Error(`Settings refused: ${problems.join('; ')}`);
    await fs.mkdir(this.workspaceDir, { recursive: true });
    await fs.writeFile(path.join(this.workspaceDir, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`);
    return { ok: true };
  }

  async config() {
    return readConfigTree(path.join(this.root, 'content')).map((e) => ({ rel: e.rel, text: e.text, hash: hash(e.text) }));
  }

  /** Validate the tree with `changes` applied, with the game's own compiler. */
  async validate(changes) {
    const tree = readConfigTree(path.join(this.root, 'content'));
    for (const c of changes || []) {
      if (!CONFIG_REL.test(c.rel || '')) throw Error(`Not a config file: ${c.rel}`);
      const i = tree.findIndex((e) => e.rel === c.rel);
      if (i < 0) tree.push({ rel: c.rel, text: c.text }); else tree[i] = { rel: c.rel, text: c.text };
    }
    const result = compileEntries(tree);
    return { errors: result.errors, files: tree.length };
  }

  /** Write config files after the whole tree validates and every expected hash matches. */
  async save(changes) {
    if (!Array.isArray(changes) || !changes.length) throw Error('Nothing to save');
    const { errors } = await this.validate(changes);
    if (errors.length) throw Error(`The compiler refuses this tree:\n${errors.join('\n')}`);
    return this.serialize(async () => {
      const targets = [];
      for (const c of changes) {
        const abs = await safePath(this.root, `${CONFIG_DIR}/${c.rel}`, { creating: true });
        let current = null;
        try { current = await fs.readFile(abs, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (current !== null && hash(current) !== c.hash) throw Error(`${c.rel} changed on disk since it was opened; reload it before saving`);
        if (current === null && c.hash) throw Error(`${c.rel} no longer exists on disk; reload before saving`);
        targets.push({ abs, rel: c.rel, current, text: c.text });
      }
      const id = `${Date.now()}-${randomBytes(4).toString('hex')}`;
      const dir = path.join(this.stateDir, 'backups', id);
      await fs.mkdir(dir, { recursive: true });
      const manifest = [];
      for (const [i, t] of targets.entries()) {
        if (t.current !== null) await fs.writeFile(path.join(dir, `${i}.bak`), t.current);
        manifest.push({ index: i, path: `${CONFIG_DIR}/${t.rel}`, oldHash: t.current === null ? null : hash(t.current), savedHash: hash(t.text) });
      }
      await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      for (const t of targets) { await fs.mkdir(path.dirname(t.abs), { recursive: true }); await fs.writeFile(t.abs, t.text); }
      await this.pruneBackups((await this.settings()).save.keepBackups);
      return { backup: id, files: targets.map((t) => ({ rel: t.rel, hash: hash(t.text) })) };
    });
  }

  async pruneBackups(keep = 40) {
    if (!(Number.isInteger(keep) && keep >= 1)) keep = 40;
    const dir = path.join(this.stateDir, 'backups');
    const ids = (await fs.readdir(dir).catch(() => [])).sort();
    for (const id of ids.slice(0, Math.max(0, ids.length - keep))) await fs.rm(path.join(dir, id), { recursive: true, force: true });
  }

  async backups() {
    const dir = path.join(this.stateDir, 'backups');
    const ids = (await fs.readdir(dir).catch(() => [])).sort().reverse().slice(0, 40);
    return Promise.all(ids.map(async (id) => ({ id, files: JSON.parse(await fs.readFile(path.join(dir, id, 'manifest.json'), 'utf8')) })));
  }

  /** The previous bytes of a backup, staged for the page to review — never applied here. */
  async backup(id) {
    if (!/^\d+-[a-f0-9]+$/.test(id)) throw Error('Invalid backup id');
    const dir = path.join(this.stateDir, 'backups', id);
    const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
    const changes = [];
    for (const entry of manifest) {
      if (entry.oldHash === null) continue;
      changes.push({ rel: entry.path.replace(`${CONFIG_DIR}/`, ''), text: await fs.readFile(path.join(dir, `${entry.index}.bak`), 'utf8'), hash: entry.savedHash });
    }
    return { changes };
  }

  async sketches() {
    const dir = path.join(this.workspaceDir, 'sketches');
    const names = (await fs.readdir(dir).catch(() => [])).filter((n) => n.endsWith('.json')).sort();
    return Promise.all(names.map(async (n) => {
      const text = await fs.readFile(path.join(dir, n), 'utf8');
      let sketch = null; try { sketch = JSON.parse(text); } catch { /* listed as unreadable */ }
      return { name: n.replace(/\.json$/, ''), title: sketch && sketch.name, boxes: sketch && Array.isArray(sketch.boxes) ? sketch.boxes.length : null, hash: hash(text) };
    }));
  }

  async sketch(name) {
    if (!SKETCH_NAME.test(name || '')) throw Error('Sketch names use lower-case letters, digits and dashes');
    const text = await fs.readFile(path.join(this.workspaceDir, 'sketches', `${name}.json`), 'utf8');
    return { name, sketch: JSON.parse(text), hash: hash(text) };
  }

  async saveSketch(name, sketch) {
    if (!SKETCH_NAME.test(name || '')) throw Error('Sketch names use lower-case letters, digits and dashes');
    const problems = sketchProblems(sketch);
    if (problems.length) throw Error(`Sketch refused: ${problems.join('; ')}`);
    const dir = path.join(this.workspaceDir, 'sketches');
    await fs.mkdir(dir, { recursive: true });
    const text = `${JSON.stringify(sketch, null, 2)}\n`;
    await fs.writeFile(path.join(dir, `${name}.json`), text);
    return { name, hash: hash(text) };
  }
}

export async function createUiStudio({ root = path.resolve(HERE, '..'), port = 4319, stateDir } = {}) {
  root = await fs.realpath(root);
  stateDir ||= path.join(HERE, '.state', hash(root).slice(0, 16));
  const workspace = new Workspace(root, stateDir);
  const token = randomBytes(32).toString('hex');
  let job = null;
  const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
  async function body(req) {
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 8 * 1024 * 1024) throw Error('Request exceeds 8 MB'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  }
  function branch() { try { return execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unknown'; } }
  function startCompile() {
    if (job && job.status === 'running') throw Error('The compiler is already running');
    job = { status: 'running', output: '' };
    const current = job;
    workspace.serialize(() => new Promise((resolve) => {
      const child = spawn(process.execPath, ['tools/config-build.mjs'], { cwd: root, windowsHide: true });
      current.child = child;
      const append = (d) => { current.output = (current.output + d).slice(-60000); };
      child.stdout.on('data', append); child.stderr.on('data', append);
      child.on('error', (e) => { append(e.message); current.status = 'failed'; resolve(); });
      child.on('close', (code) => { current.status = code === 0 ? 'passed' : 'failed'; resolve(); });
    }));
    return { ok: true };
  }

  const server = http.createServer(async (req, res) => {
    try {
      const address = `127.0.0.1:${server.address().port}`;
      const previewAddress = `localhost:${server.address().port}`;
      if (![address, previewAddress].includes(req.headers.host)) return send(res, 403, { error: 'Use the local studio address' });
      const url = new URL(req.url, `http://${address}`);
      if (req.headers.host === previewAddress && !url.pathname.startsWith('/game/')) return send(res, 403, { error: 'The preview origin serves the game only' });
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.origin && req.headers.origin !== `http://${address}`) return send(res, 403, { error: 'Cross-origin request refused' });
        if (req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: 'Cross-site request refused' });
        if (url.pathname !== '/api/session' && req.headers['x-studio-token'] !== token) return send(res, 403, { error: 'Reopen the studio to connect' });
        if (req.method === 'GET') {
          if (url.pathname === '/api/session') return send(res, 200, { token, root, branch: branch() });
          if (url.pathname === '/api/settings') return send(res, 200, await workspace.settings());
          if (url.pathname === '/api/config') return send(res, 200, await workspace.config());
          if (url.pathname === '/api/sketches') return send(res, 200, await workspace.sketches());
          if (url.pathname === '/api/sketch') return send(res, 200, await workspace.sketch(url.searchParams.get('name')));
          if (url.pathname === '/api/backups') return send(res, 200, await workspace.backups());
          if (url.pathname === '/api/compile') { const { child, ...publicJob } = job || { status: 'idle', output: '' }; return send(res, 200, publicJob); }
        }
        if (req.method === 'POST') {
          const data = await body(req);
          if (url.pathname === '/api/settings') return send(res, 200, await workspace.saveSettings(data));
          if (url.pathname === '/api/validate') return send(res, 200, await workspace.validate(data.changes));
          if (url.pathname === '/api/save') return send(res, 200, await workspace.save(data.changes));
          if (url.pathname === '/api/sketch') return send(res, 200, await workspace.saveSketch(data.name, data.sketch));
          if (url.pathname === '/api/backup') return send(res, 200, await workspace.backup(data.id));
          if (url.pathname === '/api/compile') return send(res, 200, startCompile());
        }
        return send(res, 404, { error: 'Unknown studio action' });
      }
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not supported' });
      let file;
      if (url.pathname.startsWith('/game/')) {
        const name = decodeURIComponent(url.pathname.slice(6));
        const allowed = /^(assets|art|docs|src|styles|content|music)\//.test(name) || /^[\w-]+\.html$/.test(name);
        if (!allowed || !MIME[path.extname(name)]) throw Error('Not a preview asset');
        if (req.headers.host === address) { res.writeHead(302, { Location: `http://${previewAddress}${url.pathname}${url.search}` }); return res.end(); }
        file = await safePath(root, name);
      } else {
        const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        if (!STUDIO_FILES.includes(name)) return send(res, 404, { error: 'Not found' });
        file = path.join(HERE, name);
      }
      const bytes = await fs.readFile(file);
      const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
      headers['Content-Security-Policy'] = url.pathname.startsWith('/game/')
        ? `sandbox allow-scripts allow-same-origin allow-forms allow-modals; frame-ancestors 'self' http://${address}`
        : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src http://${previewAddress}; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`;
      res.writeHead(200, headers);
      res.end(bytes);
    } catch (error) { send(res, error.code === 'ENOENT' ? 404 : 400, { error: error.message }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, workspace, url: `http://127.0.0.1:${server.address().port}`, close: async () => { if (job && job.child) job.child.kill(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const at = (flag) => { const i = process.argv.indexOf(flag); return i < 0 ? null : process.argv[i + 1]; };
  const app = await createUiStudio({ ...(at('--project') ? { root: path.resolve(at('--project')) } : {}), port: Number(at('--port') || process.env.UI_STUDIO_PORT || 4319) });
  console.log(`AshenSpire UI Studio: ${app.url}`);
  const close = async () => { await app.close(); process.exit(0); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}
