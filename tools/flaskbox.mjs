#!/usr/bin/env node
// tools/flaskbox.mjs — A FLASK THAT IS A CONTROL HAS ONE BOX, AND IT IS AT THE
// FLOOR. The rendered check on the flask CHIP, on every surface that draws one.
//
// WHY IT EXISTS, and the reason is the same shape as tools/placement.mjs's.
// Until 2026-08-17 the same flask, drawn as something a player TAPS, had three
// boxes and only one of the three declared anything. Measured at dev = b83bda1
// on the real boots, before a line changed:
//
//   .coop-flask   min-height: var(--tap-floor); height: auto   — the right one
//   .flask-slot   borrowed `.topbar .relic`'s width/height: 2.6rem
//                 -> 54.2 x 26.0 local px at 390x844 AND 1200x730, against a
//                 --tap-target of 44. 41% under the house floor, on the control
//                 a player spends a flask with, every fight. Its own quick-use
//                 keycap was drawn 5.8 px BELOW it, over the build stamp, with
//                 27% of the flask art under the cap.
//   .mh-flask     declared NOTHING. A bare <button>, so base.css's generic
//                 `padding: 1rem 2.6rem` sized it: 81.2 x 49.2 around a 20 px
//                 glyph, three times the relic chip beside it, and map.css told
//                 it `cursor: default` while it mounted an action menu.
//
// NO GREP FINDS THAT, WHICH IS THE POINT. tools/flaskpresentation.mjs reads all
// three of those files and passes — it reads SOURCE TEXT and two thirds of this
// defect is an ABSENCE. `tools/tapsize.mjs` owns the tap floor and names four
// selectors, none of them a flask. So the only instrument that could see it was
// a photograph, and this is that photograph turned into a predicate.
//
// WHAT IT CHECKS, per shape:
//   B1 FLOOR      every flask control's rendered box is at least the floor THE
//                 PAGE ITSELF resolves. The floor is MEASURED, never parsed: a
//                 probe element with `height: var(--tap-floor)` is appended and
//                 its offsetHeight read (tapsize.mjs's lesson — getPropertyValue
//                 hands back the literal `calc(...)`, and parseFloat of that is
//                 NaN printing as 0, which looks like a measurement).
//   B2 CONTAINED  nothing inside a flask control is drawn outside the control's
//                 own box. This is the keycap, and it is stated as containment
//                 rather than as a number so it cannot be satisfied by moving
//                 the badge somewhere else that also hangs out.
//   B3 ONE BOX    the flask control is the SAME HEIGHT on every surface that
//                 draws one. Law 0 clause 4 as a predicate: no threshold, no
//                 invented number — three surfaces, one answer, or red. This is
//                 the one that catches "the map flask is the generic button",
//                 which B1 alone cannot see (81 x 49 clears a 44 floor).
//
// AND ONE THING IT REPORTS AND REFUSES TO ASSERT: how it reached the map.
// `?shot=map` boots a FRESH run — main.js seeds `run.flasks` only inside its
// `combat || fx` branch — so the map's `.mh-flasks` mount is EMPTY BY
// PRECONDITION there, not by defect. That cost a night: the emptiness was
// carried as a named `unknown` and read as a missing feature. So this tool
// reaches the map the way a player does — ?shot=shop, buy the shelf, LEAVE —
// and prints which door it used. Whether main.js should also pose a flask on
// ?shot=map is a harness call and not this tool's to make.
//
// THE DOOR: the SOURCE TREE over http in headless Chromium (serve.mjs), every
// box read off getBoundingClientRect and converted to LOCAL px once before
// anything is compared. Synthesized DOM clicks, not CDP input — so this
// measures where a control IS, never whether a thumb can reach it
// (tools/actionreach.mjs, tools/screenreach.mjs own that).
//
// BOUNDARY: two viewports, 390x844 and 1200x730, at the DEFAULT settings.
// The settings sweep — Text S..XL must not move the box, Minimum tap size 24/44
// must — is measured but NOT asserted here; it is one shape of evidence in
// gamedesign/sunna/log/2026/2026-08-17_the-flask-that-had-three-boxes.md and it
// belongs with tapsize.mjs's dial if anyone wants it re-run.
//
//   node tools/flaskbox.mjs
//   node tools/flaskbox.mjs --selftest      (same-door known-bads, doorplant.mjs)

