// Block per card (owner, 2026-11-20; SPEC "Defense, Smash and stance bonuses"): a single card rarely reaches 20 Block and no
// Core enemy move authors more than 12. #3039 restored Defend's pack Block; the saved 71c50c95 profile keeps its heavy guards.
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
import { CardScoreReferenceContext, ProjectCardMechanicalValues } from '../src/model/cardMechanicalProjection.js';
import { staticCardTokens } from '../src/model/playingCard.js';

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
const corePackCards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const packDefend = corePackCards.find(card => card.id === 'core.defend');
const PACK_DEFEND_BLOCK = packDefend.effects.find(effect => effect.op === 'block').amount;

test('Defend authors its pack Block and every retuned enemy guard carries its new number', () => {
  assert.equal(blockOf(current, 'core.defend'), PACK_DEFEND_BLOCK);
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

// The combat-power table prices the neutral static face (authored Block times the Block gain scale)
// rather than a fight's guard/stance receipt. Combat bonuses are checked separately below.
test('the current starter Defend prices its neutral static Block face', async () => {
  const { measureCards } = await import('../tools/combat-power-report.mjs');
  const { cardCombatPower } = await import('../src/content/generated/combatPower.js');
  const context = CardScoreReferenceContext({ class: 'reaver' });
  const definition = context.registries.cards.get('core.defend');
  const displayed = staticCardTokens(definition, context.registries, context.rules).block;
  const blockGainScale = context.rules.gameProfile?.modules?.effects?.blockGainMultiplier;
  assert.equal(displayed, Math.floor(PACK_DEFEND_BLOCK * blockGainScale), 'the neutral static Defend face');
  assert.equal(ProjectCardMechanicalValues(definition, context).card.effects.find(effect => effect.op === 'block').amount, displayed);
  assert.equal(measureCards()['core.defend'].blk, displayed, 'the report prices the displayed Block');
  assert.ok(cardCombatPower['core.defend'].cp > 0, `Defend cp ${cardCombatPower['core.defend'].cp} prices its Block`);
  const reg = registriesFor(current);
  for (const classId of ['reaver', 'rogue', 'starseer', 'herald']) {
    assert.ok(defendBlock(reg, classId, 8) < 20, `${classId} Defend with +8 Dexterity stays under 20`);
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
  assert.ok(defendBlock(reg, 'reaver') > 0, 'a saved run still plays its Defend 10');
});
