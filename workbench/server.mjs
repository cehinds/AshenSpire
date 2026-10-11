// workbench/server.mjs — AshenSpire Workbench, one window for every authoring tool.
//
//   node workbench/server.mjs [--port 4300] [--no-open] [--project DIR] [--no-children]
//
// Serves the Workbench page on 127.0.0.1 and runs the tools it hosts as child
// servers: the Content Editor (4317), Pose & FX (4318), UI Studio (4319) and the
// game dev server (4320). A tool already answering on its port is reused. The
// page talks to this server for tool status, git state, allowlisted jobs, the
// preview gallery, the engine export and the live-reload stream (SSE).
//
// The API follows the studios' local-only model (workbench/lib/gate.mjs): a
// fixed Host, a same-origin Origin, and a per-process token on every call.
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { safePath, createGate, newToken, createSseHub, readJson, sendJson, MIME } from './lib/index.mjs';
import { ToolSupervisor } from './core/tools.mjs';
import { JobRunner, GENERATED, STOP_GRACE_MS } from './core/jobs.mjs';
import { createWatcher, createOwnWrites, buildsFor, isBuildOutput } from './core/watch.mjs';
import { Settings, resolveExternal } from './core/settings.mjs';
import { createFileService } from './core/files.mjs';
import { listArt, resolveArt, findUsage } from './core/assets.mjs';
import { MIME as ASSET_MIME } from '../tools/assetmime.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
export const DEFAULT_PORT = 4300;
const STATIC = /^(index\.html|app\.mjs|workbench\.css|shared\/[\w-]+\.css|ui\/(kit\/)?[\w-]+\.(mjs|css)|modules\/([\w-]+\/)?[\w-]+\.(mjs|css))$/;
const PREVIEW_FILE = /^([\w.-]+-preview|tooltip-review[\w.-]*)\.html$/;
const WATCH_DIRS = ['content', 'src', 'styles'];
const EXPORT_DIR = 'build/engine-export';
// A save carries up to 100 files of up to 4 MB each, as JSON.
const FILES_BODY_LIMIT = 32 * 1024 * 1024;

const git = (root, args) => new Promise((resolve) => {
  execFile('git', args, { cwd: root, windowsHide: true, maxBuffer: 8 << 20 }, (error, stdout) => resolve(error ? null : stdout));
});

export async function gitState(root) {
  const [branch, head, status] = await Promise.all([git(root, ['branch', '--show-current']), git(root, ['rev-parse', '--short', 'HEAD']), git(root, ['status', '--porcelain'])]);
  if (branch === null && head === null) return { repo: false, branch: '', head: '', dirty: 0, files: [] };
  const lines = (status || '').split('\n').filter(Boolean);
  return { repo: true, branch: (branch || '').trim() || '(detached)', head: (head || '').trim(), dirty: lines.length, files: lines.slice(0, 80) };
}

