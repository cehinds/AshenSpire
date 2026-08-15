#!/usr/bin/env node
// tools/creationbrief.mjs — D26's short form, observed on glass.
//
// Constantine, 2026-08-15: "the statte descriptions kind of suck. perhaps have
// a simplifed verison with just the starting stats, starting armaments
// selection , and then have the ability to expand by clicking, with tool tips.
// for character creation I mean"
//
// WHAT THIS ASKS, and it is one question in five parts:
//   1. IS THE ARRIVAL SHORT — every entry the CONTENT TABLES call face-tier is
//      drawn, every entry they call reveal-tier is NOT, no reveal is open, and
//      no face carries prose (a face's text must be exactly its own label and
//      its own number — anything else is the paragraph coming back).
//   2. DOES A TAP EXPAND — clicking a face opens ITS reveal, the reveal says
//      that entry's authored sentence, and tapping again closes it.
//   3. IS THE KNOB LIVE — the expander shows exactly the entries the table put
//      behind it, and its count is the table's count. THIS IS THE ONE THAT
//      MATTERS: a screen with a hard-coded list of "simple" stats passes 1 and
//      2 and fails here, which is why the first plant below is exactly that.
//   4. CAN A THUMB HIT IT — every face and every armament tile at or above the
//      44 device px floor, measured on the rendered rect (Law 4 clause 4).
//   5. DOES IT SCROLL SIDEWAYS — horizontal travel per SCROLL CONTAINER on the
//      creation screen is ZERO at 390x844 (Law 5 clause 1, measured per
//      container because a document-level reading is 0 by construction here).
//
// DOOR — stated here and printed in the run's own output (the instrument
// rule's same-door clause, commons/development.md). THE EXPECTATION and THE
// OBSERVATION enter by two different real roads and are compared:
//   expectation  the content tables under --root are IMPORTED the way the game
//                imports them (src/content/index.js -> createRegistries ->
//                createRunState -> creationBrief). A bad row is refused here by
//                the real content door, by name, exactly as at boot.
//   observation  the app is SERVED over http and booted in headless Chromium
//                at ?shot=customize — the real index.html, the real module
//                graph, the real stylesheet, the real mount — and the faces are
//                CLICKED, not simulated. Nothing is handed to a function.
// --selftest plants each known-bad as FILE BYTES in a disposable copy of this
// tree and re-runs this whole tool at --root COPY, so every plant travels both
// roads.
//
// Usage
//   node tools/creationbrief.mjs                 the whole sweep
//   node tools/creationbrief.mjs --selftest      the re-runnable known-bad
//   node tools/creationbrief.mjs --root DIR      another checkout (planted)
//   node tools/creationbrief.mjs --only 390x844
// Exit: 0 green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// BOUNDARY, printed on every run including the clean ones: headless Chromium on
// Linux, the SOURCE tree over http (not the dist bundle), the shapes listed
// below, Text size and UI size at their defaults, one class per shape. It says
// nothing about a real finger, about Windows, about the receipts panel below
// the short form, or about whether the sentences are GOOD — only that they are
// short, they are the table's own, and they are one tap away.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day the creation screen
// stops having two tiers of disclosure.

