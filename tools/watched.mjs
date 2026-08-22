#!/usr/bin/env node
// tools/watched.mjs — did anyone OPEN THE BUILD and SEE the control?
//
// Bjorn, 2026-08-08. Saga's ledger (`commons/tools/asks.json`, family repo)
// prints its own boundary over its `state` column: **`shipped` means a commit is
// an ancestor of `dev`. It does not mean anyone opened the screen.** That gap is
// not academic. It is how the fog reached Constantine SWITCHED OFF behind a
// setting nobody told him about, while a board said it existed and walked; and
// the same evening it produced a second false report — the thirty-minute-run
// knobs described as "three knobs on a screen that exists", with `floors` and
// `columns` occurring zero times in `src/ui/screens/customRun.js`.
//
// Marina's standing rule, and this file is its machine:
//
//   > A feature is not done until whoever reports it has watched it running in
//   > the state the reader will open it in.
//
// WHAT IT DOES. For every row of the ledger in a watched-worthy state, it opens
// the SHIPPED BUNDLE (`dist/AshenSpire.html` — the file he actually opens) at
// 390x844, drives real clicks to the screen the control lives on, asserts the
// control is there, and writes a PNG of it. Every row gets a verdict:
//
//   watched          the control was on the screen named, and here is the picture
//   not-there        the screen opened and the control was not on it
//   there-but-wrong  the control is there and the state he would open it in is not
//   unreachable      the screen could not be opened — A FINDING, NOT A SKIP
//   unaccounted      THE LEDGER HAS THIS ROW AND THIS INSTRUMENT HAS NO PROBE
//   no-screen        declared by a person as having no build surface, with a reason
//
// THE POPULATION IS DERIVED, NEVER TYPED. It is read out of the ledger passed on
// `--ledger`, filtered by state. A row this instrument cannot account for comes
// out RED and BY NAME (`unaccounted`) — it is never absent, because a list that
// can silently shrink is the defect this house is named for. Symmetrically, a
// probe naming a row the ledger no longer carries is red too: drift has two signs.
//
// WHO DREW EVERY EDGE. Every probe in `tools/watched-probes.json` carries `by`
// (the person who chose its selector, its reach and its expectation), `read`
// (the source FILES the selector was READ out of, not guessed) and `anchors`
// (literal strings from those files whose disappearance means the derivation is
// dead). A probe missing any of the three is a floor failure, not a warning — a
// shape list and a tolerance are the same object, and an unsigned one is an
// opinion wearing a number.
//
// AMENDED 2026-08-22 (Bjorn), and the amendment is the point: `read` used to be
// checked for being NON-EMPTY and nothing else, so a probe could cite a deleted
// file or a symbol that had moved and this tool printed `watched` beside it. See
// THE READ FLOOR below for the measurement that produced the rule. `anchors` is
// a second copy of a fact — deliberately, because a citation IS one, and the
// only thing that makes a second copy safe is something checking the two agree.
// That check is what did not exist.
//
// WHAT THIS GREEN DOES NOT COVER, said before it is cited:
//   · It proves the control was ON SCREEN in the shipped bundle at this shape.
//     It does not prove the control WORKS, and it is not a person's eyes. It
//     hands a picture to a person whose name goes in the report. `watched` here
//     means "photographable in the state he opens it in", one rung below "played".
//   · One shape by default (390x844 — his words: "mobile might need to be the
//     priority for now"), one browser, one Linux box.
//   · A `no-screen` row is a PERSON's claim that an ask has no build surface. It
//     is printed by name, excluded from the watched count, and never green.
//
// IT ALSO AUDITS THE COMMITTED PICTURES, in the same run and under the same
// rule, because a screenshot that outlives its build is a receipt: every png in
// `docs/preview/` whose last commit is behind the last commit touching `src/` or
// `styles/` is named as STALE, and every `?shot=` state declared in `src/main.js`
// with no committed picture is named as NEVER PICTURED. Both halves derived —
// the pictures from the folder, the denominator from main.js's own
// `shotState === '...'` comparisons. (Viki's note on the co-op collapse: the
// preview shots "still show the old 27 px map until whoever owns the shots
// re-runs the harness." That is this file's subject wearing a picture.)
//
// KNOWN-BAD FIRST (development.md, *The instrument rule*). `--selftest` plants
// FOURTEEN breakages and requires each to be OBSERVED red before this file may be
// cited as coverage: a control that cannot be there, a screen that cannot open,
// a ledger row with no probe, a probe for a row the ledger dropped, a state
// expectation that must fail, a content pattern that cannot match, zero rows, an
// empty population, an unsigned probe, a dead anchor, a probe with no anchors, a
// `read` naming a deleted file, a typed line number, and — plant 14, the only one
// that mutates the SOURCE rather than the probe — THE CODE MOVING OUT FROM UNDER
// A CORRECT PROBE. A check that names a thing it cannot fail on is a receipt.
//
// Usage:
//   node tools/watched.mjs --ledger <path-to-asks.json> [--shape 390x844]
//                          [--only G7,S3] [--src] [--dump] [--out DIR]
//   node tools/watched.mjs --selftest --ledger <path-to-asks.json>
//   node tools/watched.mjs --check-reads          (the read floor alone; no browser)
// Exit: 0 every row watched or declared · 1 any red · 2 the harness could not run
//
// REMOVAL CONDITION: deleted the day the ledger's `state` column is itself
// derived from a run of this file — then the two are one fact with one home and
// this is the copy. Also deleted if it is ever green while a row it called
// `watched` turns out not to be on the screen it named.

