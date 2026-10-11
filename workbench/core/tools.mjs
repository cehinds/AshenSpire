// workbench/core/tools.mjs — the child tool servers the Workbench hosts.
//
// Each tool is a separate local server the Workbench starts (or finds already
// running on its port) and shows in an iframe. A tool's status is one of
//   starting  — spawned, waiting for its health URL to answer
//   up        — its health URL answers 200
//   down      — not answering (exited, crashed, or never started)
// A tool somebody else started is reused when it answers on its port; the
// Workbench never kills a process it did not start.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LOG_LINES = 60;

/**
 * The tool table. `repo` is the checkout holding the tool code, `root` the
 * project being edited (they differ under --project), `origin` the Workbench
 * page origin the studios must allow as a frame ancestor.
 */
export function toolDefs({ repo, root, origin, ports = {} }) {
  const p = { editor: 4317, pose: 4318, 'ui-studio': 4319, game: 4320, ...ports };
  return [
    {
      id: 'editor', name: 'Content Editor', port: p.editor, host: '127.0.0.1', path: '/', health: '/api/session',
      blurb: 'Tables, sprites, relations, scripts and previews for content/source and content/framework.',
      command: (port) => [path.join(repo, 'editor/server.mjs'), '--project', root, '--port', String(port), '--frame-ancestor', origin],
      framing: true, sessionRoot: true,
    },
    {
      id: 'ui-studio', name: 'UI Studio', port: p['ui-studio'], host: '127.0.0.1', path: '/', health: '/api/session',
      blurb: 'Wireframes, tokens and screen layout in content/config, validated by the game compiler.',
      command: (port) => [path.join(repo, 'ui-studio/server.mjs'), '--project', root, '--port', String(port), '--frame-ancestor', origin],
      framing: true, sessionRoot: true,
    },
    {
      id: 'pose', name: 'Pose & FX', port: p.pose, host: '127.0.0.1', path: '/pose-studio/index.html', health: '/pose-studio/index.html',
      blurb: 'Poses, stances and effect timing on the live combat figures.',
      command: () => [path.join(repo, 'pose-studio/server.mjs'), '--project', root], env: (port) => ({ POSE_STUDIO_PORT: String(port) }),
      serveRoot: '/__serve/info',
    },
    {
      id: 'game', name: 'Game server', port: p.game, host: 'localhost', path: '/', health: '/index.html',
      blurb: 'Serves the game from source for the preview dock and the preview pages.',
      // --host localhost: loopback only (127.0.0.1 and ::1). Without it serve.mjs
      // listens on every interface and would expose the checkout, .git included,
      // to the LAN; --no-lan only turns off the LAN session layer. The game keeps
      // the `localhost` host, so its origin stays apart from the Workbench's 127.0.0.1.
      command: (port) => [path.join(repo, 'tools/serve.mjs'), '--port', String(port), '--no-open', '--no-lan', '--host', 'localhost', '--root', root],
      portFrom: /live at http:\/\/localhost:(\d+)/, internal: true, serveRoot: '/__serve/info',
    },
  ];
}

async function get(url, timeoutMs = 1500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { signal: ctrl.signal, redirect: 'manual' }); } finally { clearTimeout(timer); }
}

export class Tool {
  constructor(def, { root, origin, onChange }) {
    Object.assign(this, { def, root, origin, onChange });
    this.port = def.port; this.status = 'down'; this.message = 'Not started'; this.owned = false; this.embeddable = true;
    this.child = null; this.log = []; this.startedAt = null; this.stopping = false;
  }
  get base() { return `http://${this.def.host}:${this.port}`; }
  get url() { return `${this.base}${this.def.path}`; }
  set(status, message = '') { if (status === this.status && message === this.message) return; this.status = status; this.message = message; this.onChange?.(this); }
  toJSON() {
    const { id, name, blurb, internal } = this.def;
    return { id, name, blurb, internal: Boolean(internal), url: this.url, port: this.port, status: this.status, message: this.message, owned: this.owned, embeddable: this.embeddable, log: this.log.slice(-20) };
  }
  addLog(text) {
    for (const line of String(text).split(/\r?\n/)) {
      if (!line.trim()) continue;
      this.log.push(line); if (this.log.length > LOG_LINES) this.log.shift();
      const m = this.def.portFrom && line.match(this.def.portFrom);
      if (m) this.port = Number(m[1]);
    }
  }

  /** True when the tool answers; also records whether it may be framed and serves our project. */
  async probe() {
    // A conflict holds only while the server that caused it still answers.
    this.conflict = null;
    try {
      const res = await get(`${this.base}${this.def.health}`);
      if (res.status !== 200) return false;
      if (this.def.sessionRoot) {
        const session = await res.json().catch(() => ({}));
        // Reused only when it names this project; an older build that does not say is not reused.
        if (typeof session.root !== 'string') { this.conflict = `Port ${this.port} is answered by a ${this.def.name} that does not say which checkout it serves. Stop it, then press Restart.`; return false; }
        let served = session.root;
        try { served = fs.realpathSync(session.root); } catch { /* not on this disk: compared as given */ }
        if (served !== this.root) { this.conflict = `Port ${this.port} is serving another checkout (${session.root})`; return false; }
      } else await res.arrayBuffer().catch(() => {});
      if (this.def.serveRoot) {
        // A server answering on the port is reused only when it names this project as its root.
        const info = await get(`${this.base}${this.def.serveRoot}`).then((r) => (r.status === 200 ? r.json() : null)).catch(() => null);
        if (!info || typeof info.root !== 'string') { this.conflict = `Port ${this.port} is answered by a server that does not say which checkout it serves. Stop it, then press Restart.`; return false; }
        let served = info.root;
        try { served = fs.realpathSync(info.root); } catch { /* not on this disk: compared as given */ }
        if (served !== this.root) { this.conflict = `Port ${this.port} is serving another checkout (${info.root})`; return false; }
      }
      this.conflict = null;
      if (this.def.framing) {
        const page = await get(`${this.base}/`);
        await page.arrayBuffer().catch(() => {});
        const csp = page.headers.get('content-security-policy') || '';
        const ancestors = (csp.match(/frame-ancestors ([^;]*)/) || [])[1] || '';
        this.embeddable = ancestors.split(/\s+/).includes(this.origin);
      }
      return true;
    } catch { return false; }
  }

