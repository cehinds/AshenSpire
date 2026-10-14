// Feint applies Prepared at every grade rank (SPEC §13.4r), so the feint
// property rule, which fires when Prepared is applied to its owner, works at
// rank 0 and 1 as well as rank 2 and above.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { progressionCards, abilityCardUpdates } from '../src/content/progression/cards.js';

const REG = createRegistries({ ...contentBundle, cards: [...contentBundle.cards.filter(c => !progressionCards.some(n => n.id === c.id)), ...progressionCards] });
const feint = abilityCardUpdates.find(c => c.id === 'feint');

test('Feint authors Prepare and its draw at every grade rank', () => {
  assert.deepEqual(feint.gradeProfiles.map(p => p.rank), [0, 1, 2, 3, 4, 5]);
  for (const rank of [0, 1, 2]) {
    const { effects } = feint.gradeProfiles[rank];
    assert.ok(effects.some(e => e.op === 'applyStatus' && e.status === 'prepared'), `rank ${rank} applies Prepared`);
    assert.ok(effects.some(e => e.op === 'draw' && e.amount === [1, 1, 1, 2, 2, 3][rank]), `rank ${rank} draws ${[1, 1, 1, 2, 2, 3][rank]}`);
  }
});

for (const rank of [0, 1, 2]) {
  test(`Feint at rank ${rank} draws a card and becomes Prepared in a real play`, () => {
    const run = createRunState({ seed: 0x7a11, classId: 'rogue', registries: REG });
    const cb = createCombat({ registries: REG, rng: createRng(0x7a11), player: { classId: 'rogue', attributes: run.attributes, skills: run.skills, coreTags: [], maxHp: 78, hp: 60, mana: 10, maxMana: 10, energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck, loadout: run.loadout, relicIds: [] }, enemyIds: ['fellWarden'] });
    cb.player.maxStamina = 3; cb.player.stamina = 3;
    const inst = { instanceId: `feint-r${rank}`, cardId: 'feint', abilityRank: rank };
    cb.piles.hand.push(inst);
    const drawBefore = cb.piles.draw.length;
    dispatch(cb, { type: 'playCard', cardInstanceId: inst.instanceId });
    assert.ok((cb.player.statuses.prepared?.stacks ?? 0) >= 1, 'Prepared applied');
    assert.equal(drawBefore - cb.piles.draw.length, feint.gradeProfiles[rank].effects.find(e => e.op === 'draw').amount, 'draw count');
  });
}

test('the feint property rule fires at rank 1 when Feint applies Prepared', () => {
  const run = createRunState({ seed: 0x7a11, classId: 'rogue', registries: REG });
  const cb = createCombat({ registries: REG, rng: createRng(0x7a11), player: { classId: 'rogue', attributes: run.attributes, skills: run.skills, coreTags: ['feint'], maxHp: 78, hp: 60, mana: 10, maxMana: 10, energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck, loadout: run.loadout, relicIds: [] }, enemyIds: ['fellWarden'] });
  cb.player.maxStamina = 3; cb.player.stamina = 3;
  const inst = { instanceId: 'feint-rule-r1', cardId: 'feint', abilityRank: 1 };
  cb.piles.hand.push(inst);
  const foe = cb.enemies[0];
  const poiseBefore = foe.poiseMeter.value;
  dispatch(cb, { type: 'playCard', cardInstanceId: inst.instanceId });
  assert.equal(foe.poiseMeter.value - poiseBefore, REG.balance.classTree.feint.poiseDamage, 'feint rule dealt its Poise damage to the enemy');
});
