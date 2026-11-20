// Block per card (owner, 2026-11-20; SPEC "Defense, Smash and stance bonuses"): an average Block card gives about 8-10 Block with
// typical buffs and a single card rarely reaches 20. Defend authors 8 Block and no Core enemy move authors more than 12.
// Profiles are pinned: the dev profile saved before the retune (71c50c95) keeps Defend 10 and its heavy enemy guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, validateGameProfileSnapshot } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';

const registriesFor = profile => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const current = resolveGameProfile('default');
const saved = validateGameProfileSnapshot(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-71c50c95.json.gz', import.meta.url)))));

/** The retune: enemy move -> [before, after] authored Block. */
export const ENEMY_BLOCK_RETUNE = Object.freeze({
  'pearlbackSnail.nacreWall': [20, 12], 'glassRegent.prismGuard': [16, 12], 'wyrmLord.goldenBulwark': [16, 12],
  'stitchedKing.courtlyDecree': [15, 11], 'pearlbackSnail.pearlGuard': [14, 10], 'saltChoirWalrus.frozenBulwark': [14, 10],
  'charredColossus.harden': [14, 10], 'furnaceSaint.coolingAsh': [14, 10], 'kilnshellTortoise.kilnPlate': [14, 10],
  'kilnbackTerrapin.siegePlate': [14, 10], 'ferrumVotary.ironLitany': [14, 10], 'wyrmAspirant.goldenGuard': [12, 10],
  'livingArmor.fortify': [12, 10], 'pallidOathCamel.oathWater': [12, 10], 'ashheartDragon.tailBastion': [12, 10],
});
const blockOf = (profile, id) => profile.content.cards.find(card => card.id === id).effects.find(effect => effect.op === 'block').amount;
const enemyIds = profile => new Set((profile.content.enemyCards || []).map(card => card.id));

test('Defend authors 8 Block and every retuned enemy guard carries its new number', () => {
  assert.equal(blockOf(current, 'core.defend'), 8);
  assert.equal(blockOf(current, 'core.counter'), 5, 'Counter is unchanged');
  assert.equal(blockOf(saved, 'core.counter'), 5);
  for (const [id, [, after]] of Object.entries(ENEMY_BLOCK_RETUNE)) assert.equal(blockOf(current, id), after, id);
});

test('no Core enemy move authors more than 12 Block', () => {
  const ids = enemyIds(current);
  for (const card of current.content.cards.filter(card => ids.has(card.id))) {
    for (const effect of card.effects || []) if (effect.op === 'block' && typeof effect.amount === 'number') {
      assert.ok(effect.amount <= 12, `${card.id} authors ${effect.amount} Block`);
    }
  }
});

function defendBlock(reg, classId, dexterity = 0) {
  const run = createRunState({ registries: reg, classId, seed: 433, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.attributes.dexterity = (run.attributes.dexterity || 0) + dexterity;
  const combat = createRunCombat({ registries: reg, run, rng: createRng(433), enemyIds: ['wanderingSoldier'] });
  delete combat.reactionRules.contactPolicy;
  Object.assign(combat.player, { stamina: 99, maxStamina: 99, mana: 99, maxMana: 99, block: 0 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  combat.piles.hand.push({ instanceId: 'probe-defend', cardId: 'core.defend' });
  const before = combat.player.block || 0;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'probe-defend' });
  return (combat.player.block || 0) - before;
}

test('a played Defend averages 8-10 Block over the classes with their starting kit, and stays under 20 with heavy Dexterity', () => {
  // Measured 2026-11-20 (kit / +2 DEX / +8 DEX): Reaver 10/11/16, Rogue 13/14/19, Starseer 8/10/14, Herald 8/10/14. Before: 11-16 kit.
  const reg = registriesFor(current);
  const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
  const rows = ['reaver', 'rogue', 'starseer', 'herald'].map(classId =>
    ({ classId, kit: defendBlock(reg, classId), typical: defendBlock(reg, classId, 2), heavy: defendBlock(reg, classId, 8) }));
  const kitMean = mean(rows.map(row => row.kit));
  assert.ok(kitMean >= 8 && kitMean <= 10, `Defend averages ${kitMean} with the starting kits`);
  assert.ok(mean(rows.map(row => row.typical)) <= 12, 'Defend with +2 Dexterity averages at most 12');
  for (const row of rows) {
    assert.ok(row.kit <= 13, `${row.classId} Defend with its kit gives ${row.kit}`);
    assert.ok(row.heavy < 20, `${row.classId} Defend with +8 Dexterity gives ${row.heavy}`);
  }
});

test('the dev profile saved before the retune keeps Defend 10 and its heavy enemy guards', () => {
  assert.equal(saved.hash, 'sha256:71c50c95263d9fc671863a691fb6ffb7e4f621531e73eb4d98b0c1866a426bdf');
  assert.notEqual(current.hash, saved.hash);
  assert.equal(blockOf(saved, 'core.defend'), 10);
  for (const [id, [before]] of Object.entries(ENEMY_BLOCK_RETUNE)) assert.equal(blockOf(saved, id), before, id);
  const reg = registriesFor(saved);
  const fresh = registriesFor(current);
  // The fight reads an enemy move's Block from the shared move unless the profile's card hint opts in (coreBlock "card").
  for (const [id, [before, after]] of Object.entries(ENEMY_BLOCK_RETUNE)) {
    const [enemyId] = id.split('.');
    const hints = current.content.enemies.find(row => row.id === enemyId).cardHints;
    const hint = hints[`card:${id}`] || hints[id];
    assert.equal(hint.coreBlock, 'card', `${id} opts into its card's Block`);
    assert.equal(fresh.enemies.get(enemyId).moves[hint.legacyMove].block, after, `new ${id} move Block`);
    assert.equal(reg.enemies.get(enemyId).moves[hint.legacyMove].block, before, `saved ${id} move Block`);
  }
  assert.ok(defendBlock(reg, 'reaver') > defendBlock(registriesFor(current), 'reaver'), 'a saved run still plays the old Defend');
});