  start(opts) {
    this.starting ||= this.doStart(opts).finally(() => { this.starting = null; });
    return this.starting;
  }

  async doStart({ timeoutMs = 30000 } = {}) {
    if (this.child) return;
    if (await this.probe()) {
      this.owned = false;
      this.set('up', this.embeddable ? 'Already running — reused' : 'Already running outside the Workbench, without permission to be embedded. Stop it, then Restart here.');
      return;
    }
    if (this.conflict) { this.set('down', this.conflict); return; }
    this.spawn(timeoutMs);
  }

  spawn(timeoutMs) {
    const { def } = this;
    this.port = def.port; this.owned = true; this.stopping = false; this.embeddable = true; this.startedAt = Date.now();
    this.set('starting', 'Starting…');
    let child;
    try {
      child = spawn(process.execPath, def.command(this.port), { cwd: this.root, env: { ...process.env, ...(def.env ? def.env(this.port) : {}), FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) { this.set('down', `Could not start: ${e.message}`); return; }
    this.child = child;
    child.stdout.on('data', (d) => this.addLog(d));
    child.stderr.on('data', (d) => this.addLog(d));
    child.on('error', (e) => { this.addLog(e.message); });
    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null;
      if (this.stopping) return;
      const last = this.log.filter((l) => l.trim()).slice(-1)[0] || '';
      this.set('down', `Stopped (${signal || `exit ${code}`})${last ? ` — ${last.slice(0, 200)}` : ''}`);
    });
    const deadline = Date.now() + timeoutMs;
    const poll = async () => {
      if (this.child !== child || this.status !== 'starting') return;
      if (await this.probe()) return this.set('up', 'Running');
      if (Date.now() > deadline) return this.set('down', `Did not answer within ${Math.round(timeoutMs / 1000)} s`);
      setTimeout(poll, 250).unref?.();
    };
    setTimeout(poll, 150).unref?.();
  }

  async stop() {
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    await new Promise((resolve) => {
      const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } resolve(); }, 3000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      try { child.kill(); } catch { clearTimeout(timer); resolve(); }
    });
    this.child = null;
    this.set('down', 'Stopped');
  }

  /** Concurrent Restart presses share one restart, so no second child is spawned and orphaned. */
  restart() {
    this.restarting ||= this.doRestart().finally(() => { this.restarting = null; });
    return this.restarting;
  }

  async doRestart() {
    if (!this.owned && this.status === 'up') {
      // Not ours to kill; check whether it went away meanwhile.
      if (await this.probe()) throw Error(`${this.def.name} is running outside the Workbench on port ${this.port}. Stop that process, then press Restart.`);
    }
    await this.stop();
    this.status = 'down';
    await this.start();
  }

  /** The periodic health check: notices a crash, a hang, or an external instance appearing. */
  async check() {
    if (this.status === 'starting') return;
    const ok = await this.probe();
    if (ok && this.status !== 'up') this.set('up', this.owned ? 'Running' : 'Already running — reused');
    if (!ok && this.status === 'up') this.set('down', this.conflict || 'Not answering');
  }
}

export class ToolSupervisor {
  constructor({ repo, root, origin, ports, onChange, enabled = true }) {
    this.enabled = enabled;
    this.tools = new Map(toolDefs({ repo, root, origin, ports }).map((def) => [def.id, new Tool(def, { root, origin, onChange })]));
    if (!enabled) for (const t of this.tools.values()) t.message = 'Started with --no-children';
  }
  list() { return [...this.tools.values()].map((t) => t.toJSON()); }
  get(id) { return this.tools.get(id); }
  async startAll() {
    if (!this.enabled) return;
    await Promise.all([...this.tools.values()].map((t) => t.start()));
    this.timer = setInterval(() => { for (const t of this.tools.values()) t.check(); }, 5000);
    this.timer.unref?.();
  }
  async restart(id) {
    const tool = this.tools.get(id);
    if (!tool) throw Object.assign(Error(`Unknown tool: ${id}`), { status: 404 });
    if (!this.enabled) throw Object.assign(Error('The Workbench was started with --no-children'), { status: 409 });
    await tool.restart();
    return tool.toJSON();
  }
  /** Synchronous kill for process 'exit' — the last chance to not orphan a child. */
  killAllSync() { for (const t of this.tools.values()) if (t.child) { t.stopping = true; try { t.child.kill(); } catch { /* gone */ } } }
  async stopAll() { clearInterval(this.timer); await Promise.all([...this.tools.values()].map((t) => t.stop())); }
}
