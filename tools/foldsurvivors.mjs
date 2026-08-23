// tools/foldsurvivors.mjs — E5's class, and the reason no existing gate could
// see it.
//
// THE DEFECT. `mountDisclosure` sets `host.innerHTML` (disclosure.js). Every
// row already in that host is DESTROYED. A row survives only because the
// roster handed to the mount holds its box BY REFERENCE and the mount re-adopts
// it. STARTING ARMOUR and STAT POINTS are deliberately not in customize's
// SECTIONS, so nothing held them: two rows the template writes were absent from
// the document from 9676d9a to aefc356, on a screen every gate called green.
//
// WHY EVERY GATE CALLED IT GREEN, AND THIS IS THE POINT OF THE FILE.
// `disclosure.js:280` writes `button.dataset.face = entry.key`, one-to-one with
// the roster it was handed. SO `data-face` IS THE DECLARATION. A gate that
// compares a declared roster against the document is comparing the declaration
// to a COPY OF ITSELF: at aefc356 and at the fix, `.cz-fields` reports the same
// six faces. creationbrief.mjs printed 6/6 and exited 0 HONESTLY — it was not
// lazy, it was structurally incapable, because THE ROSTER NEVER NAMED THE ROWS
// THAT VANISHED. The fix for a blind gate is not a stricter gate.
//
// SO THIS TOOL DOES NOT READ A ROSTER. It watches the WIPE.
// A MutationObserver installed at document-start records, per fold host, every
// element removed from it and every element put back. A row removed and never
// restored is the evidence the mount destroyed something — evidence that exists
// nowhere in the after-state, which is exactly why the after-state was green.
//
// AND THE HARD HALF — THE DISCRIMINATOR, WHICH IS A FINDING BEFORE IT IS CODE.
// "Removed and not restored" is NOT the defect on its own. Measured on dev:
//
//   .cz-fields   roster 6   ->  [FOLD] + STARTING ARMOUR + STAT POINTS   MUST survive
//   .shop-bars   roster 4   ->  [FOLD] only, #shop-sell gone entirely    MUST NOT survive
//
// ONE CONSTRUCTION — a row in the template that the roster does not hold —
// MEANING OPPOSITE THINGS, with NOTHING in either screen marking which reading
// applies. `...(sellOn() ? [{ key: 'bar:sell', ... }] : [])` is the ruled-intent
// deletion: his toggle off means ABSENT, never greyed. Re-appending it the way
// customize re-appends its two would RESURRECT a feature he ruled away.
//
// No screen publishes its conditionality. It is only observable BY MOVING THE
// INPUT. So the classification is derived from TWO BOOTS of the same screen:
//
//   roster membership NEVER moves + never restored  -> UNCONDITIONAL. Red (E5).
//   roster membership MOVES with the input          -> CONDITIONAL. Absent when
//                                                      out of roster is CORRECT.
//
// THE COST IS A SECOND BOOT, NOT AN ANNOTATION, and whoever maintains this is
// owed that sentence plainly. The price of having no second roster is running
// the screen twice. The roster is read off the DOM and never typed here; the
// condition is supplied as an INPUT (?shotSettings=) and never restated as
// logic. One home for the truth, read twice — not two homes. If that cost is
// ever too high for some surface, that is a product conversation, not a licence
// to reintroduce a hand-written list.
//
// IDENTITY IS STRUCTURAL, NOT A SENTENCE. A row is named by the id of the box
// it owns (`cz-armours`, `cz-statedit`, `shop-sell`), never by its label text —
// a label is copy and copy rots, and an anchor that rots reports PLANT SITE
// DRIFTED instead of the finding.
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
const browserPath = process.env.CHROME || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// THE SCREENS, and per screen the INPUTS to move. Not a roster of rows — a
// roster of rows is the thing this file exists not to have. Each entry names a
// shot, its fold host, and the settings variants to boot. A screen with one
// variant is a screen with no conditional rows, and any row it wipes and never
// restores is unconditional by construction.
const SCREENS = [
  { shot: 'customize', host: '.cz-fields', variants: [
    { name: 'default', settings: null },
  ] },
  { shot: 'shop', host: '.shop-bars', variants: [
    { name: 'sell ON  (default)', settings: null },
    { name: 'sell OFF (his toggle)', settings: { shopSell: false } },
  ] },
];

