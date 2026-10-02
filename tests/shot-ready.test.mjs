// tests/shot-ready.test.mjs — tools/shotReady.mjs decides when a combat
// screenshot may be taken. A missing figure must hold the capture back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatantArt, devtoolsClient, readyExpression, settledFrame } from '../tools/shotReady.mjs';

const img = (src, { complete = true, naturalWidth = 512, display = 'block', visibility = 'visible', opacity = '1' } = {}) => ({
  complete, naturalWidth, css: { display, visibility, opacity }, getAttribute: (name) => (name === 'src' ? src : null),
});
const frame = (eid, imgs) => ({ dataset: { eid }, querySelectorAll: () => imgs });
const page = (frames) => [
  { querySelectorAll: () => frames },
  { getComputedStyle: (el) => el.css },
];

test('every combatant drawn: ready', () => {
  const state = combatantArt(...page([
    frame('player', [img('a/STANCE-READY.webp'), img('a/prev.webp', { display: 'none' }), img('a/down.webp', { visibility: 'hidden' })]),
    frame('e1', [img('e/hound_idle.webp', { naturalWidth: 384 }), img('e/hound_attack.webp', { visibility: 'hidden', complete: false })]),
  ]));
  assert.equal(state.ready, true);
  assert.deepEqual(state.combatants, [{ eid: 'player', shown: 1, drawn: 1 }, { eid: 'e1', shown: 1, drawn: 1 }]);
});

test('the player frame still loading holds the capture and is named', () => {
  const state = combatantArt(...page([
    frame('player', [img('a/STANCE-READY.webp', { complete: false, naturalWidth: 0 })]),
    frame('e1', [img('e/hound_idle.webp')]),
  ]));
  assert.equal(state.ready, false);
  assert.deepEqual(state.pending, ['player:STANCE-READY.webp']);
});

test('a broken image (loaded, zero width) is not ready and is reported', () => {
  const state = combatantArt(...page([frame('player', [img('a/missing.webp', { naturalWidth: 0 })])]));
  assert.equal(state.ready, false);
  assert.deepEqual(state.broken, ['player:missing.webp']);
});

test('a combatant with no shown artwork, or no combatants at all, is not ready', () => {
  assert.equal(combatantArt(...page([frame('player', [img('a/x.webp', { opacity: '0' })])])).ready, false);
  assert.equal(combatantArt(...page([])).ready, false);
});

test('the in-page expression carries the same check, self-contained', () => {
  const source = readyExpression();
  assert.match(source, /combatantArt/);
  assert.match(source, /\.decode\(\)/);
  assert.doesNotThrow(() => new Function(`return ${source}`));
});

// A DevTools call must settle: a reply, a dropped socket, or the time limit.
const fakeSocket = () => {
  const sent = [];
  return { sent, send: (s) => sent.push(JSON.parse(s)), close() { this.onclose?.({ code: 1006 }); } };
};

test('a DevTools call resolves with its reply and rejects with its error', async () => {
  const socket = fakeSocket();
  const send = devtoolsClient(socket);
  const a = send('Page.enable', {}, 1000);
  const b = send('Bad.method', {}, 1000);
  socket.onmessage({ data: JSON.stringify({ id: socket.sent[0].id, result: { ok: 1 } }) });
  socket.onmessage({ data: JSON.stringify({ id: socket.sent[1].id, error: { message: 'nope' } }) });
  assert.deepEqual(await a, { ok: 1 });
  await assert.rejects(b, /nope/);
});

test('a DevTools call with no reply fails by name within its time limit', async () => {
  const send = devtoolsClient(fakeSocket());
  await assert.rejects(send('Page.captureScreenshot', {}, 20), /Page\.captureScreenshot.*20 ms/);
});

test('a dropped DevTools socket rejects every waiting call, and later calls', async () => {
  const socket = fakeSocket();
  const send = devtoolsClient(socket);
  const pending = [send('Runtime.evaluate', {}, 60000), send('Page.captureScreenshot', {}, 60000)];
  socket.close();
  for (const p of pending) await assert.rejects(p, /DevTools connection closed/);
  await assert.rejects(send('Page.enable', {}, 60000), /DevTools connection closed/);
});

test('a socket error also rejects waiting calls', async () => {
  const socket = fakeSocket();
  const send = devtoolsClient(socket);
  const p = send('Runtime.evaluate', {}, 60000);
  socket.onerror({});
  await assert.rejects(p, /DevTools connection (closed|failed)/);
});

test('screenshot.mjs routes both combat shots through the ready wait', () => {
  const src = readFileSync(new URL('../tools/screenshot.mjs', import.meta.url), 'utf8');
  for (const name of ['combat', 'coop-combat']) {
    assert.match(src, new RegExp(`name: '${name}',[^}\\n]*ready: 'combatants'`), `${name} is a ready shot`);
  }
  assert.match(src, /shot\.ready \? await captureReady\(shot\)/);
});

test('a frame is kept only once a retake agrees with it', async () => {
  const frames = [Buffer.from('a'), Buffer.from('b'), Buffer.from('b')];
  const retries = [];
  const got = await settledFrame(async () => frames.shift(), { tries: 4, waitMs: 0, onRetry: (n) => retries.push(n) });
  assert.equal(got.toString(), 'b');
  assert.deepEqual(retries, [1]);
});

test('BOUNDARY must-fail: a board that never holds still writes no frame', async () => {
  // An always-running animation (e.g. backdropGlow on a plain .backdrop) gives a
  // new frame every grab; the capture must fail closed, never pick one.
  let n = 0;
  const got = await settledFrame(async () => Buffer.from(String(n++)), { tries: 4, waitMs: 0 });
  assert.equal(got, null);
  assert.equal(n, 5);
});

test('BOUNDARY: the combat and co-op boards hide the animated backdrop glow', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, /\.backdrop::after \{[^}]*animation: backdropGlow[^}]*infinite/);
  assert.match(css, /\.environment-backdrop::after \{ display: none; \}/);
  const art = readFileSync(new URL('../src/ui/components/environmentArt.js', import.meta.url), 'utf8');
  const backdrops = [...art.matchAll(/class="(backdrop[^"]*)"/g)].map((m) => m[1]);
  assert.ok(backdrops.length > 0);
  for (const cls of backdrops) assert.match(cls, /\benvironment-backdrop\b/, `combat backdrop "${cls}"`);
  for (const screen of ['combat', 'coop']) {
    const src = readFileSync(new URL(`../src/ui/screens/${screen}.js`, import.meta.url), 'utf8');
    assert.match(src, /\$\{combatBackdropHtml\(/, `${screen} draws its backdrop through combatBackdropHtml`);
  }
});
