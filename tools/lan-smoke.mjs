// tools/lan-smoke.mjs — headless end-to-end check of the LAN foundation (S1).
//
// Starts the real serve.mjs with the LAN layer, then:
//   • hits /api/lan/host and /api/lan/info (discovery + hosting)
//   • opens two WebSocket lobby clients (host + guest)
//   • drives hello → pick → ready → seed → start
//   • asserts roster sync, seed propagation, and the start broadcast
// No browser, no deps — same philosophy as tests/run-node.mjs.
//
//   node tools/lan-smoke.mjs

import { serve } from './serve.mjs';

const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A tiny promise-based lobby client over the global WebSocket.
function client(url) {
  const ws = new WebSocket(url);
  const inbox = [];
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const w = waiters.find((x) => x.pred(msg));
    if (w) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg); }
    else inbox.push(msg);
  });
  return {
    ready: new Promise((res) => ws.addEventListener('open', res)),
    send: (obj) => ws.send(JSON.stringify(obj)),
    // Resolve with the next (or buffered) message matching pred.
    next: (pred, label) => new Promise((resolve, reject) => {
      const hit = inbox.find(pred);
      if (hit) { inbox.splice(inbox.indexOf(hit), 1); return resolve(hit); }
      const to = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), 3000);
      waiters.push({ pred, resolve: (m) => { clearTimeout(to); resolve(m); } });
    }),
    close: () => ws.close(),
  };
}

const { server, port } = await serve({ port: 8199, open: false, lan: true });
const base = `http://localhost:${port}`;

try {
  // --- discovery / hosting HTTP API ---
  const info0 = await (await fetch(`${base}/api/lan/info`)).json();
  ok(info0.lan === true, '/api/lan/info reports lan:true');
  ok(typeof info0.addr === 'string' && info0.port === port, 'info advertises addr + port');

  const hostRes = await (await fetch(`${base}/api/lan/host`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Wren' }),
  })).json();
  ok(typeof hostRes.hostKey === 'string' && hostRes.hostKey.length > 0, 'hosting returns a hostKey');

  // --- lobby: host + guest ---
  const host = client(`ws://localhost:${port}/lan`);
  await host.ready;
  const hWelcome = await host.next((m) => m.t === 'welcome', 'host welcome');
  ok(!!hWelcome.id, 'host receives welcome + player id');
  host.send({ t: 'hello', name: 'Wren', classId: 'starseer', startingKitId: 'starseerStarstone', discoveredArmaments: ['starstoneStaff'], hostKey: hostRes.hostKey });
  const hRoster = await host.next((m) => m.t === 'roster', 'host roster');
  ok(hRoster.players.length === 1 && hRoster.players[0].isHost, 'host flagged isHost in roster');

  const guest = client(`ws://localhost:${port}/lan`);
  await guest.ready;
  const gWelcome = await guest.next((m) => m.t === 'welcome', 'guest welcome');
  guest.send({ t: 'hello', name: 'Fenn', classId: 'reaver', startingKitId: 'reaverGreatsword', discoveredArmaments: ['greatsword'] });
  const gRoster = await guest.next((m) => m.t === 'roster' && m.players.length === 2, 'guest 2-roster');
  ok(gRoster.players.length === 2, 'roster grows to 2 when guest joins');
  ok(gRoster.players.some((p) => p.name === 'Fenn' && !p.isHost), 'guest present and not host');

  // --- ready + seed + start ---
  guest.send({ t: 'ready', ready: true });
  const rosterReady = await host.next((m) => m.t === 'roster' && m.players.find((p) => p.name === 'Fenn')?.ready, 'guest-ready roster');
  ok(!!rosterReady, 'guest ready state propagates to host');

  host.send({ t: 'seed', seedString: 'GOLDBOUGH' });
  const seeded = await guest.next((m) => m.t === 'roster' && m.seedString === 'GOLDBOUGH', 'seed roster');
  ok(seeded.seedString === 'GOLDBOUGH', 'host seed propagates to guest');

  // Couch party: the host adds a LOCAL seat riding its own connection.
  host.send({ t: 'locals', locals: [{ name: 'Torrent', classId: 'herald', startingKitId: 'heraldEmberlight', discoveredArmaments: ['emberlightSceptre'], tint: 'rot' }] });
  const withLocal = await guest.next((m) => m.t === 'roster' && m.players.length === 3, 'roster with local');
  const localRow = withLocal.players.find((p) => p.isLocal);
  ok(!!localRow && localRow.name === 'Torrent' && localRow.ready, 'local seat appears in the roster, always ready');

  host.send({ t: 'start' });
  const hStarted = await host.next((m) => m.t === 'started', 'host started');
  const gStarted = await guest.next((m) => m.t === 'started', 'guest started');
  ok(gStarted.seedString === 'GOLDBOUGH', 'started broadcast carries the seed to all');
  ok(hStarted.yourIds && hStarted.yourIds.length === 2, 'host controls two seats (main + local)');
  ok(gStarted.yourIds && gStarted.yourIds.length === 1, 'guest controls one seat');
  const localId = hStarted.yourIds[1];

  // --- server-authoritative snapshots flow over the socket ---
  const state0 = await guest.next((m) => m.t === 'state', 'first state snapshot');
  ok(state0.snapshot && state0.snapshot.scene.kind === 'map', 'first snapshot is the shared map');
  ok(state0.snapshot.party.length === 3, 'snapshot party includes the local seat');
  ok(state0.snapshot.party.some((p) => p.name === 'Wren' && p.startingKitId === 'starseerStarstone')
    && state0.snapshot.party.some((p) => p.name === 'Fenn' && p.startingKitId === 'reaverGreatsword')
    && state0.snapshot.party.some((p) => p.name === 'Torrent' && p.startingKitId === 'heraldEmberlight'),
  'LAN start preserves starting-kit identity for main, guest, and local seats');
  const firstNode = state0.snapshot.reachableIds[0];

  // Fork voting: the host's lone vote holds the party; the guest's matching
  // vote completes it and BOTH clients receive the advanced snapshot.
  host.send({ t: 'chooseNode', nodeId: firstNode });
  const voteHeld = await guest.next((m) => m.t === 'state' && m.snapshot.scene.kind === 'map' && m.snapshot.scene.votes, 'vote-held snapshot');
  ok(voteHeld.snapshot.scene.votes && Object.keys(voteHeld.snapshot.scene.votes).length === 1, 'a lone vote holds the party (vote visible to all)');
  guest.send({ t: 'chooseNode', nodeId: firstNode });
  // The host casts its LOCAL seat's vote via `as` — completing 3/3.
  host.send({ t: 'chooseNode', nodeId: firstNode, as: localId });
  const advanced = await guest.next((m) => m.t === 'state' && m.snapshot.scene.kind !== 'map', 'post-node snapshot');
  ok(['combat', 'reward', 'shrine', 'event', 'complete'].includes(advanced.snapshot.scene.kind), 'choosing a node advances the shared scene for all clients');

  // --- guest drops mid-run → the run persists; member marked absent ---
  guest.close();
  const afterDrop = await host.next(
    (m) => m.t === 'state' && m.snapshot.party.find((p) => p.name === 'Fenn')?.connected === false,
    'state after guest drop'
  );
  ok(!!afterDrop, 'dropped member marked absent, run continues on the server');

  host.close();
} catch (e) {
  ok(false, `threw: ${e.message}`);
}

await wait(50);
server.close();
console.log(fails.length ? `\nLAN SMOKE FAILED (${fails.length})` : '\nLAN foundation OK');
process.exit(fails.length ? 1 : 0);
