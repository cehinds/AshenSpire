// tools/uprightsetting.mjs — BOTH EDGES OF HIS AMENDMENT TO THE UPRIGHT GATE.
//
// Constantine, 2026-08-17: *"rotating to horizontal should work again. I hate
// that it tells me to rerotate to verticle. revert that back, or make that a
// configurable setting."*
//
// Marina ruled the setting rather than the revert, so the gate now answers to one
// row — `Display / Short-screen warning` — and a row with no check is a promise.
// This tool drives ONE still-walled shape twice, with the setting ON and OFF, through
// `?shotSettings`, and requires the two runs to DIFFER in exactly the one way the
// row claims.
//
// ============================================================================
// ⚠ WHY THIS IS A SECOND FILE AND NOT A CLAUSE IN tools/uprightgate.mjs
// ============================================================================
//
// That tool owns this gate and this surface, and its clause W is exactly where
// this belongs — as a clause S, conditional on the setting. IT IS VIRA'S FILE,
// SHE IS LIVE ON IT TONIGHT (C009, clause R landed hours ago), and she has no
// `shotSettings` hook in her `SURFACES` table: adding one would be me editing a
// signed instrument so that it stays green about MY OWN change. That is the shape
// of grading your own homework, and I have one of those on my review list from
// six hours ago already.
//
// SO: FOLDING THIS INTO uprightgate.mjs AS CLAUSE S IS OWED TO HER, and until she
// takes it there are two files that both know how to ask "is the gate standing".
// That is a second copy and I am naming it rather than pretending it is a design.
// The one-line door if she wants it: her `SURFACES[].q` already builds the URL, so
// `?shot=combat&shotSettings={"uprightGate":true}` is a string concatenation and
// her 24-shape verdict becomes conditional on the row instead of on the default.
//
// ============================================================================
// WHAT IT WOULD HAVE CAUGHT, AND IT IS NOT HYPOTHETICAL
// ============================================================================
//
// The obvious way to deliver his sentence is to default the row OFF. Measured on
// this tree, `node tools/uprightgate.mjs`: ELEVEN of 24 shapes stand a gate, and
// with the row defaulting off all eleven go red on clause W — *"WALL: .end-turn
// lies at top 415.41..439.78 outside a 390 px viewport with NO scrollable
// ancestor, and NO GATE STANDS"*. That red would have been TRUE. It is the reason
// the default is ON and the reason that decision is written on the row rather
// than argued in a commit message.
//
// Usage
//   node tools/uprightsetting.mjs               source tree via tools/serve.mjs
//   node tools/uprightsetting.mjs --dist        dist/AshenSpire.html over file://
//   node tools/uprightsetting.mjs --selftest    two source plants, watched red
//   node tools/uprightsetting.mjs --root DIR    serve a different tree
//
// Exit codes  0 held · 1 a finding · 2 usage / no browser / NOTHING MEASURED
//
// BOUNDARY: one shape immediately below #27's rendered compact floor (844x339)
// and one inside its supported band (844x344), one text size, headless Chromium.
// It proves the row still reaches the refusal where no complete composition can
// fit, without resurrecting that refusal inside the supported landscape band.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const useDist = args.includes('--dist');
const SERVE_ROOT = resolve(argOf('--root') || ROOT);
printArtifactProvenance(useDist ? resolve(ROOT, 'dist/AshenSpire.html') : resolve(ROOT, 'index.html'), ROOT);

const BROWSERS = [
  process.env.CHROME,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The one-pixel cell below #27's rendered compact floor. The short-wide door is
// complete at 340 and not at 339, so the refusal still has an honest job here.
const WALLED = { w: 844, h: 339 };
// The first browser-chrome cell players reported, now inside the supported band.
const FITTING = { w: 844, h: 344 };

function cdpConnect(url) {
  const ws = new WebSocket(url); let n = 1; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sid) { const id = n++; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); }); },
    close: () => ws.close() };
}