// A NOTE ON THIS ORDINARY-LOOKING IMPORT, because it was not ordinary for two
// hours and the record should say who fixed it. At dev = b83bda1 `browser.mjs`
// ended with `if (process.argv.includes('--selftest')) await selftest();` — a
// bare argv scan at MODULE-EVALUATION time, so a static import ran the
// LAUNCHER's bench and process.exit()ed before the importing tool's own
// selftest block was reached. I hit it building this file and measured it:
//
//   $ node tools/placement.mjs --selftest        (at b83bda1)
//   browser --selftest — /usr/bin/chromium       <- and then it exits
//
// VIRA FOUND IT INDEPENDENTLY AND FIXED IT IN THE SAME HOUR (e05be89: the guard
// now fires only when browser.mjs is the entry module). This tool imports
// statically like every other one because of her fix, not in spite of it.
// Counted on THIS tree rather than repeating her number: 46 tools import the
// launcher and 13 of those declare a `--selftest` of their own. Her commit says
// 24 importers were hijacked; the two counts are of different sets and I am
// naming that rather than reconciling them into one I did not derive. Neither
// number is a claim that those benches have now been RUN — her commit says so
// too, and it is still the open finding.
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { launchBrowser } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'flaskbox.mjs',
    timeoutMs: 900000,
    plants: [
      {
        // THE DEFECT AS IT SHIPPED: the slot goes back to borrowing the relic
        // chip's fixed box. B1 is the check that names it.
        name: 'the combat slot loses the floor and takes the relic chip s 2.6rem back',
        edits: [{
          file: 'styles/ui.css',
          find: '  min-height: var(--tap-floor);\n  min-width: var(--tap-floor);\n  width: auto;\n  height: auto;',
          replace: '  width: 2.6rem;\n  height: 2.6rem;',
        }],
        expectRed: /BAD\s+B1 .*under the floor/,
      },
      {
        // THE KEYCAP GOES BACK OUTSIDE. B2 is containment, so it is red whether
        // the badge hangs off the bottom, the side, or the top.
        name: 'the quick-use keycap is drawn outside its own slot again',
        edits: [{
          file: 'styles/combat.css',
          find: '  position: absolute; bottom: 2px; right: 2px;',
          replace: '  position: absolute; bottom: -0.7rem; left: 50%; transform: translateX(-50%);',
        }],
        expectRed: /BAD\s+B2 .*drawn outside their own flask control/,
      },
      {
        // THE MAP FLASK GOES BACK TO THE GENERIC BUTTON. It still CLEARS the
        // floor at 81 x 49, so B1 is green on it — this plant exists because
        // that is exactly the hole B3 was written for.
        name: 'the map flask leaves the shared box and takes base.css button padding back',
        edits: [{
          file: 'styles/ui.css',
          find: '.topbar .relic.flask-slot,\n.map-substrip .mh-flask {',
          replace: '.topbar .relic.flask-slot {',
        }],
        expectRed: /BAD\s+B3 .*different heights/,
      },
      {
        // E10's whole sentence in one plant: the partner does NOT move, so the
        // player has to make the second half of the change themselves — which
        // is the "separate buttons" complaint wearing a plus sign.
        name: 'the step moves one kind and leaves the other alone, so the total drifts',
        edits: [{
          file: 'src/model/gracerefill.js',
          find: '  next[from] -= 1;\n  next[to] += 1;',
          replace: '  next[to] += 1; // planted: the partner never gives the charge up',
        }],
        // The observed red is `moved 0 row(s), not 2`, and the zero is the
        // interesting part: the planted move composes an allocation that does
        // not sum to capacity, so reallocateFlaskCharges REFUSES it and the
        // click changes nothing. The one-home invariant caught the plant before
        // the screen could show it — which is what that one home is for.
        expectRed: /BAD\s+B4 .*(changed the TOTAL|moved \d+ row)/,
      },
      {
        // THE EDGE STOPS BEING A STATE. `canAdd` is always true, so a full kind
        // still offers `+` and a player presses past the top into a refusal.
        name: 'the max edge stops being a legible state — a full kind still offers +',
        edits: [{
          file: 'src/model/gracerefill.js',
          find: '    const canAdd = donor !== null && count(donor) > 0;',
          replace: '    const canAdd = donor !== null; // planted: the edge is no longer a state',
        }],
        expectRed: /BAD\s+B4 .*max edge .*is still offered/,
      },
      {
        // THE OLD SURFACE COMES BACK ALONGSIDE THE NEW ONE. Two answers to one
        // question on one screen — which is Law 0 clause 4, and it is exactly
        // how a "keep the old one for now" edit would ship.
        name: 'the capacity+1 split buttons come back beside the increment rows',
        edits: [{
          file: 'src/ui/screens/rest.js',
          find: '            <p class="flask-increment-total">',
          replace: '            <div class="flask-allocation-controls">${Array.from({ length: charge.capacity + 1 }, (_, hp) => `<button type="button" data-hp="${hp}">${hp}/${charge.capacity - hp}</button>`).join(\'\')}</div>\n            <p class="flask-increment-total">',
        }],
        expectRed: /BAD\s+B4 .*old capacity\+1 split buttons/,
      },
      {
        // THE HOLE I SHIPPED AND NAMED IN MY OWN REPORT, now watched. A surface
        // silently drops out of the loop; B3 used to compare the survivors and
        // print a confident green over a smaller population.
        name: 'a declared surface stops being reachable and B3 must NOT green on the survivors',
        edits: [{
          file: 'src/ui/screens/map.js',
          find: "    el.className = 'mh-flask';",
          replace: "    el.className = 'mh-flask-planted-away';",
        }],
        expectRed: /BAD\s+B3 .*of 3 declared surfaces were reached/,
      },
    ],
  }));
}

