import test from 'node:test';
import assert from 'node:assert/strict';
import { stampCombatPlaysEver, foldCombatPlaysEver, instancePlaysEver } from '../src/model/playsEver.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';

const fixture = () => ({
  run: { deck: [{ instanceId: 'a', cardId: 'x', upgraded: false, playsEver: 3 }, { instanceId: 'b', cardId: 'y', upgraded: false }] },
  combat: { piles: { hand: [{ instanceId: 'a', cardId: 'x' }], draw: [{ instanceId: 'b', cardId: 'y' }, { instanceId: 'gen', cardId: 'z' }] },
    player: { abilityRiders: { instanceUsesCombat: { a: 2, b: 1, gen: 5 } } } },
});

test('a fight opens with each pile copy carrying its deck copy\'s lifetime plays', () => {
  const { run, combat } = fixture();
  stampCombatPlaysEver(run, combat);
  assert.equal(combat.piles.hand[0].playsEver, 3);
  assert.equal(combat.piles.draw[0].playsEver, undefined);
  assert.equal(combat.piles.draw[1].playsEver, undefined, 'a card made mid-fight has no deck copy');
});

test('a fight end folds its plays into the deck copies, once', () => {
  const { run, combat } = fixture();
  foldCombatPlaysEver(run, combat);
  foldCombatPlaysEver(run, combat);
  assert.equal(run.deck[0].playsEver, 5);
  assert.equal(run.deck[1].playsEver, 1);
  assert.equal(instancePlaysEver(run.deck[1]), 1);
  assert.equal(JSON.stringify(combat).includes('playsEverFolded'), false, 'the guard is not saved');
});

test('a saved snapshot card with a bad playsEver is refused', () => {
  const card = { instanceId: 'a', cardId: 'x', upgraded: false, playsEver: -1 };
  const bad = combatSnapshotProblems({ piles: { hand: [card] } });
  assert.ok(bad.some(p => /piles\.hand\[0\]\.playsEver/.test(p)), bad.join('; '));
  const good = combatSnapshotProblems({ piles: { hand: [{ ...card, playsEver: 4 }] } });
  assert.equal(good.some(p => /playsEver/.test(p)), false);
});