// Installed at document-start, BEFORE any screen mounts.
//
// AND IT PATCHES THE innerHTML SETTER RATHER THAN WATCHING FOR THE REMOVAL,
// because my first shape of this used a MutationObserver and it produced a
// FALSE RED against the product. MutationObserver callbacks are ASYNCHRONOUS:
// `disclosure.js:162` wipes the host, `:189` re-parents each adopted box into
// the panel, and BOTH run before the observer callback fires. By the time the
// callback inspects a removed wrapper, its box has already been moved out of
// it, so six distinct picker rows all read as one anonymous `.div` and the tool
// reported an orphan that does not exist. The evidence has to be taken
// SYNCHRONOUSLY, at the instant of destruction, or it is evidence about a
// different DOM than the one that was destroyed.
//
// So this wraps the one operation that does the destroying and records what was
// in the host at that instant. It reads; it changes nothing.
//
// IDENTITY IS THE BOX, NOT ITS WRAPPER. `.cz-fields` rows are anonymous divs
// wrapping a labelled box (`#cz-classes`, `#cz-armours`). The wrapper is
// presentation chrome and is MEANT to die when its box is adopted; the box is
// the thing that must survive. So a row is named by the ids it contains.
const OBSERVER = `(() => {
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  const hostSig = (el) => {
    const cls = (el && el.className || '').toString();
    if (/\\bcz-fields\\b/.test(cls)) return '.cz-fields';
    if (/\\bshop-bars\\b/.test(cls)) return '.shop-bars';
    return null;
  };
  const log = {};
  window.__foldwipe = log;
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true, enumerable: d.enumerable, get: d.get,
    set(v) {
      const h = hostSig(this);
      if (h) {
        // SYNCHRONOUS, before the assignment destroys anything.
        const ids = [...this.querySelectorAll('[id]')].map((e) => e.id);
        const bag = (log[h] = log[h] || { wipes: 0, ids: [] });
        bag.wipes++;
        for (const id of ids) if (!bag.ids.includes(id)) bag.ids.push(id);
      }
      return d.set.call(this, v);
    },
  });
})()`;

// The after-state, read the way a player meets it: the roster off the DOM, and
// which of the wiped rows are back as CHILDREN OF THE HOST with painted area.
const READ = (host) => `(() => {
  const h = document.querySelector(${JSON.stringify(host)});
  if (!h) return { noHost: true };
  const area = (el) => !!el && [...el.getClientRects()].some((r) => r.width > 0 && r.height > 0);
  const w = (window.__foldwipe || {})[${JSON.stringify(host)}] || { wipes: 0, ids: [] };
  const panel = h.querySelector('.disc-reveal');
  const kids = [...h.children].filter((e) => !e.classList.contains('disc-faces'));
  return {
    roster: [...h.querySelectorAll('.disc-face')].map((e) => e.dataset.face),
    wipes: w.wipes,
    // Every id that was inside this host at the instant it was destroyed.
    wiped: w.ids,
    // ADOPTED — the roster held this box by reference and the mount re-parented
    // it into the fold's own panel. It is on the screen, one tap away.
    adopted: w.ids.filter((id) => { const e = document.getElementById(id); return !!e && !!panel && panel.contains(e); }),
    // SURVIVED — the row is back as a child of the host, outside the fold, with
    // painted area. This is what the E5 repair does for its two rows.
    survived: w.ids.filter((id) => { const e = document.getElementById(id);
      return !!e && kids.some((k) => k === e || k.contains(e)) && area(e.closest('div') || e); }),
    // GONE — nowhere in the document at all.
    gone: w.ids.filter((id) => !document.getElementById(id)),
    kidSigs: kids.map((e) => { const b = e.querySelector('[id]'); return b ? '#' + b.id : (e.id ? '#' + e.id : '.' + (e.className || 'div').toString().split(/\\s+/)[0]); }),
  };
})()`;

function connectCdp(url) {
  const ws = new WebSocket(url); let n = 1; const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (!m.id || !p.has(m.id)) return;
    const { res, rej } = p.get(m.id); p.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, s) { const id = n++; return new Promise((res, rej) => { p.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params, ...(s ? { sessionId: s } : {}) })); }); }, close: () => ws.close() };
}

