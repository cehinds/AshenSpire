#!/usr/bin/env node
// tools/tapsize.mjs — does Minimum tap size actually move the floor, on glass?
//
// WHY THIS EXISTS. `--tap-floor` is the only thing deciding the height of four
// rules in this tree (`.set-tab`, `.ov-tab`, `.choice`, `.region-fold`), and
// Sunna measured that it wins in 60 of 60 readings — content never once beats
// it. So a setting that writes `--tap-target` is the SOLE author of how big
// those controls are, and "it applied" is not something a unit test can say:
// the suite has no DOM, `--tap-floor` is a `calc()` the browser resolves, and
// the number that matters is DEVICE px after `body { zoom }`. This tool is the
// half that has seen the screen.
//
// WHAT IT MEASURES, per cell (shape x UI size x tap size):
//   .set-tabs .set-tab        settings category strip
//   .overlay-tabs .ov-tab     the in-run menu's own strip
//   .choice-group .choice     every settings option chip
//   .region-fold              the armoury's collapsible region headers
// The fourth is why this is not Sunna's probe re-run: hers measured the three
// that live on one screen and said so — `.region-fold` needs the armoury
// opened, which is a different door (`#open-armoury`, the way tools/menufit.mjs
// gets there).
//
// HOW THE FLOOR IS READ, and it is deliberately NOT `getPropertyValue`.
// `getComputedStyle(root).getPropertyValue('--tap-floor')` hands back the
// literal `calc(...)` token; `parseFloat` on it is NaN, which prints as 0 and
// looks like a measurement. Sunna reported that as her own instrument's defect
// and no conclusion of hers rested on it. So: a probe element is appended with
// `height: var(--tap-floor)` and MEASURED — the browser resolves the calc, the
// rect is in device px, offsetHeight is in local px, and the ratio between them
// is the zoom the page actually applied. Nothing here parses a CSS expression.
//
// BOTH EDGES, and they are the whole point:
//   44 — must be byte-identical to the tree before the setting existed. The
//        `--baseline <file>` flag reads a JSON written by a previous run
//        (`--json <file>`) and diffs every cell; any drift at 44 is a FAIL.
//   24 — must actually render. A control still measuring 44.00 at the 24
//        setting is the setting not being wired, and it fails.
//
// AN EMPTY RESULT SET IS NEVER A PASS. The floor is on the DENOMINATOR, never
// on the findings list: this run refuses to report anything unless it measured
// at least MIN_CELLS cells, and every cell must have found every one of the
// four selectors with a non-zero count. A cell that found no `.region-fold`
// prints its emptiness and fails — it does not quietly measure three rules and
// call that a clean sweep.
//
//   node tools/tapsize.mjs                      → the whole space, human table
//   node tools/tapsize.mjs --quick              → one shape, all four sizes
//   node tools/tapsize.mjs --json out.json      → machine-readable, for a baseline
//   node tools/tapsize.mjs --baseline out.json  → diff the 44 column against it
//   node tools/tapsize.mjs --tree DIR           → measure another checkout
//
// BOUNDARY, printed on every run including the clean ones: headless Chromium on
// Linux, `dist/AshenSpire.html`, the shapes and sizes listed below. It says
// nothing about Windows, about a real finger, about whether 24 is WISE, or
// about any control that is not one of the four.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { printArtifactProvenance } from './artifact-provenance.mjs';

