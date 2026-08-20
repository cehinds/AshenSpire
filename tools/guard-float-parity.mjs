// Focused guard-hit parity gate (#207).
//
// The fast door proves the semantic split, the authoritative co-op session
// receipts, and five named source mutations. `--browser` adds the real product
// path: two LAN clients, the lobby, shared map vote, live fight, real Defend
// cards and real End Turn controls. `--shots DIR` records that measured frame.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession } from './session.mjs';
import { guardHitFloatParts } from '../src/ui/fx.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: done, reject } = pending.get(message.id); pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else done(message.result);
  });
  return {
    ready: new Promise((done, reject) => { ws.addEventListener('open', done); ws.addEventListener('error', reject); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((done, reject) => {
        pending.set(id, { resolve: done, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function browserDoor() {
  const browsers = [
    argOf('--browser'), process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].filter(Boolean);
  const browserPath = browsers.find((path) => existsSync(path));
  if (!browserPath) throw new Error('no Chrome/Edge found — pass --browser PATH or set CHROME');
  const requestedShape = argOf('--shape');
  const shapes = [
    { tag: '390x844', width: 390, height: 844, dpr: 3 },
    { tag: '1200x730', width: 1200, height: 730, dpr: 1 },
  ].filter((shape) => !requestedShape || shape.tag === requestedShape);
  if (!shapes.length) throw new Error(`unknown --shape ${requestedShape}; use 390x844 or 1200x730`);
  const shots = argOf('--shots');
  const cases = [
    { name: 'full', className: 'Reaver', defend: true, blocked: 7, texts: ['-7', '7'] },
    { name: 'partial', className: 'Herald', defend: true, blocked: 4, texts: ['-3', '-7', '4'] },
    { name: 'unguarded', className: 'Reaver', defend: false, blocked: 0, texts: ['-7', '-7'] },
  ];
  const findings = [];
  const check = (condition, label, detail = '') => {
    console.log(`    ${condition ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!condition) findings.push(label);
  };
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'guardfloat-', browser: browserPath,
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const makeTab = async (shape) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: shape.width, height: shape.height, deviceScaleFactor: shape.dpr, mobile: shape.dpr > 1,
    }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: shape.dpr > 1, maxTouchPoints: 5 }, sessionId);
    return { targetId, sessionId };
  };
  const evaluate = async (tab, expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, tab.sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page threw');
    return result.result.value;
  };
  const until = async (tab, expression, label, timeoutMs = 25000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await evaluate(tab, expression).catch(() => false)) return;
      await wait(120);
    }
    throw new Error(`timeout waiting for ${label}`);
  };
  // SVG map nodes do not implement HTMLElement.click() in every Chromium build;
  // the product listens for the bubbling click event, so use that one door for
  // HTML buttons, cards and SVG nodes alike.
  const click = (selector) => `(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)return false; el.dispatchEvent(new MouseEvent('click',{bubbles:true})); return true; })()`;

  try {
    let port = 8527;
    for (const shape of shapes) for (const row of cases) {
      const server = await serve({ root: ROOT, port: port++, open: false, lan: true });
      const base = `http://localhost:${server.port}/`;
      const host = await makeTab(shape); const guest = await makeTab(shape);
      console.log(`\n  ${shape.tag} ${row.name} — real two-client GUARD2 fight`);
      try {
        await cdp.send('Page.navigate', { url: base }, host.sessionId);
        await until(host, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'host LAN door');
        await evaluate(host, click('#lan-play'));
        await until(host, `!!document.querySelector('#lb-name')`, 'host lobby');
        await evaluate(host, `(()=>{const n=document.querySelector('#lb-name');n.value='Wren';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
        await evaluate(host, click('#lb-host'));
        await until(host, `document.querySelector('h2')?.textContent==='AT THE FIRE'`, 'host fire');

        await cdp.send('Page.navigate', { url: base }, guest.sessionId);
        await until(guest, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'guest LAN door');
        await evaluate(guest, click('#lan-play'));
        await until(guest, `!!document.querySelector('#lb-name')`, 'guest lobby');
        await evaluate(guest, `(()=>{const n=document.querySelector('#lb-name');n.value='Fenn';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
        await until(guest, `!!document.querySelector('.lb-join')`, 'guest sees fire');
        await evaluate(guest, click('.lb-join'));
        await until(guest, `!!document.querySelector('#lb-ready')`, 'guest room');
        await evaluate(guest, `(()=>{const p=[...document.querySelectorAll('#lb-classes .class-pick')].find(x=>x.querySelector('h3')?.textContent===${JSON.stringify(row.className)});if(!p)return false;p.click();return true})()`);
        await until(host, `document.querySelector('#lb-roster')?.textContent.includes(${JSON.stringify(row.className)})`, 'host sees guest class');
        await evaluate(guest, click('#lb-ready'));
        await until(host, `!document.querySelector('#lb-start')?.disabled`, 'host sees ready');
        await evaluate(host, `(()=>{const n=document.querySelector('#lb-seed');n.value='GUARD2';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
        await evaluate(host, click('#lb-start'));
        await until(host, `!!document.querySelector('.mapscreen')`, 'host map');
        await until(guest, `!!document.querySelector('.mapscreen')`, 'guest map');
        await evaluate(host, click('.map-node.reachable')); await evaluate(guest, click('.map-node.reachable'));
        await until(host, `!!document.querySelector('.combat.coop')`, 'host combat');
        await until(guest, `!!document.querySelector('.combat.coop')`, 'guest combat');
        await until(guest, `!!window.__coopSnapshot?.scene?.players?.length`, 'guest snapshot');
        await until(guest, `document.querySelectorAll('.combat.coop .hand .card').length>0`, 'guest hand');
        if (row.defend) {
          const play = await evaluate(guest, `(()=>{const all=[...document.querySelectorAll('.hand .card')],c=all.find(x=>/defend/i.test(x.textContent));if(c)c.click();return{played:!!c,cards:all.map(x=>({text:x.textContent.trim().replace(/\\s+/g,' '),aria:x.getAttribute('aria-label'),id:x.dataset.instanceId||x.dataset.cardId||null}))}})()`);
          check(play.played, `${row.name}: Fenn plays a real Defend card`, play.played ? '' : JSON.stringify(play.cards));
          if (!play.played) throw new Error(`Defend card not found in guest hand: ${JSON.stringify(play.cards)}`);
          await until(guest, `(()=>{const s=window.__coopSnapshot,id=s.party.find(p=>p.name==='Fenn')?.id;return s.scene.players.find(p=>p.id===id)?.block===${row.blocked}})()`, `Fenn block ${row.blocked}`);
        }
        const beforeHp = await evaluate(guest, `(()=>{const s=window.__coopSnapshot,id=s.party.find(p=>p.name==='Fenn')?.id;return s.scene.players.find(p=>p.id===id)?.hp})()`);
        await evaluate(host, click('#coop-endturn')); await evaluate(guest, click('#coop-endturn'));
        await until(guest, `(()=>{const s=window.__coopSnapshot,id=s.party.find(p=>p.name==='Fenn')?.id;return s.scene.events?.some(e=>e.type==='damageDealt'&&e.playerId===id)})()`, 'authoritative Fenn damage receipt');
        await until(guest, `document.querySelectorAll('.fx-layer .float-num').length>=${row.texts.length}`, 'visible float channels', 12000);
        const reading = await evaluate(guest, `(()=>{const all=window.__coopSnapshot,id=all.party.find(p=>p.name==='Fenn')?.id,s=all.scene,p=s.players.find(x=>x.id===id),e=s.events.find(x=>x.type==='damageDealt'&&x.playerId===id);return{hp:p.hp,block:p.block,receipt:e,texts:[...document.querySelectorAll('.fx-layer .float-num')].map(x=>x.textContent).sort(),guard:[...document.querySelectorAll('.fx-layer .float-num.blk')].map(x=>x.textContent)}})()`);
        check(reading.receipt?.amount === 7 && reading.receipt?.blocked === row.blocked,
          `${row.name}: wire receipt is amount 7 / blocked ${row.blocked}`, JSON.stringify(reading.receipt));
        const residual = 7 - row.blocked;
        check(reading.hp === beforeHp - residual && reading.block === 0,
          `${row.name}: authoritative Fenn state loses only ${residual} HP and guard clears`, `HP${beforeHp}→${reading.hp}/B${reading.block}`);
        check(JSON.stringify(reading.texts) === JSON.stringify(row.texts),
          `${row.name}: exact visible channels ${row.texts.join(' + ')}`, reading.texts.join(' + '));
        check(!reading.guard.some((text) => text.startsWith('+')),
          `${row.name}: absorbed guard is never mislabeled as gain`, reading.guard.join(', ') || 'no guard channel');

        if (shots) {
          mkdirSync(resolve(shots), { recursive: true });
          await evaluate(guest, `(()=>{const layer=document.querySelector('.fx-layer');for(const n of [...layer.querySelectorAll('.float-num')]){const c=n.cloneNode(true);c.style.animation='none';c.dataset.evidenceClone='true';layer.appendChild(c);n.remove()}const note=document.createElement('div');note.className='evidence-caption';note.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;padding:6px 9px;background:#090806dd;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';note.textContent=${JSON.stringify(`SOURCE · two-client GUARD2 · ${row.name}`)};document.body.appendChild(note);return true})()`);
          await cdp.send('Page.bringToFront', {}, guest.sessionId); await wait(120);
          const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, guest.sessionId);
          const name = `guard-float-after-source-${shape.tag}-coop-${row.name}.png`;
          writeFileSync(join(resolve(shots), name), Buffer.from(data, 'base64'));
          console.log(`    shot ${name}`);
        }
        await evaluate(guest, `(()=>{document.querySelectorAll('.fx-layer .float-num').forEach(n=>n.remove());document.querySelector('.combatant.enemy:not(.dead)')?.click();return true})()`);
        await wait(180);
        const replay = await evaluate(guest, `[...document.querySelectorAll('.fx-layer .float-num')].map(x=>x.textContent)`);
        check(replay.length === 0, `${row.name}: local rerender replays zero authoritative receipts`, JSON.stringify(replay));
      } finally {
        await cdp.send('Target.closeTarget', { targetId: host.targetId }).catch(() => {});
        await cdp.send('Target.closeTarget', { targetId: guest.targetId }).catch(() => {});
        await new Promise((done) => server.server.close(done));
        rmSync(join(ROOT, '.coop-session.json'), { force: true });
      }
    }
  } finally {
    cdp.close(); await dropBrowser();
  }
  console.log(`\nGUARD FLOAT BROWSER ${findings.length ? `FAILED (${findings.length})` : 'OK'}`);
  return findings.length ? 1 : 0;
}

if (args.includes('--browser')) {
  try { process.exit(await browserDoor()); }
  catch (error) { console.error(`guard-float-parity browser door: ${error.message}`); process.exit(2); }
}

const REG = createRegistries(contentBundle);
const failures = [];
const pass = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

const expected = new Map([
  ['full', { amount: 7, blocked: 7, guard: '7', damage: null }],
  ['partial', { amount: 7, blocked: 4, guard: '4', damage: '-3' }],
  ['unguarded', { amount: 7, blocked: 0, guard: null, damage: '-7' }],
]);

console.log('\nGUARD FLOAT PARITY — focused source door');
for (const [name, row] of expected) {
  const got = guardHitFloatParts(row);
  pass((got.guard ? got.guard.text : null) === row.guard
      && (got.damage ? got.damage.text : null) === row.damage,
    `semantic ${name}`,
    `guard=${got.guard?.text || 'none'} damage=${got.damage?.text || 'none'}`);
  pass(!got.guard || (!got.guard.text.startsWith('+') && got.guard.cls.includes('blk')),
    `${name} absorbed channel is unsigned guard styling`);
}

function coopReceiptMatrix() {
  const game = createSession({ registries: REG, seedString: 'GUARD2' });
  for (const [id, name] of [['p1', 'Full'], ['p2', 'Partial'], ['p3', 'Unguarded']]) {
    game.addMember({ id, name, classId: 'reaver' });
  }
  game.start();
  const nodeId = game.session.mapGraph.startIds[0];
  for (const id of ['p1', 'p2', 'p3']) game.chooseNode(id, nodeId);
  const combat = game.live.combat;
  const opening = game.snapshot().scene;
  if (opening.enemies.length !== 1 || opening.enemies[0].intent?.moveId !== 'slash'
    || opening.enemies[0].intent?.damage !== 7) {
    throw new Error('GUARD2 no longer opens one authoritative 7-damage slash');
  }
  for (const [id, block] of [['p1', 7], ['p2', 4], ['p3', 0]]) {
    const entity = combat.players.get(id).entity;
    entity.hp = 30;
    entity.block = block;
  }
  game.combatEndTurn('p1');
  const before = structuredClone(game.snapshot().scene);
  game.combatEndTurn('p2');
  game.combatEndTurn('p3');
  const after = structuredClone(game.snapshot().scene);
  return { before, after };
}

const coop = coopReceiptMatrix();
const receipts = coop.after.events.filter((event) => event.type === 'damageDealt');
pass(receipts.length === 3, 'co-op transports one damageDealt receipt per real hit', `${receipts.length}/3`);
for (const [index, [id, blocked, hp]] of [['p1', 7, 30], ['p2', 4, 27], ['p3', 0, 23]].entries()) {
  const event = receipts[index];
  const player = coop.after.players.find((entry) => entry.id === id);
  pass(event?.playerId === id && event?.amount === 7 && event?.blocked === blocked,
    `co-op ${id} receipt keeps seat/amount/blocked`, JSON.stringify(event));
  pass(player?.hp === hp && player?.block === 0,
    `co-op ${id} mutation remains HP${hp}/B0`, `HP${player?.hp}/B${player?.block}`);
}

const paths = {
  fx: resolve(ROOT, 'src/ui/fx.js'),
  coop: resolve(ROOT, 'src/ui/screens/coop.js'),
  session: resolve(ROOT, 'tools/session.mjs'),
};
const source = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path, 'utf8')]));

function sourceContract(tree) {
  return [
    /const residual = amount - blocked;/.test(tree.fx),
    /guard: blocked > 0 \? \{ text: String\(blocked\), cls: 'blk small' \}/.test(tree.fx),
    /damage: residual > 0 \? \{ text: `-\$\{residual\}`/.test(tree.fx),
    /type === 'damageDealt' && payload\.targetId === 'player'[\s\S]{0,120}playerId: combat\.playerKey/.test(tree.session),
    /\.filter\(\(e\) => \[[^\]]*'damageDealt'/.test(tree.session),
    /for \(const ev of now !== prev \? \(now\.events \|\| \[\]\) : \[\]\)[\s\S]{0,900}receiptTargets\.add/.test(tree.coop),
    /!receiptTargets\.has\(`player:\$\{p\.id\}`\)/.test(tree.coop),
  ].every(Boolean);
}

pass(sourceContract(source), 'source seams form one receipt-driven contract');
const plants = [
  ['solo-collapses-to-preblock-total', 'fx', 'const residual = amount - blocked;', 'const residual = amount;'],
  ['absorbed-channel-omitted', 'fx', 'guard: blocked > 0 ? { text: String(blocked), cls: \'blk small\' }', 'guard: null'],
  ['absorbed-mislabeled-as-gain', 'fx', 'text: String(blocked)', 'text: `+${blocked}`'],
  ['coop-drops-damage-receipt', 'session', "'enemyMoveStarted', 'damageDealt',", "'enemyMoveStarted',"],
  ['coop-guesses-from-block-delta', 'coop', 'for (const ev of now !== prev ? (now.events || []) : [])', 'for (const ev of [])'],
];
for (const [name, file, find, replacement] of plants) {
  const planted = { ...source, [file]: source[file].replace(find, replacement) };
  pass(planted[file] !== source[file] && !sourceContract(planted), `plant killed: ${name}`);
}

const crlf = Object.fromEntries(Object.entries(source).map(([key, text]) => [key, text.replace(/\n/g, '\r\n')]));
pass(sourceContract(crlf), 'forced-CRLF source contract remains green');

console.log(failures.length ? `\nGUARD FLOAT PARITY FAILED (${failures.length})` : '\nGUARD FLOAT PARITY OK');
process.exit(failures.length ? 1 : 0);