import { spawn, execFileSync } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const has = (f) => args.includes(f);

const die = (m) => { console.error(`FLOOR: ${m}`); process.exit(2); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// States whose whole claim is "it is in the build". Anything else in the ledger
// is not claiming a screen yet, so photographing it would be theatre.
const WATCH_STATES = (argOf('--states', 'shipped,already-true')).split(',').map((s) => s.trim());

const LEDGER = argOf('--ledger');
const PROBES = resolve(ROOT, argOf('--probes', 'tools/watched-probes.json'));
const OUT = resolve(ROOT, argOf('--out', 'tools/results/watched'));
const ONLY = argOf('--only') ? argOf('--only').split(',').map((s) => s.trim()) : null;
const SELFTEST = has('--selftest');
const DUMP = has('--dump');
const USE_SRC = has('--src');
const SHAPES = (argOf('--shape', '390x844')).split(',').map((s) => {
  const m = /^(\d+)x(\d+)$/.exec(s.trim());
  if (!m) die(`--shape ${s}: want WxH, e.g. 390x844`);
  return { tag: s.trim(), w: +m[1], h: +m[2], dsf: +m[1] < 700 ? 2 : 1 };
});

const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].filter(Boolean);
const browserPath = BROWSERS.find((p) => existsSync(p));

// ---- the population: DERIVED from the ledger, never typed ------------------
function readPopulation(ledgerPath) {
  if (!ledgerPath) die('no --ledger <path-to-asks.json>. The population of this audit is Saga\'s ledger; typing a list here would be the second copy this file exists to prevent.');
  if (!existsSync(ledgerPath)) die(`--ledger ${ledgerPath} does not exist. Pass the path to the family repo's commons/tools/asks.json — it is an INPUT, never a file this repo may hold a copy of.`);
  let doc;
  try { doc = JSON.parse(readFileSync(ledgerPath, 'utf8')); }
  catch (e) { die(`--ledger ${ledgerPath} is not readable JSON: ${e.message}`); }
  const all = Array.isArray(doc.rows) ? doc.rows : [];
  if (all.length === 0) die('the ledger carries 0 rows — that is a broken read, not an empty board');
  const pop = all.filter((r) => WATCH_STATES.includes(r.state));
  if (pop.length === 0) die(`0 rows in states [${WATCH_STATES.join(', ')}] out of ${all.length} — an empty population is never a pass`);
  return { pop, total: all.length, gate: doc.gate || {} };
}