import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOOLS = resolve(fileURLToPath(new URL('.', import.meta.url)));
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = resolve(argOf('--root') || resolve(TOOLS, '..'));
const only = argOf('--only');
const SHAPES = [[390, 844], [1200, 730]];
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// THE EXPECTATION — the content tables, through the real content door.
// ---------------------------------------------------------------------------
async function expectation(root) {
  const url = (rel) => pathToFileURL(resolve(root, rel)).href;
  const { contentBundle } = await import(url('src/content/index.js'));
  const { createRegistries } = await import(url('src/model/registries.js'));
  const { createRunState } = await import(url('src/model/state.js'));
  const { creationBrief } = await import(url('src/model/creationBrief.js'));
  const registries = createRegistries(contentBundle);
  // The screen arrives on its first class with the baseline kit — the same
  // state ?shot=customize mounts.
  const run = createRunState({ seed: 0, classId: registries.classes.all()[0].id, registries });
  const brief = creationBrief(registries, run);
  // The floor is READ, never typed: balance.ui.tapSize.def is the one home of
  // the number (styles/base.css deliberately carries no fallback copy of it),
  // and a 44 typed here would be the second copy this house exists to catch.
  const floor = registries.balance.ui.tapSize.def;
  const text = (entry) => `${entry.face.label}${entry.face.value === '' || entry.face.value == null ? '' : entry.face.value}`;
  return {
    floor,
    classId: brief.classId,
    faces: brief.faces.map((entry) => ({ key: entry.key, text: text(entry), sense: entry.reveal.sense })),
    behind: brief.reveals.map((entry) => ({ key: entry.key, text: text(entry), sense: entry.reveal.sense })),
    armaments: brief.armaments.map((entry) => ({ key: entry.key, text: text(entry), sense: entry.reveal.sense })),
    relicName: (brief.armaments.find((entry) => entry.kind === 'relic') || { face: {} }).face.value || '',
  };
}

// ---------------------------------------------------------------------------
// CDP plumbing (same shape as tools/inspecthold.mjs — one ws, no dependencies).
// ---------------------------------------------------------------------------
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map(); const handlers = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    } else if (m.method && handlers.has(m.method)) handlers.get(m.method)(m.params, m.sessionId);
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    on(method, fn) { handlers.set(method, fn); },
    close: () => ws.close(),
  };
}

function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`no DevTools endpoint:\n${err.slice(-300)}`)), 12000);
  });
}

// ---------------------------------------------------------------------------
// THE KNOWN-BAD CORPUS. Every plant is a REAL DEFECT of the class this check
// exists to catch, written as the tree spells the line today.
// ---------------------------------------------------------------------------
const PLANTS = [
  {
    name: 'P1 the knob ignored',
    file: 'src/ui/components/disclosure.js',
    from: "  const faces = rows.filter((entry) => entry.disclosure === 'face');",
    to: '  const faces = rows.slice(); // planted: the screen stops reading the tier and draws everything',
    what: "the screen draws every entry regardless of the table's `disclosure`",
    expect: 'a reveal-tier entry is on the arrival screen — the short form is not short',
    mustRed: (out) => /FAIL the arrival screen holds no reveal-tier entry/.test(out),
    mustStay: (out) => /PASS every face-tier entry is drawn/.test(out),
  },
  {
    name: 'P2 an illegal tier in the content table',
    file: 'src/content/attributes.js',
    from: "{ id: 'strength', label: 'Strength', shortLabel: 'STR', order: 1, disclosure: 'face'",
    to: "{ id: 'strength', label: 'Strength', shortLabel: 'STR', order: 1, disclosure: 'faec'",
    what: 'one attribute row is authored into a tier that does not exist',
    expect: 'the content door refuses it BY NAME, with the typo in the message',
    mustRed: (out) => /faec/.test(out) && /content door refused/.test(out),
    mustStay: () => true,
  },
  {
    name: 'P3 the tap floor removed',
    file: 'styles/ui.css',
    from: '  min-height: var(--tap-floor); min-width: var(--tap-floor); height: auto;\n  width: auto; max-width: 100%;',
    to: '  min-height: 0; min-width: 0; height: auto;\n  width: auto; max-width: 100%; /* planted: no floor */',
    what: 'the faces lose their 44 px floor and shrink to their glyphs',
    expect: 'a face measures under the floor on glass',
    mustRed: (out) => /FAIL every face and armament tile clears the/.test(out),
    mustStay: (out) => /PASS a tap opens that entry's reveal/.test(out),
  },
  {
    name: 'P4 the row stops wrapping',
    file: 'styles/ui.css',
    from: '.disc-faces { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: stretch; }',
    to: '.disc-faces { display: flex; flex-wrap: nowrap; gap: 0.6rem; align-items: stretch; overflow-x: auto; } /* planted: a phone that scrolls sideways */',
    what: 'the faces run off the side of a 390 px phone instead of wrapping',
    expect: 'horizontal travel on a scroll container is not zero (Law 5)',
    mustRed: (out) => /FAIL horizontal travel is ZERO/.test(out),
    mustStay: (out) => /PASS every face-tier entry is drawn/.test(out),
  },
  {
    name: 'P5 the tap does nothing',
    file: 'src/ui/components/disclosure.js',
    from: '      if (openKey === entry.key) close(); else open(entry.key);',
    to: '      /* planted: the tap is swallowed — the tips are hover-only again */',
    what: 'clicking a face no longer opens its reveal (the hover-only disease)',
    expect: 'a finger gets nothing at 390',
    mustRed: (out) => /FAIL a tap opens that entry's reveal/.test(out),
    mustStay: (out) => /PASS the arrival screen holds no reveal-tier entry/.test(out),
  },
];

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'creationbrief-kb-'));
  for (const d of ['src', 'styles', 'content', 'assets', 'tools']) {
    if (existsSync(resolve(ROOT, d))) {
      cpSync(resolve(ROOT, d), resolve(dir, d), {
        recursive: true,
        filter: (src) => !/tools[\\/](results|shots)([\\/]|$)/.test(src) && !/\.(png|py|mp3|ogg)$/.test(src),
      });
    }
  }
  cpSync(resolve(ROOT, 'index.html'), resolve(dir, 'index.html'));
  return dir;
}