// DOOR, and why --selftest exists (Rune, 2026-08-15). The real input is the
// rendered control, measured in device px after `body { zoom }` in a real
// browser — a probe element sized by `var(--tap-floor)` and MEASURED, never a
// parsed CSS token. That door was always right; what it had no re-runnable
// known-bad for was the thing it exists to prove: that the SETTING moves the
// floor. Vira's audit (2026-08-14) rated this NO-KNOWN-BAD. `--selftest`
// plants the un-wired floor back — `--tap-floor` as a constant that ignores
// both the setting and the zoom — and re-runs this whole tool against a copy
// of the tree.
//
// AND THE PLANT GOES INTO dist/AshenSpire.html, NOT styles/. Building this
// corpus is what made me read my own `--dist` default: this tool measures the
// SHIPPED BUNDLE, so a plant in styles/base.css is a plant it never reads —
// it went green on both known-bads until the plant moved to the file the tool
// actually opens. That is the same-door clause catching its own author.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'tapsize.mjs',
    args: ['--quick'],
    timeoutMs: 900000,
    extraCopy: ['dist'],
    plants: [
      {
        // The 24 edge, which the header names as one of the two that are the
        // whole point: a control still measuring 44 at the 24 setting is the
        // setting not being wired.
        name: 'the floor stops answering the setting — --tap-floor pinned at 44 px',
        file: 'dist/AshenSpire.html',
        find: '--tap-floor: calc(var(--tap-target) / var(--ui-zoom, 1));',
        replace: '--tap-floor: 44px;',
        all: true,
        expectRed: /FAIL — \d+ finding\(s\) of \d+ cell\(s\)/,
      },
      {
        // The other direction: the floor resolves to nothing at all, which the
        // header says must be its own finding rather than a measurement
        // against 44.
        name: 'the floor does not resolve at all (every height measured against nothing)',
        file: 'dist/AshenSpire.html',
        find: '--tap-floor: calc(var(--tap-target) / var(--ui-zoom, 1));',
        replace: '--tap-floor: var(--planted-nothing);',
        all: true,
        // Anchored on the tool's own verdict line, not on the word UNKNOWN:
        // the provenance banner prints "UNKNOWN" on every run in a copied
        // tree, so the loose form called a provenance note a catch. A red for
        // the wrong reason is not a catch.
        expectRed: /FAIL — \d+ finding\(s\) of \d+ cell\(s\)/,
      },
    ],
  }));
}

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const TREE = resolve(val('--tree', ROOT));
const QUICK = flag('--quick');
const LEGACY = flag('--legacy');
// MOBILE FIRST, and the order is the ruling rather than a habit. Constantine,
// 2026-08-08: "mobile might need to be the priority for now." So the phone
// shapes are measured FIRST and the desktop shape LAST — a run cut short for
// time has still measured the shape that counts, and `--mobile` drops the
// desktop cells outright and says so in its own boundary line.
const MOBILE_ONLY = flag('--mobile');
const SHAPES = QUICK ? [[390, 844]]
  : MOBILE_ONLY ? [[390, 844], [320, 640]]
  : [[390, 844], [320, 640], [1200, 730]];
const UISIZES = QUICK ? ['Auto'] : ['Auto', 'S', 'M', 'L', 'XL'];
const TEXT = QUICK ? ['M'] : ['M', 'XL'];

// The sizes come from the game's own data, not from a list here — a second copy
// of the closed set is the defect this whole change exists to remove. Read out
// of the source rather than imported, so the tool measures the tree it was
// pointed at instead of the one it lives in.
function tapSizesFromTree() {
  const src = readFileSync(resolve(TREE, 'src/content/balance.js'), 'utf8');
  const m = /tapSize:\s*\{[^}]*?sizes:\s*\[([^\]]+)\]/s.exec(src);
  // A tree without the setting is measurable exactly once, at the constant the
  // stylesheet still carries — that is what --legacy is FOR, so it is not an
  // error there. Anywhere else, a missing set is nothing to measure.
  if (!m && LEGACY) return [legacyConstantFromCss()];
  if (!m) throw new Error('balance.ui.tapSize.sizes not found in the tree — nothing to measure');
  const sizes = m[1].split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  if (sizes.length < 2) throw new Error(`balance.ui.tapSize.sizes parsed to ${sizes.length} entries — refusing to measure a set of one`);
  return sizes;
}