// ---- THE READ FLOOR: a derivation that no longer exists must not read green --
//
// Bjorn, 2026-08-22. Codex found the hole on #316 and the probe it found was
// mine (A5). The probe is not the finding. THIS IS: until today `readProbes`
// checked that `read` was NON-EMPTY and nothing else, so a probe could name a
// file that had been deleted, a line past the end of it, or a symbol that no
// longer existed, and this tool would print `watched` beside it. **The
// instrument whose whole job is catching probe rot could not tell a live
// derivation from a dead one.**
//
// MEASURED BEFORE IT WAS FIXED, at `dev` = 897d9fa, over the 47 probes that owe
// a `read`: 73 of them carried a typed `file:line`. SEVENTEEN of those 73
// resolved at the line they named. 24 probes of 47 named a line whose subject
// had moved (median drift far past any tolerable window: `.set-tabs` 461 lines,
// `.end-turn` 1161), 3 named a symbol that is not in the cited file AT ALL
// (`.map-zoom` and its three buttons left `map.js` for `mapboard.js`;
// `data-hold-action` left `holdconfirm.js`), one named a line past the end of
// its file (`map.js:534`, 309 lines long) and one named a file this repo does
// not contain. **Not one of those was red.**
//
// WHAT IT NOW REQUIRES, and why each is the cheapest rule that can go red:
//
//   1  `read` names FILES, and every file it names must EXIST.
//   2  `read` may not carry a typed `:LINE`. A line number is DERIVED from the
//      anchor below and PRINTED by this tool. A typed one is a second home for
//      a fact the machine already holds — Law 0 clause 4 — and 56 of the 73 in
//      the corpus were wrong, which is what a second home with no checker does.
//   3  every probe that owes a `read` declares `anchors`: LITERAL strings, each
//      of which must occur in at least one file the `read` names. An anchor is
//      the identity of the derivation — the symbol, selector, key or content
//      string the probe was built from. When it goes, the derivation is dead
//      and this floor is red BY NAME.
//
// WHAT THIS IS NOT, said before it is cited. It is a CONSISTENCY check, not a
// correctness one (my own card, failure 3): it proves the probe still points at
// something that exists. It does not prove the probe points at the RIGHT thing,
// and it never will — that is what `by` is for, and `by` is a person. An anchor
// chosen loose enough to survive anything is a green that means nothing, and
// this floor cannot detect one; it can only be planted against by whoever picks
// it. **I picked a loose one myself while measuring this** — a scraped `FOLDED`
// matched an unrelated comment 26 lines away and turned A5's own rot green in
// my scratch harness. That is why anchors are DECLARED and never scraped.
//
// Run it alone — no browser, no ledger, no bundle:
//   node tools/watched.mjs --check-reads
const READ_LINE_RE = /:(\d+)(?:[-,]\d+)?/;
const READ_PATH_RE = /(?:^|[\s·,(])((?:src|styles|tools|tests|docs|content|dist)\/[A-Za-z0-9_\-/.]+\.[A-Za-z0-9]+)/g;

function resolveReads(probeRows) {
  const findings = [];
  const table = [];
  for (const p of probeRows) {
    if (p.kind === 'off-build') continue;
    const read = String(p.read || '');
    const files = [...new Set([...read.matchAll(READ_PATH_RE)].map((m) => m[1]))];
    if (files.length === 0) findings.push(`${p.id}: \`read\` names no file in this repo. A derivation with no source is an opinion.`);
    for (const f of files) {
      if (!existsSync(resolve(ROOT, f))) findings.push(`${p.id}: \`read\` names ${f} — THAT FILE IS NOT IN THIS TREE.`);
    }
    const typed = READ_LINE_RE.exec(read);
    if (typed) findings.push(`${p.id}: \`read\` types a line number (\`:${typed[1]}\`). Lines are DERIVED here and printed; delete it. (56 of the 73 typed lines in this corpus were wrong.)`);
    const anchors = Array.isArray(p.anchors) ? p.anchors : null;
    if (!anchors || anchors.length === 0) {
      findings.push(`${p.id}: no \`anchors\`. Name at least one LITERAL string from a file in \`read\` — the thing whose disappearance means this probe's derivation is dead.`);
      continue;
    }
    for (const a of anchors) {
      if (typeof a !== 'string' || a.length < 4) { findings.push(`${p.id}: anchor ${JSON.stringify(a)} is too short to identify anything.`); continue; }
      let found = null;
      for (const f of files) {
        const abs = resolve(ROOT, f);
        if (!existsSync(abs)) continue;
        const lines = readFileSync(abs, 'utf8').split('\n');
        const i = lines.findIndex((l) => l.includes(a));
        if (i >= 0) { found = { file: f, line: i + 1, hits: lines.filter((l) => l.includes(a)).length }; break; }
      }
      if (found) table.push({ id: p.id, by: p.by, anchor: a, ...found });
      else findings.push(`${p.id}: anchor ${JSON.stringify(a)} is in NONE of the files \`read\` names (${files.join(', ')}). The derivation this probe was built from is gone or has moved.`);
    }
  }
  return { findings, table };
}

function reportReads(probeRows) {
  const { findings, table } = resolveReads(probeRows);
  const owed = probeRows.filter((p) => p.kind !== 'off-build').length;
  console.log(`watched --check-reads — ${owed} probe(s) owe a source derivation; ${table.length} anchor(s) resolved\n`);
  let last = '';
  for (const r of table) {
    console.log(`  ${(r.id === last ? '' : r.id).padEnd(5)} ${`${r.file}:${r.line}`.padEnd(46)} ${JSON.stringify(r.anchor)}${r.hits > 1 ? `  (${r.hits} sites)` : ''}`);
    last = r.id;
  }
  if (findings.length) {
    console.log(`\n  ${findings.length} DEAD DERIVATION(S) — a probe reading something that is not there any more:`);
    for (const f of findings) console.log(`    ✗ ${f}`);
  }
  console.log('\nBOUNDARY, and it is the same one every consistency check carries: this proves each');
  console.log('  probe still points at something that EXISTS. It does not prove it points at the RIGHT');
  console.log('  thing — an anchor picked loose enough to survive anything is a green that means');
  console.log('  nothing, and nothing here can see that. `by` names the person who picked it.');
  console.log('  The LINES above are DERIVED from the anchors on this run; none is typed anywhere.');
  // A terminated RESULT sentence with its own counted claim, so the suite's
  // reader can quote it and D103's verdict door can recognise it. A tool whose
  // summary no door can parse is one nobody can wire into a gate.
  console.log(findings.length
    ? `RESULT: FAIL — ${findings.length} dead derivation(s) across ${owed} probe(s); ${table.length} anchor(s) still resolve.`
    : `RESULT: OK — ${owed} probe(s), ${table.length} anchor(s), 0 dead derivations.`);
  return findings.length;
}

function readProbes(path) {
  if (!existsSync(path)) die(`${path} does not exist — this instrument has no probes and would report 39 unaccounted rows as if that were news`);
  let doc;
  try { doc = JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { die(`${path} is not readable JSON: ${e.message}`); }
  const rows = Array.isArray(doc.probes) ? doc.probes : [];
  if (rows.length === 0) die(`${path} declares 0 probes`);
  const byId = new Map();
  for (const p of rows) {
    if (!p.id) die(`${path}: a probe with no id`);
    if (byId.has(p.id)) die(`${path}: ${p.id} declared twice — two homes for one edge`);
    if (!p.by) die(`${path}: ${p.id} names nobody in \`by\`. Who drew this edge?`);
    if (p.kind !== 'off-build' && !p.read) die(`${path}: ${p.id} does not say which source file its selector was READ out of`);
    byId.set(p.id, p);
  }
  // THE READ FLOOR. Until 2026-08-22 the line above was the whole check: `read`
  // had to be non-empty. A non-empty string naming a deleted file passed it.
  const { findings } = resolveReads(rows);
  if (findings.length) {
    console.error(`FLOOR: ${findings.length} probe derivation(s) in ${path} no longer resolve. Run \`node tools/watched.mjs --check-reads\` for the table.`);
    for (const f of findings) console.error(`  \u2717 ${f}`);
    process.exit(2);
  }
  return { byId, doc };
}

// ---- CDP ---------------------------------------------------------------------
function connectCdp(url) {
  const ws = new WebSocket(url);
  let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} (${m.error.code})`)); else res(m.result);
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


// ---- the page-side vocabulary ------------------------------------------------
// One home for "is this control really on the screen": a box with area, not
// display:none, not visibility:hidden, not transparent, and not inside a
// [hidden] ancestor. Written once and used by every assertion below, because two
// definitions of "visible" is exactly the shape of defect this repo is named for.
const VIS = `
  const __vis = (el) => {
    if (!el || !el.isConnected) return null;
    if (el.closest('[hidden]')) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null;
    if (r.width < 1 || r.height < 1) return null;
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
             inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth };
  };
  const __all = (sel) => [...document.querySelectorAll(sel)].map(__vis).filter(Boolean);
`;

async function run() {
  if (!browserPath) die('no Chromium found — set $CHROME');
  const { pop, total, gate } = readPopulation(LEDGER);
  const { byId: probes } = readProbes(PROBES);

  mkdirSync(OUT, { recursive: true });
  const artifact = resolve(ROOT, 'dist/AshenSpire.html');
  console.log(`watched.mjs — ${pop.length} rows in [${WATCH_STATES.join(', ')}] of ${total} in the ledger`);
  console.log(`  ledger        : ${LEDGER}  (gate game ${gate.game ?? '?'})`);
  printArtifactProvenance(artifact, ROOT);

  const s = await serve({ root: ROOT, port: 8531, open: false });
  const BASE = USE_SRC ? `http://localhost:${s.port}/` : `http://localhost:${s.port}/dist/AshenSpire.html`;
  console.log(`  driving       : ${BASE}${USE_SRC ? '  (SOURCE TREE — not what he opens)' : '  (the shipped single-file bundle)'}`);

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'watched-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling', '--hide-scrollbars'],
    timeoutMs: 15000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);

  const ev = async (expr) => {
    const r = await cdp.send('Runtime.evaluate',
      { expression: expr, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || 'page threw');
    return r.result.value;
  };

  const results = [];
  for (const shape of SHAPES) {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: shape.w, height: shape.h, deviceScaleFactor: shape.dsf, mobile: shape.dsf > 1 }, S);
    for (const row of pop) {
      if (ONLY && !ONLY.includes(row.id)) continue;
      const probe = probes.get(row.id);
      const res = await walkRow({ row, probe, shape, cdp, S, ev, BASE, artifact });
      results.push(res);
      const mark = { watched: ' ok ', 'no-screen': ' -- ' }[res.verdict] || 'RED ';
      console.log(`  ${mark} ${row.id.padEnd(4)} ${res.verdict.padEnd(16)} ${(res.screen || '').padEnd(22)} ${res.detail || ''}`);
      if (DUMP && res.dump) console.log(`        dump: ${res.dump}`);
    }
  }

  // EXTRA EDGES. A probe marked `extra` is not a ledger row: it is a second
  // edge a person chose to photograph so a verdict cannot be misread — G7b
  // exists so "no fog by default" is never read as "the fog was never built".
  // They are walked, printed apart, and can still go red, because I authored
  // them as claims. They are exempt from the stale floor by DECLARATION, which
  // is the only exemption this file has.
  const extras = [];
  for (const p of probes.values()) {
    if (!p.extra) continue;
    if (ONLY && !ONLY.includes(p.id)) continue;
    for (const shape of SHAPES) {
      await cdp.send('Emulation.setDeviceMetricsOverride',
        { width: shape.w, height: shape.h, deviceScaleFactor: shape.dsf, mobile: shape.dsf > 1 }, S);
      const res = await walkRow({ row: { id: p.id, state: 'extra-edge', topic: p.screen }, probe: p, shape, cdp, S, ev, BASE });
      extras.push(res);
      console.log(`  ${res.verdict === 'watched' ? ' ok ' : 'RED '} ${p.id.padEnd(4)} ${res.verdict.padEnd(16)} ${(res.screen || '').padEnd(22)} ${res.detail || ''}`);
    }
  }

  // Drift, the other sign: a probe for a row the ledger no longer carries.
  const popIds = new Set(pop.map((r) => r.id));
  const stale = [...probes.keys()].filter((id) => !popIds.has(id) && !probes.get(id).extra);

  cdp.close(); await dropBrowser(); s.server.close();
  return { results, extras, stale, pop, total, gate, artifact };
}

