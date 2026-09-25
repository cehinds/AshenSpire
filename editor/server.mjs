import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { Workspace, safePath, walk, hash } from './core.mjs';
import { CodexBridge } from './codex.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
const commands = {
  content: [['tools/content-build.mjs'], ['tools/framework-data-build.mjs']],
  build: [['tools/launch.mjs', '--build-only']],
  validate: [['--test', 'tests/*.test.mjs'], ['tools/buildversion.mjs', '--check'], ['tools/verify-shipped.mjs']],
};
export async function createStudio({ root = path.resolve(HERE, '..'), port = 4317, stateDir, codexExecutable } = {}) {
  root = await fs.realpath(root);
  stateDir ||= path.join(HERE, '.studio', hash(root).slice(0, 16));
  const workspace = new Workspace(root, stateDir);
  const token = randomBytes(32).toString('hex');
  const codex = new CodexBridge(root, codexExecutable);
  let job = null;
  const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
  async function body(req) {
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 30 * 1024 * 1024) throw Error('Upload exceeds 30 MB'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString());
  }
  async function inventory() {
    const [source, framework, scripts, styles, images, artImages, docs, art, custom] = await Promise.all([
      walk(root, 'content/source', ['.csv', '.json']), walk(root, 'content/framework', ['.json']), walk(root, 'src', ['.js']), walk(root, 'styles', ['.css']),
      walk(root, 'assets', ['.png', '.webp', '.gif', '.jpg', '.jpeg', '.svg']), walk(root, 'art', ['.png', '.webp', '.gif']), walk(root, 'docs', ['.html']), walk(root, 'art', ['.html']), walk(root, 'editor/workspace', ['.js', '.json', '.html', '.css']),
    ]);
    const top = (await fs.readdir(root)).filter(n => n.endsWith('.html') && n !== 'AshenSpire.html');
    let branch = 'Unknown'; try { branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(); } catch {}
    const sprites = [...images.filter(p => p.startsWith('assets/enemies-unity/')), ...images.filter(p => !p.startsWith('assets/enemies-unity/')), ...artImages];
    return { root, branch, tables: [...source, ...framework], scripts: [...scripts, ...styles, ...custom].filter(n => /\.(js|css)$/.test(n) && !n.includes('/generated/')), sprites, previews: [...top, ...docs, ...art, ...custom.filter(n => n.endsWith('.html'))] };
  }
  function startJob(name) {
    if (!commands[name]) throw Error('Unknown build action');
    if (job?.status === 'running') throw Error('Another check is already running');
    job = { id: randomUUID(), name, status: 'running', output: '' };
    const current = job;
    workspace.serialize(async () => {
      for (const args of commands[name]) {
        current.output += `> node ${args.join(' ')}\n`;
        const code = await new Promise(resolve => {
          const child = spawn(process.execPath, args, { cwd: root, windowsHide: true });
          current.child = child;
          const append = data => { current.output = (current.output + data).slice(-120000); };
          child.stdout.on('data', append); child.stderr.on('data', append);
          child.on('error', error => { append(error.message); resolve(-1); });
          child.on('close', resolve);
        });
        delete current.child;
        if (code !== 0) { current.status = 'failed'; current.exitCode = code; return; }
      }
      current.status = 'passed';
    }).catch(e => { current.status = 'failed'; current.output += e.message; });
    return { id: current.id };
  }
  const server = http.createServer(async (req, res) => {
    try {
      const address = `127.0.0.1:${server.address().port}`;
      const previewAddress = `localhost:${server.address().port}`;
      if (![address, previewAddress].includes(req.headers.host)) return send(res, 403, { error: 'Use the local editor address' });
      const url = new URL(req.url, `http://${address}`);
      if (req.headers.host === previewAddress && !url.pathname.startsWith('/game/')) return send(res, 403, { error: 'Preview tools cannot access the editor' });
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.origin && req.headers.origin !== `http://${address}`) return send(res, 403, { error: 'Cross-origin request refused' });
        if (req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: 'Cross-site request refused' });
        if (url.pathname !== '/api/session' && req.headers['x-studio-token'] !== token) return send(res, 403, { error: 'Reopen the editor to connect' });
        if (req.method === 'GET') {
          if (url.pathname === '/api/session') return send(res, 200, { token });
          if (url.pathname === '/api/inventory') return send(res, 200, await inventory());
          if (url.pathname === '/api/file') return send(res, 200, await workspace.read(url.searchParams.get('path')));
          if (url.pathname === '/api/job') { const { child, ...publicJob } = job || {}; return send(res, 200, publicJob); }
          if (url.pathname === '/api/codex/events') return send(res, 200, { events: codex.events.filter(e => e.cursor > Number(url.searchParams.get('after') || 0)), active: codex.active });
          if (url.pathname === '/api/backups') {
            const dirs = (await fs.readdir(path.join(stateDir, 'backups')).catch(() => [])).sort().reverse().slice(0, 40);
            return send(res, 200, await Promise.all(dirs.map(async id => ({ id, files: JSON.parse(await fs.readFile(path.join(stateDir, 'backups', id, 'manifest.json'), 'utf8')) }))));
          }
        }
        if (req.method === 'POST') {
          const data = await body(req);
          if (url.pathname === '/api/save') {
            if (Array.isArray(data.changes)) for (const change of data.changes) {
              if (change.path?.endsWith('.js') && typeof change.text === 'string') {
                const checked = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: change.text, encoding: 'utf8', windowsHide: true, timeout: 10000 });
                if (checked.status !== 0) throw Error(`Syntax check failed for ${change.path}: ${checked.stderr || checked.error?.message}`);
              }
            }
            return send(res, 200, await workspace.save(data.changes));
          }
          if (url.pathname === '/api/job') return send(res, 200, startJob(data.name));
          if (url.pathname === '/api/codex/account') return send(res, 200, await codex.account());
          if (url.pathname === '/api/codex/login') return send(res, 200, await codex.login());
          if (url.pathname === '/api/codex/prompt') return send(res, 200, await codex.prompt(data.text));
          if (url.pathname === '/api/codex/stop') { await codex.stop(); return send(res, 200, { ok: true }); }
          if (url.pathname === '/api/backup') {
            if (!/^[\d]+-[a-f0-9-]+$/.test(data.id)) throw Error('Invalid backup');
            const dir = path.join(stateDir, 'backups', data.id);
            const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
            const changes = [];
            for (const entry of manifest) {
              if (entry.oldHash === null) continue;
              changes.push({ path: entry.path, text: await fs.readFile(path.join(dir, `${entry.index}.bak`), 'utf8'), hash: entry.savedHash });
            }
            return send(res, 200, { changes }); // Restore is staged for review, not applied here.
          }
          if (url.pathname === '/api/import') {
            const extension = path.extname(data.name || '').toLowerCase();
            if (!['.png', '.webp', '.gif', '.jpg', '.jpeg'].includes(extension)) throw Error('Import PNG, WebP, GIF or JPEG artwork');
            const bytes = Buffer.from(data.base64 || '', 'base64');
            if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw Error('Each sprite must be under 20 MB');
            const valid = extension === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : extension === '.webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' : extension === '.gif' ? /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6)) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
            if (!valid) throw Error('The file contents do not match its image type');
            const name = path.basename(data.name, extension).replace(/[^\w-]/g, '-').slice(0, 80) || 'sprite';
            const imported = `assets/imported/${name}-${randomUUID().slice(0, 8)}${extension}`;
            await workspace.serialize(async () => { const target = await safePath(root, imported, true); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, bytes, { flag: 'wx' }); });
            return send(res, 200, { path: imported, hash: hash(bytes) });
          }
        }
        return send(res, 404, { error: 'Unknown editor action' });
      }
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not supported' });
      let file;
      if (url.pathname.startsWith('/game/')) {
        const name = decodeURIComponent(url.pathname.slice(6));
        const allowed = /^(assets|art|docs|src|styles|content)\//.test(name) || /^[\w-]+\.html$/.test(name) || /^editor\/workspace\//.test(name);
        if (!allowed || !mime[path.extname(name)]) throw Error('Not a preview asset');
        if (req.headers.host === address) { res.writeHead(302, { Location: `http://${previewAddress}${url.pathname}${url.search}` }); return res.end(); }
        file = await safePath(root, name);
      } else {
        const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        if (!['index.html', 'app.js', 'styles.css', 'tables.mjs'].includes(name)) return send(res, 404, { error: 'Not found' });
        file = path.join(HERE, name);
      }
      const bytes = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...(url.pathname.startsWith('/game/') ? { 'Content-Security-Policy': `sandbox allow-scripts allow-same-origin allow-forms allow-modals allow-downloads; frame-ancestors 'self' http://${address}` } : { 'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' http://${previewAddress} data: blob:; frame-src http://${previewAddress}; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'` }) });
      res.end(bytes);
    } catch (error) { send(res, error.code === 'ENOENT' ? 404 : 400, { error: error.message }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, workspace, codex, url: `http://127.0.0.1:${server.address().port}`, close: async () => { codex.close(); job?.child?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--project');
  const portIndex = process.argv.indexOf('--port');
  const app = await createStudio({ ...(index < 0 ? {} : { root: path.resolve(process.argv[index + 1]) }), port: portIndex < 0 ? 4317 : Number(process.argv[portIndex + 1]) });
  console.log(`AshenSpire Studio: ${app.url}`);
  const close = async () => { await app.close(); process.exit(0); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}
