#!/usr/bin/env node
// tools/motion-probe.mjs — stationary rest and reduced motion, measured in a real
// browser (docs/FINISH.md §5 "Resting fighters stay still", §9 "Reduced motion is
// proven in a browser").
//
//   node tools/motion-probe.mjs              the checks below; exit 0 green, 1 red
//   node tools/motion-probe.mjs --selftest   same-door plants (tools/doorplant.mjs)
//   node tools/motion-probe.mjs --selftest --shard i/n   only the plants at index i mod n
//   node tools/motion-probe.mjs --seed S     another fixed seed (default MOTION1)
//   node tools/motion-probe.mjs --dump       also list every animation and scripted change
//
// The boot is `?shot=combat&shotSeed=<seed>`: newRun and the first monster
// node entered the way the map enters it, on the shot boot's memory storage.
//
//   IDLE <who>    every combatant (players and enemies) draws at least one
//                 visible (laid out with area, effective opacity above 0),
//                 loaded figure image (an <img> with pixels, or the
//                 Classic style's drawn <svg>). Default rear canvases keep a
//                 painted, fixed anchor/scale/rest pose over twenty frames;
//                 every other rendering style also holds its visible loaded
//                 image/SVG/canvas still. Twenty RAF samples reject displaced
//                 bounds, active translation/scale/rotation and changed canvas
//                 pixels. Status/aura opacity feedback remains independent.
//   CONTROL       with motion on, the same sampler over the same turn sees a
//                 finite CSS animation, a CSS transition and an Element.animate()
//                 call over the limit, so a green REDUCED line is not a blind
//                 sampler.
//   TURN <mode>   one full turn was played: a card landed on an enemy, End
//                 Turn was held, the enemies acted and the next turn is back
//                 in hand. A hand with no Attack (a seed's opening hand can be
//                 all Skills) is passed with End Turn, up to DRAW_TURNS times,
//                 until one is drawn; the sampled turn is the one that plays.
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
// motion and is not counted. A CSS animation or transition that starts and
// ends between two frames is caught by its animationend/transitionend event,
// whose elapsedTime is the same active duration.
//
// Canvas script motion is compared using a 32-pixel thumbnail each frame;
// changes below that resolution or entirely between frames remain unseen.
// BOUNDARY: a CSS animation or transition that is started and cancelled
// between two frames (no frame sees it, no end event fires) is not measured;
// nor is motion from a video or canvases outside the alternative card stage.
// The card stage is sampled through its final painted pixels. Other script motion is seen as
// writes to an element's inline style or an image's src when it has a layout
// box. Display-none elements (including hidden ancestors) and detached nodes
// cannot paint and do not count; zero opacity
// and transformed/offscreen boxes still count so fades and travel stay tested.
// A timer or rAF loop that moves an element by toggling CLASSES (static rules, no transition) is
// not seen. No combat code moves that way today (its flipbooks and tweens
// write src/style: presentationSequence.js, combatantEffectLayers.js, the
// pose animators), so the observer does not watch `class`, whose ordinary
// state toggles (selected, hover, turn state) would read as motion.
// tests/motion-probe-boundary.test.mjs pins this line to the observer's
// attributeFilter, so widening one without the other fails.
// An idle carrier "moves" when its
// running animation's keyframes are not all the same value; the probe does
// not measure on-screen pixels.

import { pointerTargetExpression } from './pointer-target.mjs';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
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
// A cold local art cache can take longer than CI's mounted source tree. This
// opt-in changes only boot readiness, never action deadlines or motion limits.
const BOOT_TIMEOUT_MS = Math.max(20000, Math.min(120000, Number(process.env.MOTION_BOOT_TIMEOUT_MS) || 20000));
const ALTERNATIVE = existsSync(new URL('../src/ui/alternativeArt.js', import.meta.url));
const argv = process.argv.slice(2);
const CLASSIC = argv.includes('--classic'); // style-specific negatives boot the actual Classic appearance
const SEED = argv.includes('--seed') ? argv[argv.indexOf('--seed') + 1] : 'MOTION1';
const DUMP = argv.includes('--dump'); // print every animation and scripted change seen