// ---- one row -----------------------------------------------------------------
async function walkRow({ row, probe, shape, cdp, S, ev, BASE }) {
  const base = { id: row.id, state: row.state, topic: row.topic, shape: shape.tag };

  if (!probe) {
    return { ...base, verdict: 'unaccounted', screen: '', by: '',
      detail: 'THE LEDGER HAS THIS ROW AND THIS INSTRUMENT HAS NO PROBE — nobody has said which screen it lives on' };
  }
  if (probe.kind === 'off-build') {
    return { ...base, verdict: 'no-screen', screen: probe.screen || '(no build surface)', by: probe.by,
      detail: probe.why || '', evidence: probe.evidence || '' };
  }

  // reach
  try {
    for (const step of probe.reach || []) {
      if (step.op === 'meta') {
        await ev(`localStorage.setItem('sote_meta_v1', JSON.stringify(${JSON.stringify(step.settings || {})}))`);
      } else if (step.op === 'goto') {
        await cdp.send('Page.navigate', { url: BASE + (step.q || '') }, S);
        await wait(step.ms || 1400);
      } else if (step.op === 'click') {
        const ok = await ev(`(() => { ${VIS}
          const els=[...document.querySelectorAll(${JSON.stringify(step.sel)})].filter(e=>__vis(e));
          if(!els.length) return 'no visible element matches ${step.sel.replace(/'/g, "\\'")}';
          els[${step.nth || 0}].click(); return true; })()`);
        if (ok !== true) throw new Error(String(ok));
        await wait(step.ms || 450);
      } else if (step.op === 'wait') {
        await wait(step.ms || 300);
      } else if (step.op === 'js') {
        // An escape hatch, and it is signed: `js` steps carry their own `why` in
        // the probe file so a reader can see what a person made the page do.
        const r = await ev(`(async () => { ${VIS}
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          ${step.code} })()`);
        if (r !== true) throw new Error(`js step: ${JSON.stringify(r)}`);
        await wait(step.ms || 300);
      } else {
        throw new Error(`unknown reach op "${step.op}" — the step vocabulary is closed on purpose`);
      }
    }
  } catch (e) {
    const shot = await capture({ cdp, S, id: row.id, shape, suffix: 'unreachable' });
    return { ...base, verdict: 'unreachable', screen: probe.screen, by: probe.by,
      detail: `could not open the screen: ${e.message}`, shot };
  }

  // assert
  const expect = probe.expect || {};
  const report = await ev(`(() => { ${VIS}
    const out = { present: {}, absent: {}, counts: {}, measures: {}, wrong: [] };
    for (const [k, sel] of Object.entries(${JSON.stringify(expect.present || {})})) out.present[k] = __all(sel);
    for (const [k, sel] of Object.entries(${JSON.stringify(expect.absent || {})})) out.absent[k] = __all(sel).length;
    for (const c of ${JSON.stringify(expect.count || [])}) out.counts[c.sel] = { n: __all(c.sel).length, eq: c.eq, min: c.min, max: c.max };
    for (const [k, code] of Object.entries(${JSON.stringify(expect.measure || {})})) {
      try { out.measures[k] = eval(code); } catch (e) { out.measures[k] = 'THREW: ' + e.message; }
    }
    for (const w of ${JSON.stringify(expect.wrong || [])}) {
      let hit = false; try { hit = !!eval(w.js); } catch (e) { hit = 'THREW: ' + e.message; }
      if (hit) out.wrong.push(w.why + (hit === true ? '' : ' [' + hit + ']'));
    }
    return out; })()`).catch((e) => ({ error: e.message }));

  if (report.error) {
    const shot = await capture({ cdp, S, id: row.id, shape, suffix: 'threw' });
    return { ...base, verdict: 'unreachable', screen: probe.screen, by: probe.by,
      detail: `the assertion threw on the page: ${report.error}`, shot };
  }

  // A CONTENT ROW HAS NO PIXEL OF ITS OWN. `frost` and `insanity` are full
  // threshold-proc rows in `src/content/statuses.js` and NOTHING IN THE SHIPPED
  // CONTENT APPLIES EITHER — so no drive of the game, however long, can put one
  // on a screen, and "I played and did not see it" is a weak sentence. This
  // expectation is DERIVED from the source the bundle is built from, counted, and
  // it fails BY PATTERN so the reader can re-run the grep themselves.
  const sourceMisses = [];
  for (const s of probe.expect?.source || []) {
    const n = countInTree(resolve(ROOT, s.in), new RegExp(s.pattern, 'g'), s.ext || ['.js']);
    if (s.min != null && n < s.min) sourceMisses.push(`${s.why || s.pattern} — /${s.pattern}/ occurs ${n}x under ${s.in}, wanted >= ${s.min}`);
    if (s.max != null && n > s.max) sourceMisses.push(`${s.why || s.pattern} — /${s.pattern}/ occurs ${n}x under ${s.in}, wanted <= ${s.max}`);
  }

  const missing = Object.entries(report.present).filter(([, v]) => !v.length).map(([k]) => k);
  const shouldBeGone = Object.entries(report.absent).filter(([, n]) => n > 0).map(([k]) => k);
  const badCounts = Object.entries(report.counts).filter(([, c]) =>
    (c.eq != null && c.n !== c.eq) || (c.min != null && c.n < c.min) || (c.max != null && c.n > c.max))
    .map(([sel, c]) => `${sel} → ${c.n} (wanted ${c.eq != null ? `= ${c.eq}` : ''}${c.min != null ? ` >= ${c.min}` : ''}${c.max != null ? ` <= ${c.max}` : ''})`);

  const focusSel = probe.focus || Object.values(expect.present || {})[0] || null;
  const shot = await capture({ cdp, S, id: row.id, shape, focus: focusSel, ev });

  const measures = Object.entries(report.measures).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' · ');
  let dump = null;
  if (DUMP) dump = await ev(`(() => { ${VIS}
      return [...document.querySelectorAll('button,input,select,[data-key],[data-fold],[role=tab]')]
        .filter(e=>__vis(e)).slice(0,60)
        .map(e=>(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\\s+/).join('.'):'')
          +(e.dataset.key?'[data-key='+e.dataset.key+']':'')+' "'+(e.innerText||e.value||'').trim().replace(/\\s+/g,' ').slice(0,24)+'"')
        .join(' | '); })()`).catch(() => null);

  if (missing.length || sourceMisses.length) {
    return { ...base, verdict: 'not-there', screen: probe.screen, by: probe.by, shot, measures, dump,
      detail: [missing.length ? `the screen opened and these were NOT on it: ${missing.join(', ')}` : '', ...sourceMisses].filter(Boolean).join(' · ') };
  }
  if (shouldBeGone.length || badCounts.length || report.wrong.length) {
    return { ...base, verdict: 'there-but-wrong', screen: probe.screen, by: probe.by, shot, measures, dump,
      detail: [...report.wrong, ...badCounts.map((c) => `count ${c}`), ...shouldBeGone.map((k) => `should not be there: ${k}`)].join(' · ') };
  }
  return { ...base, verdict: 'watched', screen: probe.screen, by: probe.by, shot, measures, dump,
    detail: measures || Object.keys(report.present).join(', ') };
}

