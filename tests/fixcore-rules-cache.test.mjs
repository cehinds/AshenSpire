// The memoised fixCoreRules (src/model/fixCoreRulesCache.js) answers exactly
// what the uncached adapter answers, and a change to the rules, a mount or a
// status misses instead of returning an earlier answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { fixCoreRules as uncached } from '../src/model/fixCoreMechanics.js';
import { fixCoreRules as cached, clearFixCoreRulesCache, fixCoreRulesCacheSize } from '../src/model/fixCoreRulesCache.js';

function fight() {
  const profile = resolveGameProfile('default');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 'FCCACHE' });
  return createRunCombat({ registries, run, rng: createRng('FCCACHE'), enemyIds: ['wanderingSoldier'] });
}
const agree = (combat, entity, carrier) => assert.deepEqual(cached(combat, entity, carrier), uncached(combat, entity, carrier));

test('the cached rules equal the uncached rules for the player, an enemy and a card carrier', () => {
  clearFixCoreRulesCache();
  const combat = fight();
  for (let pass = 0; pass < 2; pass++) { // the second pass is served from the cache
    agree(combat, combat.player);
    agree(combat, combat.enemies[0]);
    agree(combat, combat.player, { cardId: 'core.strike', instanceId: 'x1' });
    agree(combat, null);
  }
  assert.ok(fixCoreRulesCacheSize() >= 2 && fixCoreRulesCacheSize() <= 4, 'repeat calls share entries');
});

test('each call returns its own top-level object', () => {
  const combat = fight();
  const first = cached(combat, combat.player);
  first.accuracy = 'scribbled';
  first.extra = true;
  const second = cached(combat, combat.player);
  assert.notEqual(second.accuracy, 'scribbled');
  assert.equal(second.extra, undefined);
  assert.deepEqual(second, uncached(combat, combat.player));
});

test('editing the combat rules, a status or a mount is seen on the next call', () => {
  const combat = fight();
  const before = cached(combat, combat.player).accuracy.baseAC;
  combat.fixCoreRules.accuracy.baseAC = before + 7;
  assert.equal(cached(combat, combat.player).accuracy.baseAC, before + 7, 'raw rules edited in place');
  agree(combat, combat.player);
  combat.fixCoreRules.accuracy.baseAC = before;
  assert.equal(cached(combat, combat.player).accuracy.baseAC, before, 'and edited back');

  combat.propertyMounts = { ...(combat.propertyMounts || {}) };
  const owner = combat.playerIdForEntity?.(combat.player) || combat.player.id;
  const had = combat.propertyMounts[owner];
  combat.propertyMounts[owner] = { ...(had || {}), probe: { kind: 'feat', name: 'Probe', mechanicTags: [] } };
  agree(combat, combat.player);
  combat.propertyMounts[owner] = had;
  agree(combat, combat.player);
  combat.player.statuses = { ...combat.player.statuses, evade: { stacks: 2 } };
  agree(combat, combat.player);
});

test('a failing call is not stored and rethrows each time', () => {
  const combat = fight();
  combat.fixCoreRules.accuracy = null;
  assert.throws(() => uncached(combat, combat.player));
  assert.throws(() => cached(combat, combat.player));
  assert.throws(() => cached(combat, combat.player));
});

test('a played turn reads the same rules through the cache as without it', () => {
  const combat = fight();
  for (const card of [...combat.piles.hand]) {
    try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id }); } catch { /* unaffordable */ }
    agree(combat, combat.player);
    agree(combat, combat.enemies[0]);
  }
});