// The gate, and the BOARD BEHIND IT, in one read off one frame. Both halves
// matter: "no gate" is only half of "the player got the board", and a row that
// removed the gate AND the board would pass a gate-only check.
const READ = `(() => {
  const g = document.querySelector('.upright-veil');
  const et = document.querySelector('.end-turn');
  const r = et ? et.getBoundingClientRect() : null;
  return {
    gate: !!g,
    advice: g ? g.dataset.advice : null,
    chars: g ? (g.textContent || '').replace(/\\s+/g, ' ').trim().length : 0,
    // THE POINTER AT THE WAY OUT. His complaint was that the screen told him to
    // rotate and never said a setting existed; a gate that stands without naming
    // its own switch is the defect, not just the nag.
    namesTheRow: g ? /Short-screen warning/i.test(g.textContent || '') : null,
    board: !!et,
    endTurnTop: r ? +r.top.toFixed(2) : null,
    endTurnBottom: r ? +r.bottom.toFixed(2) : null,
    endTurnOnScreen: r ? (r.top >= -0.5 && r.bottom <= innerHeight + 0.5) : null,
    vh: innerHeight,
  };
})()`;

async function main() {
  if (!browserPath) { console.error('uprightsetting: no chromium found. Set CHROME=/path/to/chrome.'); process.exit(2); }
  if (args.includes('--selftest')) return selftest();

  let base; let stop = () => {};
  if (useDist) base = pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href;
  else { const s = await serve({ root: SERVE_ROOT, port: Number(argOf('--port') || 8295), open: false }); base = `http://127.0.0.1:${s.port}/index.html`; stop = () => s.server.close(); }

  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'upset-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--hide-scrollbars'], timeoutMs: 20000,
  });
  const cdp = cdpConnect(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
  const ev = async (e) => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result.value;

  const findings = []; let checks = 0;
  const ok = (name, cond, detail) => {
    checks++;
    console.log(`    ${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    if (!cond) findings.push(`${name}${detail ? `: ${detail}` : ''}`);
  };

  // `mobile: true` and a coarse pointer, so the ROTATE wording is the one under
  // test — that is the wording he complained about, and the gate picks it from
  // `(pointer: coarse)` rather than from a guess about the device.
  const at = async (s, settings) => {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: s.w, height: s.h, deviceScaleFactor: 2, mobile: true }, sessionId);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }] }, sessionId);
    const q = ['shot=combat'];
    if (settings) q.push(`shotSettings=${encodeURIComponent(JSON.stringify(settings))}`);
    await cdp.send('Page.navigate', { url: `${base}?${q.join('&')}` }, sessionId);
    for (let i = 0; i < 120; i++) { if (await ev(`!!document.querySelector('.end-turn, .upright-veil')`)) break; await wait(120); }
    await wait(400);
    return ev(READ);
  };

  console.log(`\nuprightsetting — his amendment, both edges`);
  console.log(`  tree: ${useDist ? 'dist/AshenSpire.html' : SERVE_ROOT}\n`);

  console.log(`  THE WALLED SHAPE ${WALLED.w}x${WALLED.h} — one pixel below the compact composition's rendered floor`);
  // DEFAULT: no shotSettings at all, which is what a ?shot= boot resolves to and
  // what a fresh profile gets. This cell is the one that would have gone red if I
  // had defaulted the row off, and it is the one that keeps uprightgate.mjs green.
  const onDefault = await at(WALLED, null);
  ok(`with NO stored settings the gate stands (the default is ON, and that is deliberate)`,
    onDefault.gate === true, `gate=${onDefault.gate} advice=${onDefault.advice} ${onDefault.chars} chars`);
  ok(`and it NAMES the row that turns it off (his complaint was that nothing did)`,
    onDefault.namesTheRow === true, `the gate's own text mentions the setting=${onDefault.namesTheRow}`);
  const onExplicit = await at(WALLED, { uprightGate: true });
  ok(`explicitly ON is the same screen as the default`,
    onExplicit.gate === true && onExplicit.advice === onDefault.advice,
    `gate=${onExplicit.gate} advice=${onExplicit.advice}`);

  const off = await at(WALLED, { uprightGate: false });
  ok(`OFF takes the gate down — his ask, delivered`, off.gate === false, `gate=${off.gate}`);
  ok(`and the BOARD is what is behind it (not a blank screen)`, off.board === true, `.end-turn present=${off.board}`);
  // ⚠ THE COST, ASSERTED RATHER THAN MENTIONED. This cell REQUIRES the wall to
  // still be there with the gate down, which reads backwards until you see what
  // it protects: the day someone reads "the setting exists" as "landscape works",
  // this is the check that says no. If a landscape composition ever ships, THIS
  // CELL GOES RED — and that red is the wake condition upright.js's header asks
  // for, one level in: it means the gate's premise is dead and the file should be
  // deleted rather than left switchable.
  ok(`⚠ and the WALL is still there, which is why the default is ON and not OFF`,
    off.endTurnOnScreen === false,
    `.end-turn top ${off.endTurnTop}..${off.endTurnBottom} in a ${off.vh} px viewport, on screen=${off.endTurnOnScreen}`
    + ` — turning the row off draws the board and does NOT make landscape playable.`
    + ` IF THIS CELL IS RED, a landscape composition has shipped: upright.js's premise is dead and the file goes, not the row.`);

  console.log(`\n  THE FITTING SHAPE ${FITTING.w}x${FITTING.h} — the control, and it is not decoration`);
  // WITHOUT THIS PAIR THE ROW IS UNDISTINGUISHED FROM A ROW THAT DOES NOTHING —
  // and Charter 2b is the reason it is here in this form: a check whose cells all
  // sit on one side of the boundary cannot tell you the boundary is anywhere.
  const fitOn = await at(FITTING, { uprightGate: true });
  ok(`ON does not invent a refusal on a shape that fits`, fitOn.gate === false, `gate=${fitOn.gate}`);
  const fitOff = await at(FITTING, { uprightGate: false });
  ok(`OFF changes nothing on a shape that fits`, fitOff.gate === false, `gate=${fitOff.gate}`);

  cdp.close(); await dropBrowser(); stop();
  console.log(`\n  BOUNDARY: two shapes, one text size, headless Chromium. It proves the`);
  console.log(`  ROW REACHES THE GATE both ways. #27's supported landscape band is the fitting control.`);
  if (!checks) { console.error(`\n  NOTHING MEASURED — unknown, never a pass.`); process.exit(2); }
  console.log(`\n  ${findings.length ? `FAIL — ${findings.length} finding(s) over ${checks} check(s)` : `PASS — ${checks} checks, 0 findings`}`);
  for (const f of findings) console.log(`    - ${f}`);
  process.exit(findings.length ? 1 : 0);
}

// ---- THE RE-RUNNABLE KNOWN-BAD (--selftest) ---------------------------------
const PLANTS = [
  {
    // THE ROW WIRED TO NOTHING — the way a settings row usually fails: it exists,
    // it persists, it renders, and no code reads it. Nothing in the settings
    // screen can tell you this.
    name: 'S1 the gate stops reading the row',
    file: 'src/ui/components/upright.js',
    from: '  if (!short || enabled === false) {',
    to: '  if (!short) { /* uprightsetting --selftest S1: the row is wired to nothing */',
    what: 'the clause that lets the player\'s answer take the gate down',
    expect: 'the row saves, renders, and does nothing — the gate stands with the setting off',
    mustRed: (out) => /FAIL\s+OFF takes the gate down/.test(out),
    mustStay: (out) => /ok\s+with NO stored settings the gate stands/.test(out),
  },
  {
    // THE OTHER DIRECTION, and it is the one a "just default it off" instinct
    // produces: the row works and the gate never stands for anyone.
    name: 'S2 the gate is forced off for every fresh/default profile',
    file: 'src/main.js',
    from: 'updateUprightGate({ short, offerRotate: !turned.short && coarse, enabled: settings.uprightGate !== false });',
    to: 'updateUprightGate({ short, offerRotate: !turned.short && coarse, enabled: false });',
    what: 'the default I held for his word — the one token in this lane that is his to flip',
    expect: 'a fresh profile on a landscape phone gets an unplayable board and no explanation; '
      + 'uprightgate.mjs clause W goes red on 11 of 24 shapes',
    mustRed: (out) => /FAIL\s+with NO stored settings the gate stands/.test(out),
    mustStay: (out) => /ok\s+OFF takes the gate down/.test(out),
  },
  {
    // THE POINTER, WHICH IS THE HALF OF HIS COMPLAINT THAT IS NOT ABOUT GEOMETRY.
    // He had to ASK for a switch because the screen never said one existed.
    name: 'S3 the gate stops naming the way out',
    file: 'src/ui/components/upright.js',
    from: '      <p class="upright-hint">${say.hint}</p>',
    to: '',
    what: 'the one line on the gate that names the setting',
    expect: 'the refusal is back to a dead end the player has to guess their way out of',
    mustRed: (out) => /FAIL\s+and it NAMES the row that turns it off/.test(out),
    mustStay: (out) => /ok\s+OFF takes the gate down/.test(out),
  },
];

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'upset-kb-'));
  for (const d of ['src', 'styles', 'assets', 'content']) {
    if (existsSync(resolve(ROOT, d))) cpSync(resolve(ROOT, d), resolve(dir, d), { recursive: true });
  }
  cpSync(resolve(ROOT, 'index.html'), resolve(dir, 'index.html'));
  return dir;
}

