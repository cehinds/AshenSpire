#!/usr/bin/env node
// tools/buildstamp-shot.mjs — IS THE BUILD VERSION ACTUALLY ON THE SCREEN?
//
// Constantine asked for the build version "on the main menu, and somewhere in
// the map and combat". tools/buildversion.mjs proves the string is derived and
// singly-homed; that is a fact about SOURCE. This is the other half, and it is
// the half he asked for: three screens, photographed, at both shapes.
//
// ── WHY THE PREDICATE IS INK AND NOT PRESENCE ────────────────────────────────
//
// The obvious check is `document.querySelector('[data-role=build-version]')`.
// Vira wrote up why that is not enough on 2026-08-15, one screen over: a check
// gated on the element being in the DOM is a claim about THE DOM, while the
// sentence it is cited under — "the version is on the screen" — is a claim
// about INK. Six ordinary CSS routes leave the element exactly where it is and
// take the ink away: `opacity: 0`, `visibility: hidden`, the text painted in
// the panel's own colour, `height: 0`, `left: -9999px`, and a
// narrow-layout `display: none` — that last one being a perfectly normal mobile
// edit on a screen class this repo photographs.
//
// So the element's box is photographed TWICE: once as the page renders it, and
// once with THE GLYPHS ALONE taken away (`color: transparent`, which changes no
// layout and no background). If the two crops are byte-identical, the letters
// put no pixels on the screen — whatever the DOM says. Animations are frozen
// first, so the only thing that may differ between the two frames is the text.
//
// AND `color: transparent` RATHER THAN `visibility: hidden`, WHICH IS WHAT I
// WROTE FIRST AND WHAT THE CORPUS CAUGHT ME ON. Hiding the whole element also
// takes away its BACKGROUND, so a stamp whose letters are painted in its own
// background — Vira's fourth route, and an easy accident — still changed the
// crop, and my gate called that ink and passed. The predicate answered "does
// this element paint anything" while the sentence above it said "the version is
// on the screen": the same gap she found in `UNMOVED AND UNEXPLAINED`, in my own
// instrument, one day later. Where the two disagreed, the sentence was rewritten
// to the predicate — and then the predicate was narrowed to the glyphs, which is
// the thing the sentence was always about.
//
// The cheap DOM facts are still asserted — one element per screen, the right
// `data-place`, a box inside the viewport, and the text equal to the version
// this tree DERIVES (never a string typed in here) — because a stamp that is
// visible and wrong is worse than one that is missing.
//
// ── WHAT IT WRITES ──────────────────────────────────────────────────────────
//
//   tools/results/buildstamp-<place>-<shape>.png   six photographs, for him
//
// Usage:
//   node tools/buildstamp-shot.mjs [--root DIR] [--out DIR]
//   node tools/buildstamp-shot.mjs --selftest     the known-bad corpus
//
// BOUNDARY: this proves the stamp puts pixels inside its own box, at two
// viewport shapes, in one browser, on the SOURCE tree this server serves. It
// does not prove the pixels are legible (Sunna's lens), that the placement is
// the right one (Viki's), or anything at all about dist/ — the release artifact
// is tools/release-shots.mjs.

import { spawn, spawnSync } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { stampText } from './buildversion.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

const SHOTS = [
  { place: 'title', query: '', what: 'the main menu — his first word' },
  { place: 'map', query: '?shot=map', what: 'the act map' },
  { place: 'combat', query: '?shot=combat', what: 'a fight' },
];
// The two shapes this repo already looks at (tools/release-shots.mjs). The
// narrow one is the point: it is where a phone photograph of a bug comes from,
// and it is where every other diagnostic string in this game is hidden.
const SHAPES = [
  { tag: '390x844', w: 390, h: 844 },
  { tag: '1200x730', w: 1200, h: 730 },
];

const FREEZE_ID = '__buildstamp_freeze';
const HIDE_ID = '__buildstamp_hide';
const SELECTOR = '[data-role="build-version"]';

