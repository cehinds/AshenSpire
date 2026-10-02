#!/usr/bin/env node
// tools/motion-probe.mjs — idle life and reduced motion, measured in a real
// browser (docs/FINISH.md §5 "The idle animation plays", §9 "Reduced motion is
// proven in a browser").
//
//   node tools/motion-probe.mjs              the checks below; exit 0 green, 1 red
//   node tools/motion-probe.mjs --selftest   same-door plants (tools/doorplant.mjs)
//   node tools/motion-probe.mjs --seed S     another fixed seed (default MOTION1)
//   node tools/motion-probe.mjs --dump       also list every animation and scripted change
//
// The boot is `?shot=combat&shotSeed=<seed>`: newRun and the first monster
// node entered the way the map enters it, on the shot boot's memory storage.
//
//   IDLE <who>    every combatant (players and enemies) draws at least one
//                 visible figure image, and every visible figure image has
//                 `getComputedStyle(img).animationName !== 'none'`.
//   CONTROL       with motion on, the same sampler over the same turn sees at
//                 least one animation longer than the limit, so a green
//                 REDUCED line below is not a blind sampler.
//   TURN <mode>   one full turn was played: a card landed on an enemy, End
//                 Turn was held, the enemies acted and turn 2 is back in hand.
//   REDUCED <mode> no animation `document.getAnimations()` returned on any
//                 frame of that turn — nor any `Element.animate()` call made
//                 during it — has an active duration over MAX_ACTIVE_MS.
//                 Modes: the Reduced motion setting with the OS preference
//                 emulated (`setting+os`), the setting alone, the OS alone.
//   REDUCED-SCRIPT <mode>  script-driven motion that never becomes an
//                 Animation object — a timer flipbook swapping an image's src,
//                 a rAF loop writing an inline transform/opacity/position —
//                 does not run either: no element changes SCRIPT_STEPS or more
//                 times inside SCRIPT_WINDOW_MS. CONTROL-SCRIPT proves the
//                 detector sees such bursts with motion on.
//
// Played Card is switched on (`showPlayedCard`) in every boot so the card's
// scripted flight (combat.js flyCard, Element.animate) is in the turn.
//
// "Active duration" is the Web Animations `getComputedTiming().activeDuration`
// (duration x iterations; an infinite animation is Infinity). A delay is not
// motion and is not counted.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

// FINISH §9's limit: "nothing over 0.01 s".
const MAX_ACTIVE_MS = 10;
// Script-driven motion with no Animation object (a timer flipbook, a rAF
// tween): SCRIPT_STEPS or more changes to one element inside SCRIPT_WINDOW_MS.
// Two is a state change and its return (a hurt pose shown, then idle again).
const SCRIPT_STEPS = 3;
const SCRIPT_WINDOW_MS = 1000;
const VIEWPORT = { width: 1440, height: 900 };
const argv = process.argv.slice(2);
const SEED = argv.includes('--seed') ? argv[argv.indexOf('--seed') + 1] : 'MOTION1';
const DUMP = argv.includes('--dump'); // print every animation and scripted change seen