export async function listPreviews(root) {
  const names = (await fs.readdir(root).catch(() => [])).filter((n) => PREVIEW_FILE.test(n)).sort();
  return Promise.all(names.map(async (file) => {
    let title = file.replace(/\.html$/, '');
    try {
      const head = (await fs.readFile(path.join(root, file), 'utf8')).slice(0, 8192);
      const m = head.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (m && m[1].trim()) title = m[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    } catch { /* unreadable: the file name stands */ }
    return { file, title, kind: file.startsWith('tooltip-review') ? 'review' : 'preview' };
  }));
}

export const REGISTRY_FORMAT = 'ashenspire.workbench-tools/1';
export async function readRegistry(file = path.join(HERE, 'tools.json')) {
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  if (data.format !== REGISTRY_FORMAT) throw Error(`${path.basename(file)}: expected format ${REGISTRY_FORMAT}`);
  return data;
}

/**
 * The Library: every registered page (workbench/tools.json), each marked with
 * whether it exists in this project, plus any root preview page the registry
 * does not name yet — listed, never hidden, so a new page shows up at once.
 */
export async function library(root, { settings = {}, extBase = '' } = {}) {
  const registry = await readRegistry();
  const entries = await Promise.all(registry.entries.map(async (e) => {
    if (e.source === 'art-checkout') {
      const rel = settings.artCheckout ? resolveExternal(e, settings.artCheckout) : null;
      return { ...e, external: true, configured: Boolean(settings.artCheckout), exists: Boolean(rel), url: rel ? `${extBase}/ext/art/${rel.split('/').map(encodeURIComponent).join('/')}` : '' };
    }
    if (e.source === 'editor-repo') {
      const url = settings.editorUrl || '';
      let reachable = false;
      if (url) { try { const ctrl = AbortSignal.timeout(1200); const r = await fetch(url, { signal: ctrl, redirect: 'manual' }); reachable = r.status < 500; await r.arrayBuffer().catch(() => {}); } catch { /* not running */ } }
      return { ...e, external: true, configured: Boolean(settings.editorCheckout || url), checkout: settings.editorCheckout || '', exists: reachable, reachable, url };
    }
    return { ...e, exists: await fs.stat(path.join(root, e.path)).then(() => true, () => false) };
  }));
  const known = new Set(entries.map((e) => e.path));
  for (const p of await listPreviews(root)) {
    if (!known.has(p.file)) entries.push({ id: `unregistered-${p.file}`, title: p.title, kind: p.kind === 'review' ? 'qa' : 'viewer', path: p.file, servedBy: 'game-server', outputs: [], area: 'QA', status: 'current', notes: 'Not in workbench/tools.json yet', exists: true, unregistered: true });
  }
  return { areas: registry.areas, entries };
}

/**
 * The state directory of one project: its job history and backups live under
 * <stateDir>/projects/<first 12 hex of sha1(realpath(root))>, so two projects that
 * share a stateDir never see each other's runs or backups. settings.json stays in stateDir.
 */
export function projectStateDir(root, stateDir) {
  const real = realpathSync(root);
  return path.join(stateDir, 'projects', createHash('sha1').update(real).digest('hex').slice(0, 12));
}

/**
 * Before per-project state, jobs.json and backups/ sat directly in stateDir and
 * were shared by every project. When this project's state dir does not exist
 * yet, those legacy items move into it, once. Returns the names moved.
 */
export async function migrateLegacyState(stateDir, projectDir) {
  if (existsSync(projectDir)) return [];
  const moved = [];
  for (const name of ['jobs.json', 'backups']) {
    const from = path.join(stateDir, name);
    if (!existsSync(from)) continue;
    await fs.mkdir(projectDir, { recursive: true });
    await fs.rename(from, path.join(projectDir, name));
    moved.push(name);
  }
  return moved;
}

export async function createWorkbench({ root = REPO, port = DEFAULT_PORT, children = true, stateDir = path.join(HERE, '.state'), debounceMs = 300, ports, forcePoll = false, env = process.env, lockWaitMs = 10 * 60 * 1000, fileFault = null } = {}) {
  root = await fs.realpath(root);
  const token = newToken();
  const hub = createSseHub();
  let address = '';
  const gate = createGate({ token, hosts: () => [address], origins: () => [`http://${address}`], open: ['/api/session'], queryTokenPaths: ['/api/events'] });
  const projectDir = projectStateDir(root, stateDir);
  await migrateLegacyState(stateDir, projectDir);
  const jobs =new JobRunner({ root, stateFile: path.join(projectDir, 'jobs.json'), onEvent: (e, d) => hub.send(e, d) });
  const settings = new Settings(path.join(stateDir, 'settings.json'), env);
  // The one save path for repo files (core/files.mjs). A save reloads the preview through onBatch.
  // What the file service wrote, so the watcher drops the echo of a save. onSaved still sends the batch itself:
  // with forcePoll or a disabled watcher nothing else would.
  const ownWrites = createOwnWrites();
  const files = createFileService({ root, stateDir: projectDir, keepBackups: () => settings.read().keepBackups, onSaved: (paths) => onBatch(paths), onWritten: (abs, stat) => ownWrites.record(abs, stat), lockWaitMs, fileFault });
  let supervisor = null;
  let reloads = 0;
  let previewAddress = '';

  // Live reload: one batch at a time; builds first when authored sources changed.
  let watcher = null; let chain = Promise.resolve();
  const runBuild = (script) => new Promise((resolve) => {
    let out = '';
    const child = spawn(process.execPath, [script], { cwd: root, env: { ...process.env, FORCE_COLOR: '0', ...jobs.lockEnv(GENERATED) }, windowsHide: true });
    child.stdout.on('data', (d) => { out = (out + d).slice(-20000); });
    child.stderr.on('data', (d) => { out = (out + d).slice(-20000); });
    child.on('error', (e) => resolve({ code: -1, out: e.message }));
    child.on('close', (code) => resolve({ code, out }));
  });
  // Batches not yet taken by the chain; one arriving meanwhile joins them, so a
  // writer's files that land while the reload waits for it reload once.
  let queued = null;
  const stepsFor = (files) => buildsFor(files, root).filter((s) => existsSync(path.join(root, s)));
  function onBatch(batch) {
    if (queued) { for (const f of batch) queued.add(f); return; }
    const mine = queued = new Set(batch);
    // The batch's file set is fixed here; startedAt says when, so a save sent later cannot match this build.
    let startedAt = 0;
    const take = () => { if (queued === mine) queued = null; startedAt = Date.now(); return [...mine].sort(); };
    chain = chain.then(async () => {
      // Generated output written by another writer (a Workbench job, the editor,
      // UI Studio, a terminal build) reloads only once that writer is done: wait
      // for the shared lock to be free, then reload once.
      if ([...mine].some(isBuildOutput) && !stepsFor([...mine]).length) {
        try { await jobs.acquire(GENERATED, 'A live-reload', { timeoutMs: lockWaitMs }); jobs.release(GENERATED); } catch (e) {
          const files = take();
          hub.send('reload-failed', { files, startedAt, step: null, output: e.message }); return;
        }
      }
      const files = take();
      const steps = stepsFor(files);
      const built = [];
      if (steps.length) {
        hub.send('building', { files, steps });
        // Live-reload builds share the jobs' lock: never two writers of the generated trees.
        // It also waits for the editor or UI Studio when one of them is building (tools/lib/build-lock.mjs).
        try { await jobs.acquire(GENERATED, 'A live-reload build', { timeoutMs: lockWaitMs }); } catch (e) { hub.send('reload-failed', { files, startedAt, step: steps[0], output: e.message }); return; }
        watcher.mute();
        try {
          for (const step of steps) {
            const { code, out } = await runBuild(step);
            built.push(step);
            if (code !== 0) { hub.send('reload-failed', { files, startedAt, step, output: out.slice(-6000) }); return; }
          }
        } finally { watcher.unmute(); jobs.release(GENERATED); }
      }
      reloads += 1;
      hub.send('reload', { files, count: files.length, built, startedAt, at: Date.now() });
    }).catch(() => { take(); });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${address}`);
      if (url.pathname.startsWith('/api/')) {
        const refused = gate(req, url);
        if (refused) return sendJson(res, refused.status, { error: refused.error });
        return await api(req, res, url);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not supported' });
      // The art checkout's pages run on the `localhost` origin, never on the
      // Workbench's own: a page there cannot read the session token.
      if (url.pathname.startsWith('/ext/art/')) {
        if (req.headers.host === address) { res.writeHead(302, { Location: `http://${previewAddress}${url.pathname}${url.search}` }); return res.end(); }
        if (req.headers.host !== previewAddress) return sendJson(res, 403, { error: 'Use the local Workbench address' });
        if (req.headers['sec-fetch-site'] === 'cross-site') return sendJson(res, 403, { error: 'Cross-site request refused' });
        return await serveArt(res, decodeURIComponent(url.pathname.slice('/ext/art/'.length)));
      }
      if (req.headers.host !== address) return sendJson(res, 403, { error: 'Use the local Workbench address' });
      if (url.pathname.startsWith('/export/')) return await serveExport(res, decodeURIComponent(url.pathname.slice('/export/'.length)));
      // The Asset Gallery's images: same origin (the page's CSP allows only 'self' images), art roots only.
      if (url.pathname.startsWith('/asset-file/')) return await serveAsset(req, res, decodeURIComponent(url.pathname.slice('/asset-file/'.length)));
      const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      if (!STATIC.test(name)) return sendJson(res, 404, { error: 'Not found' });
      const bytes = await fs.readFile(path.join(HERE, name));
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src http://127.0.0.1:* http://localhost:*; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' ? 404 : error.code === 'EREFUSED' ? 403 : 400);
      if (!res.headersSent) sendJson(res, status, { error: error.message });
      else res.end();
    }
  });

  async function serveArt(res, rel) {
    const checkout = settings.read().artCheckout;
    if (!checkout || !existsSync(checkout)) return sendJson(res, 404, { error: 'No art checkout is set: open Workbench Settings' });
    const file = await safePath(realpathSync(checkout), rel);
    const type = MIME[path.extname(file).toLowerCase()];
    if (!type) return sendJson(res, 404, { error: 'Not a viewable file' });
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': `sandbox allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups; frame-ancestors 'self' http://${address}` });
    res.end(await fs.readFile(file));
  }

  async function serveExport(res, rel) {
    const base = path.join(root, EXPORT_DIR);
    if (!existsSync(base)) return sendJson(res, 404, { error: 'No engine export yet: run the Engine export job' });
    const file = await safePath(realpathSync(base), rel);
    const type = MIME[path.extname(file)];
    if (!type || !/\.(json|csv|md|txt)$/.test(file)) return sendJson(res, 404, { error: 'Not an export file' });
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
    res.end(await fs.readFile(file));
  }

  // The art a gallery file is read from (core/assets.mjs): a tracked art tree or a fetched pack, never a path
  // the listing would not name. Read-only, GET or HEAD, and a 404 for anything else.
  async function serveAsset(req, res, gamePath) {
    const file = await resolveArt(root, gamePath);
    if (!file) return sendJson(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': ASSET_MIME[path.extname(file).toLowerCase()], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(req.method === 'HEAD' ? undefined : await fs.readFile(file));
  }

  // /api/files/*: the shared file service. Its save bodies can be large, so it reads its own body limit.
  async function filesRoute(req, res, url) {
    const p = url.pathname;
    try {
      if (req.method === 'GET') {
        if (p === '/api/files/read') return sendJson(res, 200, await files.read(url.searchParams.get('path') || ''));
        if (p === '/api/files/list') return sendJson(res, 200, await files.list(url.searchParams.get('dir') || '', url.searchParams.get('ext') || ''));
        if (p === '/api/files/backups') return sendJson(res, 200, await files.backups());
      } else if (req.method === 'POST') {
        const data = await readJson(req, { limit: FILES_BODY_LIMIT });
        if (p === '/api/files/save') return sendJson(res, 200, await files.save(data.changes));
        if (p === '/api/files/diff') return sendJson(res, 200, await files.diff(data.path, data.text));
        if (p === '/api/files/restore') return sendJson(res, 200, await files.restore(data.set, data.paths));
      }
      return sendJson(res, 404, { error: 'Unknown Workbench action' });
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' ? 404 : error.code === 'EREFUSED' ? 403 : 400);
      const extra = Object.fromEntries(['problems', 'conflicts', 'heldBy'].filter((k) => error[k] !== undefined).map((k) => [k, error[k]]));
      return sendJson(res, status, { error: error.message, ...extra });
    }
  }

  async function api(req, res, url) {
    const p = url.pathname;
    if (p.startsWith('/api/files/')) return filesRoute(req, res, url);
    if (req.method === 'GET') {
      if (p === '/api/session') return sendJson(res, 200, { token, root, repo: REPO, port: server.address().port, children: Boolean(supervisor?.enabled), watching: watcher ? watcher.modes : {} });
      if (p === '/api/events') { hub.attach(req, res); return; }
      if (p === '/api/tools') return sendJson(res, 200, supervisor.list());
      if (p === '/api/git') return sendJson(res, 200, await gitState(root));
      if (p === '/api/jobs') return sendJson(res, 200, { defs: jobs.defs(), runs: jobs.list() });
      if (p.startsWith('/api/jobs/runs/')) {
        const run = jobs.get(p.slice('/api/jobs/runs/'.length));
        return run ? sendJson(res, 200, run) : sendJson(res, 404, { error: 'Unknown run' });
      }
      if (p === '/api/previews') return sendJson(res, 200, await listPreviews(root));
      if (p === '/api/assets/list') return sendJson(res, 200, await listArt(root));
      if (p === '/api/assets/usage') {
        const game = url.searchParams.get('path') || '';
        if (!game || game.length > 512 || game.includes('\0')) return sendJson(res, 400, { error: 'Name one game path' });
        return sendJson(res, 200, await findUsage(root, game));
      }
      if (p === '/api/library') return sendJson(res, 200, await library(root, { settings: settings.read(), extBase: `http://${previewAddress}` }));
      if (p === '/api/settings') return sendJson(res, 200, { ...settings.read(), env: { ASHEN_ART_CHECKOUT: env.ASHEN_ART_CHECKOUT || '', ASHEN_EDITOR_CHECKOUT: env.ASHEN_EDITOR_CHECKOUT || '' } });
      if (p === '/api/export/manifest') {
        const file = path.join(root, EXPORT_DIR, 'manifest.json');
        let text;
        try { text = await fs.readFile(file, 'utf8'); } catch { return sendJson(res, 200, { exists: false, dir: EXPORT_DIR }); }
        try { return sendJson(res, 200, { exists: true, dir: EXPORT_DIR, manifest: JSON.parse(text), modified: (await fs.stat(file)).mtimeMs }); } catch (e) { return sendJson(res, 200, { exists: true, dir: EXPORT_DIR, error: `manifest.json does not parse: ${e.message}` }); }
      }
      if (p === '/api/doc') {
        const rel = url.searchParams.get('path') || '';
        if (!/^docs\/[\w./-]+\.md$/.test(rel)) return sendJson(res, 400, { error: 'Only docs/*.md can be read' });
        const file = await safePath(root, rel);
        return sendJson(res, 200, { path: rel, text: await fs.readFile(file, 'utf8') });
      }
    }
    if (req.method === 'POST') {
      const data = await readJson(req, { limit: 64 * 1024 });
      const restart = p.match(/^\/api\/tools\/([\w-]+)\/restart$/);
      if (restart) return sendJson(res, 200, await supervisor.restart(restart[1]));
      if (p === '/api/jobs') return sendJson(res, 200, jobs.start(data.id));
      const cancel = p.match(/^\/api\/jobs\/runs\/([\w-]+)\/cancel$/);
      if (cancel) return sendJson(res, 200, jobs.cancel(cancel[1]));
      if (p === '/api/settings') { const saved = settings.save(data); hub.send('settings', saved); return sendJson(res, 200, saved); }
      if (p === '/api/open-folder') {
        const s = settings.read();
        const dir = { project: root, artCheckout: s.artCheckout, editorCheckout: s.editorCheckout }[data.which];
        if (!dir || !existsSync(dir)) return sendJson(res, 400, { error: 'That folder is not set' });
        openWindow(dir);
        return sendJson(res, 200, { ok: true, dir });
      }
    }
    return sendJson(res, 404, { error: 'Unknown Workbench action' });
  }

  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  address = `127.0.0.1:${server.address().port}`;
  previewAddress = `localhost:${server.address().port}`;
  const origin = `http://${address}`;
  supervisor = new ToolSupervisor({ repo: REPO, root, origin, ports, enabled: children, onChange: () => hub.send('tools', supervisor.list()) });
  watcher = createWatcher({ root, dirs: WATCH_DIRS, debounceMs, onBatch, forcePoll, isOwnWrite: ownWrites.isOwn });
  const started = supervisor.startAll();

  let closing = null;
  return {
    server, url: origin, token, supervisor, jobs, hub, started,
    get reloads() { return reloads; },
    killChildrenSync: () => { supervisor.killAllSync(); jobs.stopAll(); },
    close: () => closing ||= (async () => {
      watcher.close();
      // A running job's process must exit, and its slot and file lock be freed, before close() resolves.
      await jobs.stopAll();
      hub.close();
      await supervisor.stopAll();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    })(),
  };
}