let fails = 0; let checks = 0;
const RED = { orphan: 'F1.orphan', nohost: 'F2.nohost', noreferent: 'F3.noreferent', resurrect: 'F4.resurrect' };
const ok = (v, label, detail = '') => { checks++; console.log(`    ${v ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`); if (!v) fails++; };
const red = (id, msg) => `[${id}] ${msg}`;

async function main() {
  if (!browserPath) throw new Error('no Chrome/Edge found; pass CHROME=');
  const served = await serve({ root: ROOT, port: Number(process.env.FS_PORT || 8520), open: false });
  const base = `http://localhost:${served.port}/`;
  const browser = await launchBrowser({ prefix: 'foldsurv-', browser: browserPath, timeoutMs: 15000 });
  const cdp = connectCdp(browser.wsUrl); await cdp.ready;
  console.log(`foldsurvivors — ${base} (root ${ROOT})`);
  console.log('DOOR: real boot over http in headless Chromium. The destruction is recorded');
  console.log('      SYNCHRONOUSLY, by wrapping the innerHTML setter that does it — a');
  console.log('      MutationObserver fires too late and reports a DOM the wipe already changed.');
  console.log('      NO ROSTER IS TYPED HERE. Rosters are read off data-face; conditions are');
  console.log('      supplied as INPUTS and classified by whether membership MOVED.\n');
  try {
    for (const screen of SCREENS) {
      console.log(`  ${screen.shot} · ${screen.host} — ${screen.variants.length} boot(s)`);
      const seen = [];
      for (const v of screen.variants) {
        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
        await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false }, S);
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER }, S);
        const ev = async (x) => { const r = await cdp.send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }, S);
          if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
        const q = v.settings ? `&shotSettings=${encodeURIComponent(JSON.stringify(v.settings))}` : '';
        await cdp.send('Page.navigate', { url: `${base}?shot=${screen.shot}${q}` }, S);
        const t0 = Date.now();
        let up = false;
        while (Date.now() - t0 < 20000) { if (await ev(`!!document.querySelector('${screen.host} .disc-face')`).catch(() => false)) { up = true; break; } await wait(120); }
        const ms = Date.now() - t0;
        if (!up) { ok(false, red(RED.nohost, `${screen.shot} never mounted a fold in ${screen.host}`)); await cdp.send('Target.closeTarget', { targetId }); continue; }
        await wait(450);
        const r = await ev(READ(screen.host));
        r.name = v.name; r.bootMs = ms; seen.push(r);
        console.log(`    boot "${v.name}" (${ms} ms)  roster ${JSON.stringify(r.roster)}`);
        console.log(`      host wiped ${r.wipes}x, holding ${r.wiped.length} id(s): ${r.wiped.join(', ') || '(none)'}`);
        console.log(`      adopted into the panel: ${r.adopted.join(', ') || '(none)'}`);
        console.log(`      survived as host children: ${r.survived.join(', ') || '(none)'}`);
        console.log(`      GONE from the document: ${r.gone.join(', ') || '(none)'}`);
        await cdp.send('Target.closeTarget', { targetId });
      }
      if (!seen.length) continue;

      // \u2699 REFERENT, ASSERTED NOT ASSUMED. A probe that never saw the host
      // wiped has measured nothing, and every assertion below it would be a
      // vacuous green over an empty set — my own named failure mode, and
      // structurally the same blindness that let E5 ship.
      const anyWipe = seen.some((r) => r.wipes > 0 && r.wiped.length > 0);
      ok(anyWipe, anyWipe
        ? `the destruction was OBSERVED at the instant it happened — ${seen.map((r) => `${r.wiped.length} id(s) in the host across ${r.wipes} wipe(s) on "${r.name}"`).join(' \u00b7 ')}`
        : red(RED.noreferent, `${screen.host} was never observed being wiped — the probe measured nothing, so nothing below is a claim`));
      if (!anyWipe) continue;

      const rows = [...new Set(seen.flatMap((r) => r.wiped))];
      for (const row of rows) {
        const held = seen.map((r) => r.adopted.includes(row));      // roster held it, by reference
        const back = seen.map((r) => r.survived.includes(row));     // put back as a host child
        const gone = seen.map((r) => r.gone.includes(row));         // nowhere at all
        const moved = new Set(held).size > 1;
        const label = `held ${JSON.stringify(held)} back ${JSON.stringify(back)} gone ${JSON.stringify(gone)}`;
        if (moved) {
          // CONDITIONAL — its roster membership MOVED when the input moved, and
          // that is the only signal either screen publishes about intent. Its
          // absence where the condition is off is the RULED answer: his toggle
          // off means ABSENT, never greyed. The red here is the OPPOSITE
          // direction, and it is the one Sten's fix shape would have tripped.
          // THE PREDICATE HERE IS ABSENCE FROM THE DOCUMENT, NOT ABSENCE OF INK,
          // AND THAT DISTINCTION IS A REPAIR. My first shape asked whether the
          // row came back WITH PAINTED AREA — and Plant 2 went UNCAUGHT through
          // it. The resurrected `#shop-sell` is `<div class="class-row"
          // id="shop-sell">` with no children, because `goods` is empty when the
          // toggle is off, and `.class-row` is a bare flex box: zero area. So the
          // arm that polices resurrection was guarded behind a test that THE
          // POLICED STATE ITSELF MAKES FALSE. A check that stops being exercised
          // does not fail; it goes quiet, and this one was quiet in the only
          // direction it existed for.
          //
          // His ruling is the reason the right predicate is the stricter one:
          // "ABSENT, never greyed". An empty node in the document is not absent
          // — it is one non-empty `sellables()`, one `min-height`, one border
          // away from painting, and nothing would announce the change. So a
          // conditional row whose condition is OFF must be GONE.
          //
          // The asymmetry with the branch below is deliberate: a REQUIRED row
          // must be back WITH AREA (an invisible row is not a restored one); a
          // RULED-AWAY row must be ABSENT FROM THE DOCUMENT. Two different
          // claims about two different failures, so two different predicates.
          const resurrected = seen.map((r, i) => (!held[i] && !gone[i]) ? r.name : null).filter(Boolean);
          ok(resurrected.length === 0, resurrected.length === 0
            ? `#${row} is CONDITIONAL and GONE FROM THE DOCUMENT exactly where the input says \u2014 ${label}`
            : red(RED.resurrect, `#${row} is STILL IN THE DOCUMENT while its condition is OFF (${resurrected.join(', ')})`
              + ` \u2014 a deletion he RULED has been resurrected; "absent, never greyed" is the ruling, and an`
              + ` empty node with no ink is not absent \u2014 ${label}`));
        } else if (held.every(Boolean)) {
          ok(true, `#${row} is adopted into the fold by the roster in every boot \u2014 ${label}`);
        } else if (held.some(Boolean)) {
          ok(false, red(RED.orphan, `#${row} is adopted in some boots and neither adopted nor put back in others,`
            + ` with no input moving \u2014 ${label}`));
        } else {
          // UNCONDITIONAL AND UNHELD \u2014 the E5 class, by name. The template
          // writes it, no roster holds it in any boot, so nothing brings it back
          // unless the screen puts it back itself.
          const survives = back.every(Boolean);
          ok(survives, survives
            ? `#${row} is written by the template, held by NO roster in any boot, and PUT BACK \u2014 ${label}`
            : red(RED.orphan, `#${row} is written by the template, held by no roster in any boot, and the mount`
              + ` DESTROYED it \u2014 absent from the document on a screen every roster-gate calls green \u2014 ${label}`));
        }
      }
      console.log('');
    }
  } finally { try { cdp.close(); } catch {} try { await browser.close?.(); } catch {} try { served.close?.(); } catch {} }
  console.log(`  ${checks} checks, ${fails} finding(s)`);
  console.log('\n  BOUNDARY — what a green here does NOT mean:');
  console.log('   · two screens only (customize, shop). A fold host this file does not name is unwatched.');
  console.log('   · the classification is only as good as the INPUTS swept. A conditional row whose');
  console.log('     input is never moved reads as unconditional, and would red honestly but for the');
  console.log('     wrong reason. Adding a condition means adding a VARIANT, never a row.');
  console.log('   · presence is area on the laid-out page; it says nothing about whether the row WORKS.');
  console.log('   · Linux, one container, one headless Chromium, 1200x900.');
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