if (argv.includes('--selftest')) {
  const { doorSelftest, resolveShard } = await import('./doorplant.mjs');
  // Count the harness's own verdict lines: each plant CAUGHT and the clean
  // copy CLEAN pass; anything else it prints as a verdict fails.
  let passed = 0, failed = 0;
  const tally = (write) => (...parts) => {
    const line = parts.join(' ');
    if (/^\s+(CAUGHT|CLEAN)\s/.test(line)) passed++;
    else if (/^\s*(UNCAUGHT|RED-FOR-WRONG-REASON|RED-NOT-EXIT|RED)\s/.test(line)) failed++;
    write(...parts);
  };
  console.log = tally(console.log.bind(console));
  console.error = tally(console.error.bind(console));
  const code = await doorSelftest({
    tool: 'motion-probe.mjs',
    timeoutMs: 240000,
    shard: resolveShard(),
    // The figure art. Without it an enemy's img errors and is replaced
    // (src/ui/assets.js), and the painted player's frames load broken (the
    // painted stage has no fallback), so the clean copy would check images
    // that draw nothing; IDLE goes red on an image that did not load. The
    // seed's Reaver fights in the sword-and-shield set's outfit frames.
    extraCopy: ['assets/enemy-poses', 'assets/enemy-states', 'assets/defeated-poses', 'assets/painted-outfits',
      'assets/animations/sword-shield-outfits', 'assets/cards', 'assets/card-components',
      'assets/player-polish/illustrations', 'assets/equipment', 'assets/fonts', 'music', 'map-detail',
      'assets/combat-effects', 'assets/animations/player-counter-sweep', ...(ALTERNATIVE ? ['assets-display'] : [])],
    plants: [
      {
        name: "a resting facing layer bobs",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n@keyframes sprite-idle { from { translate:0 0; scale:1; rotate:0deg; } to { translate:0 -4px; } }\n.combatant .sprite .facing { animation: sprite-idle 3.1s ease-in-out infinite alternate; }",
        expectRed: /RED IDLE(?:-classic)?(?: \w+#\d+)? — .*(?:moves while resting|idle animation)/,
      },
      {
        name: "the Rendered figure bobs",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n@keyframes sprite-idle { from { translate:0 0; scale:1; rotate:0deg; } to { translate:0 -4px; } }\n.combatant .sprite .rendered-stage { animation: sprite-idle 3.1s ease-in-out infinite alternate; }",
        expectRed: /RED IDLE-rendered(?: \w+#\d+)? — .*(?:moves while resting|idle animation)/,
      },
      {
        name: "the hidden Rendered rest layer bobs",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n@keyframes sprite-idle { from { translate:0 0; scale:1; rotate:0deg; } to { translate:0 -4px; } }\n.rendered-stage .painted-stage { animation: sprite-idle 3.1s ease-in-out infinite alternate; }",
        expectRed: /RED IDLE-rendered-STATIC-NESTED(?: \w+#\d+)? — .*(?:moves while resting|idle animation)/,
      },
      {
        name: "a figure image bobs inside a stationary stage",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n@keyframes sprite-idle { from { translate:0 0; scale:1; rotate:0deg; } to { translate:0 -4px; } }\n.combatant .sprite :is(img,svg,canvas) { animation: sprite-idle 3.1s ease-in-out infinite alternate; }",
        expectRed: /RED IDLE(?:-classic)?(?: \w+#\d+)? — .*(?:moves while resting|idle animation)/,
      },
      {
        name: "a resting figure scales",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n@keyframes sprite-idle { from { translate:0 0; scale:1; rotate:0deg; } to { scale:1.1; } }\n.combatant .sprite .facing { animation: sprite-idle 3.1s ease-in-out infinite alternate; }",
        expectRed: /RED IDLE(?:-classic)?(?: \w+#\d+)? — .*(?:moves while resting|idle animation)/,
      },
      {
        name: "the idle carriers are made transparent",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n.combatant .sprite :is(.facing,.pose-layer,.rendered-stage,.alternative-silhouette,.enemy-expansion-bob) { opacity:0 !important; }",
        expectRed: /RED IDLE \w+#\d+ — .*no visible figure image/,
      },
      {
        name: "the combatants are made transparent",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n.combatant { opacity:0 !important; }",
        expectRed: /RED IDLE \w+#\d+ — .*no visible figure image/,
      },
      {
        name: "a resting actor wrapper translates",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n@keyframes sprite-idle { from { translate:0 0; scale:1; rotate:0deg; } to { translate:4px 0; } }\n.combatant .sprite { animation: sprite-idle 3.1s ease-in-out infinite alternate; }",
        expectRed: /RED IDLE(?:-classic)?(?: \w+#\d+)? — .*(?:moves while resting|idle animation)/,
      },
      {
        name: "a resting figure rotates",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n@keyframes sprite-idle { from { translate:0 0; scale:1; rotate:0deg; } to { rotate:5deg; } }\n.combatant .sprite .facing { animation: sprite-idle 3.1s ease-in-out infinite alternate; }",
        expectRed: /RED IDLE(?:-classic)?(?: \w+#\d+)? — .*(?:moves while resting|idle animation)/,
      },
      {
        name: "a companion shake moves resting art",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n.combatant .sprite .facing { animation: shake 3.1s infinite; }",
        expectRed: /RED IDLE(?:-classic)?(?: \w+#\d+)? — .*(?:moves while resting|idle animation)/,
      },
      {
        name: "the resting figure artwork is hidden",
        args: ['--classic'],
        file: 'styles/combat.css',
        find: "/* Fighters hold their authored resting pose in every rendering style. */",
        replace: "/* Fighters hold their authored resting pose in every rendering style. */\n.combatant .sprite :is(img,svg,canvas) { display:none !important; }",
        expectRed: /RED IDLE \w+#\d+ — .*no visible figure image/,
      },
      ...(ALTERNATIVE ? [{
        name: 'the class canvas paints no character pixels',
        file: 'src/ui/alternativeCardStage.js',
        find: "    auraRenderer.draw(ctx,source,filterFor(pose,playing?.sequence.action || playing?.action),left,top,width,height,{materialize,immutable:true,reuse:!!classSmash&&playing?.action==='smash'&&!clipping&&!reacting});ctx.restore();",
        replace: '    ctx.restore();',
        expectRed: /RED IDLE player#\d+ — .*canvas has no painted pixels/,
      }, {
        name: 'the class canvas ignores reduced motion',
        edits: [
          { file: 'src/ui/fx.js', find: '  if (!speed || reduced) {', replace: '  if (!speed) {' },
          { file: 'src/ui/alternativeCardStage.js',
            find: "import { reducedMotionRequested } from './motion.js';",
            replace: 'const reducedMotionRequested = () => false;' },
        ],
        expectRed: /RED REDUCED-SCRIPT setting\+os — .*canvas/,
      }, {
        name: 'the fixed rear stage gains an idle translation',
        file: 'styles/combat.css',
        find: '/* Fighters hold their authored resting pose in every rendering style. */',
        replace: '/* Fighters hold their authored resting pose in every rendering style. */\n@keyframes sprite-idle { from { translate:0 0; } to { translate:0 -4px; } }\n.combatant .sprite > .alternative-card-stage { animation: sprite-idle 3.1s ease-in-out infinite; }',
        expectRed: /RED IDLE player#\d+ — .*fixed rest/,
      }, {
        name: 'the fixed rear stage changes scale while resting',
        file: 'styles/combat.css',
        find: '/* Fighters hold their authored resting pose in every rendering style. */',
        replace: '/* Fighters hold their authored resting pose in every rendering style. */\n@keyframes broken-rear-scale { from { transform: scale(1); } to { transform: scale(1.1); } }\n.combatant .sprite > .alternative-card-stage { animation: broken-rear-scale 1s linear infinite alternate; }',
        expectRed: /RED IDLE player#\d+ — .*fixed rest/,
      }] : []),
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
        // #1475 review: an animation just over the limit finishes between two
        // frames, so only its end event sees it.
        name: 'the OS preference shortens CSS animations to 11 ms, not 0.01 ms',
        file: 'styles/base.css',
        find: '@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-duration: 0.01ms !important;',
        replace: '@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-duration: 11ms !important;',
        expectRed: /RED REDUCED os — .*CSSAnimation .* \(11 ms/,
      },
      {
        // #1475 review: seed T14's opening hand is four Skills, so the turn
        // is passed until an Attack is drawn. This plant runs there (and so
        // does its own clean copy), proving that drive still plays a card.
        name: 'the card-play flight (Element.animate) ignores reduced motion',
        args: ['--seed', 'T14'],
        file: 'src/ui/screens/combat.js',
        find: "    if (readSettings().showPlayedCard !== true || reducedMotionRequested()) return;",
        replace: "    if (readSettings().showPlayedCard !== true) return;",
        expectRed: /RED REDUCED setting\+os — .*card-flight/,
      },
      {
        // A timer flipbook: force the active timeline through its reduced-speed
        // gate and lift the actual effect gate. Alternative silhouettes have
        // no pose attachment host, so their six-frame effect uses
        // playCombatEffect's fallback overlay instead of combatant-effect-layer.
        // Each branch must expose its real src swaps.
        name: 'the combatant effect flipbook runs under reduced motion',
        edits: [
          { file: 'src/ui/fx.js', find: '  const timing = actionPacing({ reduced: reducedMotionRequested() });', replace: '  const timing = actionPacing({ reduced: false });' },
          ALTERNATIVE ? { file: 'src/ui/combatEffectSprites.js',
            find: " if(!layer||!from||reducedMotionRequested()||document.body.classList.contains('reduce-flashes'))return ()=>{};",
            replace: " if(!layer||!from||document.body.classList.contains('reduce-flashes'))return ()=>{};" }
            : { file: 'src/ui/combatantEffectLayers.js',
              find: " if(!stage||reducedMotionRequested()||document.body.classList.contains('reduce-flashes'))return null;",
              replace: " if(!stage||document.body.classList.contains('reduce-flashes'))return null;" },
        ],
        expectRed: ALTERNATIVE ? /RED REDUCED-SCRIPT setting\+os — .*painted-combat-effect/
          : /RED REDUCED-SCRIPT setting\+os — .*combatant-effect-layer/,
      },
    ],
  });
  // The one counted verdict line (tools/verdict.mjs reads it bare).
  console.info(`${passed} passed, ${failed} failed`);
  process.exit(code || (failed ? 1 : 0));
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
  // What the frame poll already recorded, per element and name, as the
  // Animation instance, so an end event for that same run does not log it
  // twice. A later run of the same name on the same element is a different
  // instance (or has no polled entry) and is logged.
  let polled = new WeakMap();
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
    const t = a.effect && a.effect.target;
    if (t) { let k = polled.get(t); if (!k) polled.set(t, k = new Map()); k.set(kind + ':' + name, a); }
    log.push({ kind, name, via, active: active === Infinity ? 'Infinity' : Number(active) || 0,
      target: describe(a.effect && a.effect.target), at: Math.round(performance.now()) });
  };
  // A CSS animation or transition that starts and finishes between two
  // frames is never in getAnimations(); its end event still fires, and its
  // elapsedTime is the active duration it ran (iterations x duration for
  // animationend, the duration for transitionend). One that is cancelled
  // between two frames is not seen (BOUNDARY in the header).
  const ended = (kind, nameOf) => (e) => {
    const t = e.target, key = kind + ':' + nameOf(e), name = nameOf(e);
    const k = polled.get(t), run = k && k.get(key);
    // The polled run is the one ending only when it has finished; a polled
    // run that was cancelled or replaced is not this one.
    if (k) k.delete(key);
    if (run && run.playState === 'finished') return;
    log.push({ kind, name, via: e.type + ' event', active: Number(e.elapsedTime) * 1000 || 0,
      target: describe(t), at: Math.round(performance.now()) });
  };
  addEventListener('animationend', ended('CSSAnimation', (e) => e.animationName), true);
  addEventListener('transitionend', ended('CSSTransition', (e) => e.propertyName), true);
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
    // Hidden compact-HUD labels still receive stage positioning updates, but
    // updating their future anchor cannot animate pixels. Do not exempt zero
    // opacity or transformed boxes: those can be steps of a visible tween.
    if (!el.getClientRects().length) return;
    let c = changes.get(el);
    if (!c) { c = { frames: new Set(), times: [], what: new Set() }; changes.set(el, c); }
    if (!c.frames.has(frames)) c.times.push(Math.round(performance.now()));
    c.frames.add(frames); c.what.add(what);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target;
      // An assignment of the value already there moves nothing.
      if (r.attributeName === 'src') { if (el.getAttribute('src') !== r.oldValue) note(el, 'src'); continue; }
      const st = el.style; if (!st) continue;
      const now = MOTION_PROPS.map((p) => st.getPropertyValue(p)).join('|');
      // The first write seen is compared with the style before it (the
      // record's old value), so a tween's first step counts too.
      let was = lastStyle.get(el);
      if (was === undefined) {
        const probe = document.createElement('i');
        probe.setAttribute('style', r.oldValue || '');
        was = MOTION_PROPS.map((p) => probe.style.getPropertyValue(p)).join('|');
      }
      lastStyle.set(el, now);
      if (was !== now) note(el, 'style');
    }
  }).observe(document, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['style', 'src'] });
  // Compare final painted pixels, rather than repeated draw calls. A still
  // canvas can be redrawn without moving; a changed frame is script motion.
  const thumbnail = document.createElement('canvas');
  thumbnail.width = thumbnail.height = 32;
  const thumbnailContext = thumbnail.getContext('2d', { willReadFrequently: true });
  const lastPixels = new WeakMap(), canvasErrors = new Set();
  const sampleCanvas = (canvas) => {
    try {
      if (!thumbnailContext) throw new Error('no 2D sampling context');
      thumbnailContext.clearRect(0, 0, 32, 32);
      thumbnailContext.drawImage(canvas, 0, 0, 32, 32);
      const pixels = thumbnailContext.getImageData(0, 0, 32, 32).data;
      let hash = 2166136261;
      for (const pixel of pixels) hash = Math.imul(hash ^ pixel, 16777619);
      const prior = lastPixels.get(canvas);
      if (prior !== undefined && prior !== hash) note(canvas, 'canvas pixels');
      lastPixels.set(canvas, hash);
    } catch (error) { canvasErrors.add(String(error.message)); }
  };
  const tick = () => {
    frames++;
    for (const canvas of document.querySelectorAll('.alternative-card-stage canvas')) sampleCanvas(canvas);
    for (const a of document.getAnimations()) record(a, 'getAnimations');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__motionProbe = {
    reset() { log.length = 0; frames = 0; changes.clear(); canvasErrors.clear(); polled = new WeakMap(); for (const a of document.getAnimations()) seen.delete(a); },
    read() {
      for (const a of document.getAnimations()) record(a, 'getAnimations');
      const scripted = [...changes].map(([el, c]) => ({ target: describe(el), frames: c.frames.size, times: c.times, what: [...c.what].join('+') }))
        .sort((a, b) => b.frames - a.frames);
      return { frames, log: log.slice(), scripted, canvasErrors: [...canvasErrors] };
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

async function until(evaluate, expression, what, ms = 20000, onWait = null) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await evaluate(expression)) return true;
    if(onWait)await onWait();
    await wait(100);
  }
  throw new Error(`timed out after ${ms} ms waiting for ${what}; screen ${JSON.stringify(await evaluate(`({url:location.href,text:document.body.innerText.slice(0,1200),combat:!!window.__combat,sampler:!!window.__motionProbe})`))}`);
}

async function boot({ send, evaluate }, base, { setting, os, classic = CLASSIC }) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: os ? 'reduce' : 'no-preference' }] });
  const settings = encodeURIComponent(JSON.stringify({ reducedMotion: setting, showPlayedCard: true, classicAppearance: classic }));
  await send('Page.navigate', { url: `${base}?shot=combat&shotSeed=${encodeURIComponent(SEED)}&shotSettings=${settings}` });
  await wait(300);
  await until(evaluate, `!!(window.__combat && window.__motionProbe && document.querySelector('.combatant.enemy') && document.querySelector('.hand .card') && document.querySelector('.end-turn') && !document.querySelector('.end-turn').disabled)`, 'combat to mount', BOOT_TIMEOUT_MS);
  // The applied setting is the app's own, read back from the page.
  const applied = await evaluate(`({ cls: document.body.classList.contains('reduced-motion'), os: matchMedia('(prefers-reduced-motion: reduce)').matches, appearance: document.documentElement.dataset.displayAppearance })`);
  if (applied.cls !== setting || applied.os !== os) throw new Error(`reduced motion did not apply as asked: wanted setting=${setting} os=${os}, page has class=${applied.cls} media=${applied.os}`);
  if (applied.appearance !== (classic ? 'classic' : 'alternative')) throw new Error('The requested display appearance did not apply');
  await wait(800);
}