// ---- committed pictures: a screenshot that outlives its build is a receipt ---
//
// Viki's closing note on the co-op collapse: the preview shots checked into this
// repo "still show the old 27 px map until whoever owns the shots re-runs the
// harness." That is this file's own subject wearing a picture — a reader opens
// `docs/preview/`, sees a screen, and calls the thing done while looking at a
// build nobody can open any more.
//
// BOTH HALVES ARE DERIVED, neither is a typed list:
//   · the pictures    — every .png in docs/preview/
//   · the denominator — every `?shot=` state src/main.js actually compares on,
//                       read out of the file's own `shotState === '...'` text.
//                       (The same derivation my axis check uses, and for the
//                       same reason: a hand-typed list of screens goes stale
//                       silently, which is the defect this section is about.)
//
// RED, by name:
//   · a picture whose last commit is BEHIND the last commit that touched
//     src/ or styles/ — it depicts a build that no longer exists
//   · a declared shot state with no committed picture at all — a screen this
//     repo can pose and has never shown anybody
function committedPictures() {
  const dir = resolve(ROOT, 'docs/preview');
  const lastCommit = (path) => {
    const out = execFileSync('git', ['log', '-1', '--format=%h %ad', '--date=short', '--', path],
      { cwd: ROOT, encoding: 'utf8' }).trim();
    return out || null;
  };
  const code = lastCommit('src') && lastCommit('styles')
    ? [lastCommit('src'), lastCommit('styles')].sort((a, b) => (a.split(' ')[1] < b.split(' ')[1] ? 1 : -1))[0]
    : null;
  const pics = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')) : [];

  // The declared states, read out of main.js rather than out of a list here.
  const main = readFileSync(resolve(ROOT, 'src/main.js'), 'utf8');
  const states = [...new Set([...main.matchAll(/shotState === '([a-z]+)'/g)].map((m) => m[1]))].sort();

  const stale = [];
  for (const f of pics) {
    const c = lastCommit(join('docs/preview', f));
    if (!c || !code) continue;
    const picDate = c.split(' ')[1]; const codeDate = code.split(' ')[1];
    if (picDate < codeDate) stale.push({ f, pic: c, code });
  }
  // A state is "pictured" if some png name contains it (title/boss-intro etc.
  // are named by hand in tools/screenshot.mjs, so the match is loose on purpose
  // — a loose match UNDER-reports, which is the safe direction for a finding).
  const unpictured = states.filter((s) => !pics.some((f) => f.replace(/[-_.]/g, '').includes(s)));
  return { dir, pics, states, stale, unpictured, code };
}