if (argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const code = await doorSelftest({
    tool: 'motion-probe.mjs',
    timeoutMs: 240000,
    plants: [
      {
        name: 'the idle bob goes back to the dead `.sprite > img` selector',
        file: 'styles/combat.css',
        find: '.combatant .sprite :is(img.pose-frame, img.enemy-pose-idle) { animation: sprite-idle',
        replace: '.combatant .sprite > img { animation: sprite-idle',
        expectRed: /RED IDLE /,
      },
      {
        name: 'the Reduced motion setting stops shortening CSS animations',
        file: 'styles/base.css',
        find: '.reduced-motion, .reduced-motion *, .reduced-motion *::before, .reduced-motion *::after {\n  animation-duration: 0.01ms !important;',
        replace: '.reduced-motion, .reduced-motion *, .reduced-motion *::before, .reduced-motion *::after {\n  animation-delay: 0s;',
        expectRed: /RED REDUCED setting\b/,
      },
      {
        name: 'the OS preference stops shortening CSS animations',
        file: 'styles/base.css',
        find: '@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-duration: 0.01ms !important;',
        replace: '@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-delay: 0s;',
        expectRed: /RED REDUCED os\b/,
      },
      {
        name: 'the card-play flight (Element.animate) ignores reduced motion',
        file: 'src/ui/screens/combat.js',
        find: "    if (readSettings().showPlayedCard !== true || reducedMotionRequested()) return;",
        replace: "    if (readSettings().showPlayedCard !== true) return;",
        expectRed: /RED REDUCED setting\+os — .*card-flight/,
      },
      {
        name: 'the fx timeline plays its scripted beats under reduced motion',
        file: 'src/ui/fx.js',
        find: '  if (!speed || reduced) {',
        replace: '  if (!speed) {',
        expectRed: /RED REDUCED-SCRIPT setting\+os/,
      },
    ],
  });
  process.exit(code);
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const results = [];
const check = (ok, id, detail) => {
  results.push(ok);
  (ok ? console.log : console.error)(`${ok ? 'OK ' : 'RED'} ${id} — ${detail}`);
};

// Installed before any page script: every frame, every animation the document
// reports is recorded once; every Element.animate() call is recorded as made,
// so a JS animation created and cancelled between two frames is still seen.
const SAMPLER = `(() => {
  const seen = new WeakSet();
  const log = [];
  let frames = 0;
  const describe = (el) => {
    if (!el || !el.tagName) return String(el);
    const cls = typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls.trim().split(/\\s+/).slice(0, 3).join('.') : '');
  };
  const record = (a, via) => {
    if (!a || seen.has(a)) return;
    seen.add(a);
    let active = 0;
    try { active = a.effect ? a.effect.getComputedTiming().activeDuration : 0; } catch {}
    const kind = a.constructor && a.constructor.name;
    const name = a.animationName || a.transitionProperty || a.id || '(script)';
    log.push({ kind, name, via, active: active === Infinity ? 'Infinity' : Number(active) || 0,
      target: describe(a.effect && a.effect.target), at: Math.round(performance.now()) });
  };
  const nativeAnimate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    const a = nativeAnimate.apply(this, args);
    record(a, 'Element.animate');
    return a;
  };
  // Script-driven motion that never becomes an Animation object: a timer or
  // rAF loop writing an inline motion property, or swapping a flipbook image's
  // src, frame after frame. Counted as the distinct frames each element
  // changed on; one write (a layout settle, a pose swap) is not motion.
  const MOTION_PROPS = ['transform', 'translate', 'scale', 'rotate', 'opacity', 'left', 'top', 'clip-path'];
  const changes = new Map();
  const lastStyle = new WeakMap();
  const note = (el, what) => {
    let c = changes.get(el);
    if (!c) { c = { frames: new Set(), times: [], what: new Set() }; changes.set(el, c); }
    if (!c.frames.has(frames)) c.times.push(Math.round(performance.now()));
    c.frames.add(frames); c.what.add(what);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target;
      if (r.attributeName === 'src') { note(el, 'src'); continue; }
      const st = el.style; if (!st) continue;
      const now = MOTION_PROPS.map((p) => st.getPropertyValue(p)).join('|');
      const was = lastStyle.get(el);
      lastStyle.set(el, now);
      if (was !== undefined && was !== now) note(el, 'style');
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['style', 'src'] });
  const tick = () => {
    frames++;
    for (const a of document.getAnimations()) record(a, 'getAnimations');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__motionProbe = {
    reset() { log.length = 0; frames = 0; changes.clear(); for (const a of document.getAnimations()) seen.delete(a); },
    read() {
      for (const a of document.getAnimations()) record(a, 'getAnimations');
      const scripted = [...changes].map(([el, c]) => ({ target: describe(el), frames: c.frames.size, times: c.times, what: [...c.what].join('+') }))
        .sort((a, b) => b.frames - a.frames);
      return { frames, log: log.slice(), scripted };
    },
  };
})();`;

async function session(browser) {
  const ws = new WebSocket(browser.wsUrl);
  const pending = new Map();
  let id = 0;
  ws.onmessage = (event) => {
    const m = JSON.parse(event.data), call = pending.get(m.id);
    if (!call) return;
    pending.delete(m.id);
    m.error ? call.reject(new Error(m.error.message)) : call.resolve(m.result);
  };
  await new Promise((done, fail) => { ws.onopen = done; ws.onerror = fail; });
  const raw = (method, params = {}, sessionId) => new Promise((done, fail) => {
    const call = ++id;
    pending.set(call, { resolve: done, reject: fail });
    ws.send(JSON.stringify({ id: call, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => raw(method, params, sessionId);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SAMPLER });
  await send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
  return { ws, send, evaluate };
}

async function until(evaluate, expression, what, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await evaluate(expression)) return true;
    await wait(100);
  }
  throw new Error(`timed out after ${ms} ms waiting for ${what}`);
}

async function boot({ send, evaluate }, base, { setting, os }) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: os ? 'reduce' : 'no-preference' }] });
  const settings = encodeURIComponent(JSON.stringify({ reducedMotion: setting, showPlayedCard: true }));
  await send('Page.navigate', { url: `${base}?shot=combat&shotSeed=${encodeURIComponent(SEED)}&shotSettings=${settings}` });
  await wait(300);
  await until(evaluate, `!!(window.__combat && window.__motionProbe && document.querySelector('.combatant.enemy') && document.querySelector('.hand .card') && document.querySelector('.end-turn') && !document.querySelector('.end-turn').disabled)`, 'combat to mount');
  // The applied setting is the app's own, read back from the page.
  const applied = await evaluate(`({ cls: document.body.classList.contains('reduced-motion'), os: matchMedia('(prefers-reduced-motion: reduce)').matches })`);
  if (applied.cls !== setting || applied.os !== os) throw new Error(`reduced motion did not apply as asked: wanted setting=${setting} os=${os}, page has class=${applied.cls} media=${applied.os}`);
  await wait(800);
}