function plantInto(dir, p) {
  const path = resolve(dir, p.file);
  const src = readFileSync(path, 'utf8');
  const first = src.indexOf(p.from);
  if (first < 0 || src.indexOf(p.from, first + 1) >= 0) {
    console.error(`creationbrief --selftest: ${p.name} found ${first < 0 ? 'NO' : 'MORE THAN ONE'} home in ${p.file}`);
    console.error('  A plant whose site drifted is a HARD RED, never a skip: a corpus that quietly');
    console.error('  stops matching is the eleven-instruments shape. Re-aim it at the line that');
    console.error('  carries the contract now.');
    process.exit(2);
  }
  writeFileSync(path, src.slice(0, first) + p.to + src.slice(first + p.from.length), 'utf8');
}

function runSelfAt(root) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--root', root, '--only', '390x844'],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(browserPath ? { CHROME: browserPath } : {}) } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => res({ code, out }));
  });
}

async function selftest() {
  console.log('creationbrief --selftest — the re-runnable known-bad');
  console.log('  DOOR: every plant below is a FILE EDIT to a disposable copy of this tree');
  console.log(`  (root ${ROOT}) — content table, screen component, or stylesheet — judged by`);
  console.log('  re-running this whole tool at --root COPY: the tables imported through the real');
  console.log('  content door, the app served over http, booted in headless Chromium at');
  console.log('  ?shot=customize, and the faces CLICKED. Nothing is handed to a function.\n');
  let fails = 0;
  const ok = (b, what) => { if (b) console.log(`  PASS ${what}`); else { fails++; console.log(`  FAIL ${what}`); } };

  const cleanDir = sandbox();
  console.log('  control: untouched copy of this tree (no plant)');
  const clean = await runSelfAt(cleanDir);
  ok(clean.code === 0, `control: the copied tree is GREEN (exit ${clean.code}) — the plants are the only difference`);
  if (clean.code !== 0) for (const line of clean.out.split('\n').filter((l) => /FAIL|refused/.test(l))) console.log(`    control |${line}`);
  try { rmSync(cleanDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }

  for (const p of PLANTS) {
    console.log(`\n  ${p.name}: ${p.what}`);
    console.log(`    plant: ${p.file} — expect ${p.expect}`);
    const dir = sandbox();
    plantInto(dir, p);
    const r = await runSelfAt(dir);
    ok(r.code === 1, `${p.name}: the planted tree goes RED (exit ${r.code}, want 1)`);
    ok(p.mustRed(r.out), `${p.name}: red BY NAME — ${p.expect}`);
    ok(p.mustStay(r.out), `${p.name}: the untouched checks stay green (red for the RIGHT reason, not a crater)`);
    for (const line of r.out.split('\n').filter((l) => /\s*(FAIL|content door refused)/.test(l))) {
      console.log(`    red |${line.replace(/^\s+/, ' ')}`);
    }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }
  }

  console.log(fails
    ? `\ncreationbrief --selftest: ${fails} FAIL — this instrument's red is NOT re-observed; treat its greens as unknown`
    : '\ncreationbrief --selftest: held — clean copy green, five defects red by name, through the doors real content and real fingers use');
  console.log('  BOUNDARY: the plants cover the tier filter, the content door, the tap floor, the');
  console.log('  wrap and the tap itself. The tooltip path (hover/gamepad focus) is ASSERTED every');
  console.log('  run and has never been watched to fail — it carries no plant here.');
  process.exit(fails ? 1 : 0);
}

