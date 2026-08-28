// tools/reward-collect-drive.mjs — Bjorn, 2026-08-21 (E11/#256, PR #290).
//
// THE PRODUCTION DOOR, driven: ?shot=map + a real click on a real treasure
// node → nodeArrive('treasure') → rollDrop() → mountRewards() — the exact call
// path every real armament reward takes, NOT the ?shot=reward pose (which
// authors its offer and never calls rollDrop, and so concealed the defect this
// tool was built after: rollDrop persisted the armament AT ROLL TIME, before
// the menu ever mounted, so Skip could not leave it, manual Continue could not
// leave it, and NEW could never show on first discovery — Aurora's merge
// review on #290 at f29d468, and Codex review 4989824448).
//
// WHAT IT PROVES (Aurora's six, by name):
//   1. tap Take persists the armament exactly once (meta.found + run storage);
//   2. auto Continue persists an unskipped armament;
//   3. manual Continue leaves an untaken armament unowned;
//   4. explicit Skip leaves it unowned;
//   5. first discovery shows NEW before take and not after;
//   6. the path exercised is rollDrop → mountRewards through the map's own
//      click, asserted by the door marker: the mounted title is TREASURE,
//      which only the treasure arm of nodeArrive writes.
// Plus the chooser half of Codex's third finding: an unseen card in the card
// chooser wears a VISIBLE NEW badge (a rendered element with area, inside the
// card's own rect — Law 2), not an inert data attribute.
//
// THE READ DOOR: a shot boot runs on MEMORY storage (main.js pickStorage —
// deliberately, so a showcase URL can never clobber a real run), so no
// localStorage read can witness the writes this tool is about. It reads
// `window.__spoils()` — the manager's own loadMeta and the live run, the same
// species as `__profile`/`__runstatus` (holdconfirm's precedent: "it
// committed" is a claim about storage state, not about the mounted screen).
// Memory storage also means EVERY BOOT IS A FRESH PROFILE — each scenario
// below starts from zero without any clearing act.
//
// Run:  CHROME=/usr/bin/chromium node tools/reward-collect-drive.mjs
// Exit 0 = all named checks pass. Any FAIL names the player-visible sentence
// that broke.
//
// THE SEED IS PINNED AND THE PIN IS EXPLAINED: 'FALK' rolls 11 on the
// armaments stream's first draw (chance gate ≤ 60 for treasure), so the
// treasure node drops deterministically. A seed that rolls dry (SHOWCASE
// rolls 82) would green every ownership check vacuously — the armament-row
// presence assertion below is the guard that says the offer actually
// happened.
//
// BOUNDARY: headless Chromium, one viewport (1200x730). This proves the
// collection CONTRACT, not legibility (Sunna's gate) and not the elite/boss
// arms of the same shared rollDrop call (same function, same collector — the
// treasure arm is the cell; the others are named untested).

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'reward-collect-drive.mjs',
    timeoutMs: 900000,
    plants: [
      {
        // THE DEFECT ITSELF, replanted: persistence back at roll time — the
        // exact shape Aurora's review names at f29d468.
        name: 'rollDrop persists the armament at roll time, before the menu mounts',
        file: 'src/main.js',
        find: '  return id; // the roll is PURE: collection persists (collectArmament), not discovery',
        replace: '  if (id) collectArmament(id, source); return id; // planted: persistence back at roll time',
        expectRed: /FAIL\s+S1 pre-take: the rolled armament is not yet owned/,
      },
      {
        // The other half of the same defect: a collector that never fires —
        // taking becomes a reveal again and nothing is ever stored.
        name: 'apply.armament is a no-op — Take stores nothing',
        file: 'src/ui/screens/reward.js',
        find: '    armament(row) { if (onCollectArmament) onCollectArmament(row.armamentId); },',
        replace: '    armament() { /* planted: the reveal-only no-op */ },',
        expectRed: /FAIL\s+S1 tap Take persists the armament \(meta\.found\)/,
      },
      {
        // Codex's third finding replanted: the chooser badge gone — data-new
        // back to inert pixels.
        name: 'the chooser card NEW badge is not rendered',
        file: 'src/ui/screens/reward.js',
        find: '        el.appendChild(badge);',
        replace: '        /* planted: the badge is built and never attached — data-new back to inert pixels */',
        expectRed: /FAIL\s+S5 chooser: an unseen card wears a visible NEW badge/,
      },
      {
        // The b6b7df0 P1's UI face alone: the full-bag derivation gone — the
        // ninth piece renders takeable at the cap. The collector's own gate
        // stays, so the tap stores nothing and writes nothing; what breaks is
        // the LEGIBILITY (row pending, then reading Taken over a refusal).
        name: 'the full-bag refusal is not derived — the ninth offer renders takeable',
        file: 'src/model/rewardplan.js',
        find: "    blocked: (r, facts) => (facts.armamentSlotsFree > 0 ? null : 'storage'),",
        replace: '    blocked: () => null, /* planted: the cap has no face — the row renders takeable at the cap */',
        expectRed: /FAIL\s+S7 at the cap the offer is refused legibly/,
      },
      {
        // The reviewer's first mutation: THE CAPACITY GATE REMOVED. The face
        // must come off with it — with the derivation intact a blocked row
        // takes no click, so a gateless collector would be planted where no
        // door reaches it and the corpus would report an un-armed plant green.
        name: 'the capacity gate is gone — a refused store no longer stops collection',
        edits: [
          {
            file: 'src/model/rewardplan.js',
            find: "    blocked: (r, facts) => (facts.armamentSlotsFree > 0 ? null : 'storage'),",
            replace: '    blocked: () => null, /* planted: face off, so the gateless collector is reachable */',
          },
          {
            file: 'src/main.js',
            find: '  if (!stored) return; // the bag refused: nothing entered storage, so nothing is found — meta stays clean',
            replace: '  /* planted: the capacity gate is gone — collection proceeds though the bag refused */',
          },
        ],
        expectRed: /FAIL\s+S7 tapping claims nothing at the cap/,
      },
      {
        // The reviewer's second mutation: META PERSISTENCE AHEAD OF THE
        // SUCCESSFUL STORE — the store still runs, its verdict no longer
        // gates the meta write. Face off for the same reachability reason.
        name: 'meta persists ahead of the successful store',
        edits: [
          {
            file: 'src/model/rewardplan.js',
            find: "    blocked: (r, facts) => (facts.armamentSlotsFree > 0 ? null : 'storage'),",
            replace: '    blocked: () => null, /* planted: face off, so the reordered collector is reachable */',
          },
          {
            file: 'src/main.js',
            find: '  const stored = addToStorage(run.loadout, id, registries.balance.equipment.storageSlots || 8);',
            replace: '  const stored = true; addToStorage(run.loadout, id, registries.balance.equipment.storageSlots || 8); // planted: meta persistence no longer waits on the store landing',
          },
        ],
        expectRed: /FAIL\s+S7 tapping claims nothing at the cap/,
      },
    ],
  }));
}