// Count a pattern across a source subtree. Node-side, so a row whose claim is
// CONTENT rather than a control can still be failed by a machine.
function countInTree(dir, re, exts) {
  let n = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (exts.some((x) => e.name.endsWith(x))) {
        const m = readFileSync(p, 'utf8').match(re);
        if (m) n += m.length;
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return n;
}

// The picture. The control is scrolled into view and outlined so the reader can
// find it — the outline is INJECTED BY THIS TOOL and removed straight after, and
// saying so is the difference between a photograph and a claim.
async function capture({ cdp, S, id, shape, focus = null, suffix = null, ev = null }) {
  let outlined = false;
  if (focus && ev) {
    outlined = await ev(`(() => {
      const el = document.querySelector(${JSON.stringify(focus)});
      if (!el) return false;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.setAttribute('data-watched-outline', '1');
      let st = document.getElementById('watched-outline-style');
      if (!st) { st = document.createElement('style'); st.id = 'watched-outline-style';
        st.textContent = '[data-watched-outline]{outline:3px solid #ff2d95 !important;outline-offset:2px !important}';
        document.head.appendChild(st); }
      return true; })()`).catch(() => false);
    await wait(180);
  }
  const name = `${id}${suffix ? `_${suffix}` : ''}_${shape.tag}.png`;
  const file = join(OUT, name);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, S);
  writeFileSync(file, Buffer.from(data, 'base64'));
  if (outlined && ev) {
    await ev(`(() => { document.querySelectorAll('[data-watched-outline]').forEach(e=>e.removeAttribute('data-watched-outline'));
      const st=document.getElementById('watched-outline-style'); if(st) st.remove(); return true; })()`).catch(() => {});
  }
  return file.slice(ROOT.length + 1);
}

