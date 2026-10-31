// CO-OP KEEPS THE ENCOUNTER'S FITTED ART ACROSS RECEIPT RENDERS (#1772).
//
// The co-op screen rebuilds the combat DOM wholesale on every snapshot
// receipt, so wireBattlefieldStage runs once per render. Its fit caches
// (loadedGeometry, handAnchor, restHandAnchor, artworkFit) live on the
// layoutState object it is given; a fresh `{}` per render throws them away,
// which makes sprites jump while replacement images load and makes the first
// fit measure an empty hand. #1781 regressed exactly this. The node runner has
// no DOM, so the contract is pinned on the source: one layout state per
// encounter (declared at mount scope, reset when the scene leaves combat),
// handed to the stage, and the stage wired only after the hand has mounted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const coop = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
const body = (name) => {
  const start = coop.indexOf(`\n  function ${name}(`);
  assert.ok(start > 0, `coop.js must define ${name}()`);
  const next = coop.indexOf('\n  function ', start + 1);
  return coop.slice(start, next > 0 ? next : undefined);
};

test('co-op layout state is declared once per mount, outside any render', () => {
  const decl = coop.indexOf('let combatLayoutState = {};');
  assert.ok(decl > 0, 'mountCoop must hold a persistent combatLayoutState');
  assert.ok(decl < coop.indexOf('\n  function render('), 'the layout state must outlive a single render');
  assert.doesNotMatch(body('renderCombat'), /combatLayoutState\s*=/, 'a combat render must not replace the encounter layout state');
});

test('co-op layout state resets when the scene leaves combat', () => {
  const render = body('render');
  assert.match(render, /if \(snap\.scene\.kind !== 'combat'\) \{\s*combatLayoutState = \{\};/,
    'a new encounter must start from an empty layout state');
});

test('co-op wires the battlefield stage once, with the layout state, after the hand mounts', () => {
  const combat = body('renderCombat');
  const calls = [...combat.matchAll(/wireBattlefieldStage\(([^;]*)\);/g)];
  assert.equal(calls.length, 1, 'renderCombat must wire the stage exactly once');
  assert.match(calls[0][1], /,\s*combatLayoutState\s*$/, 'the stage must receive the persistent layout state');
  const hand = combat.indexOf('handStrip = mountHand(');
  assert.ok(hand > 0, 'renderCombat must mount the hand');
  assert.ok(calls[0].index > hand, 'the stage must fit after the replacement hand establishes the field size');
});

test('coopMaxAnimationScale reads standalone scale and multiplies with transform', async () => {
  globalThis.DOMMatrixReadOnly ??= class { constructor(t) { const m = /scale\(([\d.]+)\)/.exec(t); this.a = this.d = m ? +m[1] : 1; this.b = this.c = 0; } };
  const { coopMaxAnimationScale } = await import('../src/ui/screens/coop.js');
  const el = (frames) => ({ getAnimations: () => [{ effect: { getKeyframes: () => frames } }] });
  assert.equal(coopMaxAnimationScale(el([{ scale: '0.4' }, { scale: '1.6' }, { scale: '1' }])), 1.6);
  assert.equal(coopMaxAnimationScale(el([{ scale: '1.3 1.3' }, { scale: 'none' }])), 1.3);
  assert.ok(Math.abs(coopMaxAnimationScale(el([{ transform: 'scale(1.2)', scale: '1.5' }])) - 1.8) < 1e-9);
  assert.equal(coopMaxAnimationScale({}), 1);
});