const point = (evaluate, selector) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) throw new Error('missing ' + ${JSON.stringify(selector)});
  el.scrollIntoView({ block: 'nearest' });
  const b = el.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
})()`);

async function press({ send, evaluate }, selector, holdMs = 0) {
  const at = await point(evaluate, selector);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, button: 'left', clickCount: 1 });
  if (holdMs) await wait(holdMs);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, button: 'left', clickCount: 1 });
}

// One full turn: play the first attack in hand on the first living enemy, hold
// End Turn, wait for the enemies to act and turn 2 to come back to the player.
async function playTurn(s) {
  const { evaluate } = s;
  await evaluate('window.__motionProbe.reset()');
  const before = await evaluate(`({ turn: window.__combat.turn, hand: window.__combat.piles.hand.length,
    hp: window.__combat.enemies.reduce((t, e) => t + (e.hp || 0) + (e.block || 0), 0) })`);
  const attack = await evaluate(`(() => { const c = document.querySelector('.hand .card.type-attack'); return c ? c.dataset.cardId : null; })()`);
  if (!attack) throw new Error('no attack card in the opening hand');
  // Select the card, then the target. A press that lands while the board is
  // still settling can be read as a hover; the pair is retried, never forced.
  for (let attempt = 1; ; attempt++) {
    await press(s, `.hand .card[data-card-id="${attack}"]`);
    await wait(300);
    await press(s, '.combatant.enemy:not(.dead)');
    try {
      await until(evaluate, `window.__combat.piles.hand.length < ${before.hand}`, `${attack} to leave the hand`, 3000);
      break;
    } catch (e) {
      if (attempt >= 3) {
        const why = await evaluate(`[...document.querySelectorAll('.modal, [role=dialog], .card.selected, .card.armed, .tooltip')].map((el) => el.className).join(' | ')`);
        throw new Error(`${e.message} (after ${attempt} tries; open: ${why || 'nothing'})`);
      }
      await press(s, '.combat-log, .enemy-row', 0).catch(() => {});
      await wait(500);
    }
  }
  await wait(1500);
  const afterPlay = await evaluate(`window.__combat.enemies.reduce((t, e) => t + (e.hp || 0) + (e.block || 0), 0)`);
  await until(evaluate, `!!document.querySelector('.end-turn') && !document.querySelector('.end-turn').disabled`, 'End Turn to be ready');
  await press(s, '.end-turn', 1200);
  await until(evaluate, `window.__combat.turn > ${before.turn} && !document.querySelector('.end-turn').disabled`, 'turn 2 to return to the player', 30000);
  await wait(800);
  const sample = await evaluate('window.__motionProbe.read()');
  return { attack, landed: afterPlay < before.hp, turn: await evaluate('window.__combat.turn'), ...sample };
}

const burst = (times) => {
  let most = 0;
  for (let i = 0, j = 0; j < times.length; j++) {
    while (times[j] - times[i] > SCRIPT_WINDOW_MS) i++;
    most = Math.max(most, j - i + 1);
  }
  return most;
};
const scripted = (list) => list.map((c) => ({ ...c, burst: burst(c.times) })).filter((c) => c.burst >= SCRIPT_STEPS);
const showScripted = (c) => `${c.target} (${c.what} changed ${c.burst} times within ${SCRIPT_WINDOW_MS} ms)`;
const dump = (mode, turn) => {
  console.log(`  [dump ${mode}]`);
  for (const a of turn.log) console.log(`    ${show(a)}`);
  for (const c of turn.scripted) console.log(`    scripted ${c.target} ${c.what} on ${c.frames} frame(s), burst ${burst(c.times)}`);
};
const long = (log) => log.filter((a) => a.active === 'Infinity' || a.active > MAX_ACTIVE_MS);
const show = (a) => `${a.kind} ${a.name} on ${a.target} (${a.active === 'Infinity' ? 'infinite' : `${Math.round(a.active)} ms`}, via ${a.via})`;

const server = await serve({ root: ROOT, port: 0, open: false });
const base = `http://localhost:${server.server.address().port}/`;
const browser = await launchBrowser({ prefix: 'motion-', headless: '--headless=new' });
let s;
try {
  s = await session(browser);

  // ---- §5: the idle animation plays on every combatant, motion on ----------
  await boot(s, base, { setting: false, os: false });
  const figures = await s.evaluate(`[...document.querySelectorAll('.combatant')].map((c, i) => {
    const who = (c.classList.contains('player') ? 'player' : c.classList.contains('enemy') ? 'enemy' : 'combatant') + '#' + i;
    const imgs = [...c.querySelectorAll('.sprite img')].filter((img) => {
      const cs = getComputedStyle(img);
      return cs.visibility === 'visible' && cs.display !== 'none' && !img.classList.contains('defeated-frame')
        && !img.classList.contains('pose-previous');
    });
    return { who, name: c.querySelector('.nm')?.textContent?.trim() || '', imgs: imgs.map((img) => ({ cls: img.className, anim: getComputedStyle(img).animationName })) };
  })`);
  const players = figures.filter((f) => f.who.startsWith('player')).length;
  const enemies = figures.filter((f) => f.who.startsWith('enemy')).length;
  check(players >= 1 && enemies >= 1, 'IDLE-BOARD', `seed ${SEED}: ${players} player(s) and ${enemies} enemy(ies) on the board`);
  for (const f of figures) {
    const still = f.imgs.filter((i) => i.anim === 'none');
    check(f.imgs.length > 0 && still.length === 0, `IDLE ${f.who}`,
      f.imgs.length === 0 ? `${f.name}: no visible figure image to animate`
        : still.length ? `${f.name}: animationName none on ${still.map((i) => `img.${i.cls.replace(/\s+/g, '.')}`).join(', ')}`
          : `${f.name}: ${f.imgs.map((i) => i.anim).join(', ')}`);
  }

  // ---- CONTROL: the sampler can see a long animation when motion is on ------
  const control = await playTurn(s);
  check(control.landed && control.turn >= 2, 'TURN motion-on', `${control.attack} landed, turn ${control.turn}, ${control.frames} frames sampled`);
  const seen = long(control.log);
  if (DUMP) dump('motion-on', control);
  check(seen.length > 0, 'CONTROL', `motion on: ${control.log.length} animation(s) seen, ${seen.length} over ${MAX_ACTIVE_MS} ms (e.g. ${seen.slice(0, 3).map(show).join('; ') || 'none'})`);
  const flipbooks = scripted(control.scripted);
  check(flipbooks.length > 0, 'CONTROL-SCRIPT', `motion on: ${flipbooks.length} script-driven change burst(s) seen (e.g. ${flipbooks.slice(0, 3).map(showScripted).join('; ') || 'none'})`);

  // ---- §9: reduced motion, one full turn per way of asking -----------------
  for (const [mode, setting, os] of [['setting+os', true, true], ['setting', true, false], ['os', false, true]]) {
    await boot(s, base, { setting, os });
    const turn = await playTurn(s);
    check(turn.landed && turn.turn >= 2 && turn.frames > 30, `TURN ${mode}`, `${turn.attack} landed, turn ${turn.turn}, ${turn.frames} frames sampled, ${turn.log.length} animation(s) seen`);
    if (DUMP) dump(mode, turn);
    const over = long(turn.log);
    check(over.length === 0, `REDUCED ${mode}`, over.length
      ? `${over.length} animation(s) over ${MAX_ACTIVE_MS} ms: ${over.slice(0, 8).map(show).join('; ')}`
      : `nothing over ${MAX_ACTIVE_MS} ms across ${turn.log.length} animation(s)`);
    const moving = scripted(turn.scripted);
    check(moving.length === 0, `REDUCED-SCRIPT ${mode}`, moving.length
      ? `${moving.length} script-driven animation(s): ${moving.slice(0, 8).map(showScripted).join('; ')}`
      : `no element changed ${SCRIPT_STEPS}+ times within ${SCRIPT_WINDOW_MS} ms (${turn.scripted.length} element(s) changed at all)`);
  }
} catch (e) {
  check(false, 'PROBE', `the drive did not finish: ${e.message}`);
} finally {
  s?.ws.close();
  await browser.close();
  server.server.closeAllConnections?.();
  await new Promise((done) => server.server.close(done));
}

const failed = results.filter((ok) => !ok).length;
console.log(`motion-probe: ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