// ---- print + floors ----------------------------------------------------------
function reportOut({ results, extras = [], stale, pop, total, gate, artifact }) {
  const by = (v) => results.filter((r) => r.verdict === v);
  const watched = by('watched'); const notThere = by('not-there');
  const wrong = by('there-but-wrong'); const unreachable = by('unreachable');
  const unaccounted = by('unaccounted'); const noScreen = by('no-screen');

  console.log('');
  console.log(`TALLY over ${results.length} row-shapes (population ${pop.length} of ${total} ledger rows, states [${WATCH_STATES.join(', ')}])`);
  console.log(`  watched          ${String(watched.length).padStart(3)}   on screen in the shipped bundle, picture written`);
  console.log(`  there-but-wrong  ${String(wrong.length).padStart(3)}`);
  console.log(`  not-there        ${String(notThere.length).padStart(3)}`);
  console.log(`  unreachable      ${String(unreachable.length).padStart(3)}   a finding, not a skip`);
  console.log(`  unaccounted      ${String(unaccounted.length).padStart(3)}   the ledger has the row, this tool has no probe`);
  console.log(`  no-screen        ${String(noScreen.length).padStart(3)}   declared by a person: no build surface (NOT counted as watched)`);

  const list = (label, set) => {
    if (!set.length) return;
    console.log('');
    console.log(`${label}: ${set.length}`);
    for (const r of set) console.log(`  ${r.id.padEnd(4)} ${r.topic}\n         ${r.screen ? `screen: ${r.screen}` : ''}${r.by ? ` · by ${r.by}` : ''}\n         ${r.detail}${r.shot ? `\n         shot: ${r.shot}` : ''}`);
  };
  list('NOT THERE — reported done, and the screen does not have it', notThere);
  list('THERE BUT WRONG — on the screen, and not in the state he opens it in', wrong);
  list('UNREACHABLE — no instrument in this repo can open this screen', unreachable);
  list('UNACCOUNTED — the ledger carries this row and nobody has named its screen', unaccounted);
  list('NO SCREEN — a person declared this ask has no build surface', noScreen);
  if (stale.length) {
    console.log('');
    console.log(`STALE PROBES — this instrument names rows the ledger does not carry: ${stale.length}`);
    for (const id of stale) console.log(`  ${id}`);
  }

  console.log('');
  console.log('BOUNDARY — what this green does NOT cover:');
  console.log(`  · ${SHAPES.map((s) => s.tag).join(', ')} only, headless Chromium, one Linux box. Windows unrun — he has not run it either.`);
  console.log('  · `watched` = the control was ON SCREEN and photographable in the state he opens it in.');
  console.log('    It is NOT "it works", and it is not a person\'s eyes. The picture still needs a reader,');
  console.log('    and the report that cites this run names who looked.');
  console.log('  · `no-screen` rows are a PERSON\'s claim, printed by name above and never folded into watched.');
  console.log(`  · the artifact was ${artifact.slice(ROOT.length + 1)}; a stale bundle photographs a tree nobody is on (provenance printed at the top).`);
  console.log(`  · gate: ledger game ${gate.game ?? '?'} · this tree ${gitShort()}`);

  // The committed pictures, in the same run and under the same rule.
  const cp = committedPictures();
  console.log('');
  console.log(`COMMITTED PICTURES — docs/preview/: ${cp.pics.length} png · ${cp.states.length} ?shot= states declared in src/main.js`);
  console.log(`  newest code commit touching src/ or styles/: ${cp.code}`);
  if (cp.stale.length) {
    console.log(`  STALE — a picture of a build that no longer exists: ${cp.stale.length}`);
    for (const s of cp.stale) console.log(`    ${s.f.padEnd(24)} last touched ${s.pic}   code moved on at ${s.code}`);
  } else {
    console.log('  none stale.');
  }
  if (cp.unpictured.length) {
    console.log(`  NEVER PICTURED — a state this repo can pose and has never shown anybody: ${cp.unpictured.length}`);
    console.log(`    ${cp.unpictured.join(' · ')}`);
  }

  const extraRed = extras.filter((r) => r.verdict !== 'watched');
  if (extras.length) {
    console.log('');
    console.log(`EXTRA EDGES (declared, not ledger rows): ${extras.length}, red ${extraRed.length}`);
    for (const r of extras) console.log(`  ${r.id.padEnd(4)} ${r.verdict.padEnd(16)} ${r.screen}\n         ${r.detail || ''}${r.shot ? `\n         shot: ${r.shot}` : ''}`);
  }

  // Stale pictures are RED. A tool that finds a defect and exits 0 is a whisper —
  // my own unresolved-glyph warning already taught this house that lesson once.
  const red = notThere.length + wrong.length + unreachable.length + unaccounted.length
    + stale.length + extraRed.length + cp.stale.length + cp.unpictured.length;
  return red;
}

