// Floater policy (owner, 2026-11-07): only HP damage, Hit, Missed, Blocked, Countered and Defeated show.
// ui/models/FloaterPolicyModel.js is the allowlist; ui/fx.js gates callout() and floatNum() through it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOATER_WORDS_SHOWN, floaterWordShown, floaterNumberShown, floaterGlyphShown, setFloaterPolicyEnabled } from '../src/ui/models/FloaterPolicyModel.js';
import { floatNum, callout, clearCallouts, CALLOUT_KINDS } from '../src/ui/fx.js';
import { dmgClass, guardHitFloatParts } from '../src/ui/fx.js';
import { withKitDom } from './helpers/dom.mjs';

test('the allowlist is Hit, Hit - Evade Failed, Missed, Evaded, Blocked and Countered', () => {
  assert.deepEqual([...FLOATER_WORDS_SHOWN], ['hit', 'evadeFailed', 'missed', 'evaded', 'blocked', 'countered']);
  assert.ok(Object.isFrozen(FLOATER_WORDS_SHOWN));
  for (const kind of FLOATER_WORDS_SHOWN) assert.equal(floaterWordShown(kind), kind);
});

// Owner, 2026-11-14: an Evade stack that cancels a hit reads Evaded; a dodge is still a miss.
test('Dodged draws as Missed and Evaded keeps its own word', () => {
  assert.equal(floaterWordShown('dodged'), 'missed');
  assert.equal(floaterWordShown('evaded'), 'evaded');
});

test('every other word is hidden', () => {
  const hidden = ['status:burn', 'status:poison', 'action:Slash', 'staggered', 'disrupted', 'critical', 'guardBreak', 'wardBreak',
    'barrierBreak', 'blockBreak', 'interrupted', 'poiseBreak', 'resisted', 'wardResisted', 'immune', 'weak', 'outOfRange', 'outOfSp',
    'contestPassed', 'contestFailed'];
  for (const kind of hidden) assert.equal(floaterWordShown(kind), null, kind);
  // Nothing in CALLOUT_KINDS outside the allowlist and the two miss aliases slips through.
  for (const kind of Object.keys(CALLOUT_KINDS)) {
    const shown = floaterWordShown(kind) !== null;
    assert.equal(shown, FLOATER_WORDS_SHOWN.includes(kind) || kind === 'dodged' || kind === 'evaded', kind);
  }
});

test('only HP damage numbers and Defeated show', () => {
  for (const cls of ['dmg', 'dmg small', 'dmg heavy', 'dmg crit', 'dmg pct20', 'dmg pct35', dmgClass(3), dmgClass(30), 'dmg heavy']) {
    assert.equal(floaterNumberShown(cls), true, cls);
  }
  for (const cls of ['blk', 'blk small', 'blk heavy', 'blk pct20', 'heal', 'burst', 'poise small', 'ward small', 'barrier small', 'pierce small', 'immune small', '', undefined]) {
    assert.equal(floaterNumberShown(cls), false, String(cls));
  }
  const parts = guardHitFloatParts({ amount: 10, blocked: 4, barrierAbsorbed: 1, wardAbsorbed: 1, poiseAbsorbed: 1, pierced: 1, forceImmune: 1 });
  assert.equal(floaterNumberShown(parts.damage.cls), true);
  for (const key of ['barrier', 'ward', 'poise', 'pierced', 'immune', 'guard', 'fullHit']) assert.equal(floaterNumberShown(parts[key].cls), false, key);
});

test('callout() with a hidden kind returns null and spawns nothing; a shown kind spawns', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom(({ document }) => {
    const layer = document.createElement('div'); layer.box = { left: 0, top: 0, width: 600, height: 700 };
    const anchor = document.createElement('div'); anchor.box = { left: 100, top: 300, width: 80, height: 120 };
    document.body.append(layer, anchor);
    assert.equal(callout(layer, anchor, 'e1', 'staggered'), null);
    assert.equal(callout(layer, anchor, 'e1', 'status:burn'), null);
    assert.equal(callout(layer, anchor, 'e1', 'action:Slash'), null);
    assert.equal(layer.children.length, 0, 'no element');
    const word = callout(layer, anchor, 'e1', 'dodged');
    assert.ok(word, 'a dodge draws');
    assert.equal(word.dataset.calloutKind, 'missed', 'as the Missed word');
    clearCallouts(layer);
  });
});

test('floatNum() with a hidden class spawns nothing but still runs onSpawn; dmg spawns', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom(({ document }) => {
    const layer = document.createElement('div'); layer.box = { left: 0, top: 0, width: 600, height: 700 };
    const anchor = document.createElement('div'); anchor.box = { left: 100, top: 300, width: 80, height: 120 };
    document.body.append(layer, anchor);
    let sounds = 0;
    assert.equal(floatNum(layer, anchor, '+5', 'blk', undefined, { onSpawn: () => { sounds += 1; } }), null);
    assert.equal(floatNum(layer, anchor, '+5', 'heal'), null);
    assert.equal(floatNum(layer, anchor, '-3', 'burst'), null);
    assert.equal(layer.children.length, 0, 'no element');
    assert.equal(sounds, 1, 'the block sound still plays with its suppressed number');
    const dmg = floatNum(layer, anchor, '-9', 'dmg');
    assert.ok(dmg);
    assert.equal(layer.children.length, 1);
    assert.equal(layer.children[0].textContent, '-9');
  });
});

test('buff-gain popups are hidden words too', async () => {
  const { floaterWordShown } = await import('../src/ui/models/FloaterPolicyModel.js');
  assert.equal(floaterWordShown('buff:precision'), null);
  assert.equal(floaterWordShown('buff:block'), null);
});

test('glyph words (Cast, Guard, Stun) are hidden; allowlisted words still show', () => {
  for (const word of ['Cast', 'Guard', 'Stun']) assert.equal(floaterGlyphShown(word), false, word);
  assert.equal(floaterGlyphShown('blocked'), true);
  setFloaterPolicyEnabled(false);
  try { assert.equal(floaterGlyphShown('Cast'), true); } finally { setFloaterPolicyEnabled(true); }
});
