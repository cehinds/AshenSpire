#!/usr/bin/env node
// The chosen sigil is drawn on the figure, on every style that draws a figure.
//
// WHY THIS EXISTS. The overlay was written inline after the painted `img` in
// `classSprite()`, so it only ever ran on the `rendered` style. `animated`
// returns as soon as it has a pose stage — and since #700 `animated` is the
// DEFAULT everywhere a character is made. The result: a player picked a sigil
// at creation and it appeared nowhere on the default figure. Nothing failed.
// No tool looked at the overlay at all, which is why a silent omission on the
// default path survived two art migrations.
//
// It also guards the two numbers that omission hid behind. Three of the four
// medallion anchors were recorded as "measured unplaceable" on 2026-09-04
// because a fixed 22px disc could not fit a full-body chest; the disc is a
// share of the frame now and the anchors carry an x as well as a y, so all
// four are real again. Both facts have one home —
// `src/content/classArtAnchors.js` — and this tool IMPORTS it rather than
// restating the numbers, so a re-measure moves the assertion with it.
//
// WHAT IT DOES NOT CLAIM. It measures where the disc sits in the FRAME, not
// where the chest is in the art: no tool can tell those apart, which is why
// the anchors are measured by eye and this only holds them to what was
// measured. And an animated figure moves inside its frame between poses while
// the overlay does not, so the disc reads as on-chest at rest and drifts with
// a swing. That is inherent to a frame-anchored overlay on frame-animated art
// and is a known cost, not a fault this tool is blind to.
//
//   node tools/sigil-medallion.mjs

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { medallionAnchor } from '../src/content/classArtAnchors.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DISC_PCT = 7; // classSprite(): the disc's height as a share of the frame
const GLYPH_CQH = 62; // and the glyph's, as a share of the disc's CONTENT box (what `cqh` means)
// THE x MUST BE LOAD-BEARING, AND ONE CLASS CANNOT PROVE THAT.
// The first version of this tool booted the Reaver only, whose measured x IS
// 50 — so reverting the overlay to the old hardcoded `left: 50%` passed every
// row. Measured, not reasoned: that revert was planted and the tool stayed
// green. The Starseer (x48) and the Rogue (x49) are the classes whose anchor
// disagrees with the frame's middle, so they are what makes an ignored x fail.
const SURFACES = [
  { name: 'combat', shot: 'combat', cls: 'reaver', why: 'the fight — the surface the sigil was missing from' },
  { name: 'creation', shot: 'customize', cls: 'reaver', why: 'where the sigil is chosen' },
  { name: 'starseer', shot: 'customize', cls: 'starseer', why: 'x48 — an anchor that is not the frame middle' },
  { name: 'rogue', shot: 'customize', cls: 'rogue', why: 'x49 — the other off-centre anchor' },
];