/** Open the Workbench as an app window where Edge is installed, else the default browser (or a folder in the file manager). */
export function openWindow(url) {
  try {
    if (process.platform === 'win32' && !/^https?:/.test(url)) spawn('explorer', [url], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'win32') {
      const edge = [`${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`, `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`].find((p) => existsSync(p));
      if (edge) spawn(edge, [`--app=${url}`], { detached: true, stdio: 'ignore' }).unref();
      else spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  } catch { /* headless: the URL is printed */ }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const at = (flag) => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1]; };
  const app = await createWorkbench({
    ...(at('--project') ? { root: path.resolve(at('--project')) } : {}),
    port: Number(at('--port') || process.env.WORKBENCH_PORT || DEFAULT_PORT),
    children: !args.includes('--no-children'),
  });
  console.log(`AshenSpire Workbench: ${app.url}`);
  if (!args.includes('--no-open')) openWindow(app.url);
  process.on('exit', () => app.killChildrenSync());
  // Allow the job's grace period (STOP_GRACE_MS) to end before the process exits anyway.
  const close = async () => { const t = setTimeout(() => process.exit(0), STOP_GRACE_MS + 2000); await app.close().catch(() => {}); clearTimeout(t); process.exit(0); };
  process.on('SIGINT', close); process.on('SIGTERM', close); process.on('SIGHUP', close);
}
