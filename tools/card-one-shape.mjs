#!/usr/bin/env node
// tools/card-one-shape.mjs — THE PLAYING CARD HAS ONE SHAPE, MEASURED ON REAL
// SCREENS.
//
// WHY THIS EXISTS. Measured at c63a09620 over CDP, one renderer, eight
// surfaces, two viewports — the same card, two shapes, decided by nothing but
// which screen it landed on:
//
//   combat hand        120x192   5 / 8     deck + discard piles   170x238   5 / 7
//   shop cards shelf   140x224   5 / 8     armoury card gallery   192x268   5 / 7
//   reward card pick   140x224   5 / 8     cc starting-card fold            5 / 7
//   card inspection    320x512   5 / 8
//   co-op hand/reward            5 / 8
//
// Nothing caught it, because nothing asked. `content/config/ui/components/
// card.json` declared the shape, but its only readers were the hand's geometry
// maths; `styles/kit.css` drew the face from a second, hand-typed copy. So the
// two could disagree — and did — with every existing check green.
//
// WHAT THIS ASKS, AND IT IS ONE QUESTION:
//   every `.card` in the game reports ONE aspect ratio, and that ratio is the
//   one authored in card.json.
//
// HOW IT COVERS SCREENS A DRIVER CANNOT REACH. Several playing-card surfaces
// sit behind a wizard step or a category tab (the character-creation starting
// fold, the armoury card gallery on a phone) and a click-driver that misses one
// reports nothing rather than a finding. `getComputedStyle` answers for a
// display:none element too, so this measures EVERY `.card` in each screen's
// DOM, shown or not. A card that is merely not on screen yet is still a card
// whose shape can have drifted.
//
// BOUNDARY, and it is a real one:
//   - This is about the PLAYING card (`.card`). The equipment card
//     (`.epc-frame` / `.equipment-poker-card`) is a different component with
//     its own canvas and is deliberately not measured here.
//   - It asks about the card's OUTER shape, not its four face bands. A band
//     split that disagrees with `sizing.bands` would pass this and is caught,
//     if at all, by reading the stylesheet — see the literal scan below, which
//     is a source check and says so.
//   - headless Chromium, one text size, default fonts.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SELFTEST = process.argv.includes('--selftest');

const SHAPES = [
  { w: 1440, h: 900, d: 1, mobile: false },
  { w: 390, h: 844, d: 3, mobile: true },
];

// Every `?shot=` state that puts a playing card in the DOM. `coopshrine` is
// listed because a prior audit named it a playing-card screen; it renders none,
// and this reports that rather than quietly dropping it.
const SCREENS = ['combat', 'shop', 'reward', 'customize', 'map', 'coop', 'coopreward', 'coopshrine'];

