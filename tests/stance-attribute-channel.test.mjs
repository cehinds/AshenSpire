// Codex P2 (PR #2835): a stance attribute grant lands on the attribute before the channel is priced, so max(INT, WIS) only moves when
// the granted attribute leads; a fight saved with the old flat `stanceRating` keeps its flat bonus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { ItemPropertySummary } from '../src/model/itemProperties.js';
import { stanceRatingBonus } from '../src/model/stanceRules.js';

const meta = { profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } };
const RELIC = 'relic/forsakenMedallion';
const fight = (props) => {
  const run = createRunState({ registries, classId: 'reaver', seed: 504, ...meta });
  run.itemProps = props;
  return createRunCombat({ registries, run, rng: createRng(5), enemyIds: [registries.enemies.ids()[0]] });
};
const inStance = (c, maneuver, attrs, itemProps) => {
  c.player.combatStance = { maneuver, camp: maneuver === 'casting' ? 'spell' : 'weapon', staggered: false };
  Object.assign(c.player.attributes, attrs);
  if (itemProps) c.player.itemProps = itemProps;
  return c;
};
const bonus = (c, id) => stanceRatingBonus(c, c.player, id) - stanceRatingBonus(c, { ...c.player, itemProps: null }, id);

test('summary keeps the attribute, not a channel', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 504, ...meta });
  run.itemProps = { [RELIC]: ['castingStance'] };
  assert.deepEqual(ItemPropertySummary(run).stanceAttribute, { casting: { intelligence: 2 } });
  assert.equal(ItemPropertySummary(run).stanceRating, undefined);
});
test('+2 INT with INT 1 / WIS 10 leaves the magic channel unchanged', () => {
  const c = inStance(fight({ [RELIC]: ['castingStance'] }), 'casting', { intelligence: 1, wisdom: 10 });
  assert.equal(bonus(c, 'pr'), 0);
});
test('+2 INT with INT 10 / WIS 1 adds 2', () => {
  const c = inStance(fight({ [RELIC]: ['castingStance'] }), 'casting', { intelligence: 10, wisdom: 1 });
  assert.equal(bonus(c, 'pr'), 2);
});
test('a pure-attribute channel (STR) adds 2', () => {
  const c = inStance(fight({ [RELIC]: ['attackStance'] }), 'attack', {});
  assert.equal(bonus(c, 'ar'), 2);
  assert.equal(bonus(c, 'dr'), 0);
});
test('the grant is fight-local: attributes are never written', () => {
  const c = inStance(fight({ [RELIC]: ['attackStance'] }), 'attack', {});
  const before = { ...c.player.attributes };
  stanceRatingBonus(c, c.player, 'ar');
  assert.deepEqual(c.player.attributes, before);
});
test('a fight saved with the old flat stanceRating keeps the flat bonus', () => {
  const c = inStance(fight({}), 'casting', { intelligence: 1, wisdom: 10 }, { stanceRating: { casting: { pr: 2 } } });
  assert.equal(bonus(c, 'pr'), 2);
});