const point = (evaluate, selector) => evaluate(pointerTargetExpression(selector));

async function press({ send, evaluate }, selector, holdMs = 0) {
  const at = await point(evaluate, selector);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, button: 'left', clickCount: 1 });
  if (holdMs) await wait(holdMs);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, button: 'left', clickCount: 1 });
}

const ATTACK_IN_HAND = `(async () => {
  const { resolveCombatCard } = await import('/src/engine/combatExpansion.js');
  const { hasImmediateHostileDamage } = await import('/tools/click-impact-card.mjs');
  const combat = window.__combat;
  const c = [...document.querySelectorAll('.hand .card:not(.unaffordable)')].find(node => {
    const inst = combat.piles.hand.find(card => card.instanceId === node.dataset.instanceId);
    return inst && hasImmediateHostileDamage(resolveCombatCard(combat, inst), { targeted: true });
  });
  return c ? c.dataset.cardId : null;
})()`;
// Turns the probe may end without playing while it waits for an Attack to be
// drawn (a seed whose opening hand is all Skills; #1475 review).
const DRAW_TURNS = 4;

// End the player's turn and wait for the next one to come back to the hand.
async function endTurn(s, turn) {
  await until(s.evaluate, `!!document.querySelector('.end-turn') && !document.querySelector('.end-turn').disabled`, 'End Turn to be ready');
  await press(s, '.end-turn', 1200);
  await until(s.evaluate, `window.__combat.turn > ${turn} && !document.querySelector('.end-turn').disabled`, `turn ${turn + 1} to return to the player`, 30000, async()=>{
    const decline='.reaction-choice [data-control-role="exit"]';
    if(await s.evaluate(`!!document.querySelector(${JSON.stringify(decline)})`))await press(s,decline);
  });
}

