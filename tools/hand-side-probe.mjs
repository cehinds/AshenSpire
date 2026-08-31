#!/usr/bin/env node
// tools/hand-side-probe.mjs — WHICH SIDE OF THE MODEL IS AN ARMAMENT DRAWN ON?
//
// Constantine, 2026-08-21: "in armory, the right hand and left hand weapons are
// on the wrong side on the character model in all views armory, character
// creation and combat. the sword shows on my right side of the screen, but on
// the left side of the character since it's facing the player."
//
// THE GEOMETRY, so this is checkable rather than arguable. The figure FACES the
// viewer. Facing someone, their right hand is on YOUR LEFT — the same reason a
// mirror is not a photograph. So, with x measured rightward on screen:
//
//     hand === 'right'  ->  ink centroid must be LEFT of the body's centre
//     hand === 'left'   ->  ink centroid must be RIGHT of the body's centre
//
// WHAT IS MEASURED. The producer bakes each full-frame layer at a TYPE-DEFAULT
// socket: shields at LX, everything else at RX. That is not the weapon row's
// `hand` value. `hand` is eligibility; figureSpec() reads the actual slot and
// supplies a per-layer mirror when the piece is moved away from its authored
// socket. ARM 2 exercises every legal slot placement, including BOTH placements
// for `hand=either`, through the same global and per-layer mirrors the player
// receives.
//
// THE READING IS AN ALPHA-WEIGHTED CENTROID, not a bounding box. A bounding box
// is decided by the single most extreme pixel, so one stray anti-aliased texel
// from a crossguard moves the verdict and nothing reports that it did. The
// centroid is carried by the mass of the piece.
//
// THE X ORIGIN IS THE BODY'S OWN INK, never the canvas centre. A figure that
// does not sit centred in its own frame would otherwise read as handed when it
// is only off-centre — and that error looks EXACTLY like the defect being
// hunted, which is the one confusion this probe must not ship.
//
// TWO ARMS, AND ONLY ONE OF THEM IS THE GATE.
//   ARM 1 (diagnostic) reads each RAW ASSET once and reports its type-default
//     socket. It REPORTS and never decides the exit code.
//   ARM 2 (the gate) measures THE RENDERED FIGURE through the shipped
//     stylesheet — the pixels a player actually receives, CSS transform and
//     all. This is what must be green, and it is what goes red the moment the
//     correction in styles/ui.css is removed or double-applied.
//
//   node tools/hand-side-probe.mjs            → both arms; exit 1 if ARM 2 is wrong
//   node tools/hand-side-probe.mjs --selftest → both directions planted

import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BODY = 'assets/equipment/body_reaver_default.webp';

// A centroid this close to the body's centre is NOT a side. Two-handed pieces
// and pole weapons sit near the midline by design, so a hard `< 0` test would
// score them as handed on whichever side noise fell. Expressed as a fraction of
// the body's own ink width so it does not become a pixel literal that a resize
// silently invalidates.
const NEUTRAL_BAND = 0.04;

// A PNG reader, because ARM 2 must read what the COMPOSITOR produced. A CSS
// transform exists only in the rendered frame: `drawImage` into a canvas
// re-rasterises the source bitmap and sees no transform at all, so an in-page
// canvas reading would report the asset again under a second name and agree
// with itself for the wrong reason.
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; colour = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, interlace ${interlace})`);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
  if (!ch) throw new Error(`unsupported PNG colour type ${colour}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, ch, px: out };
}

// Ink centroid of a rendered frame, against a BACKDROP the harness painted, so
// "ink" means "the figure" and not "every pixel the page drew".
function centroidOf(png) {
  const { w, h, ch, px } = decodePng(png);
  let sum = 0, wx = 0, min = Infinity, max = -Infinity, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      // The harness paints pure magenta; anything not magenta is the figure.
      const isBackdrop = px[i] > 240 && px[i + 1] < 20 && px[i + 2] > 240;
      if (isBackdrop) continue;
      const weight = 255;
      sum += weight; wx += weight * x; n++;
      if (x < min) min = x;
      if (x > max) max = x;
    }
  }
  if (!n) return null;
  return { centroid: wx / sum, min, max, pixels: n, w, h };
}