// The constant a pre-setting tree still holds inside --tap-floor. Read, never
// assumed: --legacy against a tree whose floor is not 44 must say 40, not lie.
function legacyConstantFromCss() {
  const css = readFileSync(resolve(TREE, 'styles/base.css'), 'utf8');
  const line = (css.split('\n').find((l) => l.includes('--tap-floor:')) || '');
  const m = /calc\(\s*(\d+(?:\.\d+)?)px/.exec(line);
  if (!m) throw new Error(`--legacy: no literal constant in the --tap-floor line of styles/base.css — got: ${line.trim() || '(no line)'}`);
  return Number(m[1]);
}

// THE SECOND-COPY GUARD. The whole claim of this change is that the constant
// has one home. A literal tap constant re-typed into the stylesheet would agree
// with the data today and be synchronised by nothing.
function stylesheetHoldsNoConstant(sizes) {
  const css = readFileSync(resolve(TREE, 'styles/base.css'), 'utf8');
  const line = css.split('\n').find((l) => l.includes('--tap-floor:'));
  if (!line) return ['styles/base.css declares no --tap-floor at all'];
  const bad = sizes.filter((s) => new RegExp(`\\b${s}px\\b`).test(line));
  return bad.length ? [`styles/base.css --tap-floor line re-types ${bad.join(', ')}px — a second home for the constant`] : [];
}

const SELECTORS = {
  setTab: '.set-tabs .set-tab',
  ovTab: '.overlay-tabs .ov-tab',
  choice: '.choice-group .choice',
  regionFold: '.region-fold',
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BROWSERS = [process.env.CHROME, '/usr/bin/chromium', '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} (${m.error.code})`)); else res(m.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}


async function open() {
  const browser = BROWSERS.find((p) => existsSync(p));
  if (!browser) throw new Error('no Chromium/Chrome found — set CHROME=<path>');
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'tapsize-', browser: browser,
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling'],
    timeoutMs: 20000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const ev = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (x, what, ms = 20000) => {
    const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return true; await wait(120); }
    throw new Error(`timed out waiting for ${what}`);
  };
  return { cdp, S, ev, until, close: () => { cdp.close(); dropBrowser(); } };
}

// The read. Every number is a RENDERED number: rects for device px, offsetHeight
// for local px, and the floor itself measured off a probe element rather than
// parsed out of a custom property.
const READ = (sels) => `(() => {
  const n = (v) => Math.round(v * 100) / 100;
  // The floor, measured. A div sized by the same var every floored rule uses.
  const p = document.createElement('div');
  p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;padding:0;border:0;height:var(--tap-floor)';
  document.body.appendChild(p);
  const floorDevice = n(p.getBoundingClientRect().height);
  const floorLocal = n(p.offsetHeight);
  p.remove();
  const target = getComputedStyle(document.documentElement).getPropertyValue('--tap-target').trim();
  const zoom = n(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1);
  const grp = (sel) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (!els.length) return { count: 0 };
    const hs = els.map((e) => e.getBoundingClientRect().height);
    return { count: els.length, hMin: n(Math.min(...hs)), hMax: n(Math.max(...hs)), minH: getComputedStyle(els[0]).minHeight };
  };
  const out = { zoom, target, floorDevice, floorLocal, groups: {} };
  ${Object.entries(sels).map(([k, s]) => `out.groups[${JSON.stringify(k)}] = grp(${JSON.stringify(s)});`).join('\n  ')}
  return out;
})()`;

// The cost line under the row: present only below the largest size, and it must
// CHANGE with the value or it is decoration (Sunna's rule, aimed at her own
// proposal). Read as text off the rendered page.
const READ_COST = `(() => {
  const slot = document.querySelector('[data-applied="tapFloor"]');
  if (!slot) return { slot: false };
  return { slot: true, text: (slot.textContent || '').replace(/\\s+/g, ' ').trim() };
})()`;

async function cell(b, href, w, h, ui, tx, tap) {
  // `--legacy` measures a tree that does not HAVE the setting: no tapFloor in
  // the URL, no `--tap-target` to check, and the cell key carries no tap
  // suffix. That is what makes edge 1 a real diff rather than an assertion —
  // the baseline is the tree before the setting existed, measured by this same
  // instrument, and `--baseline` compares the 44 column against it cell for
  // cell. A "byte-identical" claim nobody diffed is an opinion.
  const shotSettings = LEGACY ? { uiScale: ui, textSize: tx } : { uiScale: ui, textSize: tx, tapFloor: String(tap) };
  const q = encodeURIComponent(JSON.stringify(shotSettings));
  await b.cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 }, b.S);
  await b.cdp.send('Page.navigate', { url: `${href}?shot=map&shotSettings=${q}` }, b.S);
  await b.until(`!!document.querySelector('.map-node')`, 'the map');
  await wait(400);

  // Door 1 — the armoury, for `.region-fold`. Opened FIRST because it closes
  // again; the overlay does not.
  await b.ev(`(() => { const x = document.querySelector('#open-armoury'); if (x) x.click(); return !!x; })()`);
  await b.until(`!!document.querySelector('.armoury')`, 'the armoury');
  await wait(300);
  const fold = await b.ev(READ(({ regionFold: SELECTORS.regionFold })));
  await b.ev(`(() => { const bs = [...document.querySelectorAll('.armoury button')]
    .find((x) => /close|✕|×/i.test(x.textContent || x.title || '')); if (bs) bs.click(); return 1; })()`);
  await wait(300);

  // Door 2 — the ☰ overlay and its Settings tab, for the other three.
  await b.ev(`(() => { const bs = [...document.querySelectorAll('button')];
    const m = bs.find((x) => /☰/.test(x.textContent)) || bs.find((x) => /menu/i.test(x.getAttribute('aria-label') || ''));
    if (m) m.click(); return !!m; })()`);
  await b.until(`!!document.querySelector('.overlay-tabs .ov-tab')`, 'the overlay strip');
  await wait(250);
  await b.ev(`(() => { const t = [...document.querySelectorAll('.overlay-tabs .ov-tab')].find((x) => /settings/i.test(x.textContent));
    if (t) t.click(); return !!t; })()`);
  await b.until(`!!document.querySelector('.set-tabs .set-tab')`, 'the settings strip');
  await wait(250);
  // Onto Accessibility, where the row lives — the chips must be on screen for
  // `.choice` to have anything to measure and for the cost line to exist.
  await b.ev(`(() => { const t = [...document.querySelectorAll('.set-tabs .set-tab')].find((x) => /accessibility/i.test(x.textContent));
    if (t) t.click(); return !!t; })()`);
  if (!LEGACY) await b.until(`!!document.querySelector('[data-applied="tapFloor"]')`, 'the tap-size row');
  await wait(250);

  const main = await b.ev(READ(({ setTab: SELECTORS.setTab, ovTab: SELECTORS.ovTab, choice: SELECTORS.choice })));
  const cost = await b.ev(READ_COST);
  return {
    key: LEGACY ? `${w}x${h}/ui${ui}/text${tx}` : `${w}x${h}/ui${ui}/text${tx}/tap${tap}`,
    w, h, ui, tx, tap,
    zoom: main.zoom, target: main.target,
    floorDevice: main.floorDevice, floorLocal: main.floorLocal,
    groups: { ...main.groups, ...fold.groups },
    cost: cost.slot ? cost.text : null,
  };
}