const SHAPES = [
  { tag: '390x844', w: 390, h: 844, d: 2, mobile: true },
  { tag: '1200x730', w: 1200, h: 730, d: 1, mobile: false },
];

// Every surface that draws a flask AS A CONTROL, and the door it is reached by.
// `.flask-charge` is a subset of `.flask-slot` in combat and its own class in
// co-op, so co-op is listed by the selector its own screen writes.
const SURFACES = [
  { name: 'combat topbar', sel: '.combat .flask-slot', door: 'combat' },
  { name: 'map sub-strip', sel: '.map-substrip .mh-flask', door: 'map-after-shop' },
  { name: 'co-op board', sel: '.combat.coop .coop-flask', door: 'coop' },
];

const findings = [];
let checks = 0;
const ok = (id, shape, msg) => { checks++; console.log(`  ok   ${id} ${shape} — ${msg}`); };
const bad = (id, shape, msg) => { checks++; findings.push(`${id} ${shape}`); console.log(`  BAD  ${id} ${shape} — ${msg}`); };

// The floor, MEASURED. Never getPropertyValue: that returns the literal calc().
const FLOOR = `(() => { const p = document.createElement('div');
  p.style.cssText = 'position:absolute;left:-9999px;top:0;height:var(--tap-floor)';
  document.body.appendChild(p); const h = p.offsetHeight; p.remove(); return h; })()`;