// weapons.csv QUOTES ANY FIELD CONTAINING A COMMA — `blurb` does it repeatedly
// ("Slow, and it does not care."). A positional `line.split(',')` shifts every
// column after that field, so the one column this function must read correctly
// is precisely the one a naive split gets wrong. This reads quoted fields
// properly rather than approximately.
function csvFields(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') { cur += c; continue; }
      if (line[i + 1] === '"') { cur += '"'; i++; continue; }
      quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// weapons.csv carries no machine-readable header row (line 1 is a comment), so
// the column contract is positional. Named here rather than counted inline.
const COL = { id: 0, kind: 2, hand: 3, artKey: 17 };

// THE ASSET IS DERIVED THE WAY THE RUNTIME DERIVES IT — that is now this
// function's whole job. `src/model/loadout.js:962` reads `piece.artKey ||
// piece.id`, so a row may point at ANOTHER row's art. Deriving from `id` alone
// measures a DIFFERENT POPULATION than the one that reaches the player, and
// then reports the size of its own set as though it were the file's.
//
// THAT ALREADY HAPPENED HERE, and it is why this comment is long. `shortbow`
// (hand=right, artKey=dagger) is the only non-identity artKey in the file.
// Under the id-only rule there is no `weapon_shortbow.webp`, an `existsSync`
// guard `continue`d past it WITHOUT PRINTING A LINE, and the tool reported
// "22 of 23" out of a file holding 24 handed rows. Nothing was wrong on the
// screen and every number looked reproducible. Law 0 clause 5 exactly: the
// silent plausible derivation is the dangerous one, not the loud missing one.
//
// Every armament enters once per legal slot. `either` therefore enters TWICE;
// turning it into one convenient default would recreate the issue as a test
// omission. One whose asset is absent is named and fails the gate.
function armaments() {
  const csv = readFileSync(resolve(ROOT, 'content/source/weapons.csv'), 'utf8');
  const rows = [];
  for (const line of csv.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const f = csvFields(line);
    const id = f[COL.id];
    const kind = f[COL.kind];
    const hand = f[COL.hand];
    if (!id || !['left', 'right', 'either'].includes(hand)) continue;
    // The runtime's own rule, `loadout.js:962`.
    const art = (f[COL.artKey] || '').trim() || id;
    const url = `assets/equipment/weapon_${art}.webp`;
    const authoredHand = kind === 'shield' ? 'left' : 'right';
    const hands = hand === 'either' ? ['left', 'right'] : [hand];
    for (const slotHand of hands) {
      rows.push({
        id: `${id}@${slotHand}`,
        pieceId: id,
        hand: slotHand,
        declaredHand: hand,
        authoredHand,
        art,
        url,
        missing: !existsSync(resolve(ROOT, url)),
      });
    }
  }
  return rows;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const pair = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? pair.no(new Error(msg.error.message)) : pair.ok(msg.result);
  };
  return {
    ready: new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; }),
    send(method, params = {}, sessionId) {
      const call = ++id;
      return new Promise((ok, no) => {
        pending.set(call, { ok, no });
        ws.send(JSON.stringify({ id: call, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

// Runs IN THE PAGE. Returns, per armament, the alpha-weighted centroid x and the
// body's ink centre and width — the raw numbers, so the verdict is computed here
// in node where it can be printed next to what produced it.
const MEASURE = (bodyUrl, pieces) => `(async () => {
  const load = (src) => new Promise((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i); i.onerror = () => no(new Error('load failed: ' + src));
    i.src = src;
  });
  const ink = async (src) => {
    const img = await load(src);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, wx = 0, min = Infinity, max = -Infinity;
    for (let py = 0; py < c.height; py++) {
      for (let px = 0; px < c.width; px++) {
        const a = d[(py * c.width + px) * 4 + 3];
        if (a < 16) continue;
        sum += a; wx += a * px;
        if (px < min) min = px;
        if (px > max) max = px;
      }
    }
    if (!sum) return null;
    return { centroid: wx / sum, min, max, width: c.width };
  };
  const body = await ink(${JSON.stringify(bodyUrl)});
  const out = [];
  for (const p of ${JSON.stringify(pieces)}) {
    let r = null, err = null;
    try { r = await ink(p.url); } catch (e) { err = String(e.message || e); }
    out.push({ ...p, piece: r, err });
  }
  return { body, out };
})()`;

// ARM 2 — THE GATE. Renders the real containers through the shipped stylesheet
// and reads the frame the compositor produced.
//
// The figure is mounted with the SAME class names the app uses, so it inherits
// whatever styles/ui.css says today. `.equipped-figure` is mounted BARE here,
// which is the Armoury's shape; the combat shape (nested inside `.class-sprite`)
// is measured too, because those two are exactly the pair that a careless mirror
// rule collapses to identity.
async function renderedMeasure(cdp, S, port, pieces) {
  // THE FIRST FRAME AFTER A MOUNT IS NOT THE PAGE. Measured: the same shape
  // photographed twice differed by 5.71px, and the nesting check was reporting
  // that noise as a finding about the page — a red that arrived exactly where
  // one was expected. The first capture is taken and DISCARDED so the surface
  // has composited before the one that counts. The repeatability control below
  // is what proves this worked, and it is not removable: without it this is a
  // fix nobody can see fail.
  const shoot = async () => {
    await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, S);
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, S);
    return centroidOf(Buffer.from(r.data, 'base64'));
  };
  const mount = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'mount threw');
    return r.result.value;
  };
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 500, deviceScaleFactor: 1, mobile: false }, S);

  const HARNESS = `(async () => {
    const [{ equippedFigure }, { figureSpec }, { ARMAMENTS, ARMOUR, SLOTS }] = await Promise.all([
      import('/src/ui/assets.js'),
      import('/src/model/loadout.js'),
      import('/src/content/equipment.js'),
    ]);
    const registries = { equipment: { armaments: ARMAMENTS, armour: ARMOUR, slots: SLOTS } };
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#ff00ff;width:400px;height:500px;overflow:hidden';
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:500px;background:#ff00ff;';
    document.body.appendChild(host);
    window.__probeShow = async (wrapper, piece) => {
      host.innerHTML = '';
      let outer = host;
      if (wrapper === 'nested') {
        const cs = document.createElement('div');
        cs.className = 'class-sprite';
        cs.style.cssText = 'position:absolute;inset:0;';
        host.appendChild(cs);
        outer = cs;
      }
      const slotId = piece && piece.hand === 'left' ? 'leftHand' : 'rightHand';
      const loadout = piece ? {
        sets: { [slotId]: [piece.pieceId] },
        active: { [slotId]: 0 },
      } : { sets: {}, active: {} };
      const spec = figureSpec(registries, loadout, 'reaver');
      const fig = equippedFigure({ classId: 'reaver', ...spec });
      if (!fig) throw new Error('equippedFigure returned no Reaver figure');
      fig.style.position = 'absolute';
      fig.style.inset = '0';
      outer.appendChild(fig);
      const images = [...fig.querySelectorAll('img')];
      await Promise.all(images.map((img) => img.decode().catch(() => null)));
      // Piece readings exclude body pixels, but preserve the exact element,
      // layer transform and enclosing shipped CSS produced by the runtime.
      if (piece) {
        const body = images.find((img) => img.getAttribute('src').includes('/body_'));
        if (body) body.style.visibility = 'hidden';
      }
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      return true;
    };
    return true;
  })()`;
  await mount(HARNESS);
  const show = (wrapper, piece) => mount(`window.__probeShow(${JSON.stringify(wrapper)}, ${JSON.stringify(piece)})`);

  await show('bare', null);
  const bodyBare = await shoot();

  // THE NESTING PROBE MUST BE ASYMMETRIC, and the first version of it was not.
  // It compared the BODY's centroid bare vs nested — and the bodies are
  // symmetric in shape to within 0.3%, so a mirror moves their centroid by
  // nothing and a double mirror was invisible. Plant P2 walked straight through
  // it. The subject is now an ARMAMENT, whose whole point is that it sits on one
  // side: bare and nested must put it on the SAME side, or the mirror count
  // differs between the Armoury and the combat board.
  const witness = pieces.find((p) => p.hand === 'right') || pieces[0];
  await show('bare', witness);
  const witnessBare = await shoot();
  await show('nested', witness);
  const witnessNested = await shoot();
  // REPEATABILITY CONTROL. A difference between two SHAPES means nothing until
  // the same shape twice means nothing — otherwise noise in the harness is read
  // as a finding about the page. Measured before the shapes are compared.
  await show('bare', witness);
  const witnessBareAgain = await shoot();

  const rows = [];
  for (const p of pieces) {
    await show('bare', p);
    rows.push({ ...p, piece: await shoot() });
  }
  return { bodyBare, witnessBare, witnessNested, witnessBareAgain, witness, rows };
}

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  // `assets` is NOT in doorplant's COPY_SET and this probe reads nothing else:
  // without it every plant would fail to load an image and go red for a reason
  // that has nothing to do with handedness — a catch that proves nothing.
  process.exit(await doorSelftest({
    tool: 'hand-side-probe.mjs',
    extraCopy: ['assets'],
    env: process.env.CHROME ? { CHROME: process.env.CHROME } : {},
    plants: [
      {
        // DIRECTION 1 — the correction is gone. This is the shipped defect.
        name: 'P1 the mirror is removed — the reported bug, restored',
        file: 'styles/ui.css',
        find: '.equipped-figure { transform: scaleX(-1); }',
        replace: '.equipped-figure { transform: none; }',
        expectRed: /WRONG straightSword@right.*drawn viewer-right/,
      },
      {
        // DIRECTION 2 — mirrored the WRONG WAY: applied TWICE on the nested
        // shape, which cancels to identity on the combat board while the
        // Armoury still looks fixed. This is the plant a per-selector rule
        // written without the guard would walk straight into, and NO per-piece
        // row goes red for it — only the nesting check can see it.
        name: 'P2 the one-mirror guard is removed — combat double-mirrors back to the bug',
        file: 'styles/ui.css',
        find: '.class-sprite .equipped-figure { transform: none; }',
        replace: '/* guard removed */',
        expectRed: /WRONG ONE MIRROR PER FIGURE/,
      },
      {
        name: 'P3 a slot correction is removed — either-hand pieces collapse to their authored socket',
        file: 'src/model/loadout.js',
        find: "      spec.leftMirror = piece.kind !== 'shield';",
        replace: "      spec.leftMirror = false;",
        expectRed: /WRONG .*@(left|right)/,
      },
      {
        name: 'P4 the asset is derived from `id` alone — an artKey borrower is named missing',
        file: 'tools/hand-side-probe.mjs',
        find: "    const art = (f[COL.artKey] || '').trim() || id;",
        replace: "    const art = id;",
        expectRed: /MISSING shortbow@.*never measured/,
      },
      {
        name: 'P5 hand=either is collapsed to one convenient slot',
        file: 'tools/hand-side-probe.mjs',
        find: "    const hands = hand === 'either' ? ['left', 'right'] : [hand];",
        replace: "    const hands = [authoredHand];",
        expectRed: /POPULATION WRONG.*hand=either.*both left and right/,
      },
    ],
  }));
}

