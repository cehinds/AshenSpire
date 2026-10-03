// tools/quick-start-inputs.mjs — how many inputs does a new player spend between
// the Title and their first card play? (docs/FINISH.md §6: a quick start gives
// the first card play in 6 inputs or fewer; the full route measured 26.)
//
// A SCRIPTED INPUT COUNT, WITH REAL INPUT. A real headless Chromium boots the
// source tree with empty durable storage (a genuinely new player), and every
// input the script spends is a real CDP mouse click at the control's own
// screen coordinates or a real key press — never el.click(). Each one is
// counted and named, so a reader can audit the route line by line.
//
// It walks two routes and prints both counts:
//   quick    — Title -> Quick start -> (opening sequence, if it plays) -> a fight
//              on the map -> the first card play. JUDGED against BUDGET below,
//              the number the FINISH line states.
//   baseline — the full character-creation route (New -> slot -> Start ->
//              class -> Next -> stat mode -> keepsake -> Next -> armour ->
//              Choose -> Next… -> Begin -> Skip opening -> fight -> card play),
//              the same selectors tools/tutorial-reach.mjs walks. REPORTED, not
//              judged: it is the comparison the FINISH line names.
//
// What counts as one input: one mouse click (press + release) or one key press.
// A native <select> changed from the keyboard is counted as 2 (open, pick).
// The startup gate's Enter counts: it is the first thing the Title asks for.
// "First card play" is read from the fight itself:
// `window.__combat.player.counters.cardsPlayedThisCombat` goes from 0 to 1.
//
//   node tools/quick-start-inputs.mjs                 (both routes, judge quick)
//   node tools/quick-start-inputs.mjs --only quick    (the judged route alone)
//   CHROME=/path/to/chrome node tools/quick-start-inputs.mjs
//
// Exit 0 when the quick route is within budget, 1 when it is not or a route
// fails, 2 when no browser or no check ran (never a pass).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// docs/FINISH.md §6: "A quick start gives the first card play in 6 inputs or
// fewer (baseline 26)." The acceptance number, not a game setting.
const BUDGET = 6;
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const ROUTES = ['quick', 'baseline'];
const only = argOf('--only');
if (args.includes('--only') && !ROUTES.includes(only)) {
  console.error(`quick-start-inputs: --only takes one of ${ROUTES.join(', ')}; got ${JSON.stringify(only)}`);
  process.exit(2);
}
const want = (name) => !only || only === name;