// One reading per surface: the control's box in local px, and the box of every
// element inside it, so containment is a comparison and not a special case for
// the one child that happens to be a keycap today.
const READ = (sel) => `(() => {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const L = (el) => { const r = el.getBoundingClientRect();
    return { left: r.left/z, top: r.top/z, right: r.right/z, bottom: r.bottom/z, w: r.width/z, h: r.height/z }; };
  return [...document.querySelectorAll(${JSON.stringify(sel)})].map((el, i) => ({
    i, box: L(el),
    clipped: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
    kids: [...el.querySelectorAll('*')].filter((k) => k.getBoundingClientRect().width > 0)
      .map((k) => ({ cls: k.className && String(k.className).split(' ')[0], box: L(k) })),
  }));
})()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { serve } = await import(join(ROOT, 'tools/serve.mjs'));
  const s = await serve({ root: ROOT, port: 8296, open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`flaskbox — ${base} (root ${ROOT})`);
  console.log('DOOR: real boot over http in headless Chromium; every box converted to LOCAL px once');
  console.log('      before anything is compared; the tap floor MEASURED off a probe element sized');
  console.log('      by var(--tap-floor), never parsed out of a calc() token. The map is reached the');
  console.log('      way a player reaches it — ?shot=shop, buy the shelf, LEAVE — because ?shot=map');
  console.log('      boots a fresh run and its flask mount is empty BY PRECONDITION, not by defect.');
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'flaskbox-', browser: process.env.CHROME || '/usr/bin/chromium', timeoutMs: 15000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  let ran = 0;

  for (const vp of SHAPES) {
    const shape = vp.tag;
    ran++;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };
    console.log(`\n  ${shape}`);

    const heights = new Map();
    for (const surface of SURFACES) {
      if (surface.door === 'combat') {
        await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, S);
        await until(`!!document.querySelector('.combat .flask-slot')`, 'combat');
      } else if (surface.door === 'coop') {
        await cdp.send('Page.navigate', { url: `${base}?shot=coop` }, S);
        await until(`!!document.querySelector('.combat.coop')`, 'coop');
      } else {
        // THE PLAYER'S OWN ROAD TO A MAP WITH FLASKS ON IT.
        await cdp.send('Page.navigate', { url: `${base}?shot=shop` }, S);
        await until(`!!document.querySelector('#leave-shop')`, 'shop');
        await wait(500);
        const bought = await ev(`(() => { let n = 0;
          for (let pass = 0; pass < 6; pass++) {
            const row = [...document.querySelectorAll('#shop-items .class-pick')]
              .find((el) => el.querySelector('.flask-identity') && !el.classList.contains('locked'));
            if (!row) break; row.click(); n++; }
          return n; })()`);
        if (!bought) { bad('B0', shape, 'the merchant stocked no affordable flask — the map surface was NOT reached, and nothing below is a measurement of it'); continue; }
        await wait(300);
        await ev(`document.querySelector('#leave-shop').click(); true`);
        await until(`!!document.querySelector('.mapscreen')`, 'map after shop');
        console.log(`       map reached by the shop door: ${bought} flask(s) bought, then LEAVE`);
      }
      await wait(600);

      const rows = await ev(READ(surface.sel));
      if (!rows.length) { bad('B0', shape, `${surface.name}: no flask control rendered — nothing measured, and an empty population is not a pass`); continue; }
      const floor = await ev(FLOOR);

      // B1 — the floor.
      const under = rows.filter((r) => r.box.h < floor - 0.5 || r.box.w < floor - 0.5);
      if (under.length) {
        bad('B1', shape, `${surface.name}: ${under.length} of ${rows.length} flask control(s) under the floor — `
          + under.map((r) => `#${r.i} ${r.box.w.toFixed(1)}x${r.box.h.toFixed(1)}`).join(', ')
          + ` against ${floor} local px. A control that spends a resource may not be smaller than the floor the player set`);
      } else {
        ok('B1', shape, `${surface.name}: all ${rows.length} at or above the ${floor} px floor `
          + `(smallest ${Math.min(...rows.map((r) => Math.min(r.box.w, r.box.h))).toFixed(1)})`);
      }

      // B2 — containment. Every child inside the parent's own box.
      const escapes = [];
      for (const r of rows) for (const k of r.kids) {
        const out = Math.max(r.box.top - k.box.top, k.box.bottom - r.box.bottom,
          r.box.left - k.box.left, k.box.right - r.box.right);
        if (out > 0.5) escapes.push(`#${r.i} .${k.cls} by ${out.toFixed(1)} px`);
      }
      const clipped = rows.filter((r) => r.clipped);
      if (escapes.length) bad('B2', shape, `${surface.name}: ${escapes.length} element(s) drawn outside their own flask control — ${escapes.join(', ')}. A badge that hangs off its control lands on whatever is under it`);
      else if (clipped.length) bad('B2', shape, `${surface.name}: ${clipped.length} control(s) clip their own content (scroll size exceeds client size)`);
      else ok('B2', shape, `${surface.name}: every child inside its own box, nothing clipped (${rows.reduce((n, r) => n + r.kids.length, 0)} children)`);

      heights.set(surface.name, rows.map((r) => +r.box.h.toFixed(1)));
    }

    // B3 — one box. No threshold: three surfaces, one answer.
    //
    // THE DENOMINATOR IS ASSERTED, and this closes a hole I shipped in the first
    // version of this file eight hours ago and named in my own report: it went
    // red only at FEWER THAN TWO surfaces, so a surface dropping out of the loop
    // left B3 comparing the survivors and printing a confident green over a
    // smaller population. That is the partial-blindness shape release-shots.mjs
    // already names in its own header, reproduced by me in a new tool the same
    // night I read it. The count SURFACES declares is the count that must be
    // reached; anything less is red, whatever the survivors agreed about.
    const seen = [...heights.entries()];
    const all = [...new Set(seen.flatMap(([, hs]) => hs))];
    if (seen.length !== SURFACES.length) bad('B3', shape, `${seen.length} of ${SURFACES.length} declared surfaces were reached (${seen.map(([n]) => n).join(', ') || 'none'}) — a smaller confident number is the worse failure. Missing: ${SURFACES.map((x) => x.name).filter((n) => !heights.has(n)).join(', ')}`);
    else if (all.length === 1) ok('B3', shape, `the flask control is ${all[0]} px on all ${seen.length} of ${SURFACES.length} declared surfaces (${seen.map(([n]) => n).join(', ')})`);
    else bad('B3', shape, `the same flask is ${all.length} different heights: ${seen.map(([n, hs]) => `${n} ${[...new Set(hs)].join('/')}`).join(', ')}. One item, one box — a flask that changes size when the screen changes is the defect this tool exists for`);

    // ---- B4 — E10: THE ASSIGNMENT IS AN INCREMENT, AND THE TOTAL HOLDS ------
    // His words: "I don't like how the flask assignments are separate buttons
    // instead of just increment button for each that automatically adjusts the
    // other flask to keep to the total available."
    //
    // Driven, not read: the real Shrine at `?shot=rest`, the real `+` pressed by
    // a real click, and the counts re-read off the screen afterwards. The
    // arithmetic lives in tools/flask-reallocation.mjs and is NOT restated here
    // — what this owns is that a thumb can reach the control, that pressing it
    // moves the other row, and that BOTH EDGES are reachable by pressing.
    await cdp.send('Page.navigate', { url: `${base}?shot=rest` }, S);
    await until(`!!document.querySelector('#flask-reallocate .flask-step')`, 'shrine');
    await wait(600);
    const READ_INC = `(() => {
      const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
      const steps = [...document.querySelectorAll('#flask-reallocate .flask-step')];
      const L = (el) => { const r = el.getBoundingClientRect();
        return { left: r.left/z, top: r.top/z, right: r.right/z, bottom: r.bottom/z, w: r.width/z, h: r.height/z }; };
      return {
        rows: document.querySelectorAll('#flask-reallocate .flask-increment-row').length,
        counts: [...document.querySelectorAll('#flask-reallocate .flask-increment-count')].map((e) => Number(e.textContent.trim())),
        total: (document.querySelector('#flask-reallocate .flask-increment-total') || {}).textContent || '',
        legacySplits: document.querySelectorAll('#flask-reallocate [data-hp]').length,
        steps: steps.map((e) => ({ kind: e.dataset.kind, step: Number(e.dataset.step),
          off: e.getAttribute('aria-disabled') === 'true', box: L(e) })),
      };
    })()`;
    const probe = await ev(READ_INC);
    const floorNow = await ev(FLOOR);
    // A REGEX LITERAL, NOT AN INJECTED STRING — and I got that wrong once, in
    // this exact line, and the tool said the panel carried no total while the
    // panel plainly read "3 of 3 assigned". Over-escaping is invisible until
    // something disagrees with a screen; the check was wrong, not the screen.
    const capText = /(\d+)\s+of\s+(\d+)\s+assigned/.exec(probe.total);

    if (!probe.rows) { bad('B4', shape, 'the Shrine drew no increment row — nothing measured, and an empty population is not a pass'); }
    else if (probe.legacySplits) { bad('B4', shape, `${probe.legacySplits} of the old capacity+1 split buttons are still on the screen — E10 asked for those to GO, and a screen carrying both is two answers to one question`); }
    else if (!capText) { bad('B4', shape, `the panel does not SAY its total (read "${probe.total.trim()}") — "keep to the total available" is a promise a player has to be able to check`); }
    else {
      // One step pair per row, both at the floor a thumb was promised.
      const pairs = probe.rows * 2;
      if (probe.steps.length !== pairs) bad('B4', shape, `${probe.steps.length} step button(s) for ${probe.rows} row(s) — his sentence is "increment button for EACH", which is one minus and one plus per kind`);
      else ok('B4', shape, `one minus and one plus on each of ${probe.rows} charge-kind row(s)`);
      const small = probe.steps.filter((x) => x.box.h < floorNow - 0.5 || x.box.w < floorNow - 0.5);
      if (small.length) bad('B4', shape, `${small.length} step button(s) under the ${floorNow} px floor — smallest ${Math.min(...probe.steps.map((x) => Math.min(x.box.w, x.box.h))).toFixed(1)}`);
      else ok('B4', shape, `every step button at or above the ${floorNow} px floor`);
      const sum = probe.counts.reduce((a, b) => a + b, 0);
      if (sum !== Number(capText[2]) || Number(capText[1]) !== sum) bad('B4', shape, `the counts on screen sum to ${sum} but the panel says "${probe.total.trim()}" — the number a player reads is a copy of one nothing syncs (Law 1 clause 2)`);
      else ok('B4', shape, `the counts on screen sum to the stated total (${probe.total.trim()})`);

      // PRESS IT. The other row must move, and the total must not.
      const live = probe.steps.find((x) => x.step > 0 && !x.off);
      if (!live) bad('B4', shape, 'no pressable `+` on the opening allocation — the control cannot be exercised, so nothing below is a measurement of it');
      else {
        const before = probe.counts.slice();
        await ev(`document.querySelector('#flask-reallocate .flask-step[data-kind="${live.kind}"][data-step="1"]').click(); true`);
        await wait(400);
        const after = await ev(READ_INC);
        const sumAfter = after.counts.reduce((a, b) => a + b, 0);
        const changed = after.counts.filter((n, i) => n !== before[i]).length;
        if (sumAfter !== sum) bad('B4', shape, `one press changed the TOTAL: ${sum} -> ${sumAfter}. "keep to the total available" is the whole ask`);
        else if (changed !== 2) bad('B4', shape, `one press moved ${changed} row(s), not 2 — "automatically adjusts the OTHER flask" means the partner moves in the same act, never in a second one the player has to make`);
        else ok('B4', shape, `pressing + on ${live.kind} moved both rows (${before.join('/')} -> ${after.counts.join('/')}) and held the total at ${sum}`);

        // BOTH EDGES BY PRESSING, not by posing: walk one kind to the top and
        // check the edge is a legible STATE, then walk it back to zero.
        for (let i = 0; i < 12; i++) {
          const got = await ev(`(() => { const b = document.querySelector('#flask-reallocate .flask-step[data-kind="${live.kind}"][data-step="1"]');
            if (!b || b.getAttribute('aria-disabled') === 'true') return false; b.click(); return true; })()`);
          if (!got) break;
          await wait(220);
        }
        const atMax = await ev(READ_INC);
        const maxStep = atMax.steps.find((x) => x.kind === live.kind && x.step > 0);
        const maxSum = atMax.counts.reduce((a, b) => a + b, 0);
        const others = atMax.steps.filter((x) => x.kind !== live.kind && x.step < 0);
        if (maxSum !== sum) bad('B4', shape, `walking to the max edge changed the total: ${sum} -> ${maxSum}`);
        else if (!maxStep || !maxStep.off) bad('B4', shape, `at the max edge ${live.kind}'s + is still offered — an edge a player can press past is not an edge`);
        else if (others.some((x) => !x.off)) bad('B4', shape, `at the max edge an empty kind still offers a minus — a control that cannot act may not look like one`);
        else ok('B4', shape, `MAX EDGE reached by pressing (${atMax.counts.join('/')}): + is refused on the full kind, - is refused on every empty one, total held at ${sum}`);

        // and back down — the return path is the one a player uses to undo.
        for (let i = 0; i < 12; i++) {
          const got = await ev(`(() => { const b = document.querySelector('#flask-reallocate .flask-step[data-kind="${live.kind}"][data-step="-1"]');
            if (!b || b.getAttribute('aria-disabled') === 'true') return false; b.click(); return true; })()`);
          if (!got) break;
          await wait(220);
        }
        const atZero = await ev(READ_INC);
        const zeroStep = atZero.steps.find((x) => x.kind === live.kind && x.step < 0);
        const zeroSum = atZero.counts.reduce((a, b) => a + b, 0);
        if (zeroSum !== sum) bad('B4', shape, `walking to the zero edge changed the total: ${sum} -> ${zeroSum}`);
        else if (!zeroStep || !zeroStep.off) bad('B4', shape, `at zero ${live.kind}'s - is still offered — an edge a player can press past is not an edge`);
        else ok('B4', shape, `ZERO EDGE reached by pressing (${atZero.counts.join('/')}): - is refused at zero, total held at ${sum}`);
      }
    }

    await cdp.send('Target.closeTarget', { targetId });
  }

  cdp.close(); await s.close?.(); await dropBrowser();
  if (!ran) { console.error('flaskbox: NOTHING RAN'); process.exit(2); }
  console.log(findings.length ? `\nflaskbox: ${findings.length} FINDING(S) over ${checks} check(s)` : `\nflaskbox: all green — ${checks} check(s)`);
  process.exit(findings.length ? 1 : 0);
}

main().catch((e) => { console.error('flaskbox: UNKNOWN — ' + (e.stack || e.message)); process.exit(2); });
