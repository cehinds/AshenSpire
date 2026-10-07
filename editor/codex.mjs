import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// Credentials stay in Codex. Only account summaries, login URLs and agent text reach the UI.
export class CodexBridge {
  constructor(root, executable = process.env.STUDIO_CODEX || 'codex') {
    this.root = root; this.executable = executable; this.pending = new Map();
    this.sequence = 0; this.events = []; this.cursor = 0; this.threadId = null; this.active = false;
  }
  event(type, data) { this.events.push({ cursor: ++this.cursor, type, ...data }); if (this.events.length > 1000) this.events.shift(); }
  async start() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this.child = spawn(this.executable, ['app-server'], { cwd: this.root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      this.child.on('error', error => this.fail(error));
      this.child.on('exit', () => { this.ready = null; this.threadId = null; this.active = false; this.fail(Error('Codex stopped. Reconnect to continue.')); });
      this.child.stderr.on('data', () => {});
      createInterface({ input: this.child.stdout }).on('line', line => {
        let message; try { message = JSON.parse(line); } catch { return; }
        if (message.id != null && !message.method) {
          const pending = this.pending.get(message.id);
          if (pending) { clearTimeout(pending.timer); this.pending.delete(message.id); message.error ? pending.reject(Error(message.error.message)) : pending.resolve(message.result); }
          return;
        }
        if (message.id != null) {
          // First version is a read-only assistant. Unsupported interactive requests fail explicitly.
          this.child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'This editor supports read-only prompting; use Codex for interactive tool approvals.' } }) + '\n');
          this.event('notice', { text: 'Codex requested an interactive action. Continue that workflow in Codex.' });
          return;
        }
        const p = message.params || {};
        if (message.method === 'item/agentMessage/delta') this.event('delta', { text: p.delta || '' });
        if (message.method === 'turn/completed') { this.active = false; this.event('complete', { status: p.turn?.status, error: p.turn?.error?.message }); }
        if (message.method === 'error') this.event('error', { text: p.error?.message || 'Codex reported an error' });
        if (message.method === 'account/login/completed') this.event('login', { success: p.success, error: p.error });
      });
      await this.request('initialize', { clientInfo: { name: 'ashenspire_studio', title: 'AshenSpire Studio', version: '0.6.0' } });
      this.child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
    })();
    try { await this.ready; } catch (e) { this.ready = null; throw e; }
  }
  fail(error) { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); } this.pending.clear(); }
  request(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error(`Codex timed out: ${method}`)); }, 45000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n', error => { if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); } });
    });
  }
  async account() {
    await this.start();
    const result = await this.request('account/read', { refreshToken: false });
    return { connected: result.account?.type === 'chatgpt', type: result.account?.type || null, plan: result.account?.planType || null };
  }
  async login() { await this.start(); const result = await this.request('account/login/start', { type: 'chatgpt' }); return { authUrl: result.authUrl }; }
  async prompt(text) {
    if (typeof text !== 'string' || !text.trim() || text.length > 50000) throw Error('Enter a prompt under 50,000 characters');
    if (this.active) throw Error('Wait for the current response, or stop it first');
    this.active = true;
    try {
      if (!(await this.account()).connected) throw Error('Sign in with ChatGPT first. API-key accounts are not used by this editor.');
      if (!this.threadId) {
        const result = await this.request('thread/start', { cwd: this.root, approvalPolicy: 'never', sandbox: 'read-only', developerInstructions: 'You are the AshenSpire Studio assistant. Explain, inspect and propose source edits. Do not edit files, publish, commit, run builds, or install anything. Give concrete proposals that the owner can review in the editor.' });
        this.threadId = result.thread.id;
      }
      const result = await this.request('turn/start', { threadId: this.threadId, input: [{ type: 'text', text }], approvalPolicy: 'never', sandboxPolicy: { type: 'readOnly' } });
      this.turnId = result.turn.id;
      return { threadId: this.threadId, turnId: this.turnId };
    } catch (error) { this.active = false; throw error; }
  }
  async stop() { if (this.threadId && this.turnId && this.active) await this.request('turn/interrupt', { threadId: this.threadId, turnId: this.turnId }); }
  close() { this.child?.kill(); }
}
