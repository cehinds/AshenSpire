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

// Every numeric leaf of the raw rules: bump it, and the cache must answer what the
// uncached adapter answers. A key that left any rule out would return the stale
// earlier answer for the leaf it ignored.
function numericLeaves(value, path = [], out = []) {
  if (typeof value === 'number') out.push(path);
  else if (value && typeof value === 'object') for (const k of Object.keys(value)) numericLeaves(value[k], [...path, k], out);
  return out;
}
const at = (root, path) => path.reduce((o, k) => o[k], root);

test('changing any single numeric rule leaf is seen by the cache (no field is dropped from the key)', () => {
  clearFixCoreRulesCache();
  const combat = fight();
  const leaves = numericLeaves(combat.fixCoreRules);
  assert.ok(leaves.length > 20, `expected many rule leaves, found ${leaves.length}`);
  cached(combat, combat.player); // warm the unmodified answer
  let compared = 0;
  for (const path of leaves) {
    const holder = at(combat.fixCoreRules, path.slice(0, -1)), leaf = path[path.length - 1], original = holder[leaf];
    for (const bumped of [original + 1, original + 13]) {
      holder[leaf] = bumped;
      let expected;
      try { expected = uncached(combat, combat.player); } catch { expected = null; }
      if (expected) {
        assert.deepEqual(cached(combat, combat.player), expected, `rules.${path.join('.')} = ${bumped}`);
        compared++;
      } else assert.throws(() => cached(combat, combat.player));
    }
    holder[leaf] = original;
    assert.deepEqual(cached(combat, combat.player), uncached(combat, combat.player), `restored rules.${path.join('.')}`);
  }
  assert.ok(compared > 20, 'enough edits were valid rules');
});

test('the carrier and the owning entity each take part in the key', () => {
  clearFixCoreRulesCache();
  const combat = fight();
  const carriers = [null, { cardId: 'core.strike', instanceId: 'x1' }, { cardId: 'core.defend', instanceId: 'x2' }, { cardId: 'core.strike', instanceId: 'x1', upgraded: true }];
  for (let pass = 0; pass < 2; pass++) for (const entity of [combat.player, combat.enemies[0]]) for (const carrier of carriers) agree(combat, entity, carrier);
});

test('a caller cannot corrupt the cache through the nested fields it is handed', () => {
  clearFixCoreRulesCache();
  const combat = fight();
  const pristine = structuredClone(uncached(combat, combat.player));
  const first = cached(combat, combat.player);
  const nested = Object.entries(first).filter(([, v]) => v && typeof v === 'object');
  assert.ok(nested.length > 3, 'the result has nested sections to attack');
  for (const [name, value] of nested) {
    const field = Object.keys(value)[0];
    assert.throws(() => { value[field] = 'scribbled'; }, TypeError, `${name} is read-only`);
    assert.throws(() => { value.addedByCaller = 1; }, TypeError, `${name} takes no new keys`);
  }
  assert.deepEqual(cached(combat, combat.player), pristine);
});

test('editing one fight\'s rules in place never leaks into another fight that read the same rules earlier', () => {
  clearFixCoreRulesCache();
  const a = fight(), b = fight();
  assert.deepEqual(JSON.stringify(a.fixCoreRules), JSON.stringify(b.fixCoreRules));
  cached(a, a.player); // a stores the entry
  const baseline = structuredClone(uncached(b, b.player));
  for (const value of Object.values(a.fixCoreRules)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) { const k = Object.keys(value).find(key => typeof value[key] === 'number'); if (k) value[k] += 99; }
    
  }
  assert.deepEqual(cached(b, b.player), baseline, 'b still reads its own, unedited rules');
});