function gitShort() {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return '?'; }
}

// ---- known-bad corpus --------------------------------------------------------
// Six plants. Each one must be OBSERVED red, here, before anything this file
// prints may be cited (development.md, *The instrument rule*). They are run
// against the real tree, in memory, and undone.
async function selftest() {
  const { runSelftest } = await import('./watched-selftest.mjs');
  return runSelftest({ ROOT, LEDGER, PROBES, OUT });
}

// `--check-reads` is the READ FLOOR ALONE: no browser, no ledger, no bundle, so
// it can be run by a person in a second and wired into CI, which the rest of
// this file cannot be. It exits 2 on a dead derivation, which is the same floor
// exit a full run would take — one home for the rule, two doors to it.
if (has('--check-reads')) {
  const { probes: rows } = JSON.parse(readFileSync(PROBES, 'utf8'));
  process.exit(reportReads(rows) ? 2 : 0);
}

if (SELFTEST) {
  process.exit(await selftest());
} else {
  const out = await run();
  const red = reportOut(out);
  const jsonPath = join(OUT, 'watched.json');
  // `ledgerGate` REPAIRED 2026-08-14 (Bjorn). It used to copy the ledger's own
  // `gate.game` — a restatement of Saga's field, not a fact about this run. The
  // two coincided at cd3da94 and then drifted apart: an audit of tree X carrying
  // gate Y claims verdicts about a tree nobody ran. Saga's `--watched` floor
  // compares this field against her gate to decide drift, so the field must
  // state THE TREE THE VERDICTS ARE ABOUT — which is this tree, `gitShort()`.
  // What the ledger's gate said when the population was read is kept beside it
  // as `ledgerGateAtRead`, and a mismatch is printed, never silent.
  if (out.gate.game && out.gate.game !== gitShort()) {
    console.log(`\n  NOTE: the ledger's own gate is ${out.gate.game}; these verdicts are about THIS tree, ${gitShort()}.`);
    console.log('        watched.json says so (`ledgerGate` = the audited tree; `ledgerGateAtRead` = the ledger\'s gate when read).');
  }
  writeFileSync(jsonPath, `${JSON.stringify({
    tool: 'tools/watched.mjs', tree: gitShort(), ledgerGate: gitShort(), ledgerGateAtRead: out.gate.game ?? null,
    ledger: LEDGER, shapes: SHAPES.map((s) => s.tag), ranAt: new Date().toISOString(),
    population: out.pop.length, rows: out.results.map((r) => ({
      id: r.id, state: r.state, shape: r.shape, verdict: r.verdict,
      screen: r.screen || null, by: r.by || null, shot: r.shot || null, detail: r.detail || null,
    })), extras: out.extras.map((r) => ({ id: r.id, verdict: r.verdict, screen: r.screen || null, shot: r.shot || null })), stale: out.stale,
  }, null, 1)}\n`);
  console.log(`\n  machine-readable verdicts → ${jsonPath.slice(ROOT.length + 1)} (for asks.mjs to read; it is DERIVED, delete it freely)`);
  process.exit(red ? 1 : 0);
}
