#!/usr/bin/env node
// tools/displayfirst.mjs — FULLSCREEN IS THE FIRST THING A PLAYER MEETS UNDER
// DISPLAY, ON THE SCREEN, AT BOTH DOORS. The rendered check on E3 / #248.
//
// WHY IT EXISTS, and it is not that the ordering is broken — it is not.
//
// His words, 2026-08-15 (#248): "the full screen option toggle should be the
// first option in the display". PR #287 moved the row to the head of `ROWS` and
// landed `tests/engine.test.js` test 61 to hold the seat. That test reads
//
//     categoryHandler('Display').rows[0].key === 'fullscreen'
//
// which is an assertion about an ARRAY, and its own comment states the missing
// half as a fact rather than checking it: *"Order on the screen IS array order
// in ROWS — categoryHandler() filters without sorting, rowHtml renders in
// sequence."* That sentence is true today. Nothing in this repo watches it stay
// true, and three separate one-line edits make it false while test 61 stays
// green — each of them is a plant in the corpus below:
//
//   · the RENDERER reorders (`categoryHtml`'s `h.rows.map(...)`), leaving
//     `categoryHandler().rows` untouched;
//   · CSS hides the first row — it is still first in the array, and the first
//     control a player can SEE is Character sprites;
//   · CSS reverses the visual order of a DOM that never moved (`column-reverse`
//     / `order:`), which is the same shape as a box that "never moved" because
//     what moved was its parent.
//
// So this file is not a second copy of test 61. Test 61 asserts the TABLE; this
// asserts the SCREEN, and the two disagree exactly where the bugs live.
//
// THE BEFORE, MEASURED AT dev = 897d9fa BEFORE A LINE OF THIS EXISTED, so the
// claim "the ordering already holds" is a reading and not a hope. Four cells,
// title door and in-run door, 1440x860 and 390x844: `#set-panel` renders TWENTY
// Display rows, row 0 is `fullscreen` in every one, `display:flex`,
// `visibility:visible`, box 83.5 px tall wide / 64.4 px phone, top edge equal to
// the panel's own top, panel `scrollTop` 0. It is first, and it is INK.
//
// WHAT IT CHECKS, per cell:
//   D1 ORDER    the first Display control a player meets is `fullscreen`.
//               "First" is GEOMETRIC — visible rows sorted by rendered (top,
//               left) — never DOM order. A check that read DOM order would be
//               green under `flex-direction: column-reverse`, where every box
//               is where it always was and the player sees the list backwards.
//   D2 ONCE     exactly one `fullscreen` control is in the panel. A move that
//               copies is not a move.
//   D3 INK      that row is on screen ON ARRIVAL — non-zero box, not
//               `display:none` / `visibility:hidden`, and its box is wholly
//               inside the viewport with nothing scrolled. "First" that a
//               player has to scroll to is not first.
//   D4 DOORS    the title-screen modal and the in-run overlay give the SAME
//               answer at the same shape and text size. One home renders both
//               (`renderSettings`); a divergence means that stopped being true.
//   D0 POP      the declared cell count is reached, and a Display panel with NO
//               rows is RED. An empty population and a clean one look identical
//               to a check that only hunts for violations, and they mean the
//               opposite.
//
// BOTH EDGES, named because the gate requires it:
//   · EMPTY — Display with zero rows (plant 5). D0 goes red; nothing else may
//     report green over it.
//   · MAX — Text XL, the longest labels and notes and the tallest rows this
//     screen has, at the narrow shape where the panel is nearest to overflowing.
//
// THE THRESHOLD'S OWN NEIGHBOURHOOD (Charter 2b). The threshold here is ordinal
// position, and its unit is one row: plant 1 moves `fullscreen` exactly ONE
// position and the verdict flips, so there is a cell either side of the line,
// adjacent, and both enter by the same door as every other input — file bytes in
// a copied real tree.
//
// THE DOOR: the SOURCE TREE over http in headless Chromium (tools/serve.mjs).
// Text size is set through the game's own settings store (`?shotSettings`), the
// panel is opened by CLICKING the same controls a player clicks, and every box
// is read with `getBoundingClientRect()` off the live page. Nothing is injected
// and no module is imported to be asked a question. `--selftest` plants its
// known-bads as file bytes in a copied real tree (tools/doorplant.mjs) and runs
// this tool WHOLE from the copy — the same door, narrowed population declared in
// its own output.
//
// WHAT IT DOES NOT COVER, and this is the boundary rather than a to-do:
//   · THE OTHER HALF OF HIS SENTENCE. "the menu settings need some work in look
//     and feel" is unspecified, unowned, and NOT ASSERTED ANYWHERE HERE. This
//     tool would be green on a settings screen he hates. It says one thing:
//     the first control under Display is the Fullscreen toggle, and you can see
//     it without scrolling.
//   · THE OTHER NINETEEN ROWS. Only position 1 has an ask attached to it, so
//     only position 1 is held. The rest may be reordered freely.
//   · Linux headless Chromium, two shapes, two text sizes, two doors. Windows
//     and macOS are `unknown` here as everywhere else in this repo.
//   · IT IS NOT WIRED INTO ci.yml. Deliberate — see the PR. `.github/workflows/
//     ci.yml` is open under #294, and adding a step to the gate list while that
//     lane is mid-flight changes the census under its author's feet. Until it is
//     wired this gate is a seat's hand-run, which under SOP 2's silence guard is
//     `unknown` between runs, not green.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day #248's ordering ask is
// withdrawn or superseded by a different first row — in which case the ask moves
// and this file moves with it, it does not quietly widen. Also deleted if test
// 61 is ever replaced by a check that reads the rendered screen itself, since
// then this is the second copy.
//
// Vira Falk, 2026-08-22.