function plantInto(dir, p) {
  const path = resolve(dir, p.file);
  const src = readFileSync(path, 'utf8');
  const first = src.indexOf(p.from);
  if (first < 0 || src.indexOf(p.from, first + 1) >= 0) {
    console.error(`uprightsetting --selftest: ${p.name} found ${first < 0 ? 'NO' : 'MORE THAN ONE'} home in ${p.file}`);
    console.error('  Re-aim it at the bytes the defect replaces. Do not delete it and do not loosen it:');
    console.error('  a corpus that silently stops matching is a suite that has gone green about nothing.');
    process.exit(2);
  }
  writeFileSync(path, src.slice(0, first) + p.to + src.slice(first + p.from.length), 'utf8');
}

function runAt(root) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--root', root],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(browserPath ? { CHROME: browserPath } : {}) } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => res({ code, out }));
  });
}

async function selftest() {
  console.log('uprightsetting --selftest — the re-runnable known-bad for his amendment');
  console.log(`  DOOR: one source line replaced in a disposable copy of ${ROOT}, then this whole tool`);
  console.log('  re-run at --root COPY. Real server, real boot, real ?shotSettings.\n');
  let fails = 0;
  const ok = (b, what) => { if (b) console.log(`  PASS ${what}`); else { fails++; console.log(`  FAIL ${what}`); } };

  const cleanDir = sandbox();
  const clean = await runAt(cleanDir);
  ok(clean.code === 0, `control: the copied tree is GREEN (exit ${clean.code}) — the plants are the only difference`);
  if (clean.code !== 0) console.log(clean.out.split('\n').filter((l) => /FAIL/.test(l)).slice(0, 8).map((l) => `      ${l.trim()}`).join('\n'));
  try { rmSync(cleanDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }

  for (const p of PLANTS) {
    console.log(`\n  ${p.name}: ${p.what}`);
    console.log(`    plant: ${p.file} — expect ${p.expect}`);
    const dir = sandbox();
    plantInto(dir, p);
    const r = await runAt(dir);
    ok(r.code === 1, `${p.name}: the planted tree goes RED (exit ${r.code}, want 1)`);
    ok(p.mustRed(r.out), `${p.name}: red BY NAME — ${p.expect}`);
    ok(p.mustStay(r.out), `${p.name}: an untouched corner stays green (right reason, not a crater)`);
    for (const line of r.out.split('\n').filter((l) => /^\s*FAIL/.test(l)).slice(0, 4)) console.log(`      ${line.trim()}`);
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }
  }

  console.log(`\n  ${fails ? `FAIL — ${fails} selftest check(s) failed` : `PASS — ${PLANTS.length} plants, every one watched red by name`}`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
