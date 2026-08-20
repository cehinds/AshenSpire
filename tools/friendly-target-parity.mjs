#!/usr/bin/env node
// Focused source door for issue #209. The selected standalone door is added
// only after the serialized #27 artifact rebuild releases root/build/dist.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createCoopCombat, leaveCombat, playCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createRegistries } from '../src/model/registries.js';
import { friendlyTargetPlan } from '../src/ui/components/friendlyTargets.js';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { setCombatStartStateForTools } from './session.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const files = {
  shared: 'src/ui/components/friendlyTargets.js',
  combat: 'src/ui/screens/combat.js',
  coop: 'src/ui/screens/coop.js',
  engine: 'src/engine/coopCombat.js',
};

const source = Object.fromEntries(Object.entries(files).map(([key, rel]) => [key, fs.existsSync(path.join(ROOT, rel)) ? read(rel) : '']));
function evaluateSource(candidate) {
  return [
    ['shared semantic renderer exists', /export function friendlyTargetPlan/.test(candidate.shared) && /export function renderTargetSilhouette/.test(candidate.shared)],
    ['blue self and green ally stay distinct', /self: '#4d94e0'/.test(candidate.shared) && /ally: '#49b675'/.test(candidate.shared)],
    ['solo and co-op share the renderer', /from ['"]\.\.\/components\/friendlyTargets\.js['"]/.test(candidate.combat) && /from ['"]\.\.\/components\/friendlyTargets\.js['"]/.test(candidate.coop)],
    ['down and disconnected seats are excluded', /!player\.alive \|\| !player\.connected/.test(candidate.shared)],
    ['co-op has relationship-specific targets', /data-friendly-target/.test(candidate.coop) && !/arming && p\.alive && p\.connected \? ' throw-target'/.test(candidate.coop)],
    ['co-op target cancel restores focus', /cancelFriendlyTargeting/.test(candidate.coop) && /ev\.key === 'Escape'/.test(candidate.coop) && /focusElement\(card\)/.test(candidate.coop)],
    ['co-op legal targets enter the shared focus system', /decorateFriendlyTarget/.test(candidate.coop) && /dataset\.focusable/.test(candidate.shared) && /aria-label/.test(candidate.shared)],
    ['confirm disarms before its one network intent', /armedFriendlyCard = null;\r?\n\s+hideTooltip\(\);\r?\n\s+render\(\);\r?\n\s+send\(\{ t: 'playCard'/.test(candidate.coop)],
    ['server validates the same friendly target model before spending', /targetId = assertFriendlyTarget\(friendlyPlan, targetId, C\.playerKey\);/.test(candidate.engine) && candidate.engine.indexOf('targetId = assertFriendlyTarget') < candidate.engine.indexOf('p.energy -= cost')],
  ];
}
const checks = evaluateSource(source);

let pass = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (ok) pass += 1;
}
console.log(`friendly target source parity: ${pass}/${checks.length}`);

function evaluateArtifact(html, serverEngine) {
  return [
    ['artifact carries blue self and green ally', /self: '#4d94e0'/.test(html) && /ally: '#49b675'/.test(html)],
    ['artifact carries shared semantic renderer', /function friendlyTargetPlan/.test(html) && /function renderTargetSilhouette/.test(html)],
    ['artifact excludes down and disconnected seats', /!player\.alive \|\| !player\.connected/.test(html)],
    ['artifact carries relationship target and AX focus state', /function decorateFriendlyTarget[\s\S]{0,500}dataset\.friendlyTarget[\s\S]{0,160}dataset\.focusable[\s\S]{0,240}Target \$\{label\} \(\$\{relationship\}\)/.test(html)],
    ['artifact carries Escape cancellation and focus restore', /ev\.key === 'Escape'/.test(html) && /focusElement\(card\)/.test(html)],
    ['artifact disarms before its one network intent', /armedFriendlyCard = null;\r?\n\s+hideTooltip\(\);\r?\n\s+render\(\);\r?\n\s+send\(\{ t: 'playCard'/.test(html)],
    ['selected-root server enforces friendly legality before spending', /targetId = assertFriendlyTarget\(friendlyPlan, targetId, C\.playerKey\);[\s\S]{0,1800}p\.energy -= cost;/.test(serverEngine)],
  ];
}

if (process.argv.includes('--artifact-check')) {
  const artifact = read('AshenSpire.html');
  const artifactChecks = evaluateArtifact(artifact, read('src/engine/coopCombat.js'));
  for (const [label, ok] of artifactChecks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  const artifactGreen = artifactChecks.every(([, ok]) => ok);
  console.log(`friendly target artifact parity: ${artifactGreen ? 'OK' : 'RED'} (${artifactChecks.filter(([, ok]) => ok).length}/${artifactChecks.length})`);
  process.exit(artifactGreen ? 0 : 1);
}

let dynamicPass = 0;
let dynamicTotal = 0;
const check = (label, fn) => {
  dynamicTotal += 1;
  try { fn(); dynamicPass += 1; console.log(`PASS ${label}`); }
  catch (error) { console.log(`FAIL ${label} — ${error.message}`); }
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const seats = [
  { id: 'caster', alive: true, connected: true, ended: false },
  { id: 'ally', alive: true, connected: true, ended: true },
  { id: 'down', alive: false, connected: true, ended: false },
  { id: 'away', alive: true, connected: false, ended: false },
];
const selfDef = { effects: [{ op: 'block', target: 'self', amount: 5 }] };
const allyDef = { effects: [{ op: 'block', target: 'ally', amount: 5 }] };
const mixedDef = { effects: [{ op: 'block', target: 'ally', amount: 5 }, { op: 'block', target: 'self', amount: 2 }] };
check('self-only plan exposes exactly the blue caster', () => {
  const plan = friendlyTargetPlan(selfDef, 'caster', seats);
  assert(JSON.stringify(plan.targets) === JSON.stringify([{ id: 'caster', relationship: 'self' }]), JSON.stringify(plan.targets));
});
check('ally-only plan exposes the living connected ended ally, never self/down/away', () => {
  const plan = friendlyTargetPlan(allyDef, 'caster', seats);
  assert(JSON.stringify(plan.targets) === JSON.stringify([{ id: 'ally', relationship: 'ally' }]), JSON.stringify(plan.targets));
});
check('mixed plan exposes blue self and green living ally', () => {
  const plan = friendlyTargetPlan(mixedDef, 'caster', seats);
  assert(plan.targets.length === 2 && plan.targets[0].relationship === 'self' && plan.targets[1].relationship === 'ally', JSON.stringify(plan.targets));
});

const REG = createRegistries(contentBundle);
const player = (id, cardId) => ({
  id, name: id, classId: 'starseer', maxHp: 72, hp: 60,
  energyMax: 3, drawPerTurn: 5, relicIds: [], flasks: [],
  deck: Array.from({ length: 5 }, (_, index) => ({ instanceId: `${id}-${cardId}-${index}`, cardId, upgraded: false })),
});
const fight = (cardId = 'rallyingBanner') => createCoopCombat({
  registries: REG, rng: createRng(209), players: [player('caster', cardId), player('ally', cardId)], enemyIds: ['blightHound'],
});
const firstCard = (C, id = 'caster') => C.players.get(id).piles.hand[0];
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

check('authoritative ally play lands on chosen teammate once', () => {
  const C = fight();
  const before = C.players.get('caster').piles.hand.length;
  playCard(C, 'caster', firstCard(C).instanceId, 'ally');
  assert(C.players.get('ally').entity.block === 10, 'ally block missing');
  assert(C.players.get('caster').entity.block === 0, 'caster incorrectly targeted');
  assert(C.players.get('caster').piles.hand.length === before - 1, 'card not spent exactly once');
});
check('authoritative ally-only self target is rejected before spend', () => {
  const C = fight(); const P = C.players.get('caster'); const card = firstCard(C); const energy = P.entity.energy;
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'caster')), 'self target accepted');
  assert(P.entity.energy === energy && P.piles.hand.includes(card), 'illegal play spent resources');
});
check('authoritative disconnected ally is rejected before spend', () => {
  const C = fight(); const P = C.players.get('caster'); const card = firstCard(C); const energy = P.entity.energy;
  leaveCombat(C, 'ally');
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'ally')), 'away target accepted');
  assert(P.entity.energy === energy && P.piles.hand.includes(card), 'illegal play spent resources');
});
check('authoritative down ally is rejected before spend', () => {
  const C = fight(); const P = C.players.get('caster'); const card = firstCard(C); const energy = P.entity.energy;
  const ally = C.players.get('ally'); ally.entity.hp = 0; ally.entity.alive = false;
  assert(throws(() => playCard(C, 'caster', card.instanceId, 'ally')), 'down target accepted');
  assert(P.entity.energy === energy && P.piles.hand.includes(card), 'illegal play spent resources');
});
check('authoritative mixed Oath accepts self and ally choices', () => {
  for (const targetId of ['caster', 'ally']) {
    const C = fight('ashOath');
    playCard(C, 'caster', firstCard(C).instanceId, targetId);
    assert(Object.keys(C.players.get('caster').entity.statuses).length > 0, `caster status missing for ${targetId}`);
  }
});

if (process.argv.includes('--selftest-source')) {
  const plants = [
    ['generic gold ally', 'shared', (text) => text.replace("ally: '#49b675'", "ally: '#d5ad57'")],
    ['swapped relationship colors', 'shared', (text) => text.replace("self: '#4d94e0'", "self: '#49b675'")],
    ['down or away becomes legal', 'shared', (text) => text.replace('!player.alive || !player.connected', '!player.alive && !player.connected')],
    ['controller focus removed', 'shared', (text) => text.replace("combatantEl.dataset.focusable = '';", '')],
    ['cancel focus restoration removed', 'coop', (text) => text.replace('if (card) focusElement(card);', '')],
    ['confirm can replay before disarm', 'coop', (text) => text.replace('armedFriendlyCard = null;\n          hideTooltip();\n          render();\n          send(', 'send(')],
    ['server legality bypassed', 'engine', (text) => text.replace('targetId = assertFriendlyTarget(friendlyPlan, targetId, C.playerKey);', 'targetId = targetId;')],
  ];
  let caught = 0;
  for (const [label, key, mutate] of plants) {
    const candidate = { ...source, [key]: mutate(source[key]) };
    const red = evaluateSource(candidate).some(([, ok]) => !ok);
    console.log(`${red ? 'CAUGHT' : 'MISSED'} plant: ${label}`);
    if (red) caught += 1;
  }
  console.log(`source plants: ${caught}/${plants.length}`);
  if (caught !== plants.length) process.exitCode = 1;
  const crlfSource = Object.fromEntries(Object.entries(source).map(([key, text]) => [key, text.replace(/\n/g, '\r\n')]));
  const crlfChecks = evaluateSource(crlfSource);
  const crlfGreen = crlfChecks.every(([, ok]) => ok);
  console.log(`${crlfGreen ? 'PASS' : 'FAIL'} forced-CRLF source contract${crlfGreen ? '' : ` — ${crlfChecks.filter(([, ok]) => !ok).map(([label]) => label).join('; ')}`}`);
  if (!crlfGreen) process.exitCode = 1;
}

if (process.argv.includes('--selftest-artifact')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const artifactPlants = [
    ['selected artifact generic gold ally', 'AshenSpire.html', "ally: '#49b675'", "ally: '#d5ad57'"],
    ['selected artifact swapped self color', 'AshenSpire.html', "self: '#4d94e0'", "self: '#49b675'"],
    ['selected artifact allows down or away', 'AshenSpire.html', '!player.alive || !player.connected', '!player.alive && !player.connected'],
    ['selected artifact drops controller focus', 'AshenSpire.html', "combatantEl.dataset.focusable = '';", ''],
    ['selected artifact drops cancel focus restore', 'AshenSpire.html', 'if (card) focusElement(card);', ''],
    ['selected artifact can replay before disarm', 'AshenSpire.html', 'armedFriendlyCard = null;\n          hideTooltip();\n          render();\n          send(', 'send('],
    ['selected-root server bypasses legality', 'src/engine/coopCombat.js', 'targetId = assertFriendlyTarget(friendlyPlan, targetId, C.playerKey);', 'targetId = targetId;'],
  ];
  const status = await doorSelftest({
    tool: 'friendly-target-parity.mjs', args: ['--artifact-check'], timeoutMs: 300000,
    extraCopy: ['AshenSpire.html'],
    plants: artifactPlants.map(([name, file, find, replace]) => ({
      name, file, find, replace, expectRed: /friendly target artifact parity: RED/,
    })),
  });
  process.exit(status);
}

console.log(`friendly target dynamic parity: ${dynamicPass}/${dynamicTotal}`);
if (pass !== checks.length || dynamicPass !== dynamicTotal) process.exitCode = 1;

const argOf = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const handlers = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(message.error.message));
    else handlers.resolve(message.result);
  });
  return {
    ready: new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

async function browserDoor() {
  const captureBefore = process.argv.includes('--capture-before');
  const standalone = process.argv.includes('--standalone');
  const browserFlag = argOf('--browser');
  const candidates = [
    browserFlag && !browserFlag.startsWith('--') ? browserFlag : null,
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  const browserPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!browserPath) throw new Error('Chrome or Edge is required for --browser');
  const only = argOf('--shape');
  const textSize = argOf('--text') || 'M';
  if (!['M', 'XL'].includes(textSize)) throw new Error(`--text must be M or XL (got ${textSize})`);
  const shapes = [
    { tag: '320x640', width: 320, height: 640, dpr: 3 },
    { tag: '390x844', width: 390, height: 844, dpr: 3 },
    { tag: '1200x730', width: 1200, height: 730, dpr: 1 },
  ].filter((shape) => !only || shape.tag === only);
  if (!shapes.length) throw new Error(`unknown --shape ${only}`);
  const shotsDir = argOf('--shots');
  if (shotsDir) fs.mkdirSync(path.resolve(ROOT, shotsDir), { recursive: true });
  const findings = [];
  const observed = (condition, label, detail = '') => {
    console.log(`${condition ? 'PASS' : 'FAIL'} browser ${label}${detail ? ` — ${detail}` : ''}`);
    if (!condition) findings.push(`${label}${detail ? `: ${detail}` : ''}`);
  };
  const { wsUrl, close: closeBrowser } = await launchBrowser({
    prefix: 'friendly-target-', browser: browserPath,
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(wsUrl);
  await cdp.ready;
  let port = 43920;
  const makeTab = async (shape) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: shape.width, height: shape.height, deviceScaleFactor: shape.dpr, mobile: shape.dpr > 1,
    }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: shape.dpr > 1, maxTouchPoints: 5 }, sessionId);
    return { targetId, sessionId };
  };
  const evaluate = async (tab, expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, tab.sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'browser expression threw');
    return result.result.value;
  };
  const until = async (tab, expression, label, timeout = 25000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(tab, expression).catch(() => false)) return;
      await wait(100);
    }
    throw new Error(`timeout waiting for ${label}`);
  };
  const click = (selector) => `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true})()`;
  const activate = async (tab, selector, touch = false) => {
    const point = await evaluate(tab, `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=e.getBoundingClientRect(),x=Math.max(1,Math.min(innerWidth-1,(b.left+b.right)/2)),y=Math.max(1,Math.min(innerHeight-1,(b.top+b.bottom)/2)),h=document.elementFromPoint(x,y);return{x,y,hit:h?.className||h?.tagName,text:h?.textContent?.trim().slice(0,40)}})()`);
    if (!point) return false;
    if (touch) {
      const touchPoint = [{ x: point.x, y: point.y, radiusX: 12, radiusY: 12, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoint }, tab.sessionId);
      await wait(60);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, tab.sessionId);
      await wait(300);
    } else {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, tab.sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, tab.sessionId);
    }
    return true;
  };
  const key = async (tab, value) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value === 'Escape' ? 'Escape' : value }, tab.sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: value === 'Escape' ? 'Escape' : value }, tab.sessionId);
  };
  const capture = async (tab, name) => {
    if (!shotsDir) return;
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, tab.sessionId);
    fs.writeFileSync(path.resolve(ROOT, shotsDir, name), Buffer.from(shot.data, 'base64'));
  };

  try {
    for (const shape of shapes) {
      setCombatStartStateForTools({
        name: 'Fenn', hp: 60, block: 0,
        extraHand: ['ironSkin', 'rallyingBanner', 'rallyingBanner', 'ashOath'],
        ally: { name: 'Wren', hp: 60, block: 0 },
      });
      const server = await serve({ root: ROOT, port: port++, open: false, lan: true });
      const settings = encodeURIComponent(JSON.stringify({ textSize }));
      const base = `http://localhost:${server.port}/${captureBefore || standalone ? 'AshenSpire.html' : 'index.html'}?shotSettings=${settings}`;
      const host = await makeTab(shape);
      const guest = await makeTab(shape);
      console.log(`\n${shape.tag} Text ${textSize} real two-client friendly targeting`);
      const evidenceCell = shotsDir && ((shape.tag === '390x844' && textSize === 'XL') || (shape.tag === '1200x730' && textSize === 'M'));
      const evidenceCapture = async (state, label) => {
        if (!evidenceCell) return;
        await evaluate(guest, `(()=>{document.querySelector('.evidence-caption')?.remove();const n=document.createElement('div');n.className='evidence-caption';n.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;padding:6px 9px;background:#090806ee;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';n.textContent=${JSON.stringify(`${standalone ? 'SELECTED ROOT' : 'SOURCE'} · #209 · ${label} · ${shape.tag} · Text ${textSize}`)};document.body.appendChild(n);return true})()`);
        const textSuffix = textSize === 'M' ? '' : `-text-${textSize.toLowerCase()}`;
        await capture(guest, `friendly-target-after-${standalone ? 'root' : 'source'}-${state}-${shape.tag}${textSuffix}.png`);
      };
      try {
        await cdp.send('Page.navigate', { url: base }, host.sessionId);
        await until(host, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'host LAN door');
        await evaluate(host, click('#lan-play'));
        await until(host, `!!document.querySelector('#lb-name')`, 'host lobby');
        await evaluate(host, `(()=>{const n=document.querySelector('#lb-name');n.value='Wren';n.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#lb-host').click();return true})()`);
        await until(host, `document.querySelector('h2')?.textContent==='AT THE FIRE'`, 'host fire');

        await cdp.send('Page.navigate', { url: base }, guest.sessionId);
        await until(guest, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'guest LAN door');
        await evaluate(guest, click('#lan-play'));
        await until(guest, `!!document.querySelector('#lb-name')`, 'guest lobby');
        await evaluate(guest, `(()=>{const n=document.querySelector('#lb-name');n.value='Fenn';n.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
        await until(guest, `!!document.querySelector('.lb-join')`, 'guest sees host');
        await evaluate(guest, click('.lb-join'));
        await until(guest, `!!document.querySelector('#lb-ready')`, 'guest room');
        await evaluate(guest, `(()=>{const p=[...document.querySelectorAll('#lb-classes .class-pick')].find(x=>x.querySelector('h3')?.textContent==='Reaver');p?.click();return !!p})()`);
        await until(host, `document.querySelector('#lb-roster')?.textContent.includes('Reaver')`, 'host sees guest class');
        await evaluate(guest, click('#lb-ready'));
        await until(host, `!document.querySelector('#lb-start')?.disabled`, 'host sees ready');
        await evaluate(host, `(()=>{const n=document.querySelector('#lb-seed');n.value='FRIEND209';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#lb-start').click();return true})()`);
        await until(host, `!!document.querySelector('.mapscreen')`, 'host map');
        await until(guest, `!!document.querySelector('.mapscreen')`, 'guest map');
        await evaluate(host, click('.map-node.reachable'));
        await evaluate(guest, click('.map-node.reachable'));
        await until(guest, `!!document.querySelector('.combat.coop')`, 'guest combat');
        await until(guest, `[...document.querySelectorAll('.hand .card')].some(c=>c.textContent.includes('Oath of Ash'))`, 'friendly fixture cards');

        if (captureBefore) {
          await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Rallying Banner'));c?.click();return !!c})()`);
          await until(guest, `document.querySelectorAll('.coop-seat.throw-target').length===2`, 'pre-change generic target seats');
          const before = await evaluate(guest, `(()=>[...document.querySelectorAll('.coop-seat')].map(e=>({seat:e.dataset.seat,generic:e.classList.contains('throw-target'),friendly:e.dataset.friendlyTarget||null,focus:e.hasAttribute('data-focusable')})))()`);
          observed(before.length === 2 && before.every((entry) => entry.generic && !entry.friendly && !entry.focus), 'pre-change selected standalone reproduces generic all-seat targeting RED', JSON.stringify(before));
          if (shotsDir) {
            await evaluate(guest, `(()=>{const n=document.createElement('div');n.className='evidence-caption';n.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;padding:6px 9px;background:#090806ee;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';n.textContent='SELECTED ROOT BEFORE · #209 RED · Rallying Banner · generic gold on self + ally · no AX target state · ${shape.tag} · Text ${textSize}';document.body.appendChild(n);return true})()`);
            await capture(guest, `friendly-target-before-root-${shape.tag}${textSize === 'M' ? '' : `-text-${textSize.toLowerCase()}`}.png`);
          }
          continue;
        }

        // Mouse/touch door: self-only owns exactly one blue caster.
        const ironSelector = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Iron Skin'));if(!c)return null;c.dataset.friendlyProbe='iron';return '[data-friendly-probe="iron"]'})()`);
        observed(await activate(guest, ironSelector, shape.dpr > 1), shape.dpr > 1 ? 'touch arms a real self-only card' : 'mouse arms a real self-only card');
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'self-only targeting appears');
        const selfOnly = await evaluate(guest, `(()=>[...document.querySelectorAll('[data-friendly-target]')].map(e=>({seat:e.dataset.seat,rel:e.dataset.friendlyTarget,aria:e.getAttribute('aria-label'),focus:e.hasAttribute('data-focusable'),color:e.querySelector('.aim-silho')?.style.getPropertyValue('--target-color')})))()`);
        observed(selfOnly.length === 1 && selfOnly[0].rel === 'self' && selfOnly[0].focus && selfOnly[0].color === '#4d94e0', 'self-only blue caster and AX focus', JSON.stringify(selfOnly));
        await evidenceCapture('self', 'Iron Skin self-only · blue caster · AX target');
        await key(guest, 'Escape');
        const selfCancel = await evaluate(guest, `({targets:document.querySelectorAll('[data-friendly-target]').length,card:[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Iron Skin'))?.classList.contains('gp-focus')})`);
        observed(selfCancel.targets === 0 && selfCancel.card === true, 'Escape cancels without spend and restores exact card focus', JSON.stringify(selfCancel));
        await evidenceCapture('cancel', 'Cancel · no target markers · exact card focus restored');

        // A living, connected teammate who already ended remains a legal ally.
        await evaluate(host, click('#coop-endturn'));
        await until(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===s.party.find(m=>m.name==='Wren')?.id);return p?.ended===true})()`, 'ended teammate snapshot');

        // Mouse/touch ally arm/confirm: no self highlight.
        const bannerSelector = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Rallying Banner'));if(!c)return null;c.dataset.friendlyProbe='banner';return '[data-friendly-probe="banner"]'})()`);
        await activate(guest, bannerSelector, shape.dpr > 1);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'ally-only targeting appears');
        const ids = await evaluate(guest, `(()=>{const s=window.__coopSnapshot;return{actor:s.party.find(p=>p.name==='Fenn')?.id,ally:s.party.find(p=>p.name==='Wren')?.id}})()`);
        const allyOnly = await evaluate(guest, `(()=>[...document.querySelectorAll('[data-friendly-target]')].map(e=>({seat:e.dataset.seat,rel:e.dataset.friendlyTarget,color:e.querySelector('.aim-silho')?.style.getPropertyValue('--target-color')})))()`);
        observed(allyOnly.length === 1 && allyOnly[0].seat === ids.ally && allyOnly[0].rel === 'ally' && allyOnly[0].color === '#49b675', 'ally-only green legal ally excludes self', JSON.stringify(allyOnly));
        await evidenceCapture('ally', 'Rallying Banner ally-only · green ally · self excluded');
        await activate(guest, `[data-seat="${ids.ally}"]`, shape.dpr > 1);
        await until(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===${JSON.stringify(ids.ally)});return p?.block===10})()`, 'Rallying Banner server result');
        const banner = await evaluate(guest, `({targets:document.querySelectorAll('[data-friendly-target]').length,cards:[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Rallying Banner')).length})`);
        observed(banner.targets === 0 && banner.cards === 1, `${shape.dpr > 1 ? 'touch' : 'mouse'} confirm commits and spends exactly once`, JSON.stringify(banner));

        // Keyboard number arm reaches mixed blue/green, then Escape restores.
        const oathIndex = await evaluate(guest, `[...document.querySelectorAll('.hand .card')].findIndex(x=>x.textContent.includes('Oath of Ash'))`);
        const oathKey = oathIndex === 9 ? 'q' : String(oathIndex + 1);
        await key(guest, oathKey);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===2`, 'keyboard mixed targeting');
        const mixed = await evaluate(guest, `(()=>{const layer=document.querySelector('.fx-layer')?.getBoundingClientRect(),targets=[...document.querySelectorAll('[data-friendly-target]')].map(e=>{const r=e.getBoundingClientRect();return{seat:e.dataset.seat,rel:e.dataset.friendlyTarget,color:e.querySelector('.aim-silho')?.style.getPropertyValue('--target-color'),aria:e.getAttribute('aria-label'),onGlass:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}});return{targets,layer:!!layer}})()`);
        observed(mixed.targets.length === 2 && mixed.targets.some((t) => t.rel === 'self' && t.color === '#4d94e0') && mixed.targets.some((t) => t.rel === 'ally' && t.color === '#49b675') && mixed.targets.every((t) => t.aria && t.onGlass), 'keyboard mixed target relationship/AX/on-glass parity', JSON.stringify(mixed));
        await evidenceCapture('mixed', 'Oath of Ash mixed · self blue · ally green');
        // Standard-mapping gamepad shim: product poller receives B Cancel and
        // A Confirm through its public navigator.getGamepads door.
        await evaluate(guest, `(()=>{const pad={index:0,connected:true,mapping:'standard',id:'friendly-target parity pad',buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad,null,null,null]});window.__friendlyPad={lastKey:null,press(i){pad.buttons[i]={pressed:true,value:1}},release(i){pad.buttons[i]={pressed:false,value:0}}};addEventListener('keydown',e=>window.__friendlyPad.lastKey=e.key);dispatchEvent(new Event('gamepadconnected'));return true})()`);
        const padTap = async (button) => {
          await evaluate(guest, `window.__friendlyPad.press(${button})`); await wait(180);
          await evaluate(guest, `window.__friendlyPad.release(${button})`); await wait(180);
        };
        const focusBeforeMove = await evaluate(guest, `document.querySelector('.coop-seat.gp-focus')?.dataset.seat`);
        await padTap(15);
        const focusAfterMove = await evaluate(guest, `document.querySelector('.coop-seat.gp-focus')?.dataset.seat`);
        observed(!!focusBeforeMove && !!focusAfterMove && focusBeforeMove !== focusAfterMove, 'controller traverses the mixed legal target set', `${focusBeforeMove}→${focusAfterMove}`);
        await padTap(1);
        const padCancel = await evaluate(guest, `({targets:document.querySelectorAll('[data-friendly-target]').length,focused:[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Oath of Ash'))?.classList.contains('gp-focus'),lastKey:window.__friendlyPad.lastKey})`);
        observed(padCancel.targets === 0 && padCancel.focused === true, 'controller Cancel clears and restores card focus', JSON.stringify(padCancel));

        // Put the unified cursor on a self-only card through its public number
        // key, cancel it, then let the pad own arm + confirmation.
        const ironIndex = await evaluate(guest, `[...document.querySelectorAll('.hand .card')].findIndex(x=>x.textContent.includes('Iron Skin'))`);
        await key(guest, ironIndex === 9 ? 'q' : String(ironIndex + 1));
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'keyboard self-only arm');
        await key(guest, 'Escape');
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===0`, 'keyboard self-only cancel');
        await padTap(0);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'pad arms self-only card');
        await padTap(0);
        await until(guest, `![...document.querySelectorAll('.hand .card')].some(x=>x.textContent.includes('Iron Skin'))`, 'pad confirms one self target');
        const padCommit = await evaluate(guest, `(()=>{const s=window.__coopSnapshot.scene,actor=s.players.find(p=>p.id===${JSON.stringify(ids.actor)});return{targets:document.querySelectorAll('[data-friendly-target]').length,cards:[...document.querySelectorAll('.hand .card')].filter(x=>x.textContent.includes('Iron Skin')).length,energy:actor?.energy,block:actor?.block}})()`);
        observed(padCommit.targets === 0 && padCommit.cards === 0 && padCommit.energy === 1 && padCommit.block === 8, 'controller Confirm commits exactly once and clears markers', JSON.stringify(padCommit));

        // A real disconnect invalidates the remaining ally-only card and the
        // screen cannot leave a stale highlight, click target, or focus target.
        const spareSelector = await evaluate(guest, `(()=>{const c=[...document.querySelectorAll('.hand .card')].find(x=>x.textContent.includes('Rallying Banner'));if(!c)return null;c.dataset.friendlyProbe='spare-banner';return '[data-friendly-probe="spare-banner"]'})()`);
        await activate(guest, spareSelector, shape.dpr > 1);
        await until(guest, `document.querySelectorAll('[data-friendly-target]').length===1`, 'spare ally card arms before disconnect');
        await cdp.send('Target.closeTarget', { targetId: host.targetId });
        await until(guest, `(()=>{const s=window.__coopSnapshot,p=s.scene.players.find(x=>x.id===${JSON.stringify(ids.ally)});return !p?.connected})()`, 'away teammate snapshot');
        const away = await evaluate(guest, `({targets:document.querySelectorAll('[data-friendly-target]').length,focusable:document.querySelectorAll('.coop-seat[data-focusable]').length,selected:[...document.querySelectorAll('.hand .card')].some(x=>x.textContent.includes('Rallying Banner')&&x.classList.contains('selected'))})`);
        observed(away.targets === 0 && away.focusable === 0 && away.selected === false, 'away teammate clears highlight/focus/click target and spends nothing', JSON.stringify(away));
      } finally {
        await cdp.send('Target.closeTarget', { targetId: host.targetId }).catch(() => {});
        await cdp.send('Target.closeTarget', { targetId: guest.targetId }).catch(() => {});
        server.server.closeAllConnections?.();
        await new Promise((resolve) => server.server.close(resolve));
      }
    }
  } finally {
    cdp.close();
    await closeBrowser();
  }
  if (findings.length) throw new Error(`browser parity failed (${findings.length}): ${findings.join('; ')}`);
}

if (process.argv.includes('--browser')) {
  try { await browserDoor(); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