import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const WANT = 'fullscreen';

const ALL_SHAPES = [
  { tag: '1440x860', w: 1440, h: 860, d: 1, mobile: false },
  { tag: '390x844', w: 390, h: 844, d: 3, mobile: true },
];
const ALL_TEXTS = ['M', 'XL'];
const ALL_DOORS = ['title', 'inrun'];

// The selftest narrows the population so five whole-tool browser runs finish in
// a sensible time. It is DECLARED, never implied: `--only-shape` / `--only-text`
// print in the header of every run that uses them.
const onlyShape = argOf('--only-shape');
const onlyText = argOf('--only-text');
const SHAPES = onlyShape ? ALL_SHAPES.filter((s) => s.tag === onlyShape) : ALL_SHAPES;
const TEXTS = onlyText ? ALL_TEXTS.filter((t) => t === onlyText) : ALL_TEXTS;
const DOORS = ALL_DOORS;

let bad = 0;
let unknown = 0;
const fail = (line) => { bad++; console.error(`RED  ${line}`); };
const note = (line) => console.log(`  ok  ${line}`);
const unk = (line) => { unknown++; console.log(`  ??  ${line}`); };

// ---------------------------------------------------------------------------
// The page-side read. Returns the VISIBLE Display rows in GEOMETRIC order, each
// with the key of the control it carries, plus the fullscreen row's own box and
// the viewport it was measured in.
// ---------------------------------------------------------------------------
const READ = `(() => {
  const panel = document.querySelector('#set-panel');
  if (!panel) return { panel: false };
  const rows = [...panel.querySelectorAll('.set-row')].map((row) => {
    const ctrl = row.querySelector('[data-key]');
    const b = row.getBoundingClientRect();
    const cs = getComputedStyle(row);
    return {
      key: ctrl ? ctrl.dataset.key : null,
      top: +b.top.toFixed(2), left: +b.left.toFixed(2),
      bottom: +b.bottom.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2),
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
    };
  });
  // VISIBLE means a player could see it if they looked: it occupies space and
  // is not hidden. Being off-screen is D3's question, not this one.
  const visible = rows.filter((r) => r.display !== 'none' && r.visibility !== 'hidden'
    && r.w > 0 && r.h > 0 && r.opacity !== '0');
  // GEOMETRIC ORDER, not DOM order. This is the whole reason the tool exists.
  visible.sort((a, b2) => (a.top - b2.top) || (a.left - b2.left));
  const fs = rows.filter((r) => r.key === ${JSON.stringify(WANT)});
  return {
    panel: true,
    tab: (document.querySelector('.set-tab.on') || { dataset: {} }).dataset.member,
    domKeys: rows.map((r) => r.key),
    visibleKeys: visible.map((r) => r.key),
    first: visible.length ? visible[0] : null,
    fsCount: fs.length,
    fs: fs[0] || null,
    scroll: { panelTop: panel.scrollTop, docY: window.scrollY, docX: window.scrollX },
    vp: { w: window.innerWidth, h: window.innerHeight },
  };
})()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Open Settings and select Display, THROUGH THE CONTROLS A PLAYER USES.
const OPEN_TITLE = `(async () => {
  const b = [...document.querySelectorAll('button')].find((x) => /settings/i.test(x.textContent));
  if (!b) return { err: 'no Settings button on the title screen' };
  b.click(); await new Promise((r) => setTimeout(r, 500));
  const d = [...document.querySelectorAll('.set-tab')].find((e) => e.dataset.member === 'Display');
  if (!d) return { err: 'no Display tab in the settings modal' };
  d.click(); await new Promise((r) => setTimeout(r, 500));
  return { ok: true };
})()`;

const OPEN_INRUN = `(async () => {
  const m = [...document.querySelectorAll('button')].find((x) => /^\\s*(menu|☰)\\s*$/i.test(x.textContent) || x.id === 'menu' || /(^|\\s)menu(\\s|$)/i.test(x.className));
  if (!m) return { err: 'no menu button in combat' };
  m.click(); await new Promise((r) => setTimeout(r, 550));
  const t = [...document.querySelectorAll('button')].find((x) => /^settings$/i.test(x.textContent.trim()));
  if (!t) return { err: 'no Settings tab in the overlay' };
  t.click(); await new Promise((r) => setTimeout(r, 550));
  const d = [...document.querySelectorAll('.set-tab')].find((e) => e.dataset.member === 'Display');
  if (!d) return { err: 'no Display tab in the overlay settings panel' };
  d.click(); await new Promise((r) => setTimeout(r, 500));
  return { ok: true };
})()`;

/** One cell: judge a read. Returns the key a player meets first, or null. */
function judge(r, cell) {
  if (!r || r.panel === false) {
    fail(`FINDING D0/population cell=${cell} panel=absent — no #set-panel rendered, so every check `
      + 'below had nothing to compare. An empty population is not a pass.');
    return null;
  }
  if (!r.visibleKeys.length) {
    fail(`FINDING D0/population cell=${cell} visible=0 dom=${r.domKeys.length} — the Display panel `
      + 'renders NO visible control rows. Nothing here is evidence about ordering.');
    return null;
  }
  const first = r.first ? r.first.key : null;
  if (first !== WANT) {
    fail(`FINDING D1/order cell=${cell} first=${first} want=${WANT} — the first control a player meets `
      + `under Display is not the Fullscreen toggle. Visible order: ${JSON.stringify(r.visibleKeys.slice(0, 4))}`
      + `; DOM order: ${JSON.stringify(r.domKeys.slice(0, 4))}.`);
  } else {
    note(`D1/order ${cell} first=${first} (geometric, ${r.visibleKeys.length} visible rows)`);
  }
  if (r.fsCount !== 1) {
    fail(`FINDING D2/once cell=${cell} count=${r.fsCount} want=1 — the row must have MOVED, not been copied.`);
  } else {
    note(`D2/once ${cell} count=1`);
  }
  // D3 INK — on screen with nothing scrolled.
  const fs = r.fs;
  if (!fs) {
    fail(`FINDING D3/ink cell=${cell} key=${WANT} present=false — the Fullscreen row is not in the panel at all.`);
  } else {
    const shown = fs.display !== 'none' && fs.visibility !== 'hidden' && fs.w > 0 && fs.h > 0 && fs.opacity !== '0';
    const onscreen = fs.top >= 0 && fs.left >= 0 && fs.bottom <= r.vp.h + 0.5 && fs.top <= r.vp.h;
    const unscrolled = r.scroll.panelTop === 0 && r.scroll.docY === 0;
    if (!shown || !onscreen || !unscrolled) {
      fail(`FINDING D3/ink cell=${cell} key=${WANT} visible=${shown} onscreen=${onscreen} unscrolled=${unscrolled} `
        + `box=${fs.top}..${fs.bottom} of viewport ${r.vp.w}x${r.vp.h} (display:${fs.display} visibility:${fs.visibility}) `
        + '— first that a player has to scroll to, or cannot see, is not first.');
    } else {
      note(`D3/ink ${cell} box ${fs.top}..${fs.bottom} inside viewport ${r.vp.w}x${r.vp.h}, nothing scrolled`);
    }
  }
  return first;
}