const fails = [];
let passedCount = 0;
const ok = (cond, msg) => { console.log(`    ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); else passedCount += 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`));
      else res(msg.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function main() {
  if (!browserPath) { console.error('quick-start-inputs: no Chrome/Chromium found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const { server, port } = await serve({ root: ROOT, port: 8247, open: false });
  const base = `http://localhost:${port}/`;
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'qsinputs-', browser: browserPath,
    args: ['--window-size=1440,860', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S);
  await cdp.send('Runtime.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S);

  const evalIn = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (expr, label, timeoutMs = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await evalIn(expr)) return true;
      await wait(120);
    }
    throw new Error(`timeout: ${label}`);
  };

  // THE COUNTER. Every input the script spends goes through `spend`.
  let inputs = [];
  const spend = (label, n = 1) => { for (let i = 0; i < n; i += 1) inputs.push(label); };
  const clickAt = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, S);
    }
    await wait(300);
  };
  const click = async (sel, label) => {
    const pt = await evalIn(`(() => {
      const e = document.querySelector(${JSON.stringify(sel)});
      if (!e) return null;
      const before = e.getBoundingClientRect();
      if (before.bottom > innerHeight || before.top < 0) e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!pt) throw new Error(`no element for ${label} (${sel})`);
    spend(label);
    await clickAt(pt.x, pt.y);
  };
  const pressKey = async (key, code, keyCode, label) => {
    spend(label);
    for (const type of ['keyDown', 'keyUp']) {
      await cdp.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, S);
    }
    await wait(150);
  };

  const freshBoot = async () => {
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`document.readyState === 'complete'`, 'the page');
    await evalIn(`(() => { localStorage.clear(); return true; })()`);
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`!!(document.querySelector('.startup-gate') || document.querySelector('.title-menu .slot-new'))`, 'the startup gate or the title');
    inputs = [];
    if (await evalIn(`!!document.querySelector('.startup-gate')`)) await pressKey('Enter', 'Enter', 13, 'the startup gate (Enter)');
    await until(`!!document.querySelector('.title-menu .slot-new')`, 'the title screen');
    await wait(300);
  };

  // From wherever a new climb lands (the opening or the map) to the first card play.
  const toFirstCardPlay = async () => {
    await until(`!!(document.querySelector('.prologue-screen') || document.querySelector('.map-node.reachable'))`, 'the opening sequence or the map');
    if (await evalIn(`!!document.querySelector('.prologue-screen')`)) {
      const marked = await evalIn(`(() => {
        const b = [...document.querySelectorAll('.prologue-screen .prologue-controls button')].find((c) => !c.hidden && /skip/i.test(c.textContent));
        if (!b) return false;
        b.dataset.qsSkip = 'true';
        return true;
      })()`);
      if (!marked) throw new Error('the opening sequence offers no Skip');
      await click('[data-qs-skip="true"]', 'Skip opening');
    }
    await until(`!!document.querySelector('.map-node.monster.reachable')`, 'a reachable fight on the map');
    await click('.map-node.monster.reachable', 'a fight on the map');
    // A map node may ask to be confirmed; answer whatever the board asks, and count it.
    for (let guard = 0; guard < 4 && !(await evalIn(`!!window.__combat && !!document.querySelector('.hand .card')`)); guard += 1) {
      const confirm = await evalIn(`(() => {
        const b = document.querySelector('.confirmation-modal .confirmation-confirm, .map-tray [data-map-action="enter"]:not([disabled]), .map-enter:not([disabled])');
        if (!b) return false;
        b.dataset.qsConfirm = 'true';
        return true;
      })()`);
      if (confirm) await click('[data-qs-confirm="true"]', 'confirm the fight');
      else await wait(600);
    }
    await until(`!!window.__combat && !!document.querySelector('.hand .card.type-attack:not(.unaffordable)')`, 'the first fight with a playable attack');
    await wait(800);
    const played = () => evalIn(`window.__combat?.player?.counters?.cardsPlayedThisCombat || 0`);
    ok((await played()) === 0, 'the fight opens with no card played');
    await click('.hand .card.type-attack:not(.unaffordable)', 'an attack card');
    await until(`!!document.querySelector('.enemy-row .enemy.targetable')`, 'targeting armed', 5000);
    await click('.enemy-row .enemy.targetable', 'its target');
    await until(`(window.__combat?.player?.counters?.cardsPlayedThisCombat || 0) >= 1`, 'the first card play', 8000);
    ok(true, 'the first card was played');
  };

  const report = (name) => {
    console.log(`    ${name}: ${inputs.length} inputs`);
    inputs.forEach((label, i) => console.log(`      ${String(i + 1).padStart(2)}. ${label}`));
    return inputs.length;
  };

  const counts = {};
  if (want('quick')) {
    console.log('\n  quick route: Title -> Quick start -> first card play (fresh profile, 1440x900)');
    await freshBoot();
    ok(await evalIn(`!!document.querySelector('.title-menu [data-title-action="quick-start"]:not([disabled])')`), 'the Title offers Quick start');
    await click('.title-menu [data-title-action="quick-start"]', 'Quick start');
    await toFirstCardPlay();
    counts.quick = report('quick');
    ok(counts.quick <= BUDGET, `quick start reaches the first card play in ${counts.quick} inputs (budget ${BUDGET})`);
  }

  if (want('baseline')) {
    console.log('\n  baseline route: Title -> New -> character creation -> Begin -> first card play (fresh profile, 1440x900)');
    await freshBoot();
    await click('.title-menu .slot-new', 'New');
    await until(`!!document.querySelector('[data-title-action="modal-continue"]:not([disabled])')`, 'the new-slot picker');
    await click('[data-title-action="modal-continue"]', 'slot picker Continue');
    await until(`!!document.querySelector('[data-title-action="review-new"]:not([disabled])')`, 'the new-slot decision door');
    await click('[data-title-action="review-new"]', 'Start in this slot');
    await until(`!!document.querySelector('#cz-classes .cz-class')`, 'the Class stage');
    const openFace = async (key) => {
      await until(`!!document.querySelector('[data-face="${key}"]')`, `the ${key} fold`);
      if (!(await evalIn(`document.querySelector('[data-face="${key}"]')?.closest('details')?.open === true`))) await click(`[data-face="${key}"]`, `open the ${key} fold`);
    };
    await click('#cz-classes .cz-class', 'a class');
    await click('#cz-next', 'Next (to Character)');
    await until(`!!document.querySelector('#cz-statedit .cc-mode-select')`, 'the Character stage');
    await openFace('primary');
    spend('stat mode select (open, pick)', 2);
    await evalIn(`(() => { const s = document.querySelector('#cz-statedit .cc-mode-select'); s.value = 'lean'; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
    await openFace('keepsake');
    await click('#cz-keepsakes [data-keepsake-id]', 'a keepsake');
    await click('#cz-next', 'Next (to Starting equip)');
    await until(`document.querySelector('#cz-tab-equipment')?.getAttribute('aria-selected') === 'true'`, 'the Starting equip stage');
    await openFace('armour');
    await click('#cz-armours .equip-chip .equipment-poker-card', 'an armour');
    await click('#cz-armours .equip-chip .equipment-choose', 'Choose armour');
    for (let step = 0; step < 8; step += 1) {
      if (await evalIn(`document.querySelector('#cz-tab-review')?.getAttribute('aria-selected') === 'true'`)) break;
      await click('#cz-next', 'Next (towards Review)');
    }
    await until(`(() => { const b = document.querySelector('#cz-start'); return !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; })()`, 'Begin accepting the finished character', 5000);
    await click('#cz-start', 'BEGIN THE CLIMB');
    await toFirstCardPlay();
    counts.baseline = report('baseline');
  }

  cdp.close();
  await dropBrowser();
  server.close();

  if (!fails.length && passedCount === 0) {
    console.error('quick-start-inputs: 0 checks ran — an empty run is not a pass.');
    process.exit(2);
  }
  console.log(`\n  counts: ${JSON.stringify(counts)}`);
  console.log(`${passedCount} passed, ${fails.length} failed`);
  console.log('  boundary: real Chromium headless against the source server at 1440x900, mouse and Enter only,');
  console.log('  a fresh profile with the shipped defaults (slot 1 empty). Not checked: touch or gamepad input,');
  console.log('  a profile whose every slot is full (Quick start then asks before replacing), or other browsers.');
  if (fails.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
