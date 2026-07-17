// tools/lan-resume-smoke.mjs — headless check of host disk-resume over the wire:
// a server persists the run to disk, "restarts" (new server, same root), loads
// the save, and resumes it — the client lands back in the run as its member.
//
//   node tools/lan-resume-smoke.mjs

import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from './serve.mjs';

const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function client(url) {
  const ws = new WebSocket(url);
  const inbox = [];
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const w = waiters.find((x) => x.pred(msg));
    if (w) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg); } else inbox.push(msg);
  });
  return {
    ready: new Promise((res) => ws.addEventListener('open', res)),
    send: (o) => ws.send(JSON.stringify(o)),
    next: (pred, label) => new Promise((resolve, reject) => {
      const hit = inbox.find(pred);
      if (hit) { inbox.splice(inbox.indexOf(hit), 1); return resolve(hit); }
      const to = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), 3000);
      waiters.push({ pred, resolve: (m) => { clearTimeout(to); resolve(m); } });
    }),
    close: () => ws.close(),
  };
}

const root = mkdtempSync(join(tmpdir(), 'coopresume-'));
const savePath = join(root, '.coop-session.json');

try {
  const host = async (port) => (await (await fetch(`http://localhost:${port}/api/lan/host`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ranni' }) })).json()).hostKey;

  // --- server #1: host a run, advance a node, then it persists to disk ---
  const s1 = await serve({ root, port: 8196, open: false, lan: true });
  const hk1 = await host(s1.port);
  const c1 = client(`ws://localhost:${s1.port}/lan`);
  await c1.ready;
  await c1.next((m) => m.t === 'welcome', 'welcome');
  c1.send({ t: 'hello', name: 'Ranni', classId: 'astrologer', hostKey: hk1 });
  await c1.next((m) => m.t === 'roster', 'roster');
  c1.send({ t: 'start' });
  const st0 = await c1.next((m) => m.t === 'state', 'first state');
  ok(st0.snapshot.scene.kind === 'map', 'run started at the shared map');
  await wait(60);
  ok(existsSync(savePath), 'the run persisted to disk at the map boundary');

  // Advance one node so the saved state is past floor 0.
  c1.send({ t: 'chooseNode', nodeId: st0.snapshot.reachableIds[0] });
  await c1.next((m) => m.t === 'state', 'post-node state');
  await wait(60);
  c1.close();
  s1.server.close();
  await wait(120);

  // --- server #2: same root — it should LOAD the save on startup ---
  const s2 = await serve({ root, port: 8196, open: false, lan: true });
  const info2 = await (await fetch(`http://localhost:${s2.port}/api/lan/info`)).json();
  ok(info2.hasSave === true, 'a fresh server on the same root reports a resumable save');
  ok(info2.save && info2.save.players.includes('Ranni'), 'save metadata carries the party (Ranni)');

  // --- resume: host reconnects and the run comes back ---
  const c2 = client(`ws://localhost:${s2.port}/lan`);
  await c2.ready;
  await c2.next((m) => m.t === 'welcome', 'welcome2');
  const hk2 = await host(s2.port);
  c2.send({ t: 'hello', name: 'Ranni', classId: 'astrologer', hostKey: hk2 });
  await c2.next((m) => m.t === 'roster', 'roster2');
  c2.send({ t: 'resume' });
  const resumed = await c2.next((m) => m.t === 'resumed', 'resumed');
  ok(!!resumed.yourId, 'the server hands the client its restored member id');
  const st2 = await c2.next((m) => m.t === 'state', 'resumed state');
  ok(st2.snapshot.party.some((p) => p.name === 'Ranni' && p.connected), 'resumed run has the player back, connected');
  ok(st2.snapshot.actNumber >= 1, 'resumed run is back on the map at the saved progress');

  c2.close();
  s2.server.close();
} catch (e) {
  ok(false, `threw: ${e.stack || e.message}`);
}
await wait(50);
try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
console.log(fails.length ? `\nLAN RESUME FAILED (${fails.length})` : '\nHost disk-resume over the wire OK');
process.exit(fails.length ? 1 : 0);
