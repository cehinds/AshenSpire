// tools/seedrefuses.mjs — the seed field keeps the promise printed on it.
//
// THE DEFECT THIS EXISTS FOR. `customize.js` put this tooltip on the seed
// field: "The same seed gives the same map, the same shops and the same
// cards." `SEED_ALPHABET` (engine/rng.js) has no hyphen, `seedFromString`
// threw on anything outside it, and `main.js` CAUGHT the throw and substituted
// `Math.random()`. Six boots of one URL with `MY-SEED` typed in gave six
// different maps and said nothing. Measured on this tree at dev 346f4fa,
// through the shipped code path: `MY-SEED` · `MY SEED` · `A_B` · `café` ·
// `ELDEN!` · `2026/08/08` · `ÅSA` all silently rerolled. Constantine asked for
// the 30-minute-run knobs so he could do REPEATABLE short runs; the field that
// makes a run repeatable was the field that quietly did not.
//
// WHAT IT CHECKS, on the rendered page and never on the source — per screen:
//   1. the field's length bound is the ONE home's (engine/rng.js SEED_MAX_LEN),
//      read off the live input, not off the markup
//   2. a bad seed is REFUSED where it is typed: the note renders, it NAMES the
//      character, the input is aria-invalid, and BEGIN THE CLIMB carries a
//      `data-refusal` (components/refusal.js) — never `disabled`, so it can
//      still be asked
//   3. THE BUTTON AND THE FIELD SAY THE SAME SENTENCE, character for character.
//      Two copies of one message is the defect this whole change is about, so
//      the probe asserts there is one.
//   4. pressing BEGIN THE CLIMB with a bad seed starts NO RUN and rerolls
//      nothing — the screen stays where it is
//   5. the refusal LETS GO: a good seed clears the note, the mark and the
//      refusal, and the run starts (a refusal that never lifts is worse than
//      the bug)
//   6. THE PROMISE ITSELF, end to end: six boots typing `ELDEN` produce six
//      IDENTICAL maps (the rendered `#map-nodes` fingerprint, not a claim
//      about it), and six boots typing `MY-SEED` produce zero runs instead of
//      six different maps.
//
// Usage
//   node tools/seedrefuses.mjs                  source tree via tools/serve.mjs
//   node tools/seedrefuses.mjs --only 390x844   one shape instead of both
//   node tools/seedrefuses.mjs --mutate nonote  arm a known-bad (see below)
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// OBSERVED RED — the instrument rule (development.md, top). A check whose
// failing case nobody has watched fail is `unknown`, not green. `--mutate`
// breaks the rendered page in three ways, in the live DOM, and each one must
// take this file to exit 1:
//   nonote   delete the `.seed-problem` element after typing  → the refusal is
//            invisible, which is the shipped defect wearing a fix
//   nomark   strip `data-refusal`/`aria-disabled` off the button → the control
//            refuses in silence, which is what components/refusal.js exists for
//   twowords rewrite the note's text so the field and the button disagree →
//            two copies of one sentence, the drift this change removes
// The runs are recorded in the log entry that ships with this file, with their
// exit codes and failing-line counts.
//
// BOUNDARY, and it is the honest one. Linux headless Chromium, two shapes.
// This is a claim about THREE screens — customize, Custom Climb, the co-op
// lobby — and nothing at all about any other. The lobby is reached by lighting
// a real fire on this machine (`serve({ lan: true })`), so the lobby rows are a
// LOCALHOST host-side claim: no second launcher, no guest, no wire between two
// machines. The wire boundary itself (tools/lan.mjs's `seed` message) is not
// tested here — it is a node-side path and has no pixels.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { SEED_MAX_LEN } from '../src/engine/rng.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const SHAPES = [[390, 844], [1200, 730]];
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const MUTATE = argOf('--mutate') || '';
const MUTATIONS = ['nonote', 'nomark', 'twowords'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The typed seeds. BAD is Marina's measured set; GOOD is one that has always
// worked, so the probe proves the refusal is a gate and not a wall.
const BAD = 'MY-SEED';
const BAD_CHAR = '-';
const GOOD = 'ELDEN';

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
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

async function main() {
  if (!browserPath) { console.error('seedrefuses: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  if (MUTATE && !MUTATIONS.includes(MUTATE)) {
    console.error(`seedrefuses: --mutate ${MUTATE} is not one of ${MUTATIONS.join(', ')}`); process.exit(2);
  }
  const profile = mkdtempSync(join(tmpdir(), 'seedref-'));
  // `lan: true` so the co-op lobby is reachable — it is the third seed field
  // and the only one whose value crosses a wire.
  const s = await serve({ root: ROOT, port: 8641, open: false, lan: true });
  const base = `http://localhost:${s.port}/`;
  console.log(`seedrefuses — ${base}${MUTATE ? `  [KNOWN-BAD ARMED: ${MUTATE}]` : ''}`);
  console.log(`  one home: SEED_MAX_LEN = ${SEED_MAX_LEN} (src/engine/rng.js)`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  let fails = 0; let ran = 0; let checks = 0;

  for (const [W, H] of SHAPES) {
    const shape = `${W}x${H}`;
    if (only && only !== shape) continue;
    ran++;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 700 }, S);

    const ev = async (e) => {
      const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
      return r.result.value;
    };
    const until = async (x, w, ms = 20000) => {
      const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(120); }
      throw new Error('timeout ' + w);
    };
    const ok = (b, what) => { checks++; if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };

    // Type into a field the way a player does: set the value and fire the
    // events the browser fires, so the screen's own listeners run.
    const type = (sel, v) => ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)});
      i.value = ${JSON.stringify(v)};
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
      return i.value; })()`);
    const click = (sel) => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)});
      b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return 1; })()`);
    const readState = (input, button) => ev(`(() => {
      const i = document.querySelector(${JSON.stringify(input)});
      const b = document.querySelector(${JSON.stringify(button)});
      const n = i && i.closest('.seed-line') ? i.closest('.seed-line').querySelector('.seed-problem') : null;
      return {
        maxLength: i ? i.maxLength : null,
        invalid: i ? i.getAttribute('aria-invalid') : null,
        noteShown: !!(n && !n.hidden && n.textContent.trim()),
        note: n ? n.textContent.trim() : null,
        refusal: b ? (b.dataset.refusal || null) : null,
        ariaDisabled: b ? b.getAttribute('aria-disabled') : null,
        nativeDisabled: b ? !!b.disabled : null,
      }; })()`);
    // The known-bads. They break the RENDERED page, after the app has done its
    // work, which is the only way to prove this file can see the absence.
    const mutate = (input, button) => {
      if (!MUTATE) return Promise.resolve(0);
      return ev(`(() => {
        const i = document.querySelector(${JSON.stringify(input)});
        const b = document.querySelector(${JSON.stringify(button)});
        const n = i.closest('.seed-line').querySelector('.seed-problem');
        const m = ${JSON.stringify(MUTATE)};
        if (m === 'nonote') n.remove();
        if (m === 'nomark') { delete b.dataset.refusal; b.removeAttribute('aria-disabled'); }
        if (m === 'twowords') n.textContent = 'Something is wrong with that seed.';
        return 1; })()`);
    };

    console.log(`\n  ${shape}`);

    // ---- screen 1 · character creation (the field carrying the promise) ----
    for (const [label, url, drive, input, button] of [
      ['customize', `${base}?shot=customize`, null, '#seed-input', '#cz-start'],
      ['custom climb', base, `#custom-climb`, '#cr-seed', '#cr-start'],
    ]) {
      await cdp.send('Page.navigate', { url }, S);
      if (drive) { await until(`!!document.querySelector('${drive}')`, `title (${label})`); await click(drive); }
      await until(`!!document.querySelector('${input}')`, label);
      await wait(200);
      console.log(`\n    — ${label}`);

      const clean = await readState(input, button);
      ok(clean.maxLength === SEED_MAX_LEN, `${label}: the field's length bound is the one home's (${clean.maxLength} = SEED_MAX_LEN)`);
      ok(!clean.noteShown && !clean.refusal, `${label}: a usable seed refuses nothing`);

      await type(input, BAD);
      await wait(120);
      await mutate(input, button);
      const bad = await readState(input, button);
      ok(bad.noteShown, `${label}: "${BAD}" renders a refusal at the field`);
      ok(!!bad.note && bad.note.includes(BAD_CHAR), `${label}: the refusal NAMES the character — ${JSON.stringify(bad.note)}`);
      ok(bad.invalid === 'true', `${label}: the input is marked aria-invalid`);
      ok(!!bad.refusal, `${label}: BEGIN THE CLIMB carries a data-refusal`);
      ok(bad.ariaDisabled === 'true' && bad.nativeDisabled === false,
        `${label}: it is aria-disabled and NOT disabled — still focusable, still askable`);
      ok(bad.note === bad.refusal, `${label}: the field and the button say ONE sentence, not two`);

      await click(button);
      await wait(400);
      ok(await ev(`!!document.querySelector('${input}')`),
        `${label}: pressing BEGIN THE CLIMB starts no run and rerolls nothing — the screen stays`);

      await type(input, GOOD);
      await wait(120);
      const good = await readState(input, button);
      ok(!good.noteShown && !good.refusal && good.invalid === null,
        `${label}: a good seed LETS GO — no note, no mark, no refusal`);
      await click(button);
      await until(`!!document.querySelector('#map-nodes .map-node')`, `${label} → map`);
      ok(true, `${label}: and the run starts`);
    }

    // ---- screen 3 · the co-op lobby (the field that crosses a wire) ----
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`!!document.querySelector('#lan-play')`, 'title (lobby)');
    await until(`!document.querySelector('#lan-play').hidden`, 'lan button un-hidden');
    await click('#lan-play');
    await until(`!!document.querySelector('#lb-host')`, 'lobby browse');
    await click('#lb-host');
    await until(`!!document.querySelector('#lb-seed')`, 'lobby room', 25000);
    await wait(250);
    console.log('\n    — co-op lobby (host side, this machine)');
    const lobbyClean = await readState('#lb-seed', '#lb-start');
    ok(lobbyClean.maxLength === SEED_MAX_LEN, `lobby: the field's length bound is the one home's (${lobbyClean.maxLength})`);
    await type('#lb-seed', BAD);
    await wait(150);
    await mutate('#lb-seed', '#lb-start');
    const lobbyBad = await readState('#lb-seed', '#lb-start');
    ok(lobbyBad.noteShown && !!lobbyBad.note && lobbyBad.note.includes(BAD_CHAR),
      `lobby: "${BAD}" renders a refusal naming the character`);
    ok(lobbyBad.invalid === 'true', 'lobby: the input is marked aria-invalid');
    ok(!!lobbyBad.refusal && lobbyBad.note === lobbyBad.refusal,
      'lobby: the field and BEGIN THE CLIMB say ONE sentence');
    await type('#lb-seed', GOOD);
    await wait(150);
    const lobbyGood = await readState('#lb-seed', '#lb-start');
    ok(!lobbyGood.noteShown && !lobbyGood.refusal, 'lobby: a good seed lets go');

    // ---- the promise, end to end -------------------------------------------
    // Six boots of one URL. This is the exact sentence the tooltip makes, and
    // the exact shape the defect took.
    console.log('\n    — the promise, six boots of one URL');
    const fingerprint = `(() => document.querySelector('#map-nodes').innerHTML)()`;
    const prints = [];
    for (let i = 0; i < 6; i++) {
      await cdp.send('Page.navigate', { url: `${base}?shot=customize` }, S);
      await until(`!!document.querySelector('#seed-input')`, 'customize');
      await type('#seed-input', GOOD);
      await click('#cz-start');
      await until(`!!document.querySelector('#map-nodes .map-node')`, 'map');
      await wait(150);
      prints.push({
        seed: await ev(`(document.querySelector('.mh-seed')||{textContent:''}).textContent.trim()`),
        map: await ev(fingerprint),
      });
    }
    ok(prints.every((p) => p.map === prints[0].map && p.map.length > 0),
      `"${GOOD}" × 6 boots → ONE map (${prints[0].map.length} chars of rendered node markup, identical 6/6)`);
    ok(prints.every((p) => p.seed === prints[0].seed),
      `"${GOOD}" × 6 boots → the header prints one seed every time (${JSON.stringify(prints[0].seed)})`);

    let started = 0;
    for (let i = 0; i < 6; i++) {
      await cdp.send('Page.navigate', { url: `${base}?shot=customize` }, S);
      await until(`!!document.querySelector('#seed-input')`, 'customize');
      await type('#seed-input', BAD);
      await click('#cz-start');
      await wait(350);
      if (await ev(`!!document.querySelector('#map-nodes .map-node')`)) started++;
    }
    ok(started === 0, `"${BAD}" × 6 boots → ${started} runs started (was 6, each a different map)`);

    await cdp.send('Target.closeTarget', { targetId });
  }

  // THE DENOMINATOR IS FLOORED. A run that examined nothing has not passed.
  if (ran === 0) { console.error(`\nseedrefuses: --only ${only} matched nothing. Unknown, not a pass.`); process.exit(2); }
  if (checks === 0) { console.error('\nseedrefuses: zero checks ran. Unknown, not a pass.'); process.exit(2); }

  console.log(`\n  ${checks} checks over ${ran} shape(s)`);
  console.log(`  ${fails ? `FAIL — ${fails} finding(s)` : 'PASS — every seed field refuses what it cannot reproduce, says why where it was typed, and lets go'}`);
  console.log('  boundary: three screens, this machine, headless Linux. Silent on every other screen,'
    + '\n            on Windows, on a real two-machine wire, and on tools/lan.mjs (no pixels).');
  cdp.close(); child.kill(); s.server.close();
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(`seedrefuses: ${e.message}`); process.exit(2); });