// ---------------------------------------------------------------------------
async function main() {
  if (args.includes('--selftest')) return selftest();
  if (!browserPath) { console.error('creationbrief: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }

  console.log('creationbrief — D26\'s short form, observed');
  console.log(`  DOOR: expectation = the content tables at ${ROOT} imported through src/content/index.js`);
  console.log('        -> createRegistries -> createRunState -> creationBrief (the real content door,');
  console.log('        which refuses a bad row by name exactly as boot does).');
  console.log('        observation = index.html served over http, booted in headless Chromium at');
  console.log('        ?shot=customize, faces CLICKED with real input. Two roads, compared.');

  let want;
  try {
    want = await expectation(ROOT);
  } catch (e) {
    // A refusal here IS a result, and it is the loud one: the content door
    // named the row. Print it whole — a boot failure that prints a stack with
    // the row's name buried is the blank screen Law 1 clause 5 is about.
    console.error(`\ncreationbrief: content door refused the tables — ${e && e.message}`);
    process.exit(1);
  }
  const floor = want.floor;
  console.log(`  expectation: ${want.faces.length} face-tier entr(ies), ${want.behind.length} behind the expander, `
    + `${want.armaments.length} armament row(s), relic '${want.relicName}', floor ${floor} px\n`);

  const { serve } = await import(join(TOOLS, 'serve.mjs'));
  const s = await serve({ root: ROOT, port: 8291, open: false });
  const base = `http://localhost:${s.port}/`;
  const profile = mkdtempSync(join(tmpdir(), 'creationbrief-'));
  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;

  let fails = 0; let ran = 0; let measured = 0;

  for (const [W, H] of SHAPES) {
    const shape = `${W}x${H}`;
    if (only && only !== shape) continue;
    ran++;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }, S);
    const errors = [];
    cdp.on('Runtime.exceptionThrown', (p) => {
      const d = p && p.exceptionDetails;
      errors.push((d && (d.exception && d.exception.description || d.text)) || 'threw');
    });
    const ev = async (e) => {
      const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
      return r.result.value;
    };
    const until = async (x, w, ms = 20000) => {
      const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); }
      throw new Error(`timeout ${w}`);
    };
    const ok = (b, what) => { if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };

    console.log(`  ${shape}`);
    await cdp.send('Page.navigate', { url: `${base}?shot=customize` }, S);
    try {
      await until(`!!document.querySelector('.cz-brief .disc-faces .disc-face')`, 'the short form', 15000);
    } catch (e) {
      fails++;
      console.log(`    FAIL the creation screen drew its short form — ${e.message}`);
      for (const line of errors.slice(0, 4)) console.log(`      page | ${String(line).split('\n')[0]}`);
      continue;
    }
    await wait(250);

    // ---- 1. the arrival ---------------------------------------------------
    const read = await ev(`(() => {
      const norm = (s) => (s || '').replace(/\\s+/g, '');
      const faces = [...document.querySelectorAll('.cz-brief .disc-face')].filter((el) => !el.classList.contains('disc-more'));
      const box = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 }; };
      const more = document.querySelector('.cz-brief .disc-more');
      return {
        faces: faces.map((el) => ({ key: el.dataset.face, tier: el.dataset.disclosure, text: norm(el.textContent), ...box(el) })),
        moreCount: more ? Number(more.dataset.more) : 0,
        openReveals: document.querySelectorAll('.cz-brief .disc-reveal[data-reveal-for]').length,
        briefText: norm(document.querySelector('.cz-brief').textContent),
        // The SAME panel with its spaces intact — 'Straight Sword' is two words
        // and only reads as camelCase once whitespace is stripped, so the
        // engine-language probe gets its own honest reading rather than a
        // squashed one.
        // innerText, not textContent: textContent runs two boxes' words
        // together ('Straight Sword' + 'Right Hand' -> 'SwordRight'), which
        // reads as camelCase that no player ever sees. innerText is what is on
        // the screen.
        briefWords: (document.querySelector('.cz-brief').innerText || '').replace(/\s+/g, ' '),
        kits: [...document.querySelectorAll('#cz-kits button')].map((el) => box(el)),
        screenText: (document.querySelector('.screen.customize').textContent || '').replace(/\\s+/g, ' '),
      };
    })()`);
    measured += read.faces.length;

    const drawn = new Map(read.faces.map((row) => [row.key, row]));
    const missing = want.faces.filter((row) => !drawn.has(row.key)).map((row) => row.key);
    ok(missing.length === 0, `every face-tier entry is drawn — ${want.faces.length - missing.length}/${want.faces.length}${missing.length ? ` · missing ${missing.join(', ')}` : ''}`);
    const leaked = read.faces.filter((row) => row.tier !== 'face').map((row) => row.key);
    ok(leaked.length === 0, `the arrival screen holds no reveal-tier entry — ${leaked.length ? `drawn anyway: ${leaked.join(', ')}` : `${want.behind.length} kept behind the expander`}`);
    ok(read.moreCount === want.behind.length, `the expander counts what the table put behind it — ${read.moreCount}, want ${want.behind.length}`);
    ok(read.openReveals === 0, `nothing is expanded on arrival — ${read.openReveals} open reveal(s)`);
    // A FACE CARRIES NO PROSE: its text must be exactly its own label and its
    // own number, whitespace ignored. This is the check that catches the
    // paragraph coming back one sentence at a time.
    const wordy = [...want.faces, ...want.armaments]
      .filter((row) => drawn.has(row.key) && drawn.get(row.key).text !== row.text.replace(/\s+/g, ''))
      .map((row) => `${row.key}: '${drawn.get(row.key).text}' != '${row.text.replace(/\s+/g, '')}'`);
    ok(wordy.length === 0, `no face carries prose — ${wordy.length ? wordy.join(' · ') : `${want.faces.length + want.armaments.length} faces are label + number only`}`);
    // Bjorn's finding: the screen never named the starting relic while the
    // panel one row below itemized relics.
    ok(want.relicName !== '' && read.screenText.includes(want.relicName),
      `the starting relic is named on the screen — '${want.relicName}'`);
    // Vira's finding: engine language on a player's first screen. camelCase is
    // the tell — an id that escaped as a label.
    const camel = (read.briefWords.match(/[a-z]{2,}[A-Z][a-z]+/g) || []);
    ok(camel.length === 0, `no engine language in the short form — ${camel.length ? camel.slice(0, 4).join(', ') : 'no camelCase token in the panel'}`);

    // ---- 2. the tap -------------------------------------------------------
    const probe = want.faces[0];
    const tapped = await ev(`(() => {
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const el = document.querySelector('.cz-brief [data-face=${JSON.stringify(probe.key)}]');
      el.click();
      const panel = document.querySelector('.cz-brief .disc-reveal[data-reveal-for]');
      const opened = { for: panel ? panel.dataset.revealFor : null, text: panel ? norm(panel.textContent) : '',
        expanded: el.getAttribute('aria-expanded'), mark: el.dataset.reveal };
      el.click();
      const after = document.querySelector('.cz-brief .disc-reveal[data-reveal-for]');
      return { ...opened, closedAgain: !after };
    })()`);
    ok(tapped.for === probe.key && tapped.expanded === 'true' && tapped.mark === 'open',
      `a tap opens that entry's reveal — ${probe.key} → ${tapped.for || 'nothing'}`);
    ok(probe.sense !== '' && tapped.text.includes(probe.sense),
      `the reveal says the entry's OWN authored sentence — ${JSON.stringify((probe.sense || '').slice(0, 42))}`);
    ok(tapped.closedAgain, 'a second tap closes it again — the short form stays short');

    // ---- 3. the expander --------------------------------------------------
    if (want.behind.length) {
      const opened = await ev(`(() => {
        const more = document.querySelector('.cz-brief .disc-more');
        more.click();
        return { keys: [...document.querySelectorAll('.cz-brief .disc-face')].filter((el) => el.dataset.disclosure === 'reveal').map((el) => el.dataset.face),
          expanded: more.getAttribute('aria-expanded') };
      })()`);
      const wantKeys = want.behind.map((row) => row.key).sort().join(',');
      ok(opened.keys.slice().sort().join(',') === wantKeys && opened.expanded === 'true',
        `the expander reveals exactly the table's reveal-tier entries — ${opened.keys.join(', ') || 'none'}, want ${wantKeys}`);
    } else {
      ok(read.moreCount === 0, 'no expander is drawn when the table puts nothing behind one');
    }

    // ---- 4. the tap floor -------------------------------------------------
    const tiles = [...read.faces, ...read.kits];
    const short = tiles.filter((row) => row.w + 0.5 < floor || row.h + 0.5 < floor);
    ok(tiles.length > 0 && short.length === 0,
      `every face and armament tile clears the ${floor} px floor — ${tiles.length} measured, smallest `
      + `${tiles.length ? Math.min(...tiles.map((row) => Math.min(row.w, row.h))) : 0} px`);

    // ---- 5. Law 5, per scroll container -----------------------------------
    const axis = await ev(`(() => {
      const out = [];
      const root = document.querySelector('.screen.customize');
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const over = getComputedStyle(el).overflowX;
        const travel = el.scrollWidth - el.clientWidth;
        if (travel > 1 && (over === 'auto' || over === 'scroll')) out.push({ sel: el.className || el.tagName, travel });
      }
      return { scrollers: out, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    })()`);
    ok(axis.scrollers.length === 0,
      `horizontal travel is ZERO on every scroll container of the creation screen — `
      + `${axis.scrollers.length ? axis.scrollers.map((row) => `${row.sel} ${row.travel}px`).join(' · ') : 'none scroll sideways'}`
      + ` (document ${axis.doc} px)`);

    await cdp.send('Target.closeTarget', { targetId }, S).catch(() => {});
  }

  try { cdp.close(); } catch { /* closing */ }
  try { child.kill(); } catch { /* closing */ }
  try { s.server.close(); } catch { /* closing */ }

  // AN EMPTY RESULT IS NEVER A PASS. The floor is on the denominator: a run
  // that measured no shape, or a shape that found no face, is exit 2 — not a
  // clean sweep with nothing in it.
  if (!ran || measured === 0) {
    console.error(`\ncreationbrief: NOTHING RAN (${ran} shape(s), ${measured} face(s) measured) — this is not a pass`);
    process.exit(2);
  }
  console.log(`\ncreationbrief: ${fails ? `${fails} FAIL` : 'green'} — ${ran} shape(s), ${measured} face(s) measured`);
  console.log('  BOUNDARY: headless Chromium on Linux, the SOURCE tree over http (not dist/), '
    + `${SHAPES.map(([w, h]) => `${w}x${h}`).join(' + ')}, default Text size and UI size, the first class only.`);
  console.log('  Silent on: a real finger, Windows, the receipts panel under the short form, whether');
  console.log('  the sentences are GOOD — only that they are short, the table\'s own, and one tap away.');
  process.exit(fails ? 1 : 0);
}

await main();
