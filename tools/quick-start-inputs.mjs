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
//              the number the FINISH line states. Run twice: once on the random
//              seed a player gets, once pinned to SKILLS_ONLY_SEED, whose
//              opening hand holds no attack. It also checks the fresh Title's
//              default focus is Quick start (the keyboard/controller route).
//   baseline — the full character-creation route (New -> slot -> Start ->
//              class -> Next -> stat mode -> keepsake -> Next -> armour ->
//              Choose -> Next… -> Begin -> Skip opening -> fight -> card play),
//              the same selectors tools/tutorial-reach.mjs walks. REPORTED, not
//              judged: it is the comparison the FINISH line names.
// After the quick route it also begins an ordinary climb on the same profile
// and checks the opening plays (Quick start records nothing as seen).
//
// What counts as one input: one mouse click (press + release) or one key press.
// A native <select> is driven as a player would: a click to open it, one
// ArrowDown per option moved, Enter to commit, each counted; its value is read
// back from the control, never set by the script.
// The startup gate's Enter counts: it is the first thing the Title asks for.
// "First card play" is read from the fight itself:
// `window.__combat.player.counters.cardsPlayedThisCombat` goes from 0 to 1.
//
//   node tools/quick-start-inputs.mjs                 (both routes, judge quick)
//   node tools/quick-start-inputs.mjs --only quick    (the judged route alone)
//   node tools/quick-start-inputs.mjs --only quick --quick-seed 8   (pin the first pass's seed)
//   CHROME=/path/to/chrome node tools/quick-start-inputs.mjs
//
// Exit 0 when the quick route is within budget, 1 when it is not or a route
// fails, 2 when no browser or no check ran (never a pass).

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