// One full turn: play the first attack in hand on the first living enemy, hold
// End Turn, wait for the enemies to act and the next turn to come back to the
// player. A hand with no Attack is passed (End Turn, no card) until one is
// drawn; the sampled turn starts with that hand.
async function playTurn(s) {
  const { evaluate } = s;
  let attack = await evaluate(ATTACK_IN_HAND), passed = 0;
  for (; !attack; passed++) {
    if (passed >= DRAW_TURNS) throw new Error(`no attack card in hand after ${DRAW_TURNS} turn(s) passed`);
    await endTurn(s, await evaluate('window.__combat.turn'));
    await until(evaluate, `document.querySelectorAll('.hand .card').length === window.__combat.piles.hand.length && window.__combat.piles.hand.length > 0`, 'the new hand to be drawn');
    attack = await evaluate(ATTACK_IN_HAND);
  }
  await evaluate('window.__motionProbe.reset()');
  const before = await evaluate(`({ turn: window.__combat.turn, hand: window.__combat.piles.hand.length,
    targetId: window.__combat.enemies.find(enemy => enemy.alive)?.id,
    hp: window.__combat.enemies.reduce((t, e) => t + (e.hp || 0) + (e.block || 0), 0) })`);
  if (!before.targetId) throw new Error('no living enemy for the sampled attack');
  // Use the same living enemy's legal input surface: the picker when shown,
  // or the targetable battlefield frame when the current target HUD owns it.
  const targetSelectorExpression = `(() => {
    const id = CSS.escape(${JSON.stringify(before.targetId)});
    const picker = '.enemy-target-picker:not([hidden]) .enemy-target-button[data-eid="' + id + '"]:not([disabled])';
    return document.querySelector(picker) ? picker
      : '.combat[data-target-hud="true"] .combatant.enemy.targetable[data-eid="' + id + '"]:not([inert])';
  })()`;
  // Select the card, then the target. A press that lands while the board is
  // still settling can be read as a hover; the pair is retried, never forced.
  for (let attempt = 1; ; attempt++) {
    await press(s, `.hand .card[data-card-id="${attack}"]`);
    await wait(300);
    await until(evaluate, `!!document.querySelector(${targetSelectorExpression})`, 'the selected legal enemy target to be ready');
    await press(s, await evaluate(targetSelectorExpression));
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
  await endTurn(s, before.turn);
  await wait(800);
  const sample = await evaluate('window.__motionProbe.read()');
  return { attack, passed, landed: afterPlay < before.hp, turn: await evaluate('window.__combat.turn'), ...sample };
}

const passedNote = (t) => (t.passed ? ` (after ${t.passed} turn(s) passed with no Attack in hand)` : '');

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

// Rear canvases have an authored fixed resting body, not a CSS idle bob.
// Sample the real stage AND canvas boxes/pose over twenty frames. A painted,
// stationary wrapper cannot vouch for a blank or independently moving canvas.
// Pixels are read at the first and last sample of each rest window only;
// transient internal painting between those samples remains outside this gate.
async function fixedRest({ evaluate }, label, baseline = []) {
  const samples = await evaluate(`(async () => {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const MOVE = ['translate','transform','scale','rotate','top','bottom','left','right','inset','marginTop','marginBottom','marginLeft','marginRight','offsetDistance'];
    const measure = (pixels = false) => [...document.querySelectorAll('.combatant:not(.dead):not(.down)')].flatMap((frame,i) => {
      const stage = frame.querySelector('.sprite .alternative-card-stage');
      if (!stage) return [];
      const canvas = stage.querySelector('canvas');
      let alpha = 1, visible = !!canvas, displacing = false;
      for (let el = canvas; el; el = el.parentElement) {
        const style = getComputedStyle(el);
        alpha *= Number(style.opacity);
        if (style.display === 'none' || style.visibility !== 'visible') visible = false;
        displacing ||= el.getAnimations().some(a => a.playState === 'running' && a.effect
          && new Set(a.effect.getKeyframes().map(k => JSON.stringify(MOVE.map(p => k[p] ?? null)))).size > 1);
      }
      const s = stage.getBoundingClientRect(), c = canvas?.getBoundingClientRect();
      visible &&= alpha > 0 && s.width > 0 && s.height > 0 && c?.width > 0 && c?.height > 0;
      let painted = null, fingerprint = null;
      if (pixels && canvas) {
        try { const data = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          painted = data.some((value,index) => index % 4 === 3 && value > 0);
          fingerprint = 2166136261;
          for (const value of data) fingerprint = Math.imul(fingerprint ^ value,16777619) >>> 0;
        } catch { painted = false; }
      }
      return [{ id: frame.dataset.eid || 'actor-'+i,
        who: (frame.classList.contains('player') ? 'player' : 'enemy')+'#'+i,
        visible,painted,fingerprint,displacing,pose:stage.dataset.pose,rest:stage.dataset.rest,stance:stage.dataset.stance,
        bounds:[s.left,s.top,s.width,s.height,c?.left,c?.top,c?.width,c?.height] }];
    });
    const out = [measure(true)];
    for (let i=0;i<20;i++) { await new Promise(r => requestAnimationFrame(r)); out.push(measure(i===19)); }
    return out;
  })()`);
  const first = samples[0];
  check(first.length > 0, `${label}-FIXED-BOARD`, 'the Default appearance has an authored rear canvas');
  for (const owner of first) {
    const previous = baseline.find(value => value.id === owner.id);
    const final = samples.at(-1).find(value => value.id === owner.id);
    const geometry = (a,b) => a.bounds.every((value,index) => Number.isFinite(value)
      && Number.isFinite(b.bounds[index]) && Math.abs(value-b.bounds[index]) <= .05);
    const stable = samples.every(frame => {
      const current = frame.find(value => value.id === owner.id);
      return current && current.visible && !current.displacing && geometry(owner,current)
        && current.pose === owner.pose && current.rest === owner.rest && current.stance === owner.stance;
    });
    const resting = owner.pose === 'ready' || owner.pose === 'guard-brace' || owner.pose?.startsWith('stance-');
    const pixelsStable = final?.painted && final.fingerprint === owner.fingerprint;
    const detail = !owner.painted || !final?.painted ? 'canvas has no painted pixels' : !owner.visible ? 'no visible figure image to animate'
      : !resting || !stable || !pixelsStable || previous && !geometry(previous,owner) ? 'fixed rest anchor, scale, pose or painted pixels changed'
        : 'painted canvas holds its fixed rest anchor, scale and pose across twenty frames';
    check(owner.painted && owner.visible && pixelsStable && resting && stable && (!previous || geometry(previous,owner)),
      `${label} ${owner.who}`, detail);
  }
  return first;
}

// Every living combatant retains loaded, visible, stationary figure art at rest.
// Sample actual image/canvas bounds and canvas pixels, independently of the
// wrapper's geometry; a static outer box cannot vouch for moving inner art.
async function idle({ evaluate }, label, policy = {}) {
  const { excludeCanvases = false } = typeof policy === 'string' ? {} : policy;
  const samples = await evaluate(`(async () => {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const MOVE = ['translate','transform','scale','rotate','top','bottom','left','right','inset','marginTop','marginBottom','marginLeft','marginRight','offsetDistance'];
    const tag = el => el.tagName.toLowerCase() + [...el.classList].slice(0,2).map(k => '.'+k).join('');
    const measure = (pixels = false) => [...document.querySelectorAll('.combatant')].map((c,i) => {
      const fixedCanvas = ${excludeCanvases} && !!c.querySelector('.sprite .alternative-card-stage canvas');
      const imgs = [...c.querySelectorAll('.sprite img, .sprite svg, .sprite canvas')].filter(img => {
        if (${excludeCanvases} && img.closest('.alternative-card-stage')) return false;
        if (img.tagName.toLowerCase() === 'svg' && (img.parentElement.closest('svg') || img.closest('[aria-hidden="true"]'))) return false;
        const box=img.getBoundingClientRect();
        let visible=true,alpha=1;
        for(let el=img;el;el=el.parentElement) {
          const cs=getComputedStyle(el);alpha*=Number(cs.opacity);
          visible &&= cs.visibility==='visible' && cs.display!=='none';
        }
        return visible && alpha>0 && box.width>0 && box.height>0
          && !img.classList.contains('defeated-frame') && !img.classList.contains('pose-previous');
      });
      return {who:(c.classList.contains('player')?'player':c.classList.contains('enemy')?'enemy':'combatant')+'#'+i,
        dead:c.classList.contains('dead')||c.classList.contains('down'),fixedCanvas,name:c.querySelector('.nm')?.textContent?.trim()||'',
        imgs:imgs.map(img => {
          const box=img.getBoundingClientRect();let moving=false,painted=null,fingerprint=null;
          for(let el=img;el;el=el.parentElement) moving ||= el.getAnimations().some(a => a.playState==='running' && a.effect
            && new Set(a.effect.getKeyframes().map(k=>JSON.stringify(MOVE.map(p=>k[p]??null)))).size>1);
          if(pixels && img.tagName==='CANVAS') {
            try {const data=img.getContext('2d').getImageData(0,0,img.width,img.height).data;
              painted=data.some((v,i)=>i%4===3&&v>0);fingerprint=2166136261;
              for(const value of data)fingerprint=Math.imul(fingerprint^value,16777619)>>>0;
            } catch {painted=false;}
          }
          return {img:tag(img),src:img.tagName==='IMG'?(img.getAttribute('src')||''):'',moving,painted,fingerprint,
            loaded:img.tagName!=='IMG'||img.complete&&img.naturalWidth>0,
            bounds:[box.left,box.top,box.width,box.height]};
        })};
    });
    const out=[measure(true)];
    for(let i=0;i<20;i++){await new Promise(r=>requestAnimationFrame(r));out.push(measure(i===19));}
    return out;
  })()`);
  const figures=samples[0],last=samples.at(-1);
  for(const [index,f] of figures.entries()) {
    if(label!=='IDLE'&&f.dead || f.fixedCanvas)continue;
    const faults=[];
    for(const [imageIndex,image] of f.imgs.entries()) {
      const final=last[index]?.imgs[imageIndex];
      const stable=samples.every(frame=>{
        const current=frame[index]?.imgs[imageIndex];
        return current && current.loaded && !current.moving && current.src===image.src
          && current.bounds.every((v,i)=>Number.isFinite(v)&&Math.abs(v-image.bounds[i])<=.05);
      });
      if(!image.loaded || !final?.loaded)faults.push(`${image.img}: image did not load`);
      else if(image.painted===false || final?.painted===false)faults.push(`${image.img}: canvas has no painted pixels`);
      else if(!stable)faults.push(`${image.img}: figure moves while resting`);
      else if(image.fingerprint!==final?.fingerprint)faults.push(`${image.img}: canvas pixels changed while resting`);
    }
    if(samples.some(frame=>frame[index]?.imgs.length!==f.imgs.length))faults.push('visible figure art changed while resting');
    check(f.imgs.length>0 && faults.length===0,`${label} ${f.who}`,!f.imgs.length?`${f.name}: no visible figure image`
      :faults.length?`${f.name}: ${faults.join('; ')}`:`${f.name}: visible loaded figure holds still with stable painted content`);
  }
  return figures;
}

const server = await serve({ root: ROOT, port: 0, open: false });
const base = `http://localhost:${server.server.address().port}/`;
const browser = await launchBrowser({ prefix: 'motion-', headless: '--headless=new' });
let s;
try {
  s = await session(browser);

  // ---- §5: stationary visible rest in every style, motion on ----------------
  await boot(s, base, { setting: false, os: false });
  const fixedDefault = ALTERNATIVE && !CLASSIC;
  const resting = fixedDefault ? await fixedRest(s, 'IDLE') : [];
  const first = await idle(s, 'IDLE', { excludeCanvases: fixedDefault });
  const alternativeStageId = await s.evaluate(`document.querySelector('.combatant.player .sprite .alternative-card-stage')?.dataset.animationSet || null`);
  const expectedStageId = await s.evaluate('"class-cards-" + window.__combatRunForShot.class');
  if (fixedDefault) check(alternativeStageId === expectedStageId, 'IDLE-ALTERNATIVE-IDENTITY', 'the approved Default player art matches the current class');
  const players = first.filter((f) => f.who.startsWith('player')).length;
  const enemies = first.filter((f) => f.who.startsWith('enemy')).length;
  check(players >= 1 && enemies >= 1, 'IDLE-BOARD', `seed ${SEED}: ${players} player(s) and ${enemies} enemy(ies) on the board`);

  // ---- CONTROL: the sampler can see a long animation when motion is on ------
  const control = await playTurn(s);
  check(control.landed && control.turn >= 2, 'TURN motion-on', `${control.attack} landed${passedNote(control)}, turn ${control.turn}, ${control.frames} frames sampled`);
  const seen = long(control.log);
  if (DUMP) dump('motion-on', control);
  const kinds = { 'finite CSS animation': seen.find((a) => a.kind === 'CSSAnimation' && a.active !== 'Infinity'),
    'CSS transition': seen.find((a) => a.kind === 'CSSTransition'), 'Element.animate()': seen.find((a) => a.via === 'Element.animate') };
  const missing = Object.keys(kinds).filter((k) => !kinds[k]);
  check(missing.length === 0, 'CONTROL', `motion on: ${control.log.length} animation(s) seen, ${seen.length} over ${MAX_ACTIVE_MS} ms; `
    + (missing.length ? `never saw a ${missing.join(' or ')} over the limit — the sampler may be blind to it` : Object.entries(kinds).map(([k, a]) => `${k}: ${show(a)}`).join('; ')));
  if (fixedDefault) await fixedRest(s, 'IDLE-AFTER', resting);
  await idle(s, 'IDLE-AFTER', { excludeCanvases: fixedDefault });
  // Rest coverage includes the actual Classic appearance, independently of
  // Default's canvas. Guard/state changes must also settle without a bob.
  if (fixedDefault) {
    await boot(s, base, { setting: false, os: false, classic: true });
    await idle(s, 'IDLE');
    const classicTurn = await playTurn(s);
    check(classicTurn.landed && classicTurn.turn >= 2, 'TURN classic-rest', `${classicTurn.attack} landed${passedNote(classicTurn)}, turn ${classicTurn.turn}`);
    await idle(s, 'IDLE-AFTER');
  }
  // The other figure styles a player can choose (customize.js SPRITE_STYLES):
  // the run's customization is part of the player frame's art key, so a
  // render after changing it draws the player afresh in that style.
  for (const style of ['rendered', 'classic']) {
    const mark = style === 'rendered' ? '.rendered-stage' : 'svg';
    await s.evaluate(`(() => { const run = window.__combatRunForShot;
      run.customization = { ...(run.customization || {}), spriteStyle: ${JSON.stringify(style)} };
      window.__renderCombatForShot(); })()`);
    await until(s.evaluate, `!!document.querySelector(${JSON.stringify(`.combatant.player .sprite ${mark}`)})
      && [...document.querySelectorAll('.combatant.player .sprite img')].every((i) => i.complete)`, `the player redrawn in the ${style} style`);
    await wait(300);
    const drawn = await idle(s, `IDLE-${style}`);
    check(drawn.some((f) => f.who.startsWith('player')), `IDLE-${style}-BOARD`, `the player is on the board in the ${style} style`);
    if (style === 'rendered') {
      // A hidden nested Rendered stage must not retain a bob that starts
      // when the next guard/wounded/rest pose reveals it.
      const carrier = '.rendered-stage';
      const inner = await s.evaluate(`[...document.querySelectorAll(${JSON.stringify(`.combatant .sprite ${carrier} *`)})]
        .filter((el) => getComputedStyle(el).animationName.split(/,\\s*/).includes('sprite-idle'))
        .map((el) => el.tagName.toLowerCase() + '.' + [...el.classList].join('.'))`);
      check(inner.length === 0, 'IDLE-rendered-STATIC-NESTED', inner.length
        ? `an idle animation inside ${carrier}: ${inner.join(', ')}`
        : `${carrier} and its nested rest art have no idle bob`);
    }
  }
  check(control.canvasErrors.length === 0, 'CANVAS-SAMPLER', control.canvasErrors.join('; ') || 'painted canvas frames were sampled without read errors');
  const flipbooks = scripted(control.scripted);
  if (alternativeStageId) check(flipbooks.some((change) => change.target.startsWith('canvas') && change.what.includes('canvas pixels')), 'CONTROL-CANVAS', 'normal action playback changes the authored canvas pixels');
  check(flipbooks.length > 0, 'CONTROL-SCRIPT', `motion on: ${flipbooks.length} script-driven change burst(s) seen (e.g. ${flipbooks.slice(0, 3).map(showScripted).join('; ') || 'none'})`);

  // ---- §9: reduced motion, one full turn per way of asking -----------------
  for (const [mode, setting, os] of [['setting+os', true, true], ['setting', true, false], ['os', false, true]]) {
    await boot(s, base, { setting, os });
    const turn = await playTurn(s);
    check(turn.landed && turn.turn >= 2 && turn.frames > 30, `TURN ${mode}`, `${turn.attack} landed${passedNote(turn)}, turn ${turn.turn}, ${turn.frames} frames sampled, ${turn.log.length} animation(s) seen`);
    if (DUMP) dump(mode, turn);
    const over = long(turn.log);
    check(over.length === 0, `REDUCED ${mode}`, over.length
      ? `${over.length} animation(s) over ${MAX_ACTIVE_MS} ms: ${over.slice(0, 8).map(show).join('; ')}`
      : `nothing over ${MAX_ACTIVE_MS} ms across ${turn.log.length} animation(s)`);
    check(turn.canvasErrors.length === 0, `CANVAS-SAMPLER ${mode}`, turn.canvasErrors.join('; ') || 'painted canvas frames were sampled without read errors');
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
// The one counted verdict line (tools/verdict.mjs reads it bare).
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