async function main() {
  if (args.includes('--selftest')) return selftest();

  const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')));
  const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8474), open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`displayfirst — ${base} (root ${ROOT})`);
  console.log('DOOR: source tree over http in headless Chromium; the panel is opened by CLICKING the');
  console.log('      same controls a player clicks; text size set through the game\'s own settings');
  console.log('      store (?shotSettings); every box read with getBoundingClientRect() off the live');
  console.log('      page. "First" is GEOMETRIC — visible rows sorted by (top,left) — never DOM order.');
  if (onlyShape || onlyText) {
    console.log(`      NARROWED POPULATION (declared): shape=${onlyShape || 'all'} text=${onlyText || 'all'}`);
  }

  const browserPath = resolveBrowser();
  if (!browserPath) {
    console.error('displayfirst: UNKNOWN — no Chrome/Chromium found (tried $CHROME, $CHROME_PATH and the usual paths).');
    console.error('              Exit 2, not 1: nothing was measured, so this is not a verdict about the screen.');
    await s.close?.();
    process.exit(2);
  }
  console.log(`      browser: ${browserPath}`);

  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'displayfirst-', browser: browserPath, timeoutMs: 15000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;

  const expected = SHAPES.length * TEXTS.length * DOORS.length;
  let reached = 0;
  const heights = [];

  for (const vp of SHAPES) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    const ev = async (e) => {
      const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
      return r.result.value;
    };
    const until = async (x, w, ms = 25000) => {
      const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); }
      throw new Error(`timeout waiting for ${w}`);
    };

    console.log(`\n  ${vp.tag}`);
    for (const text of TEXTS) {
      const perDoor = {};
      for (const door of DOORS) {
        const cell = `${vp.tag} Text ${text} ${door}`;
        const shot = door === 'title' ? 'title' : 'combat';
        const url = `${base}?shot=${shot}&shotSettings=${encodeURIComponent(JSON.stringify({ textSize: text }))}`;
        await cdp.send('Page.navigate', { url }, S);
        const ready = door === 'title'
          ? `!!document.querySelector('button')`
          : `!!document.querySelector('.combat')`;
        await until(ready, `${shot} ${cell}`);
        await wait(700);
        const nav = await ev(door === 'title' ? OPEN_TITLE : OPEN_INRUN);
        if (nav && nav.err) {
          fail(`FINDING D0/population cell=${cell} door=unreachable — ${nav.err}. Nothing was measured here.`);
          reached++;
          perDoor[door] = null;
          continue;
        }
        await wait(400);
        const r = await ev(READ);
        reached++;
        perDoor[door] = judge(r, cell);
        if (r && r.panel && r.tab !== 'Display') {
          fail(`FINDING D0/population cell=${cell} tab=${r.tab} — the panel measured is not Display.`);
        }
        // THE MAX EDGE HAS TO ARRIVE, NOT JUST BE NAMED. Recorded per cell and
        // asserted after the loop: if XL does not render taller than M, the XL
        // cell is a second copy of the M cell wearing a different name, and the
        // "both edges" claim is decoration.
        if (r && r.fs) heights.push({ shape: vp.tag, door, text, h: r.fs.h });
        console.log(`      ${cell}: tab=${r && r.tab} rows=${r && r.domKeys.length} `
          + `fullscreenRowHeight=${r && r.fs ? r.fs.h : 'n/a'}`);
      }
      // D4 DOORS — the two surfaces must agree.
      if (perDoor.title !== undefined && perDoor.inrun !== undefined) {
        if (perDoor.title !== perDoor.inrun) {
          fail(`FINDING D4/doors shape=${vp.tag} text=${text} title=${perDoor.title} inrun=${perDoor.inrun} `
            + '— one renderer, two answers. The doors have stopped sharing renderSettings.');
        } else if (perDoor.title !== null) {
          note(`D4/doors ${vp.tag} Text ${text} — both doors first=${perDoor.title}`);
        }
      }
    }
    await cdp.send('Target.closeTarget', { targetId });
  }

  // D5 MAXEDGE — did Text XL actually arrive? A max edge that renders identically
  // to the middle of the domain was never measured.
  if (TEXTS.includes('M') && TEXTS.includes('XL')) {
    for (const vp of SHAPES) {
      for (const door of DOORS) {
        const m = heights.find((x) => x.shape === vp.tag && x.door === door && x.text === 'M');
        const xl = heights.find((x) => x.shape === vp.tag && x.door === door && x.text === 'XL');
        if (!m || !xl) {
          fail(`FINDING D5/maxedge shape=${vp.tag} door=${door} m=${m ? m.h : 'missing'} xl=${xl ? xl.h : 'missing'} `
            + '— one half of the edge pair never rendered, so the max edge is not evidence.');
        } else if (!(xl.h > m.h)) {
          fail(`FINDING D5/maxedge shape=${vp.tag} door=${door} m=${m.h} xl=${xl.h} `
            + '— Text XL did not render taller than Text M, so the text size did NOT land and the XL '
            + 'cell is the M cell under a different name.');
        } else {
          note(`D5/maxedge ${vp.tag} ${door} — Text XL landed: row ${m.h} px at M, ${xl.h} px at XL`);
        }
      }
    }
  } else {
    unk('D5/maxedge — the text-size population is narrowed by --only-text, so the max edge is NOT '
      + 'measured in this run. Declared, not silent; it counts toward nothing.');
  }

  if (reached !== expected) {
    fail(`FINDING D0/population reached=${reached} declared=${expected} — a check that quietly measures `
      + 'fewer cells than it declares prints a confident green over a smaller world.');
  } else {
    note(`D0/population reached=${reached} declared=${expected} `
      + `(${SHAPES.length} shape(s) x ${TEXTS.length} text size(s) x ${DOORS.length} doors)`);
  }

  cdp.close(); await dropBrowser(); await s.close?.();

  console.log('');
  console.log('BOUNDARY — printed every run, green or red, because a gate that prints only PASS is');
  console.log('  "green wasn\'t clearance" shipped as infrastructure:');
  console.log('  · THE LOOK-AND-FEEL HALF OF #248 IS NOT ASSERTED HERE and is still unowned. This tool');
  console.log('    would be green on a settings screen Constantine dislikes. It holds ONE sentence:');
  console.log('    the first control under Display is the Fullscreen toggle, and it is on screen.');
  console.log('  · Only position 1 is held. The other nineteen Display rows may be reordered freely.');
  console.log('  · Linux headless Chromium only; windows-latest and macos-latest are `unknown`.');
  console.log('  · NOT WIRED INTO ci.yml (see the header) — between hand-runs this is `unknown`.');
  if (unknown) console.log(`  · ${unknown} check(s) resolved UNKNOWN in this run and counted toward nothing.`);
  console.log('');

  if (bad) {
    console.error(`displayfirst: FAIL — ${bad} finding(s) across ${reached} cells`);
    process.exit(1);
  }
  console.log(`displayfirst: OK — ${reached} cells passed; 0 findings`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// --selftest — the same-door known-bad corpus.
//
// FIVE PLANTS. THREE OF THEM ARE INVISIBLE TO test 61, and that is the argument
// for this file existing at all: plants 2, 3 and 4 leave `ROWS` and
// `categoryHandler('Display').rows` exactly as they are, so the engine suite
// stays green while the screen is wrong.
// ---------------------------------------------------------------------------
async function selftest() {
  const { doorSelftest } = await import('./doorplant.mjs');
  const plants = [
    {
      // 1 — THE NEIGHBOURHOOD. `fullscreen` moves exactly ONE position. One step
      // of the threshold's own unit flips the verdict (Charter 2b). test 61
      // catches this one too, which is the point: on the obvious direction the
      // two agree.
      name: 'the row moves one position down the array',
      file: 'src/ui/screens/settings.js',
      find: `  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: 'Fullscreen',
    note: 'Fill the screen (also toggles with F11 in most browsers).' },
  { cat: 'Display', key: 'useSprites', def: true, label: 'Character sprites',
    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },`,
      replace: `  { cat: 'Display', key: 'useSprites', def: true, label: 'Character sprites',
    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },
  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: 'Fullscreen',
    note: 'Fill the screen (also toggles with F11 in most browsers).' },`,
      expectRed: /FINDING D1\/order .*first=useSprites want=fullscreen/,
    },
    {
      // 2 — THE RENDERER REORDERS AND THE TABLE DOES NOT. test 61 reads
      // categoryHandler().rows, which this never touches: GREEN there, wrong
      // here.
      name: 'the renderer reverses what the table hands it (test 61 stays green)',
      file: 'src/ui/screens/settings.js',
      find: '  return h.rows.map((r) => rowHtml(settings, r)).join(\'\');',
      replace: '  return [...h.rows].reverse().map((r) => rowHtml(settings, r)).join(\'\');',
      expectRed: /FINDING D1\/order .*want=fullscreen/,
    },
    {
      // 3 — CSS HIDES THE FIRST ROW. Array untouched, test 61 green, and the
      // first control a player can see is Character sprites.
      name: 'CSS hides the first row (test 61 stays green)',
      file: 'styles/ui.css',
      append: '.set-panel .set-row:first-child { display: none !important; }',
      expectRed: /FINDING D1\/order .*first=useSprites want=fullscreen/,
    },
    {
      // 4 — THE DOM NEVER MOVES AND THE SCREEN REVERSES. This is the exact
      // shape that costs a reader a whole verdict: every box is where it always
      // was, and the parent changed. A DOM-order check is green here.
      name: 'the scroll parent reverses the visual order (DOM order unchanged)',
      file: 'styles/ui.css',
      append: '.set-panel { display: flex !important; flex-direction: column-reverse !important; }',
      expectRed: /FINDING D1\/order .*want=fullscreen/,
    },
    {
      // 5 — THE EMPTY EDGE. Display renders no rows. A check that only hunts for
      // "the first row is wrong" finds nothing here and reports green over a
      // blank screen.
      name: 'Display renders no rows at all (the empty edge)',
      file: 'src/ui/screens/settings.js',
      find: '  const rows = ROWS.filter((r) => r.cat === cat);',
      replace: '  const rows = ROWS.filter((r) => r.cat === cat && cat !== \'Display\');',
      expectRed: /FINDING D0\/population/,
    },
  ];
  // NARROWED ON PURPOSE AND SAID OUT LOUD: five whole-tool browser runs plus a
  // clean run is six browser boots. The population is one shape and one text
  // size, both doors — the DOOR is unnarrowed, which is the axis the corpus is
  // about.
  const code = await doorSelftest({
    tool: 'displayfirst.mjs',
    args: ['--only-shape', '1440x860', '--only-text', 'M', '--port', '8475'],
    plants,
    timeoutMs: 300000,
  });
  process.exit(code);
}

main().catch((e) => { console.error(`displayfirst: ${e && e.stack || e}`); process.exit(1); });
