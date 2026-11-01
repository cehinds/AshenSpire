// A card upgrade that adds or changes a ramp (SPEC §4.3) compares its retained base and growth, never the
// formula's text (which read as 0 and produced "DAMAGE 3 → 0").
import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/engine/runCombat.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { planCardUpgrade } from '../src/model/cardUpgradeService.js';
import { cardUpgradeChanges } from '../src/ui/models/CardUpgradeModel.js';

const changesFor = (cardId, playsEver = 0) => {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const instance = { cardId, instanceId: `ramp-up:${cardId}`, upgraded: false, ...(playsEver ? { playsEver } : {}) };
  run.deck.push(instance);
  const plan = planCardUpgrade(run, registries, instance.instanceId);
  assert.ok(plan.before && plan.after, cardId);
  return cardUpgradeChanges(registries, plan.before, plan.after, playsEver);
};
const row = (changes, label) => changes.find(c => c.label === label);

test('Flick -> Momentum keeps its 3 damage and adds the growth, with no "→ 0" row', () => {
  const changes = changesFor('core.flick');
  assert.deepEqual(row(changes, 'DAMAGE'), { label: 'DAMAGE', before: '3', after: '3 (+1 per play)' });
  assert.equal(changes.some(c => c.after === '0'), false);
});

test('Brace -> Momentum keeps its 2 guard and adds the growth, with no "→ 0" row', () => {
  const changes = changesFor('core.brace');
  assert.deepEqual(row(changes, 'GUARD'), { label: 'GUARD', before: '2', after: '2 (+1 per play)' });
  assert.equal(changes.some(c => c.after === '0'), false);
});

test('a run-scoped ramp upgrade shows the base without the plays-ever growth', () => {
  assert.deepEqual(row(changesFor('core.temperedEdge', 4), 'DAMAGE'), { label: 'DAMAGE', before: '1', after: '1 (+2 per play)' });
});

test('a numeric upgrade on an already ramped (Honed) card shows the base change', () => {
  assert.deepEqual(row(changesFor('core.whetstoneNick', 4), 'DAMAGE'), { label: 'DAMAGE', before: '2', after: '3' });
});