import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { fileURLToPath } from 'node:url';

const SEED = 'FALK'; // armaments stream first draw = 11 ≤ 60: the treasure drops
const { port } = await serve({ root: fileURLToPath(new URL('..', import.meta.url)), port: 8207, open: false });
await launchBrowser({
  prefix: 'reward-collect-', browser: process.env.CHROME || '/usr/bin/chromium',
  headless: '--headless=new', awaitEndpoint: false,
  args: ['--remote-debugging-port=9407'], stdio: 'ignore',
});

async function cdp(p) {
  let l;
  for (let i = 0; i < 100; i++) {
    try { l = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json(); if (l.length) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const ws = new WebSocket(l.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const w = new Map();
  ws.onmessage = (m) => {
    const g = JSON.parse(m.data);
    if (g.id != null && w.has(g.id)) { const { ok, no } = w.get(g.id); w.delete(g.id); g.error ? no(new Error(g.error.message)) : ok(g.result); }
  };
  return { send: (m2, p2 = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method: m2, params: p2 })); return new Promise((ok, no) => w.set(n, { ok, no })); } };
}
const c = await cdp(9407);
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 730, deviceScaleFactor: 1, mobile: false });

const ev = async (e, aw = false) => {
  const r = await c.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: aw });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function nav(url) {
  await c.send('Page.navigate', { url });
  await sleep(150);
}
async function waitFor(cond, what, ms = 8000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await ev(cond)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
}

let fails = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? ' — ' + d : ''}`); if (!ok) fails++; };

const base = `http://127.0.0.1:${port}/index.html`;
const spoils = () => ev(`window.__spoils ? window.__spoils() : null`);
const clickSel = (sel) => `(()=>{const el=document.querySelector('${sel}');if(!el)return false;el.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true})()`;