// ---------------------------------------------------------------------------

const SIZES = tapSizesFromTree();
const MAX = Math.max(...SIZES);
// The denominator's floor. Not a findings floor — a run that measured nothing
// must print its emptiness, and a run that measured less than it set out to
// must fail rather than report a clean sweep over a shrunken space.
const EXPECT_CELLS = SHAPES.length * UISIZES.length * TEXT.length * SIZES.length;
const MIN_CELLS = EXPECT_CELLS;
// THE FULL SPACE, ALWAYS COMPUTED, so a narrowed run can say what it narrowed
// FROM. Vira's finding on the arm below: `--quick` shrinks the space AND the
// expectation together, so the headline read `PASS — 4/4 cells` over a tenth of
// the space. Every number was honest; the defect was an ASYMMETRY — `--mobile`
// earned a named boundary sentence and `--quick` earned only numbers, so the
// two narrowings did not cost the same to state. Derived from the same arrays,
// never typed, so it cannot drift from what a full run would actually measure.
const FULL_CELLS = 3 * 5 * 2 * SIZES.length; // 3 shapes x 5 UI sizes x 2 text sizes
const NARROWED = [QUICK ? '--quick' : null, MOBILE_ONLY ? '--mobile' : null].filter(Boolean).join(' + ');

const href = pathToFileURL(resolve(TREE, 'dist/AshenSpire.html')).href;
if (!existsSync(resolve(TREE, 'dist/AshenSpire.html'))) {
  console.error(`tapsize: no dist/AshenSpire.html under ${TREE} — run node tools/launch.mjs --build-only first`);
  process.exit(1);
}
// WHICH TREE DID THIS SEE. --tree means this tool routinely measures a bundle
// that is NOT the one beside it, which is exactly the case where naming the
// file says least. Provenance is of TREE, never of ROOT.
printArtifactProvenance(resolve(TREE, 'dist/AshenSpire.html'), TREE);

