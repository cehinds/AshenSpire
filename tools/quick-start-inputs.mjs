// Count real native inputs from the default Core New Game menu to its first
// card play. --only quick remains the CI entry point; it names this shortest
// supported route, not a removed Quick Start menu control. --url checks a built
// standalone. Every click/key travels through CDP and is counted.

import { CORE_ENTRY_SEED, CORE_INPUT_ALLOWANCE, CORE_INPUT_BUDGET as BUDGET } from './core-entry-fixture.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { pointerTargetExpression } from './pointer-target.mjs';

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
  const externalUrl = argOf('--url');
  const hosted = externalUrl ? null : await serve({ root: ROOT, port: 8247, open: false });
  const server = hosted?.server;
  const base = externalUrl || `http://localhost:${hosted.port}/`;
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
  let lastHand = null;
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
      // Fighter centres may contain intent buttons; a card's centre can be
      // covered by a tooltip or neighbouring card. Use a visible hit point.
      const { x, y } = e.matches('.combatant, .hand .card') ? ${pointerTargetExpression(sel)}
        : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const hit = document.elementFromPoint(x, y);
      return { x, y, expected: e.textContent?.trim().slice(0, 100), hit: hit?.tagName + '.' + hit?.className, inside: !!hit && e.contains(hit) };
    })()`);
    if (!pt) throw new Error(`no element for ${label} (${sel})`);
    console.log(`      click ${label}: ${JSON.stringify(pt)}`);
    spend(label);
    await clickAt(pt.x, pt.y);
  };
  const pressKey = async (key, code, keyCode, label, modifiers = 0) => {
    spend(label);
    for (const type of ['keyDown', 'keyUp']) {
      await cdp.send('Input.dispatchKeyEvent', { type, key, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, S);
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

  const dismissFirstCombatTutorial = async () => {
    const visible = await evalIn(`(() => {
      const button = document.querySelector('.combat .tut-skip');
      if (!button || button.hidden || button.disabled) return false;
      const style = getComputedStyle(button), rect = button.getBoundingClientRect();
      return style.display !== 'none' && !['hidden', 'collapse'].includes(style.visibility)
        && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
    })()`);
    if (!visible) return false;
    // The first Stamina callout can cover a self target. Spend a real, counted
    // Skip before selecting a card; never hide the tutorial or change its flag.
    await click('.combat .tut-skip', 'Skip the first-combat tutorial');
    if (await evalIn(`!!document.querySelector('.combat .tut-skip')`)) {
      throw new Error('the native tutorial Skip did not close the tutorial');
    }
    return true;
  };

  // From wherever a new climb lands (the opening or the map) to the first card play.
  const toFirstCardPlay = async () => {
    // Walk the live entry rest, authored dungeon dialogue and map doors.
    // These are real controls, never engine calls or injected run state.
    for (let step = 0; step < 24; step += 1) {
      if (await evalIn(`!!window.__combat && !!document.querySelector('.hand .card')`)) break;
      const next = await evalIn(`(() => {
        const visible = n => { if (!n || n.hidden || n.disabled || n.getAttribute('aria-disabled') === 'true') return false; const r=n.getBoundingClientRect(); return r.width>0 && r.height>0 && n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)); };
        const pick = selector => [...document.querySelectorAll(selector)].find(visible);
        const direct = pick('#shrine-leave, #leave-shop, .prologue-screen .prologue-controls button, .confirmation-modal .confirmation-confirm, .map-tray [data-map-action="enter"], .map-enter');
        const node = direct || pick('.map-node.monster.reachable:not(.current)') || [...document.querySelectorAll('.map-node.reachable:not(.current):not(.visited)')].filter(visible).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left)[0];
        const dialogue = node || [...document.querySelectorAll('.dialogue-screen button, .event-screen button, .class-mastery-node')].find(visible);
        if (!dialogue) return null;
        document.querySelectorAll('[data-input-probe-next]').forEach(n => delete n.dataset.inputProbeNext);
        dialogue.dataset.inputProbeNext = 'true';
        return (dialogue.textContent || dialogue.getAttribute('aria-label') || dialogue.className).trim().slice(0,100);
      })()`);
      if (next) await click('[data-input-probe-next="true"]', next);
      else {
        if (step === 8) console.log('    route waiting:', await evalIn(`JSON.stringify({screens:[...document.querySelectorAll('main > *, #app > *')].map(n=>n.className),buttons:[...document.querySelectorAll('button')].filter(n=>n.getBoundingClientRect().width>0).map(n=>({text:n.textContent.slice(0,80),id:n.id,cls:n.className}))})`));
        await wait(500);
      }
    }
    // Any affordable card is a first card play. A shuffled opening hand can
    // hold no attack at all (Defend, Dodge Roll, Brace…), so the probe takes an
    // attack when the hand has one (the common route, counted the same as
    // before) and otherwise the first affordable card, and it clicks a target
    // only when the card arms targeting.
    await until(`!!window.__combat && !!document.querySelector('.hand .card:not(.unaffordable)')`, 'the first fight with a playable card');
    await wait(800);
    const played = () => evalIn(`window.__combat?.player?.counters?.cardsPlayedThisCombat || 0`);
    ok((await played()) === 0, 'the fight opens with no card played');
    await dismissFirstCombatTutorial();
    const kind = await evalIn(`(() => {
      const hand = [...document.querySelectorAll('.hand .card')];
      hand.forEach((c) => delete c.dataset.qsCard);
      const pick = hand.find((c) => c.classList.contains('type-attack') && !c.classList.contains('unaffordable')) || hand.find((c) => !c.classList.contains('unaffordable'));
      if (!pick) return null;
      pick.dataset.qsCard = 'true';
      return { attack: pick.classList.contains('type-attack'), types: hand.map((c) => [...c.classList].find((k) => k.startsWith('type-')) || '?') };
    })()`);
    if (!kind) throw new Error('no affordable card in the opening hand');
    lastHand = kind;
    await click('[data-qs-card="true"]', kind.attack ? 'an attack card' : 'a playable card (no attack in hand)');
    const t0 = Date.now();
    let targeted = false;
    // A selected card waits for its confirm (combat.js syncCardSelection): an
    // enemy-targeted card lights the targetable enemies, a self-targeted one
    // arms the player (`.combatant.player.armed`, "Play selected card on
    // yourself"). Whichever the board asks for is clicked, once, and counted.
    while (Date.now() - t0 < 5000 && (await played()) < 1) {
      const ask = targeted ? null : await evalIn(`document.querySelector('.combatant.player.armed') ? 'self' : document.querySelector('.enemy-row .enemy.targetable') ? 'enemy' : null`);
      if (ask === 'self') await click('.combatant.player.armed', 'play it on yourself');
      else if (ask === 'enemy') await click('.enemy-row .enemy.targetable', 'its target');
      else { await wait(120); continue; }
      targeted = true;
    }
    await until(`(window.__combat?.player?.counters?.cardsPlayedThisCombat || 0) >= 1`, 'the first card play', 8000);
    ok(true, 'the first card was played');
  };

  const counted = {}; // each route's numbered inputs, kept so a failure can print them again at the end
  const report = (name) => {
    counted[name] = [...inputs];
    console.log(`    ${name}: ${inputs.length} inputs`);
    inputs.forEach((label, i) => console.log(`      ${String(i + 1).padStart(2)}. ${label}`));
    return inputs.length;
  };

  // The full character-creation route, from the Title to BEGIN THE CLIMB.
  const createAndBegin = async () => {
    await click('.title-menu .slot-new', 'New');
    await until(`!!document.querySelector('[data-title-action="modal-continue"]:not([disabled])')`, 'the new-slot picker');
    await click('[data-title-action="modal-continue"]', 'slot picker Continue');
    await until(`!!document.querySelector('[data-title-action="review-new"]:not([disabled])')`, 'the new-slot decision door');
    await click('[data-title-action="review-new"]', 'Start in this slot');
    await until(`!!document.querySelector('#cz-classes .cz-class')`, 'the Class stage');
    // Core's authored creation has Class and Review only.
    // The staged flow (Class -> Attributes -> Keepsake -> Equipment -> Feats ->
    // Spells for casters -> Review). Each stage is the `.cz-railed` panel's
    // data-creation-stage; Next (#cz-next) is the one real click that leaves a
    // stage, and each stage is waited for by that attribute.
    const onStage = (stage) => `document.querySelector('.cz-railed')?.dataset.creationStage === '${stage}'`;
    const openFace = async (key) => {
      await until(`!!document.querySelector('[data-face="${key}"]')`, `the ${key} fold`);
      if (!(await evalIn(`document.querySelector('[data-face="${key}"]')?.closest('details')?.open === true`))) await click(`[data-face="${key}"]`, `open the ${key} fold`);
    };
    await click('#cz-classes .cz-class', 'a class');
    await click('#cz-next', 'Next (creation)');
    if (await evalIn(onStage('review'))) {
      await click('#seed-input', 'seed field');
      await pressKey('a', 'KeyA', 65, 'select seed text', 2);
      spend('type route seed', CORE_ENTRY_SEED.length);
      await cdp.send('Input.insertText', { text: CORE_ENTRY_SEED }, S);
      await click('#cz-start', 'Begin Core');
      return;
    }
    await until(`${onStage('attributes')} && !!document.querySelector('#cz-statedit .cc-mode-select')`, 'the Attributes stage');
    await chooseStatMode('lean');
    await click('#cz-next', 'Next (to Keepsake)');
    await until(onStage('keepsake'), 'the Keepsake stage');
    await click('#cz-keepsakes [data-keepsake-id]', 'a keepsake');
    await click('#cz-next', 'Next (to Equipment)');
    await until(onStage('equipment'), 'the Equipment stage');
    await openFace('armour');
    await click('#cz-armours .equip-chip .equipment-poker-card', 'an armour');
    // The armour's own Choose button is spent only when the stage shows it
    // (a card click may already have chosen the armour); the probe never
    // clicks an element it cannot see.
    if (await evalIn(`(() => { const b = document.querySelector('#cz-armours .equip-chip .equipment-choose'); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !b.disabled; })()`)) {
      await click('#cz-armours .equip-chip .equipment-choose', 'Choose armour');
    }
    for (let step = 0; step < 8; step += 1) {
      if (await evalIn(`document.querySelector('#cz-tab-review')?.getAttribute('aria-selected') === 'true'`)) break;
      if (await evalIn(`document.querySelector('[data-equipment-section="startingAbilities"]')?.closest('details')?.open === true`)) {
        while (await evalIn(`!!document.querySelector('.cc-ability-choose:not([aria-pressed="true"]):not([disabled])') && document.querySelector('#cz-next')?.getAttribute('aria-disabled') === 'true'`)) {
          await click('.cc-ability-choose:not([aria-pressed="true"]):not([disabled])', 'a starting ability');
        }
      }
      await click('#cz-next', 'Next (towards Review)');
    }
    await until(`(() => { const b = document.querySelector('#cz-start'); return !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; })()`, 'Begin accepting the finished character', 5000);
    await click('#cz-start', 'BEGIN THE CLIMB');
  };

  // The stat-mode <select>, driven with real input only. A real click on the
  // control focuses it and opens its popup; the popup's highlight starts on the
  // selected option and is not readable from the page, so the presses are
  // worked out from the options themselves (ArrowDown skips disabled ones):
  // one ArrowDown per enabled option between the current one and the wanted
  // one, then Enter to commit. Each is counted. The value is then read back
  // from the control, never written by the script.
  const chooseStatMode = async (wanted) => {
    const sel = '#cz-statedit .cc-mode-select';
    const read = () => evalIn(`(() => {
      const s = document.querySelector(${JSON.stringify(sel)});
      if (!s) return null;
      const opts = [...s.options];
      const target = opts.findIndex((o) => o.value === ${JSON.stringify(wanted)});
      const from = Math.max(0, s.selectedIndex);
      const downs = target < from ? -1 : opts.slice(from + 1, target + 1).filter((o) => !o.disabled).length;
      return { value: s.value, focused: document.activeElement === s, downs };
    })()`);
    await click(sel, 'stat mode select (open)');
    const start = await read();
    if (!start?.focused) throw new Error('the stat mode select did not take focus from a real click');
    if (start.downs < 0) throw new Error(`the stat mode select offers no ${wanted} below its current option`);
    for (let step = 0; step < start.downs; step += 1) await pressKey('ArrowDown', 'ArrowDown', 40, 'stat mode select (ArrowDown)');
    await pressKey('Enter', 'Enter', 13, 'stat mode select (Enter)');
    const end = await read();
    ok(end?.value === wanted, `the stat mode select reads ${JSON.stringify(wanted)} after real keyboard input (got ${JSON.stringify(end?.value)})`);
    if (end?.value !== wanted) throw new Error(`the stat mode select never reached ${wanted}`);
  };

  const counts = {};
  if (want('quick')) {
    console.log('\n  Core route: New Game -> Class/Review -> entry rest -> first card play');
    await freshBoot();
    ok(await evalIn(`document.activeElement?.matches('.title-menu .slot-new') === true`), 'a fresh title focuses New Game');
    ok(await evalIn(`!document.querySelector('.title-menu [data-title-action="quick-start"]')`), 'the default menu does not expose the retired Quick Start control');
    await createAndBegin();
    await toFirstCardPlay();
    counts.core = report('Core default');
    ok(counts.core <= BUDGET, `Core reaches first play in ${counts.core} inputs (budget ${BUDGET}: ${JSON.stringify(CORE_INPUT_ALLOWANCE)})`);
  }

  if (want('baseline')) {
    console.log('\n  baseline route: Title -> New -> character creation -> Begin -> first card play (fresh profile, 1440x900)');
    await freshBoot();
    await createAndBegin();
    await toFirstCardPlay();
    counts.baseline = report('baseline');
  }

  cdp.close();
  await dropBrowser();
  server?.close();

  if (!fails.length && passedCount === 0) {
    console.error('quick-start-inputs: 0 checks ran — an empty run is not a pass.');
    process.exit(2);
  }
  console.log(`\n  counts: ${JSON.stringify(counts)}`);
  console.log(`${passedCount} passed, ${fails.length} failed`);
  console.log('  boundary: real Chromium headless at 1440x900 against the supplied standalone or source server; counted native mouse and keyboard inputs,');
  console.log('  a fresh profile with the shipped defaults (slot 1 empty). Not checked: touch or gamepad input,');
  console.log('  occupied-slot replacement, touch, gamepad, other browsers, and optional detours are not checked.');
  if (fails.length) {
    // CI shows only the tail of this output as annotations, so a failure repeats what it
    // counted on one line at the very end: the whole numbered step list, not just the total.
    for (const f of fails) console.log(`  FAILED: ${f}`);
    for (const [name, list] of Object.entries(counted)) console.log(`  steps counted (${name}, ${list.length}): ${list.map((label, i) => `${i + 1}. ${label}`).join('; ')}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