// docs/FINISH.md §6: "A quick start gives the first card play in 6 inputs or
// fewer (baseline 26)." The acceptance number, not a game setting.
const BUDGET = 6;
// A seed whose shuffled Reaver opening hand holds only skills (Defend, Dodge
// Roll, Brace…), found with --quick-seed. The skills-only pass pins it.
const SKILLS_ONLY_SEED = 190;
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const ROUTES = ['quick', 'baseline'];
const only = argOf('--only');
const pinSeed = argOf('--quick-seed') == null ? null : Number(argOf('--quick-seed'));
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
    await until(`!!(document.querySelector('.prologue-screen') || document.querySelector('.class-mastery-node') || document.querySelector('.map-node.reachable'))`, 'the opening sequence, class tree or map');
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
    if (await evalIn(`!!document.querySelector('.class-mastery-node')`)) await click('.class-mastery-node', 'a tier 1 class-tree node');
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

  const report = (name) => {
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
    const openFace = async (key) => {
      await until(`!!document.querySelector('[data-face="${key}"]')`, `the ${key} fold`);
      if (!(await evalIn(`document.querySelector('[data-face="${key}"]')?.closest('details')?.open === true`))) await click(`[data-face="${key}"]`, `open the ${key} fold`);
    };
    await click('#cz-classes .cz-class', 'a class');
    await click('#cz-next', 'Next (to Character)');
    await until(`!!document.querySelector('#cz-statedit .cc-mode-select')`, 'the Character stage');
    await openFace('primary');
    await chooseStatMode('lean');
    await openFace('keepsake');
    await click('#cz-keepsakes [data-keepsake-id]', 'a keepsake');
    await click('#cz-next', 'Next (to Starting equip)');
    await until(`document.querySelector('#cz-tab-equipment')?.getAttribute('aria-selected') === 'true'`, 'the Starting equip stage');
    await openFace('armour');
    await click('#cz-armours .equip-chip .equipment-poker-card', 'an armour');
    await click('#cz-armours .equip-chip .equipment-choose', 'Choose armour');
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

  // Quick start draws a fresh seed with Math.random (main.js randomSeedString:
  // seedToString((Math.random() * 0xffffffff) >>> 0)). To pin one, the next
  // Math.random call alone returns the value that maps to `seed`; the real one
  // is put back at once. The seed the run got is then read from its save.
  const pinNextSeed = (seed) => evalIn(`(() => {
    const real = Math.random;
    Math.random = () => { Math.random = real; return (${seed} + 0.5) / 0xffffffff; };
    return true;
  })()`);
  const savedSeed = () => evalIn(`(() => {
    for (const k of Object.keys(localStorage)) {
      if (!/^sote_run_v1(_s\\d+)?$/.test(k)) continue;
      try { const r = JSON.parse(localStorage.getItem(k)); const run = r.run || r; if (run.seed != null || run.seedString) return { seed: run.seed ?? null, seedString: run.seedString ?? null }; } catch {}
    }
    return null;
  })()`);

  const counts = {};
  if (want('quick')) {
    console.log('\n  quick route: Title -> Quick start -> first card play (fresh profile, 1440x900)');
    await freshBoot();
    ok(await evalIn(`!!document.querySelector('.title-menu [data-title-action="quick-start"]:not([disabled])')`), 'the Title offers Quick start');
    // A keyboard or controller player presses nothing to reach it: after the
    // startup gate's Enter the Title's default focus is Quick start, so the
    // next Enter / A press is the Quick start press this route counts.
    ok(await evalIn(`document.activeElement?.dataset?.titleAction === 'quick-start'`), `a fresh profile's Title focuses Quick start (focused: ${await evalIn(`document.activeElement?.dataset?.titleAction || document.activeElement?.id || document.activeElement?.tagName || null`)})`);
    if (pinSeed != null) await pinNextSeed(pinSeed);
    await click('.title-menu [data-title-action="quick-start"]', 'Quick start');
    await toFirstCardPlay();
    console.log(`    opening hand: ${lastHand.types.join(', ')}`);
    counts.quick = report('quick');
    ok(counts.quick <= BUDGET, `quick start reaches the first card play in ${counts.quick} inputs (budget ${BUDGET})`);

    // THE SKILLS-ONLY OPENING, pinned. Quick start's seed is random, and a
    // legal Reaver opening can hold no attack at all; the route above meets
    // whichever hand the seed deals. This pass pins a seed known to deal only
    // skills, so the path that plays a non-attack card is exercised on every
    // run instead of on one run in several.
    console.log(`\n  quick route, skills-only opening hand (seed pinned to ${SKILLS_ONLY_SEED})`);
    await freshBoot();
    await pinNextSeed(SKILLS_ONLY_SEED);
    await click('.title-menu [data-title-action="quick-start"]', 'Quick start');
    await toFirstCardPlay();
    console.log(`    opening hand: ${lastHand.types.join(', ')}`);
    const pinned = await savedSeed();
    ok(pinned?.seed === SKILLS_ONLY_SEED, `the pinned run was dealt seed ${SKILLS_ONLY_SEED} (saved: ${JSON.stringify(pinned)})`);
    ok(!lastHand.types.includes('type-attack'), `seed ${SKILLS_ONLY_SEED} still opens with no attack in hand (if this fails, the deal changed: pick another skills-only seed with --quick-seed and update SKILLS_ONLY_SEED)`);
    counts.quickSkillsOnly = report('quick, skills-only hand');
    ok(counts.quickSkillsOnly <= BUDGET, `quick start with a skills-only hand reaches the first card play in ${counts.quickSkillsOnly} inputs (budget ${BUDGET})`);
    // Back to the first pass's profile shape for the opening check below: one
    // quick-start climb in slot 1, nothing recorded as seen.

    // The changelog's promise: Quick start skips the opening for its own climb
    // only and records nothing as seen, so the same profile's next ordinary
    // climb (New -> character creation -> Begin) still plays it. Not counted.
    // The shipped playback is "every", which plays the opening whatever was
    // recorded; the profile is switched to "once" so the check reads the
    // recorded prologueSeen and fails if the quick path ever writes it.
    console.log('\n  after a quick start: the next ordinary climb on the same profile still plays the opening (playback "once")');
    const seenAfterQuick = await evalIn(`(() => {
      const meta = JSON.parse(localStorage.getItem('sote_meta_v1') || '{}');
      const seen = meta.settings?.prologueSeen === true;
      meta.settings = { ...(meta.settings || {}), 'gameConfig.prologue.presentation.playback': 'once' };
      const json = JSON.stringify(meta);
      localStorage.setItem('sote_meta_v1', json);
      localStorage.setItem('sote_meta_backup_v1', json);
      return seen;
    })()`);
    ok(!seenAfterQuick, 'a quick start records the opening as not seen');
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`!!(document.querySelector('.startup-gate') || document.querySelector('.title-menu .slot-new'))`, 'the startup gate or the title (same profile)');
    if (await evalIn(`!!document.querySelector('.startup-gate')`)) await pressKey('Enter', 'Enter', 13, 'the startup gate (Enter)');
    await until(`!!document.querySelector('.title-menu .slot-new')`, 'the title screen (same profile)');
    await wait(300);
    await createAndBegin();
    await until(`!!(document.querySelector('.prologue-screen') || document.querySelector('.map-node.reachable'))`, 'the opening sequence or the map (ordinary climb)');
    ok(await evalIn(`!!document.querySelector('.prologue-screen')`), 'the next ordinary climb after a quick start plays the opening');
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
  server.close();

  if (!fails.length && passedCount === 0) {
    console.error('quick-start-inputs: 0 checks ran — an empty run is not a pass.');
    process.exit(2);
  }
  console.log(`\n  counts: ${JSON.stringify(counts)}`);
  console.log(`${passedCount} passed, ${fails.length} failed`);
  console.log('  boundary: real Chromium headless against the source server at 1440x900, mouse clicks, Enter and ArrowDown only,');
  console.log('  a fresh profile with the shipped defaults (slot 1 empty). Not checked: touch or gamepad input,');
  console.log('  a profile whose every slot is full (Quick start then asks before replacing), or other browsers.');
  if (fails.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