export async function run({ root = REPO_ROOT, out = resolve(REPO_ROOT, 'tools/results'), quiet = false } = {}) {
  const say = (...a) => { if (!quiet) console.log(...a); };
  const expected = stampText(root);
  mkdirSync(out, { recursive: true });

  const { server, port } = await serve({ root, port: 8231, open: false });

  // The browser this run measures is the browser this run spawned — port 0, the
  // endpoint parsed off my own child's stderr. Bjorn's finding, and his words
  // are in tools/release-shots.mjs; this is the same construction, not a second
  // opinion about it.
  // UNAVAILABLE IS NOT A VERDICT. A hard-coded browser path that does not exist
  // on the runner produces a failure that reads exactly like a defect in the
  // game — run 1 of this repo's CI taught that lesson to tools/shotguard-probe
  // and it is not going to be re-learned here. No browser resolves to exit 2:
  // `unknown`, which blocks, and which never reads as a pass.
  const browserPath = [
    process.env.CHROME,
    '/opt/pw-browsers/chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].find((p) => p && existsSync(p));
  if (!browserPath) {
    try { server.close(); } catch { /* nothing to close */ }
    console.error('buildstamp-shot: UNKNOWN — no Chrome/Chromium found (tried $CHROME and the usual paths).');
    console.error('  UNKNOWN BLOCKS. Nothing was photographed, so nothing has been checked.');
    process.exit(2);
  }
  // AND THE PROFILE IS THE LAUNCHER'S. This tool passed no `--user-data-dir`, so
  // Chrome made its own throwaway profile in /tmp and left it — measured at this
  // ref, one unpinned run strands a `/tmp/.org.chromium.Chromium.*` every time.
  // tools/browser.mjs gives it a private profile and points its TMPDIR inside it.
  const { child: browser, wsUrl: ws, close: dropBrowser } = await launchBrowser({
    prefix: 'buildstamp-shot-', browser: browserPath,
    headless: '--headless=new', timeoutMs: 20000,
  }).catch((e) => { try { server.close(); } catch { /* already closed */ } console.error(`buildstamp-shot: ${e.message}`); process.exit(2); });
  // The launcher's own exit guard removes the profile and kills the browser
  // GROUP; this reaper keeps only the half that is this file's — the http server.
  const reap = () => { dropBrowser(); try { server.close(); } catch { /* already closed */ } };
  process.on('exit', reap);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { reap(); process.exit(130); });

  const cdpPort = Number(new URL(ws.replace(/^ws:/, 'http:')).port);
  say(`  browser  : ${browserPath}`);
  say(`  this run: browser pid ${browser.pid} · CDP port ${cdpPort} · HTTP port ${port} — both its own`);
  say(`  serving  : ${root}`);
  say(`  expecting: "${expected}" — derived from that tree, never typed here`);
  say('');

  const c = await (async () => {
    let list;
    for (let i = 0; i < 100; i++) {
      try { list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json(); if (list.length) break; } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    const sock = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((ok, no) => { sock.onopen = ok; sock.onerror = no; });
    let id = 0; const waiting = new Map();
    sock.onmessage = (m) => {
      const g = JSON.parse(m.data);
      if (g.id != null && waiting.has(g.id)) {
        const { ok, no } = waiting.get(g.id); waiting.delete(g.id);
        g.error ? no(new Error(g.error.message)) : ok(g.result);
      }
    };
    return { send: (method, params = {}) => { const n = ++id; sock.send(JSON.stringify({ id: n, method, params })); return new Promise((ok, no) => waiting.set(n, { ok, no })); } };
  })();

  await c.send('Page.enable');
  await c.send('Runtime.enable');
  const ev = async (expr) => {
    const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || 'eval error' };
    return r.result.value;
  };

  const misses = [];
  const rows = [];

  for (const shape of SHAPES) {
    await c.send('Emulation.setDeviceMetricsOverride', {
      width: shape.w, height: shape.h, deviceScaleFactor: 1, mobile: false,
    });
    for (const shot of SHOTS) {
      const url = `http://127.0.0.1:${port}/${shot.query}`;
      const label = `${shot.place} @ ${shape.tag}`;
      await c.send('Page.navigate', { url });

      // Page.navigate resolves BEFORE the load commits, so a poll can read the
      // previous document and answer about the wrong screen entirely. Bjorn's
      // D1: assert the URL and the readyState first, then the contents.
      let landed = false;
      for (const t0 = Date.now(); Date.now() - t0 < 15000;) {
        const at = await ev('({ q: location.search, ready: document.readyState })');
        if (at && !at.__err && at.q === shot.query && at.ready !== 'loading') { landed = true; break; }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!landed) { misses.push(`${label}: never arrived at ${shot.query || '/'}`); continue; }

      // Freeze first. Both crops must differ ONLY by the stamp; the title
      // screen drifts embers across it otherwise and every run would pass.
      await ev(`(() => { let s = document.getElementById('${FREEZE_ID}');
        if (!s) { s = document.createElement('style'); s.id = '${FREEZE_ID}'; document.head.appendChild(s); }
        s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
        return true; })()`);

      let facts = null;
      for (const t0 = Date.now(); Date.now() - t0 < 15000;) {
        facts = await ev(`(() => {
          const all = [...document.querySelectorAll('${SELECTOR}')];
          if (!all.length) return null;
          const el = all[0];
          const r = el.getBoundingClientRect();
          return { n: all.length, text: el.textContent.trim(), place: el.dataset.place,
                   x: r.x, y: r.y, w: r.width, h: r.height,
                   vw: innerWidth, vh: innerHeight, sx: scrollX, sy: scrollY };
        })()`);
        if (facts && !facts.__err) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!facts || facts.__err) {
        misses.push(`${label}: no ${SELECTOR} on the screen at all${facts?.__err ? ` (${facts.__err})` : ''}`);
        continue;
      }

      const full = await c.send('Page.captureScreenshot', { format: 'png' });
      const file = resolve(out, `buildstamp-${shot.place}-${shape.tag}.png`);
      writeFileSync(file, Buffer.from(full.data, 'base64'));

      const problems = [];
      if (facts.n !== 1) problems.push(`${facts.n} stamps on one screen — the placement is not one place`);
      if (facts.place !== shot.place) problems.push(`data-place is '${facts.place}', this is the ${shot.place} screen`);
      if (facts.text !== expected) problems.push(`reads "${facts.text}", this tree derives "${expected}"`);
      if (facts.w <= 0 || facts.h <= 0) problems.push(`its box is ${facts.w}x${facts.h} — nothing can be drawn in it`);
      if (facts.x < 0 || facts.y < 0 || facts.x + facts.w > facts.vw || facts.y + facts.h > facts.vh) {
        problems.push(`its box (${Math.round(facts.x)},${Math.round(facts.y)} ${Math.round(facts.w)}x${Math.round(facts.h)}) is outside the ${facts.vw}x${facts.vh} viewport`);
      }

      // ---- the ink test ----------------------------------------------------
      let ink = null;
      if (facts.w > 0 && facts.h > 0) {
        const clip = {
          x: Math.max(0, facts.x + facts.sx - 2), y: Math.max(0, facts.y + facts.sy - 2),
          width: Math.max(1, facts.w + 4), height: Math.max(1, facts.h + 4), scale: 1,
        };
        const shown = await c.send('Page.captureScreenshot', { format: 'png', clip });
        await ev(`(() => { let s = document.getElementById('${HIDE_ID}');
          if (!s) { s = document.createElement('style'); s.id = '${HIDE_ID}'; document.head.appendChild(s); }
          s.textContent = '${SELECTOR}{color:transparent!important}';
          return true; })()`);
        const hidden = await c.send('Page.captureScreenshot', { format: 'png', clip });
        await ev(`(() => { const s = document.getElementById('${HIDE_ID}'); if (s) s.remove(); return true; })()`);
        ink = shown.data !== hidden.data;
        if (!ink) {
          problems.push('ITS BOX IS THERE AND ITS LETTERS ARE NOT — taking the glyphs away changed '
            + 'nothing inside its own box, so the element is in the DOM and the version is not on the screen');
        }
        writeFileSync(resolve(out, `buildstamp-${shot.place}-${shape.tag}-crop.png`), Buffer.from(shown.data, 'base64'));
      }

      rows.push({ label, ok: problems.length === 0, facts, ink, file });
      if (problems.length) misses.push(`${label}: ${problems.join('; ')}`);
      say(`  ${problems.length ? 'MISS' : ' OK '}  ${label.padEnd(22)} `
        + `box ${String(Math.round(facts.w)).padStart(3)}x${String(Math.round(facts.h)).padStart(2)} at `
        + `(${String(Math.round(facts.x)).padStart(4)},${String(Math.round(facts.y)).padStart(3)})  `
        + `ink ${ink === null ? '  —' : ink ? 'YES' : ' NO'}  "${facts.text}"`);
      if (problems.length) for (const p of problems) say(`        ${p}`);
    }
  }

  reap();
  return { misses, rows, expected, out };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);

  // Spawned, never imported: the corpus imports run() from this file, and an
  // in-process dynamic import of a module that imports this one back is an ESM
  // cycle with a top-level await in it — that hangs rather than throws, and a
  // tool that hangs instead of ruling is the silent bucket in a new coat.
  if (args.includes('--selftest')) {
    const r = spawnSync(process.execPath, [resolve(HERE, 'buildstamp-shot-selftest.mjs')], { stdio: 'inherit' });
    process.exit(r.status == null ? 2 : r.status);
  }

  const at = (flag, def) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
  const root = resolve(at('--root', REPO_ROOT));
  const out = resolve(at('--out', resolve(REPO_ROOT, 'tools/results')));

  console.log('buildstamp-shot: three screens, two shapes, and the question is INK.');
  console.log('');
  const { misses, rows, expected } = await run({ root, out });
  console.log('');
  const places = new Set(rows.filter((r) => r.ok).map((r) => r.facts.place));
  if (misses.length) {
    console.log('buildstamp-shot: RED');
    for (const m of misses) console.log(`  · ${m}`);
    process.exit(1);
  }
  console.log(`buildstamp-shot: OK — ${rows.length}/${SHOTS.length * SHAPES.length} placements photographed, `
    + `${places.size} distinct surfaces (${[...places].join(', ')}), each reading "${expected}",`);
  console.log('  each with pixels of its own inside its own box at both shapes.');
  console.log(`  photographs: ${out}/buildstamp-<place>-<shape>.png (+ -crop.png, the box the ink test judged)`);
  console.log('');
  console.log('BOUNDARY — what this green does NOT mean:');
  console.log('  · not legibility. Pixels differ from the background; whether a tired eye reads');
  console.log('    them at 11pm is Sunna\'s lens and tools/contrast-audit.mjs, not this.');
  console.log('  · not the right PLACE. It proves the stamp is on the screen, never that this is');
  console.log('    where a player would look for it — that is Viki\'s call on the photographs.');
  console.log('  · not dist/. This serves the SOURCE tree, which is what run.sh opens; the release');
  console.log('    artifact is photographed by tools/release-shots.mjs.');
  console.log('  · one browser, two shapes. Every other viewport, and every other browser, is');
  console.log('    silence — and silence is unknown, not green.');
  process.exit(0);
}
