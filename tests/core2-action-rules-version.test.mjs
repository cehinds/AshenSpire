import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, validateGameProfileSnapshot, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { enemyMoveSp } from '../src/engine/combatRoundsAdapter.js';

// A run saved on dev before the 2026-10-25 combat retune (runtime 73ef24...) keeps its own profile, enemy content
// and action rules: every fight it starts is stamped v1, not the current v2.
const dev = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url))));
const current = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const open = profile => {
  const validated = validateGameProfileSnapshot(structuredClone(profile));
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, validated)), validated);
  const run = deserializeRun(serializeRun(createRunState({ registries, classId: 'reaver', seed: 511 })));
  return { registries, run };
};
const fightOf = ({ registries, run }, id) => createRunCombat({ registries, run, rng: createRng(511), enemyIds: [id] });
const damageMoves = (registries, id) => Object.entries(registries.enemies.get(id).moves)
  .filter(([, move]) => move.damage != null || (move.effects || []).some(effect => effect.op === 'damage'));

test('the current Core profile carries action rules version 2 and stamps it', () => {
  assert.equal(current.modules.effects.core2ActionRulesVersion, 2);
  assert.equal(fightOf(open(current), 'wanderingSoldier').core2ActionRulesVersion, 2);
});

test('a dev-era profile keeps v1 pricing and every enemy can afford a damage move', () => {
  assert.equal(dev.lock.runtimeHash, 'sha256:73ef240835ff52f3dec38ad7b0a972d6f4886adf88fbbf1e3bf12a42d53161f2');
  assert.equal(dev.modules.effects.core2ActionRulesVersion, undefined);
  const setup = open(dev), { registries } = setup;
  const stranded = [];
  for (const id of registries.enemies.ids()) {
    const combat = fightOf(setup, id), enemy = combat.enemies[0];
    assert.equal(combat.core2ActionRulesVersion, 1, `${id} is stamped v1`);
    const moves = damageMoves(registries, id);
    if (moves.length && !moves.some(([moveId, move]) => enemyMoveSp(move, { enemy, moveId, combat }) <= enemy.maxStamina)) stranded.push(id);
  }
  // Dev already shipped these single-hit gaps (fixed for current Core separately); the retune must add none.
  assert.deepEqual(stranded.sort(), ['charredColossus', 'huskBrute', 'livingArmor'], 'a dev-era run strands only what dev itself stranded');
  for (const id of ['lanternMoth', 'mirrorScribe', 'ashheartDragon']) assert.ok(!stranded.includes(id), id);
  // The reviewer's examples: the v2 floor would strand these, v1 pricing does not.
  const combat = fightOf(setup, 'ashheartDragon'), enemy = combat.enemies[0], breath = registries.enemies.get('ashheartDragon').moves.ashBreath;
  assert.ok(enemyMoveSp(breath, { enemy, moveId: 'ashBreath', combat }) <= enemy.maxStamina);
});