const browserPath = [process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync);

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve: done, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else done(msg.result);
  });
  return {
    ready: new Promise((done, fail) => { ws.addEventListener('open', done); ws.addEventListener('error', fail); }),
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

// The authored number, read from the JSON rather than from the compiled module,
// so this check still means something if the two ever part company.
function authoredRatio() {
  const card = JSON.parse(readFileSync(resolve(ROOT, 'content/config/ui/components/card.json'), 'utf8'));
  const { numerator, denominator } = card.sizing.ratio;
  return { value: numerator / denominator, text: `${numerator} / ${denominator}` };
}

// `aspect-ratio` comes back as "0.714286 / 1", "5 / 7", "auto", or a pair with a
// fallback. Reduce it to one number, or null when the card declares no shape —
// which is what an unprojected `var(--card-ratio)` looks like, and is a finding.
const PROBE = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('.card')) {
    if (el.closest('.epc-frame, .equipment-poker-card')) continue;
    const raw = getComputedStyle(el).aspectRatio;
    const m = /^\\s*([0-9.]+)\\s*(?:\\/\\s*([0-9.]+))?\\s*$/.exec(raw);
    // offsetWidth/Height, NOT getBoundingClientRect: the hand FANS its cards,
    // and a rect is the axis-aligned box of a rotated card rather than the
    // card's own. Measured with rects, eight fanned faces read 0.725 and eight
    // more 0.7357 against an authored 0.714286 — the rotation, reported as a
    // second shape. offsetWidth is the pre-transform border box, which is the
    // thing this gate is actually asking about.
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    out.push({
      id: el.dataset.cardId || '(no id)',
      raw,
      declared: m ? Number(m[1]) / (m[2] === undefined ? 1 : Number(m[2])) : null,
      rendered: w > 2 && h > 2 ? w / h : null,
      w, h,
      host: (el.parentElement?.className || '(root)').toString().split(/\\s+/).slice(0, 2).join('.'),
      shown: w > 2,
    });
  }
  return out;
})()`;

// The selftest plants exactly the defect this tool exists to catch: one surface
// quietly drawing the card at a second shape.
// TWO DEFECTS, BECAUSE THE GATE NOW HAS TWO WAYS TO LOOK. A declaration-only
// plant proved nothing about the pixel path: a face judged by its rendered box
// ignores an inline `aspect-ratio`, so this selftest ran 5/10 and said so.
//   - a SHOWN card gets an explicit height, which is how a real second shape
//     arrives (an explicit width/height pair overrides `aspect-ratio`);
//   - a card with no box gets a second `aspect-ratio`, which is the only thing
//     a hidden face can drift by.
// A page is caught only if the defect it could plant was seen.
// WHAT THE PLANT CAN AND CANNOT MOVE.
//
// A declaration-only plant proved nothing about the pixel path, so this plants
// both. But on the combat and co-op HANDS the rendered ratio cannot be moved
// at all: those surfaces compute card geometry in JS from the SAME authored
// ratio (HandLayout / CombatLayout read `sizing.ratio`), so the face's box is
// derived rather than declared. Setting width, height, or even the slot's
// height — with !important — re-sizes the card and leaves the ratio at the
// authored value, which is the correct behaviour and not a hole in the probe.
//
// So the plant REPORTS what it managed: 'both' when the rendered ratio moved,
// 'declared' when only the declaration could be moved. The selftest requires
// every plantable page to be caught and NAMES the rest, rather than counting
// a surface whose shape is structurally pinned as a miss it never made.
const PLANT = `(() => {
  const all = [...document.querySelectorAll('.card')]
    .filter((el) => !el.closest('.epc-frame, .equipment-poker-card'));
  const target = all.find((el) => el.offsetWidth > 2 && el.offsetHeight > 2) || all[0];
  if (!target) return false;
  const ratio = (el) => (el.offsetWidth > 2 && el.offsetHeight > 2 ? el.offsetWidth / el.offsetHeight : null);
  const before = ratio(target);
  target.style.aspectRatio = '5 / 8';
  if (before != null) {
    target.style.setProperty('height', \`\${Math.round(target.offsetHeight * 1.35)}px\`, 'important');
    if (ratio(target) === before && target.parentElement) {
      target.parentElement.style.setProperty('height', \`\${Math.round(target.offsetHeight * 1.35)}px\`, 'important');
    }
  }
  const after = ratio(target);
  return (before == null || after !== before) ? 'both' : 'declared';
})()`;

async function main() {
  if (!browserPath) { console.error('card-one-shape UNKNOWN — no chromium found. Set CHROME=/path/to/chrome.'); return 2; }
  const authored = authoredRatio();
  const server = await serve({ root: ROOT, port: 8299, open: false });
  const launched = await launchBrowser({ prefix: 'cardshape-', browser: browserPath, timeoutMs: 20000 });
  const cdp = connectCdp(launched.wsUrl);
  const seen = new Map();   // ratio (rounded) -> [{ where, id, host, raw }]
  const findings = [];
  let cards = 0;
  const plantPinned = [];
  let measuredByBox = 0;
  let measuredByDeclaration = 0;
  let plantRuns = 0;
  let plantSeen = 0;
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);

    for (const shape of SHAPES) {
      await cdp.send('Emulation.setDeviceMetricsOverride',
        { width: shape.w, height: shape.h, deviceScaleFactor: shape.d, mobile: shape.mobile }, sessionId);
      for (const screen of SCREENS) {
        await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=${screen}` }, sessionId);
        let ready = false;
        for (let i = 0; i < 120 && !ready; i++) {
          const r = await cdp.send('Runtime.evaluate',
            { expression: 'document.querySelectorAll("body *").length > 12', returnByValue: true }, sessionId);
          ready = r.result?.value === true;
          if (!ready) await new Promise((d) => setTimeout(d, 100));
        }
        const where = `${shape.w}x${shape.h} ${screen}`;
        if (!ready) { findings.push(`${where}: never painted`); continue; }
        await new Promise((d) => setTimeout(d, 900));

        if (SELFTEST) {
          const planted = await cdp.send('Runtime.evaluate', { expression: PLANT, returnByValue: true }, sessionId);
          if (!planted.result?.value) continue;   // no card on this screen to plant on
          if (planted.result.value === 'declared') { plantPinned.push(where); continue; }
          plantRuns += 1;
          // Let the plant's layout settle, and let any screen that repaints on its
          // own get that repaint out of the way before the probe reads.
          await new Promise((d) => setTimeout(d, 400));
        }

        const res = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true }, sessionId);
        const rows = res.result?.value;
        if (!rows) { findings.push(`${where}: probe returned nothing`); continue; }

        if (SELFTEST) {
          // CAUGHT MEANS "DIFFERS FROM THE AUTHORED SHAPE", not "differs from
          // its neighbour". Counting distinct shapes WITHIN a page could never
          // catch a page holding one card: planting on the only face made every
          // face on that page agree, so five of ten pages reported a miss the
          // probe had not actually made.
          const drifted = rows
            .map((r) => r.rendered ?? r.declared)
            .filter((v) => v != null)
            .some((v) => Math.abs(v - authored.value) > authored.value * 0.02);
          if (drifted) plantSeen += 1;
          continue;
        }

        if (!rows.length) { console.log(`  note  ${where}: no playing card on this screen`); continue; }
        cards += rows.length;
        for (const row of rows) {
          if (row.declared == null && row.rendered == null) {
            findings.push(`${where} ${row.id} in .${row.host}: declares NO aspect ratio ("${row.raw}")`
              + ' — the card\'s shape never reached the stylesheet');
            continue;
          }
          // PIXELS DECIDE WHERE THERE ARE PIXELS. Reading only the computed
          // `aspect-ratio` asks whether the card DECLARES the authored shape,
          // which is a weaker question than whether it IS that shape: an
          // explicit width AND height pair overrides `aspect-ratio` outright,
          // so a rule like `.card-inspection-art > .card { width:220px;
          // height:308px }` can report `var(--card-ratio)` while drawing
          // whatever those two numbers happen to make. This gate's whole claim
          // is one SHAPE, so a card with a real box is judged by its box, and
          // the declaration covers the faces that are in the DOM but not on
          // screen — which is how the surfaces behind a wizard step stay
          // measured at all.
          const measured = row.rendered ?? row.declared;
          if (row.rendered != null) measuredByBox += 1; else measuredByDeclaration += 1;
          // A percentage-width cell rounds to whole pixels, so a rendered
          // ratio lands a fraction off its authored value: the co-op hand's
          // card measures 199x280 where the authored shape wants 200x280, and
          // 0.710714 is that missing pixel rather than a second shape. Bucket
          // at 2% of the authored value — six times tighter than the 12%
          // between 5:7 and 5:8, and loose enough that a rounded pixel is not
          // reported as drift.
          const key = Math.round(measured / (authored.value * 0.02));
          if (!seen.has(key)) seen.set(key, []);
          seen.get(key).push({ where, measured, ...row });
        }
      }
    }
  } finally {
    cdp.close();
    await launched.close();
    server.server.close();
  }

  if (SELFTEST) {
    console.log(`card-one-shape --selftest: a planted second shape was seen in ${plantSeen}/${plantRuns} plantable page(s)`);
    if (plantPinned.length) {
      // NAMED, NOT SILENTLY PASSED. These surfaces derive the card's box from
      // the authored ratio in JS, so no CSS plant can give them a second shape.
      // They are still measured by the gate proper; what cannot be demonstrated
      // here is the probe's reaction to drift on them, and that is said out
      // loud rather than folded into a ratio that would read as full coverage.
      console.log(`      shape is JS-derived and cannot be planted on ${plantPinned.length} page(s),`
        + ` so the pixel path is unproven there: ${plantPinned.join('; ')}`);
    }
    if (!plantRuns || plantSeen !== plantRuns) {
      console.error('card-one-shape --selftest RED — the probe MISSED a planted second shape.'
        + ' It cannot be quoted until it sees one.');
      return 1;
    }
    console.log('card-one-shape --selftest OK — the probe sees the drift it is meant to see.');
    return 0;
  }

  const ratios = [...seen.keys()].sort((a, b) => a - b);
  const asRatio = (key) => key * authored.value * 0.02;
  console.log(`card-one-shape: ${cards} playing-card face(s) measured across ${SCREENS.length} screen(s) x ${SHAPES.length} shape(s)`);
  console.log(`      ${measuredByBox} judged by rendered box, ${measuredByDeclaration} by declaration (in the DOM, not on screen)`);
  // A GREEN THAT MEANS "I FOUND NOTHING TO LOOK AT" IS NOT A PASS.
  // With no card anywhere, `seen` and `findings` were both empty, so this
  // printed GREEN — with NaN for the ratio — and exited 0. A broken mount, a
  // renamed class or an accidentally empty screen list would all have read as
  // proof that the card has one shape. The gate has to be able to fail.
  if (!cards) {
    findings.push('no playing card was measured on ANY screen — this gate cannot pass vacuously.'
      + ' Either the screens stopped rendering cards, or `.card` stopped being how a card is found.');
  } else if (!seen.size) {
    findings.push(`${cards} face(s) were found but none yielded a shape — every one was unmeasurable.`);
  }
  console.log(`      authored: content/config/ui/components/card.json sizing.ratio = ${authored.text} (${authored.value.toFixed(6)})`);

  if (ratios.length > 1) {
    findings.push(`the playing card reports ${ratios.length} shapes, not one:`);
    for (const key of ratios) {
      const rows = seen.get(key);
      const where = [...new Set(rows.map((r) => `${r.where} .${r.host}`))].slice(0, 6).join('; ');
      findings.push(`  ${asRatio(key).toFixed(6)} on ${rows.length} face(s): ${where}`);
    }
  } else if (ratios.length === 1 && Math.abs(asRatio(ratios[0]) - authored.value) > authored.value * 0.01) {
    findings.push(`the playing card is one shape — ${asRatio(ratios[0]).toFixed(6)} — but that is NOT the`
      + ` authored ${authored.text} (${authored.value.toFixed(6)}). The face and its config have parted company.`);
  }

  // A SOURCE CHECK, AND LABELLED AS ONE. The measurement above cannot tell a
  // derived shape from a literal that happens to agree today; a stylesheet rule
  // that writes the ratio out longhand is the second copy that made this tool
  // necessary, so it is named here even while the pixels agree.
  for (const file of ['styles/kit.css', 'styles/combat.css']) {
    // Comments EXPLAIN the old literal — several of them quote it on purpose —
    // so they are blanked rather than line-matched, keeping line numbers.
    const text = readFileSync(resolve(ROOT, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    text.split('\n').forEach((line, i) => {
      if (/equipment-poker-card|epc-/.test(line)) return;                     // a different component
      if (/aspect-ratio\s*:\s*\d/.test(line) && /\.card|\.ctag|hand/.test(line)) {
        findings.push(`${file}:${i + 1} states a playing-card aspect ratio literally`
          + ' — it must read var(--card-ratio) so card.json stays the one home:\n        ' + line.trim());
      }
    });
  }

  if (!findings.length) {
    console.log(`card-one-shape GREEN — one shape, ${asRatio(ratios[0]).toFixed(6)}, on every surface, and it is the authored one.`);
  } else {
    for (const f of findings) console.error('  ' + f);
    console.error(`\ncard-one-shape RED — ${findings.length} finding(s)`);
  }
  console.log('BOUNDARY: the PLAYING card only (.epc-frame is a different component), its outer');
  console.log('      shape and not its four face bands, headless Chromium at the two shapes named.');
  return findings.length ? 1 : 0;
}

main().then((code) => { process.exitCode = code; });