let checks = 0;
let failures = 0;
function ok(held, code, detail = '') {
  checks += 1;
  if (!held) failures += 1;
  console.log(`${held ? 'PASS' : 'RED '} ${code}${detail ? ` — ${detail}` : ''}`);
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const packet = JSON.parse(event.data);
    const waiter = pending.get(packet.id);
    if (!waiter) return;
    pending.delete(packet.id);
    packet.error ? waiter.no(new Error(packet.error.message)) : waiter.ok(packet.result);
  });
  return {
    ready: new Promise((res, rej) => { socket.addEventListener('open', res); socket.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((res, rej) => {
        pending.set(id, { ok: res, no: rej });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { socket.close(); },
  };
}

// Read the overlay off the real page. Returned in FRAME percentages so the
// assertion compares like with like against the anchor data.
function readMedallion() {
  const host = document.querySelector('.class-sprite');
  if (!host) return { host: false };
  // TWO WAYS A SIGIL REACHES A FIGURE, and this tool used to see only one.
  // The overlay is a direct-child <span>. The classic SVG silhouette draws it
  // as <text> INSIDE the <svg>, via sigilMedallion() — so while the absence
  // check read `:scope > span` alone it reported a clean figure on the Classic
  // style and on any rendered figure that fell back to the inline SVG, with
  // the sigil plainly on the chest. A gate that passes on the exact condition
  // it forbids is worse than no gate. Codex caught it on #764; this is the
  // repair.
  const disc = host.querySelector(':scope > span');
  const svgSigil = host.querySelector('svg text');
  const hostBox = host.getBoundingClientRect();
  if (!disc) {
    return {
      host: true,
      style: host.classList.contains('animated') ? 'animated' : 'still',
      disc: false,
      svgSigil: svgSigil ? svgSigil.textContent.trim() : null,
      // What the frame DID draw, so a red says which path ran.
      drew: [...host.querySelectorAll('*')].slice(0, 4).map((node) => `${node.tagName.toLowerCase()}.${node.className}`),
    };
  }
  const discBox = disc.getBoundingClientRect();
  const mark = disc.firstElementChild;
  const round = getComputedStyle(disc).borderRadius;
  return {
    host: true,
    style: host.classList.contains('animated') ? 'animated' : 'still',
    disc: true,
    hostH: +hostBox.height.toFixed(2),
    discPctOfFrame: +((discBox.height / hostBox.height) * 100).toFixed(2),
    squarePx: +(discBox.width - discBox.height).toFixed(2),
    round,
    centreX: +(((discBox.left + discBox.right) / 2 - hostBox.left) / hostBox.width * 100).toFixed(1),
    centreY: +(((discBox.top + discBox.bottom) / 2 - hostBox.top) / hostBox.height * 100).toFixed(1),
    glyph: mark ? mark.textContent : null,
    // AGAINST THE CONTENT BOX, because that is what `cqh` resolves against —
    // measured, not assumed: a 13.30px disc with a 1.5px border has an 11.30px
    // content box (the border rounds to one device pixel a side at DPR 1), and
    // `62cqh` computes to 7.00px there. Comparing the glyph to the disc's
    // BORDER box instead reads 52.7% and looks like a bug in the CSS when it is
    // only the wrong denominator — which is exactly what this row first did.
    glyphPctOfDisc: mark
      ? +((Number.parseFloat(getComputedStyle(mark).fontSize) / disc.clientHeight) * 100).toFixed(1)
      : null,
    // The mirror question the facing layer exists to answer: the glyph is text,
    // so it must never be mirrored on any surface.
    discTransform: getComputedStyle(disc).transform,
  };
}

async function main() {
  // fileURLToPath, never `new URL(...).pathname`: the latter leaves a percent-
  // encoded path that breaks from a working directory with a space in it, and
  // tools/urlpath-conversions.mjs refuses it across tools/ and tests/. It
  // caught this file on its first run.
  const served = await serve({ root: ROOT, port: 8412, open: false });
  const launched = await launchBrowser({ prefix: 'sigil-', browser: process.env.CHROME, timeoutMs: 20000 });
  const cdp = connect(launched.wsUrl);
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 760, deviceScaleFactor: 1, mobile: false }, sessionId);
    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(`page threw: ${JSON.stringify(result.exceptionDetails).slice(0, 300)}`);
      return result.result?.value;
    };
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));

    // Read from the module, never retyped: this tool has no opinion on WHERE
    // the chest is, only that the overlay goes where the measurement says.
    const anchors = Object.fromEntries([...new Set(SURFACES.map((s) => s.cls))]
      .map((cls) => [cls, medallionAnchor(cls)]));
    const declared = Object.entries(anchors).filter(([, a]) => a && Number.isFinite(a.x) && Number.isFinite(a.y));
    ok(declared.length === Object.keys(anchors).length,
      'EVERY EXERCISED ANCHOR CARRIES BOTH AXES',
      Object.entries(anchors).map(([cls, a]) => `${cls} ${a ? `x${a.x} y${a.y}` : 'null'}`).join(', '));
    const offCentre = declared.filter(([, a]) => a.x !== 50);
    ok(offCentre.length > 0,
      'AN OFF-CENTRE ANCHOR IS EXERCISED',
      offCentre.length
        ? `${offCentre.map(([cls, a]) => `${cls} x${a.x}`).join(', ')} — so a hardcoded left:50% fails a row`
        : 'every exercised class measures x50, so this tool cannot tell an honoured x from an ignored one');
    for (const [cls, a] of Object.entries(anchors)) {
      if (!a) throw new Error(`${cls} has no medallion anchor; this tool cannot assert an overlay that is designed to be absent`);
    }

    const settings = encodeURIComponent(JSON.stringify({ reducedMotion: false }));
    for (const surface of SURFACES) {
      const poses = surface.shot === 'customize' ? `&shotClass=${surface.cls}` : '';
      await cdp.send('Page.navigate', { url: `${served.url}?shot=${surface.shot}${poses}&shotSettings=${settings}` }, sessionId);
      const deadline = Date.now() + 15000;
      let seen = false;
      while (Date.now() < deadline) {
        // CHARACTER CREATION IS FOUR CLOSED SECTIONS, so the figure is IN THE
        // DOM long before it has a size: `mountCustomize` builds the whole
        // flow as one `details` disclosure and opens `class`, and the figure
        // well lives in `character`. Waiting on `.class-sprite` alone read a
        // 0x0 frame — every geometry row divided by zero and came back `null`
        // through CDP, which serialises NaN and Infinity as null and so looked
        // like a missing measurement rather than a closed section. So the
        // section is OPENED, the way a player opens it, and the wait is for a
        // frame with a height rather than a frame that merely exists.
        if (surface.shot === 'customize') {
          await evaluate(`document.querySelector('[data-face="character"]')?.click(), 1`).catch(() => false);
        }
        const height = await evaluate(
          `(document.querySelector('.class-sprite')?.getBoundingClientRect().height ?? 0)`,
        ).catch(() => 0);
        if (height > 1) { seen = true; break; }
        await wait(120);
      }
      const tag = surface.name.toUpperCase();
      ok(seen, `${tag} DRAWS A FIGURE WITH A SIZE`, surface.why);
      if (!seen) continue;
      await wait(250);
      const read = await evaluate(`(${readMedallion.toString()})()`);
      const anchor = anchors[surface.cls];

      // THE CONTRACT INVERTED, 2026-09-07, on the owner's call. This tool was
      // written because a chosen sigil appeared NOWHERE on the figure, and it
      // asserted the medallion was present, round, on the measured anchor,
      // scaled and unmirrored. The sigil is no longer meant to ride the figure
      // at all: it belongs beside the class information in the class picker,
      // which is where a player chooses it. So the rows below assert its
      // ABSENCE from the figure. The tool is re-pointed rather than deleted —
      // the failure it was built to catch (a sigil silently drawn nowhere) has
      // simply become a sigil silently drawn SOMEWHERE it should not be, and
      // that wants a gate just as much. `anchor` stays read from
      // classArtAnchors.js so a stray overlay is reported against the place it
      // would have landed.
      ok(!read.disc && !read.svgSigil, `${tag} NO SIGIL ON THE FIGURE`,
        read.disc
          ? `an overlay is drawn on the ${read.style} style at x${read.centreX} y${read.centreY}`
            + ` (the anchor is x${anchor.x} y${anchor.y}) — the sigil belongs in the class picker, not on the character`
          : read.svgSigil
            ? `the classic SVG silhouette draws '${read.svgSigil}' on the chest through sigilMedallion()`
              + ` — build() is still being handed the chosen sigil`
            : `clean on the ${read.style} style; the frame drew ${JSON.stringify(read.drew)}`);
    }
  } finally {
    cdp.close();
    await launched.close();
    served.close?.();
  }

  console.log(`\nsigil-medallion: ${failures ? 'RED' : 'OK'} — ${checks - failures}/${checks} checks passed`
    + ` across ${SURFACES.length} surface(s); the anchors come from src/content/classArtAnchors.js`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(`sigil-medallion: ${error.message}`);
  process.exit(1);
});