// ---- find the treasure door once: a treasure node and a parent that links to it
await nav(`${base}?shot=map&shotSeed=${SEED}`);
await waitFor(`!!document.querySelector('.map-node')`, 'the map (seed boot)');
const graph = await spoils();
if (!graph) { console.log('FAIL  window.__spoils is absent — the read door this drive rides is gone'); process.exit(1); }
const door = (() => {
  const nodes = graph.map;
  const treasures = nodes.filter((n) => n.type === 'treasure').sort((a, b) => a.floor - b.floor);
  for (const t of treasures) {
    const parent = nodes.find((n) => n.next.includes(t.id));
    if (parent) return { treasure: t.id, parent: parent.id, floor: t.floor };
  }
  return null;
})();
if (!door) { console.log('FAIL  no treasure node with a parent in the FALK act-1 graph — the door cannot be driven'); process.exit(1); }
console.log(`door: treasure ${door.treasure} (floor ${door.floor}) via ${door.parent}, seed ${SEED}`);

// One scenario = one boot (memory storage: always a fresh profile), standing
// at the parent, then the REAL click on the REAL treasure node. `settings`
// seeds meta through ?shotSettings — the same saveMeta door a player's
// Settings tap writes.
async function bootTreasure({ settings = null, storage = null } = {}) {
  const s = (settings ? `&shotSettings=${encodeURIComponent(JSON.stringify(settings))}` : '')
    + (storage ? `&shotStorage=${storage}` : '');
  await nav(`${base}?shot=map&shotSeed=${SEED}&shotAt=${door.parent}${s}`);
  await waitFor(`!!document.querySelector('[data-node="${door.treasure}"]')`, 'the treasure node on the map');
  const clicked = await ev(clickSel(`[data-node="${door.treasure}"]`));
  if (!clicked) throw new Error('treasure node vanished before the click');
  await waitFor(`!!document.querySelector('.reward-menu')`, 'the reward menu');
}
const title = () => ev(`(()=>{const h=document.querySelector('.screen h2');return h?h.textContent.trim():''})()`);

// ---- S1: auto mode, tap Take — pre-take ownership, NEW, exactly-once -------
await bootTreasure();
check('S6 the reward mounted through the treasure door (title TREASURE, not a pose)', (await title()) === 'TREASURE', `title '${await title()}'`);
check('S6 the production roll offered an armament (seed guard — a dry roll greens everything vacuously)',
  await ev(`!!document.querySelector('.reward-kind[data-kind="armament"]')`));
let s = await spoils();
check('S1 pre-take: the rolled armament is not yet owned (meta.found) — the roll is pure until collection',
  s.found.length === 0, `meta.found already holds [${s.found}] at mount`);
check('S1 pre-take: the armament row shows NEW on first discovery',
  await ev(`(()=>{const el=document.querySelector('.reward-kind[data-kind="armament"]');return el&&el.dataset.new==='1'&&!!el.querySelector('.reward-new')})()`),
  'no NEW chip on the armament row before take');
await ev(clickSel('.reward-kind[data-kind="armament"]'));
await sleep(120);
s = await spoils();
check('S1 tap Take persists the armament (meta.found)', s.found.length === 1, `meta.found is [${s.found}] after take`);
const takenId = s.found[0];
check('S1 after take the NEW chip is gone',
  await ev(`(()=>{const el=document.querySelector('.reward-kind[data-kind="armament"]');return el&&!el.querySelector('.reward-new')})()`));
await ev(clickSel('#reward-continue'));
await sleep(200);
s = await spoils();
check('S1 Continue after a take does not persist it again — exactly once (meta.found)',
  s.found.filter((x) => x === takenId).length === 1, `meta.found is [${s.found}]`);
check('S1 exactly one copy in run storage', s.storage.filter((x) => x === takenId).length === 1, `storage is [${s.storage}]`);

// ---- S2: auto mode, no tap — Continue takes the unskipped armament ---------
await bootTreasure();
await ev(clickSel('#reward-continue'));
await sleep(200);
s = await spoils();
check('S2 auto Continue persists an unskipped armament (meta.found)', s.found.length === 1, `meta.found is [${s.found}]`);
check('S2 auto Continue stores it in the run (storage)', s.storage.length === 1, `storage is [${s.storage}]`);

// ---- S3: explicit Skip leaves it unowned -----------------------------------
await bootTreasure();
await ev(clickSel('.reward-kind[data-kind="armament"] [data-skip="armament"]'));
await sleep(120);
await ev(clickSel('#reward-continue'));
await sleep(200);
s = await spoils();
check('S3 explicit Skip leaves the armament unowned (meta.found) — "Leave it" tells the truth', s.found.length === 0, `meta.found is [${s.found}]`);
check('S3 explicit Skip leaves run storage empty', s.storage.length === 0, `storage is [${s.storage}]`);

