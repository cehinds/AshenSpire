// Owner, 2026-11-18: a card face outside combat (deck editor, rewards, shop, upgrade picker) carries the run character's always-on attribute bonus,
// so it reads the number a neutral-stance hit makes: physical damage adds STR, Block adds DEX, magic damage adds max(INT, WIS), then the same
// multipliers as combat (base x0.5, physical x0.7, side x0.7, Block x0.49, min 1). No stance, status or enemy defence is in it (those show in combat).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { previewCard } from '../src/engine/combat.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';

const profile = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const newRun = classId => { const run = createRunState({ registries, classId, seed: 31, profileMeta: META }); run.relics = []; return run; };
const effects = profile.modules.effects;
const face = (run, cardId) => cardPlainText(registries, { cardId }, { rules: run });
const number = text => Number(/\d+/.exec(text)[0]);

test('a face with no run keeps the authored number', () => {
  assert.equal(number(cardPlainText(registries, { cardId: 'core.strike' }, {})), 6);
  assert.equal(number(cardPlainText(registries, { cardId: 'core.defend' }, {})), 10);
});

test('Strike and Defend add STR and DEX through the shipped multipliers', () => {
  for (const classId of ['reaver', 'rogue']) {
    const run = newRun(classId);
    const attributes = gameProfileEffectiveAttributes(registries, run);
    const strike = Math.floor((Math.ceil(6 * effects.baseDamageMultiplier) + attributes.strength * effects.strengthDamageWeight)
      * effects.physicalDamageMultiplier * effects.playerDamageMultiplier);
    const defend = Math.floor((10 + attributes.dexterity * effects.dexterityBlockWeight) * effects.blockGainMultiplier);
    assert.equal(number(face(run, 'core.strike')), strike, `${classId} Strike`);
    assert.equal(number(face(run, 'core.defend')), defend, `${classId} Defend`);
  }
});

test('a magic hit adds max(INT, WIS) and takes no physical cut', () => {
  const run = newRun('starseer');
  const attributes = gameProfileEffectiveAttributes(registries, run);
  const stat = Math.max(attributes.intelligence, attributes.wisdom);
  const cantrip = registries.cards.get('core.cantrip').effects.find(effect => effect.op === 'damage').amount;
  const expected = Math.floor((Math.ceil(cantrip * effects.baseDamageMultiplier) + stat * effects.magicStatWeight) * effects.playerDamageMultiplier);
  assert.equal(number(face(run, 'core.cantrip')), expected);
});

test('the face equals the combat receipt amount before any stance stage', () => {
  for (const classId of ['reaver', 'rogue']) {
    const run = newRun(classId);
    const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
    combat.piles.hand.push({ instanceId: 'probe', cardId: 'core.strike' });
    const hit = previewCard(combat, 'probe', combat.enemies[0].id).values[0].damageReceipt.hits[0];
    const attributed = hit.sources.find(source => source.id === 'ar:0' || source.id === 'ar');
    assert.ok(attributed, 'the receipt names the STR stage');
    const withoutStance = Math.floor(attributed.effective * effects.physicalDamageMultiplier * effects.playerDamageMultiplier);
    assert.equal(number(face(run, 'core.strike')), withoutStance, `${classId}: the static face is the receipt's STR stage through the cuts, without the stance stages`);
  }
});

// Codex review on PR #2835: the in-combat pile viewer passes the combat as `rules`; its faces keep the player's always-on attributes.
test('a face rendered with the combat as rules matches the same card outside combat', () => {
  for (const classId of ['reaver', 'rogue']) {
    const run = newRun(classId);
    const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
    assert.equal(number(face(combat, 'core.strike')), number(face(run, 'core.strike')), `${classId} Strike in the pile viewer`);
    assert.equal(number(face(combat, 'core.defend')), number(face(run, 'core.defend')), `${classId} Defend in the pile viewer`);
  }
});