const findings = LEGACY ? [] : [...stylesheetHoldsNoConstant(SIZES)];
const rows = [];
const b = await open();
try {
  for (const [w, h] of SHAPES) {
    for (const ui of UISIZES) {
      for (const tx of TEXT) {
        for (const tap of SIZES) rows.push(await cell(b, href, w, h, ui, tx, tap));
      }
    }
  }
} finally {
  b.close();
}

// ---- the denominator, before any verdict ----------------------------------
console.log(`\ntapsize — ${TREE}`);
console.log(`  space          : ${SHAPES.length} shape(s) x ${UISIZES.length} UI size(s) x ${TEXT.length} text size(s) x ${SIZES.length} tap size(s)`);
console.log(`  cells expected : ${EXPECT_CELLS}${NARROWED ? ` of ${FULL_CELLS} in the full space (${NARROWED})` : ''}`);
console.log(`  cells measured : ${rows.length}`);
if (rows.length < MIN_CELLS) {
  console.log(`\n  EMPTY OR SHORT — measured ${rows.length} of ${EXPECT_CELLS} cells. Nothing below is a verdict.`);
  process.exit(1);
}

// Every cell must have found every selector. A missing group is a cell that
// measured three rules and would otherwise look identical to a clean one.
const RULES = Object.keys(SELECTORS);
let controlsSeen = 0;
for (const r of rows) {
  for (const k of RULES) {
    const g = r.groups[k];
    if (!g || !g.count) findings.push(`${r.key}: found NO ${k} (${SELECTORS[k]}) — an unmeasured rule, not a clean one`);
    else controlsSeen += g.count;
  }
  if (!LEGACY && r.target !== `${r.tap}px`) findings.push(`${r.key}: --tap-target is '${r.target}', expected '${r.tap}px' — the setting did not reach the page`);
}
console.log(`  controls read  : ${controlsSeen} across ${rows.length * RULES.length} (cell x rule) slots`);
if (!controlsSeen) {
  console.log('\n  MEASURED NOTHING. No verdict.');
  process.exit(1);
}

// ---- the table ------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n  ${pad('cell', 30)}${pad('zoom', 7)}${pad('floor(dev)', 12)}${RULES.map((k) => pad(k, 16)).join('')}`);
for (const r of rows) {
  const cells = RULES.map((k) => {
    const g = r.groups[k];
    return pad(g && g.count ? `${g.hMin}-${g.hMax} (${g.count})` : 'NONE', 16);
  }).join('');
  console.log(`  ${pad(r.key, 30)}${pad(r.zoom, 7)}${pad(r.floorDevice, 12)}${cells}`);
}

// ---- EDGE 1: the top of the dial is today, everywhere ----------------------
// At the largest size every floored control must measure exactly that many
// device px, in every cell — which is the number Sunna measured on the tree
// before this setting existed, with zero variance across the same space.
const top = rows.filter((r) => r.tap === MAX);
for (const r of top) {
  if (Math.abs(r.floorDevice - MAX) > 0.51) findings.push(`${r.key}: floor measured ${r.floorDevice} device px, expected ${MAX}`);
  for (const k of RULES) {
    const g = r.groups[k];
    if (g && g.count && g.hMin < MAX - 0.51) findings.push(`${r.key}: ${k} shrank to ${g.hMin} at the ${MAX} setting — the default is not today`);
  }
}

// ---- EDGE 2: the bottom of the dial actually renders -----------------------
const MIN = Math.min(...SIZES);
const bottom = LEGACY ? [] : rows.filter((r) => r.tap === MIN);
for (const r of bottom) {
  if (Math.abs(r.floorDevice - MIN) > 0.51) findings.push(`${r.key}: floor measured ${r.floorDevice} device px, expected ${MIN}`);
  const stuck = RULES.filter((k) => r.groups[k] && r.groups[k].count && r.groups[k].hMin >= MAX - 0.51);
  if (stuck.length === RULES.length) findings.push(`${r.key}: every rule still measures ${MAX}+ at the ${MIN} setting — the setting is inert`);
}