async function run(port, pieces) {
  const launched = await launchBrowser({ prefix: 'handside-', headless: '--headless=new' });
  const cdp = connect(launched.wsUrl);
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S);
    await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Page.navigate', { url: `http://localhost:${port}/` }, S);
    await new Promise((r) => setTimeout(r, 1200));
    const sources = [...new Map(pieces.map((piece) => [piece.pieceId, {
      ...piece, id: piece.pieceId, hand: piece.authoredHand,
    }])).values()];
    const res = await cdp.send('Runtime.evaluate',
      { expression: MEASURE(BODY, sources), awaitPromise: true, returnByValue: true }, S);
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text || 'evaluate threw');
    const asset = res.result.value;
    const rendered = await renderedMeasure(cdp, S, port, pieces);
    return { asset, rendered };
  } finally {
    cdp.close();
    await launched.close();
  }
}

function sideOf(dx, band) {
  return Math.abs(dx) <= band ? 'centre' : (dx < 0 ? 'viewer-left' : 'viewer-right');
}
const wantFor = (hand) => (hand === 'right' ? 'viewer-left' : 'viewer-right');
// Raw producer coordinates predate the viewer-facing correction: RX appears on
// the viewer's right and LX on the viewer's left. The global CSS mirror converts
// those authored sockets into the model-hand convention used by wantFor().
const rawWantFor = (hand) => (hand === 'right' ? 'viewer-right' : 'viewer-left');

