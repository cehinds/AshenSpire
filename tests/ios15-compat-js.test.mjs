// iOS 15 (Safari 15.6) JS compatibility: docs/qa/IOS15-COMPAT.md.
// The newest OS on an iPhone SE 1st gen is iOS 15.8 = Safari 15.6. A regex
// lookbehind is a parse-time SyntaxError there (Safari 16.4), so one in any
// module blanks the whole game; the other APIs below throw at call time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SplitAfter } from '../src/model/splitAfter.js';
import { AbortWithin } from '../src/ui/abortWithin.js';
import { QUALIFIERS } from '../src/model/cardFaceProjection.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.(?:js|mjs)$/.test(name)) yield path;
  }
}
// Code only: line comments and block comments removed, string contents kept (a regex literal is code).
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

// Each pattern is a thing Safari 15.6 cannot parse or does not ship.
const BANNED = [
  [/\(\?<[=!]/, 'RegExp lookbehind (Safari 16.4; a SyntaxError at parse time)'],
  [/\.to(?:Sorted|Reversed|Spliced)\(/, 'Array copy-on-write methods (Safari 16)'],
  [/\bObject\.groupBy\(|\bMap\.groupBy\(/, 'groupBy (Safari 17.4)'],
  [/\bAbortSignal\.(?:any|timeout)\(/, 'AbortSignal.any/timeout (Safari 17.4 / 16): use src/ui/abortWithin.js'],
  [/\bPromise\.withResolvers\(/, 'Promise.withResolvers (Safari 17.4)'],
  [/\bnew Set\([^)]*\)\.(?:union|intersection|difference|symmetricDifference)\(/, 'Set methods (Safari 17)'],
  [/\bstatic\s*\{/, 'class static blocks (Safari 16.4)'],
  [/\.isWellFormed\(|\.toWellFormed\(/, 'String.isWellFormed (Safari 16.4)'],
  [/\bnew OffscreenCanvas\(/, 'OffscreenCanvas (Safari 16.4)'],
  [/\bArray\.fromAsync\(/, 'Array.fromAsync (Safari 16.4)'],
];

test('no module in src/ uses a syntax or API Safari 15.6 lacks', () => {
  const found = [];
  for (const file of sources(SRC)) {
    const text = code(readFileSync(file, 'utf8'));
    for (const [re, why] of BANNED) if (re.test(text)) found.push(`${relative(SRC, file)}: ${why}`);
  }
  assert.deepEqual(found, []);
});

test('SplitAfter matches the lookbehind splits it replaced', () => {
  const samples = ['', 'One.', 'One. Two. Three', 'Deal 6 damage. Apply 2 Weak! (Once per turn.) Draw 1?  Next', 'a.b c.  D', 'No stop', '...  X', 'Ends. '];
  for (const s of samples) {
    assert.deepEqual(SplitAfter(s, /[.!?]\s+(?=[A-Z(])/), s.split(new RegExp('(?<=[.!?])\\s+(?=[A-Z(])')), JSON.stringify(s));
    assert.deepEqual(SplitAfter(s, /\.\s+/), s.split(new RegExp('(?<=\\.)\\s+')), JSON.stringify(s));
    assert.equal(SplitAfter(s, /[.!?]\s/)[0], s.split(new RegExp('(?<=[.!?])\\s'))[0], JSON.stringify(s));
  }
});

test('the cost qualifier says what its lookbehind regex said', () => {
  const old = new RegExp('(?<!\\b(?:whenever|when|if) you )\\b(?:take|lose|loses|pay|offer|skip)\\b|\\bcosts? \\+|\\bunplayable\\b', 'i');
  const cost = QUALIFIERS.find(([kind]) => kind === 'cost')[1];
  for (const s of ['Take 3 damage.', 'Whenever you take damage, draw 1.', 'If you lose HP, gain 2.', 'When you pay 2, then lose 1 HP', 'Costs +1 per use', 'Unplayable.', 'You skip your next turn', 'Offer a card; when you offer another', 'if you take 2 and take 3', 'nothing here', 'Whenever you  take']) {
    assert.equal(cost.test(s), old.test(s), s);
  }
});

test('AbortWithin aborts with the parent signal or after the timeout', async () => {
  const parent = new AbortController();
  const signal = AbortWithin(parent.signal, 60_000);
  assert.equal(signal.aborted, false);
  parent.abort(new Error('stop'));
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason.message, 'stop');

  const late = AbortWithin(new AbortController().signal, 5);
  await new Promise((resolve) => late.addEventListener('abort', resolve, { once: true }));
  assert.equal(late.reason.name, 'TimeoutError');

  const done = new AbortController(); done.abort();
  assert.equal(AbortWithin(done.signal, 60_000).aborted, true);
});

test('the prologue traveller paints without canvas ctx.filter (absent in Safari)', async () => {
  const { paintPrologueCharacter } = await import('../src/ui/prologueCharacter.js');
  const log = [];
  const context = (name) => ({
    // No `filter` property at all, as in Safari.
    save() {}, restore() {}, translate() {}, transform() {}, scale() {}, fillRect(...a) { log.push([name, 'fillRect', ...a]); },
    createRadialGradient: () => ({ addColorStop() {} }),
    drawImage(source, ...a) { log.push([name, 'drawImage', source.scratch ? 'scratch' : 'image', ...a]); },
    set globalCompositeOperation(v) { log.push([name, 'composite', v]); },
  });
  const scratches = [];
  const doc = { createElement: () => { const c = { scratch: true, getContext: () => context(`scratch${scratches.length}`) }; scratches.push(c); return c; } };
  const canvas = { ownerDocument: doc, getContext: () => context('main') };
  const image = { naturalWidth: 400, naturalHeight: 800 };
  paintPrologueCharacter(canvas, image);
  assert.equal(scratches.length, 2, 'one silhouette for the shadow, one dimmed figure');
  assert.equal(scratches[0].width, 100, 'the shadow is drawn quarter size so scaling it up blurs it');
  assert.equal(scratches[1].width, 400);
  const mainDraws = log.filter(([who, op]) => who === 'main' && op === 'drawImage');
  assert.ok(mainDraws.length === 2 && mainDraws.every(([, , kind]) => kind === 'scratch'), 'the raw image is never drawn straight onto the layer');
  assert.ok(log.some(([who, op, mode]) => who.startsWith('scratch') && op === 'composite' && mode === 'source-atop'));
});
