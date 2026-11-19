// Owner, 2026-11-19: the weapon's free Retreat card costs 0 SP the first time, Exhausts, and its cost rises by 1 SP each use in that fight (per fight, not per copy).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { bandsFight, registries } from './helpers/bands-fight.mjs';

function playRetreat(combat, id) {
  const shown = previewCard(combat, id).cost, before = combat.player.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: id });
  return { shown, paid: before - combat.player.stamina };
}
const withCopies = (n, stamina = 10) => bandsFight({ hand: Array.from({ length: n }, () => 'core.retreat'), stamina });

test('plays 1, 2, 3 in one fight cost 0, 1, 2 SP across fresh copies, and the hand preview shows the same', () => {
  const combat = withCopies(3);
  for (const [i, cost] of [0, 1, 2].entries()) {
    const r = playRetreat(combat, `qa${i}`);
    assert.equal(r.shown, cost, `play ${i + 1} shown`);
    assert.equal(r.paid, cost, `play ${i + 1} paid`);
  }
});

test('the card is Ethereal and Exhausts as before, and its growth has no ceiling', () => {
  const card = registries.cards.get('core.retreat');
  assert.deepEqual([...card.keywords].sort(), ['ethereal', 'exhaust']);
  assert.equal(card.costGrowth.uncapped, true);
  const combat = withCopies(6, 20);
  const paid = [0, 1, 2, 3, 4, 5].map(i => playRetreat(combat, `qa${i}`).paid);
  assert.deepEqual(paid, [0, 1, 2, 3, 4, 5]);
});

test('a new fight resets the count to 0', () => {
  const first = withCopies(2);
  playRetreat(first, 'qa0'); playRetreat(first, 'qa1');
  assert.equal(playRetreat(withCopies(1), 'qa0').paid, 0);
});

test('saving and loading mid-fight keeps the count', () => {
  const combat = withCopies(3);
  playRetreat(combat, 'qa0'); playRetreat(combat, 'qa1');
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(777, combat.rng.getCounters()), snapshot: saved });
  assert.equal(previewCard(restored, 'qa2').cost, 2);
});