async function main() {
  // The population is every legal armament-to-slot placement. Every `either`
  // row contributes two named cases.
  const population = armaments();
  const eitherByPiece = new Map();
  for (const row of population.filter((candidate) => candidate.declaredHand === 'either')) {
    const hands = eitherByPiece.get(row.pieceId) || new Set();
    hands.add(row.hand);
    eitherByPiece.set(row.pieceId, hands);
  }
  const populationFindings = [...eitherByPiece]
    .filter(([, hands]) => !hands.has('left') || !hands.has('right'))
    .map(([id]) => `${id}: hand=either must exercise both left and right slots`);
  for (const reason of populationFindings) console.log(`POPULATION WRONG — ${reason}`);
  if (populationFindings.length) return 1;
  const absent = population.filter((r) => r.missing);
  const pieces = population.filter((r) => !r.missing);
  if (!population.length) throw new Error('no legal armament placement was found in weapons.csv — an empty corpus is not a pass');
  if (!pieces.length) throw new Error('every armament is missing its asset — nothing could be measured at all');
  const served = await serve({ root: ROOT, port: 8471, open: false });
  try {
    const { asset, rendered } = await run(served.port, pieces);

    // ---- ARM 1 · the baked convention (diagnostic, never the exit code) ----
    const bw = asset.body.max - asset.body.min;
    const band1 = bw * NEUTRAL_BAND;
    let bakedWrong = 0;
    for (const r of asset.out) {
      if (!r.piece) continue;
      if (sideOf(r.piece.centroid - asset.body.centroid, band1) !== rawWantFor(r.hand)) bakedWrong++;
    }
    console.log(`\nARM 1 · the baked art (DIAGNOSTIC — does not decide the exit code)`);
    console.log(`  ${asset.out.length - bakedWrong} of ${asset.out.length} MEASURED armament assets occupy their documented type-default socket.`);
    console.log(`  This is diagnostic only: actual placement belongs to the slot and is measured below.`);

    // ---- ARM 2 · what the player receives (THE GATE) ----
    if (!rendered.bodyBare || !rendered.witnessBare || !rendered.witnessNested) throw new Error('the rendered figure produced no ink — the harness did not draw');
    const rbw = rendered.bodyBare.max - rendered.bodyBare.min;
    const band2 = rbw * NEUTRAL_BAND;
    console.log(`\nARM 2 · the RENDERED figure, through styles/ui.css (THE GATE)`);
    console.log(`  body ink centre x=${rendered.bodyBare.centroid.toFixed(1)} width=${rbw}px · neutral band ±${band2.toFixed(1)}px\n`);
    const bad = [];
    const rows = rendered.rows.slice().sort((a, b) => a.hand.localeCompare(b.hand) || a.id.localeCompare(b.id));
    for (const r of rows) {
      if (!r.piece) { console.log(`  UNREADABLE ${r.id}`); bad.push(r); continue; }
      const dx = r.piece.centroid - rendered.bodyBare.centroid;
      const side = sideOf(dx, band2);
      const want = wantFor(r.hand);
      const ok = side === want;
      const mark = ok ? 'ok  ' : 'WRONG';
      console.log(`  ${mark.padEnd(5)} ${r.id.padEnd(20)} hand=${r.hand.padEnd(5)} dx=${((dx >= 0 ? '+' : '') + dx.toFixed(1)).padStart(7)}  drawn ${side.padEnd(12)} wanted ${want}`);
      if (!ok) bad.push({ ...r, dx, side, want });
    }

    // A HANDED ROW WITH NO ASSET IS NAMED, NOT SUBTRACTED. This is the whole
    // of P6: the measured set may not silently shrink. The row cannot be
    // measured, so it cannot be called correct — it is printed and it is red.
    for (const m of absent) {
      console.log(`  MISSING ${m.id.padEnd(20)} hand=${m.hand.padEnd(5)} art=${m.art} — legal placement never measured`);
      bad.push({ id: m.id, reason: `declared hand=${m.declaredHand} permits slot=${m.hand} but ${m.url} does not exist` });
    }

    // ---- ARM 2b · EXACTLY ONE MIRROR ----
    // The Armoury mounts `.equipped-figure` bare; combat nests it inside
    // `.class-sprite`. A rule that mirrors both selectors cancels to identity on
    // the nested shape, which is the combat board — so the two must agree.
    const dRepeat = Math.abs(rendered.witnessBareAgain.centroid - rendered.witnessBare.centroid);
    console.log(`  repeatability control — the SAME shape measured twice differs by ${dRepeat.toFixed(2)}px`);
    if (dRepeat > 1.0) bad.push({ id: 'repeatability', reason: `the same shape measured twice differs by ${dRepeat.toFixed(2)}px — this harness is too noisy for its own nesting verdict to mean anything` });
    const dNest = Math.abs(rendered.witnessNested.centroid - rendered.witnessBare.centroid);
    const nestOk = dNest <= 1.0;
    console.log(`\n  ${nestOk ? 'ok  ' : 'WRONG'} ONE MIRROR PER FIGURE — bare vs nested differ by ${dNest.toFixed(2)}px, `
      + `measured on ${rendered.witness.id} (an ARMAMENT: the body is symmetric and cannot see this)`);
    console.log(`        (bare = the Armoury's shape, nested = combat's; a double mirror shows up here as a mismatch)`);
    if (!nestOk) bad.push({ id: 'nesting', reason: 'bare and nested figures do not render alike' });

    if (bad.length) {
      console.log(`\nhand-side-probe: RED — ${bad.length} finding(s).`);
      // EVERY finding prints its own line. The first cut pushed ledger findings
      // into `bad` and printed only the COUNT, so two of them could never be
      // named — and a plant that fires a red nobody can read scores as a miss,
      // which is exactly what P5 did.
      for (const b of bad) console.log(`  FINDING ${b.id}: ${b.reason || `drawn ${b.side}, wanted ${b.want}`}`);
      console.log(`  The figure faces the viewer, so a RIGHT-hand piece belongs on the VIEWER'S LEFT.`);
    } else {
      // `population.length`, not `rows.length`: the denominator is what the
      // FILE holds, so the count cannot quietly shrink to the size of whatever
      // this run happened to manage to measure.
      console.log(`\nhand-side-probe: OK — ${rows.length} of ${population.length} legal armament-slot placements reach the player's correct side with exactly one global mirror.`);
      console.log(`  Every hand=either row is measured in both slots; each asset is derived`);
      console.log(`  as artKey || id — the runtime's own rule (src/model/loadout.js:962).`);
    }
    console.log('\nBOUNDARY — what a green here does NOT mean:');
    console.log('  · nothing about a future slot-neutral ART protocol. The current assets keep');
    console.log('    type-default sockets; a re-render must delete the CSS correction in the same act.');
    console.log('  · nothing about the three SCREENS individually. It renders the two CONTAINER');
    console.log('    shapes every view uses, not the views; a screen that stopped using them is');
    console.log('    invisible here.');
    console.log('  · nothing about whether the body faces the viewer — that is read from the');
    console.log('    producers\' own camera ("camera looks from -Y; front is -Y") and asserted, not measured.');
    console.log('  · a `centre` verdict is neither pass nor fail: it is a piece whose mass sits inside');
    console.log('    the neutral band, which this probe declines to call handed.');
    return bad.length ? 1 : 0;
  } finally {
    served.server.close();
  }
}

process.exit(await main());