// ---- S4: manual mode, no take — Continue means done, not take --------------
await bootTreasure({ settings: { rewardCollect: 'manual' } });
await ev(clickSel('#reward-continue'));
await sleep(200);
s = await spoils();
check('S4 manual Continue leaves an untaken armament unowned (meta.found) — only what the player chose', s.found.length === 0, `meta.found is [${s.found}]`);
check('S4 manual Continue leaves run storage empty', s.storage.length === 0, `storage is [${s.storage}]`);

// ---- S7: THE CAP — the ninth armament against a full 8-slot bag ------------
// The exact-head review at b6b7df0 (main.js:1103 thread): collectArmament
// ignored addToStorage()'s false, so at the cap the ninth piece was
// claimed-but-not-stored — meta.found poisoned with a piece the bag refused,
// the row reading Taken, and the piece excluded from every future drop. Every
// prior scenario here starts with an EMPTY bag, so this file structurally
// could not catch it — the reviewer said so, and the reviewer is right. The
// bag fills through ?shotStorage=full, which pushes pieces through
// addToStorage itself (the real writer); the offer still rolls because the
// fresh pool (25 base armaments) is far larger than the cap.
await bootTreasure({ storage: 'full' });
s = await spoils();
check('S7 the bag stands at the cap before any interaction (shotStorage guard)', s.storage.length === 8, `storage is ${s.storage.length} pieces`);
check('S7 the production roll still offered a ninth armament (pool guard)',
  await ev(`!!document.querySelector('.reward-kind[data-kind="armament"]')`));
check('S7 at the cap the offer is refused legibly (blocked row, reason storage — the flask precedent)',
  await ev(`(()=>{const el=document.querySelector('.reward-kind[data-kind="armament"]');return el&&el.dataset.state==='blocked'&&el.dataset.blockedBy==='storage'})()`),
  `state '${await ev(`(document.querySelector('.reward-kind[data-kind="armament"]')||{dataset:{}}).dataset.state`)}' blockedBy '${await ev(`(document.querySelector('.reward-kind[data-kind="armament"]')||{dataset:{}}).dataset.blockedBy`)}'`);
// Drive the corruption the review names: tap the row (a blocked row takes no
// click; an un-blocked one at the cap is the defect), then Continue.
await ev(clickSel('.reward-kind[data-kind="armament"]'));
await sleep(120);
s = await spoils();
check('S7 tapping claims nothing at the cap: no ninth piece enters meta.found while storage refuses it',
  s.found.length === 0, `meta.found is [${s.found}] with storage at ${s.storage.length}`);
check('S7 the row does not read Taken at the cap',
  await ev(`(()=>{const el=document.querySelector('.reward-kind[data-kind="armament"]');return el&&el.dataset.state!=='taken'})()`));
await ev(clickSel('#reward-continue'));
await sleep(200);
s = await spoils();
check('S7 Continue leaves storage at the cap and meta.found unchanged',
  s.storage.length === 8 && s.found.length === 0, `storage ${s.storage.length}, meta.found [${s.found}]`);
check('S7 no discovery receipt was written (count 0 — structurally 0 in showcase mode; found-unchanged above is the real witness, same gated write)',
  s.receipts === 0, `receipts ${s.receipts}`);

// ---- S5: the card chooser wears a VISIBLE NEW badge (pose door — a renderer
// fact; the treasure offer carries no cards, so the chooser's one home is the
// posed full offer) ----------------------------------------------------------
await nav(`${base}?shot=reward`);
await waitFor(`!!document.querySelector('.reward-menu')`, 'the posed reward menu');
await ev(clickSel('.reward-kind[data-kind="card"]'));
await waitFor(`!!document.querySelector('.reward-row .card')`, 'the card chooser');
check('S5 the chooser marks at least one card unseen (data-new guard — zero unseen greens the badge vacuously)',
  await ev(`document.querySelectorAll('.reward-row .card[data-new="1"]').length > 0`));
check('S5 chooser: an unseen card wears a visible NEW badge inside its own rect',
  await ev(`(()=>{
    const card = document.querySelector('.reward-row .card[data-new="1"]');
    if (!card) return false;
    const b = card.querySelector('.card-badge-new');
    if (!b) return false;
    const cr = card.getBoundingClientRect(), br = b.getBoundingClientRect();
    return br.width > 0 && br.height > 0 &&
      br.left >= cr.left - 1 && br.right <= cr.right + 1 &&
      br.top >= cr.top - 1 && br.bottom <= cr.bottom + 1;
  })()`),
  'no rendered badge with area inside the card rect');

process.exit(fails ? 1 : 0);