// ---- the cost line: silent at the top, present and CHANGING below it -------
const byTap = new Map();
// '' and null are the same state — the slot is there and says nothing. Folded
// here so the table prints one word for one state.
for (const r of rows) if (!byTap.has(r.tap)) byTap.set(r.tap, r.cost || null);
if (!LEGACY) for (const [tap, cost] of byTap) {
  if (tap === MAX && cost) findings.push(`cost line at ${tap} says "${cost}" — the top of the dial must be silent`);
  if (tap !== MAX && !cost) findings.push(`cost line missing at ${tap} — below the top it must say what the choice costs`);
  if (tap !== MAX && cost && !cost.includes(String(tap))) findings.push(`cost line at ${tap} does not name the value chosen: "${cost}"`);
}
const distinct = new Set([...byTap.entries()].filter(([t]) => t !== MAX).map(([, c]) => c));
if (!LEGACY && distinct.size !== SIZES.length - 1) findings.push(`cost lines below ${MAX} are not all distinct (${distinct.size} of ${SIZES.length - 1}) — a line that does not change with the value is decoration`);
if (!LEGACY) {
  console.log('\n  cost line, by size:');
  for (const [tap, cost] of byTap) console.log(`    ${pad(tap, 5)}${cost === null ? '(silent)' : `"${cost}"`}`);
}

// ---- optional: diff the whole space against a recorded baseline ------------
const baseFile = val('--baseline', null);
if (baseFile) {
  const base = JSON.parse(readFileSync(resolve(baseFile), 'utf8'));
  const byKey = new Map(base.rows.map((r) => [r.key, r]));
  let compared = 0;
  for (const r of rows.filter((x) => x.tap === MAX)) {
    const o = byKey.get(r.key) || byKey.get(r.key.replace(`/tap${MAX}`, ''));
    if (!o) continue;
    compared++;
    for (const k of RULES) {
      const a = r.groups[k]; const c = o.groups && o.groups[k];
      if (!a || !c || !a.count || !c.count) continue;
      if (Math.abs(a.hMin - c.hMin) > 0.01 || Math.abs(a.hMax - c.hMax) > 0.01) {
        findings.push(`BASELINE DRIFT at ${r.key} ${k}: ${c.hMin}-${c.hMax} → ${a.hMin}-${a.hMax}`);
      }
    }
  }
  console.log(`\n  baseline       : ${baseFile} — ${compared} cell(s) compared at the ${MAX} setting`);
  if (!compared) findings.push(`baseline ${baseFile} shared no cell keys with this run — an empty comparison is not a match`);
}

const jsonFile = val('--json', null);
if (jsonFile) {
  mkdirSync(dirname(resolve(jsonFile)), { recursive: true });
  writeFileSync(resolve(jsonFile), JSON.stringify({ tree: TREE, sizes: SIZES, rows }, null, 1));
  console.log(`\n  wrote          : ${jsonFile}`);
}

console.log(`\n  ${findings.length ? `FAIL — ${findings.length} finding(s) of ${rows.length} cell(s)` : `PASS — ${rows.length}/${rows.length} cells: the floor is the setting, ${MAX} is unchanged, ${MIN} renders`}`);
for (const f of findings) console.log(`    - ${f}`);
console.log(`
BOUNDARY: headless Chromium on Linux, dist/AshenSpire.html, ${SHAPES.length} shape(s)
          x ${UISIZES.length} UI size(s) x ${TEXT.length} text size(s), phone shapes first
          (his ordering, 2026-08-08)${MOBILE_ONLY ? '; --mobile, so 1200x730 was NOT measured and this run is silent about desktop' : ''}${QUICK ? `; --quick, so this is ${EXPECT_CELLS} of ${FULL_CELLS} cells and a PASS here is a pass over a TENTH of the space, not over it` : ''}. Every height is a
          RENDERED rect; the floor is a probe element the browser sized, never
          a parsed calc() token. It says nothing about Windows, about a real
          finger on real glass, about whether ${MIN} is WISE rather than legal,
          or about any control outside the four selectors above — the toggles,
          the sliders and the ✕ buttons are still under the floor and are still
          not floored by anything.`);
process.exit(findings.length ? 1 : 0);
