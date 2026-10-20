import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { setProfileStance, profileCardCosts } from '../src/engine/gameProfileCombat.js';
import { stanceOf, sameStance, stanceManaCost } from '../src/model/stanceRules.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';

// Owner ruling 2026-10-18 20:14: a scepter spell that mirrors a basic card plays in that basic's
// stance (Attack, Smash, ...) but stays a Spell and Cantrip, so spell-only rules still count it.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const card = id => reg.cards.get(id);
function live() {
  const run = createRunState({ registries: reg, classId: 'starseer', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  return createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
}

test('Arcane Spark mirrors Strike and keeps its Spell and Cantrip tags', () => {
  const spark = card('core.cantrip');
  assert.equal(spark.mirrors, 'attack');
  assert.equal(combatProfileFor(spark).mirrors, 'attack');
  for (const tag of ['camp:spell', 'source:spell', 'rank.cantrip']) assert(spark.tags.includes(tag), tag);
  assert.equal(card('core.starseerSpecial').mirrors, undefined, 'a class special mirrors nothing');
});

test('the mirrored cantrip reads as an Attack-stance Spell; other spells keep the casting stance', () => {
  assert.deepEqual(stanceOf(card('core.cantrip')), { maneuver: 'attack', camp: 'spell', mirrored: true, range: 'melee' });
  assert.equal(stanceOf(card('core.starseerSpecial')).maneuver, 'casting');
  assert.equal(stanceOf(card('core.strike')).maneuver, 'attack');
  assert.equal(stanceOf(card('core.strike')).camp, 'physical');
});

test('mirrored schemas: smash, sweep, defend and counter mirrors read the same way; junk does not', () => {
  for (const mirrors of ['smash', 'sweep', 'defend', 'counter'])
    assert.equal(stanceOf({ ...card('core.cantrip'), mirrors, combatProfile: undefined }).maneuver, mirrors, mirrors);
  assert.equal(stanceOf({ ...card('core.cantrip'), mirrors: 'casting', combatProfile: undefined }).maneuver, 'casting');
});

test('a played cantrip sets an Attack/Spell stance that a second cantrip matches', () => {
  const combat = live();
  const spark = card('core.cantrip');
  setProfileStance(combat, combat.player, { ...spark, combatProfile: combatProfileFor(spark) });
  assert.equal(combat.player.combatStance.maneuver, 'attack');
  assert.equal(combat.player.combatStance.camp, 'spell');
  assert.equal(combat.player.combatStance.mirrored, true);
  assert.equal(sameStance(combat.player, spark), true);
  assert.equal(sameStance(combat.player, card('core.strike')), false, 'physical Strike is another camp');
});

test('successive Spells still cut Mana after a mirrored cantrip, both ways', () => {
  const combat = live();
  const spark = card('core.cantrip'), costly = { ...card('core.starseerSpecial'), manaCost: 3 };
  const base = stanceManaCost(3, combat.player, costly, combat);
  assert.equal(base, 3, 'no spell played yet');
  setProfileStance(combat, combat.player, { ...spark, combatProfile: combatProfileFor(spark) });
  assert.equal(stanceManaCost(3, combat.player, costly, combat), 2, 'a Spell after the cantrip is discounted');
  assert.equal(profileCardCosts(combat, costly).mana, 2);
  setProfileStance(combat, combat.player, { ...costly, combatProfile: combatProfileFor(costly) });
  assert.equal(stanceManaCost(3, combat.player, { ...spark, manaCost: 3 }, combat), 2, 'the cantrip after a Spell too');
  setProfileStance(combat, combat.player, { ...card('core.strike'), combatProfile: combatProfileFor(card('core.strike')) });
  assert.equal(stanceManaCost(3, combat.player, costly, combat), 3, 'a physical Strike breaks the chain');
});

// ---- Card face: Spell mark + the basic's mark + the basic's word ----
import { cardSigilIdentity } from '../src/content/combatSigils.js';
import { cardSigilsHtml, sigilExplanationHtml } from '../src/ui/components/combatSigilView.js';
import { playingCardModel } from '../src/model/playingCard.js';

test('footer of a mirrored cantrip: two marks and the basic\'s word', () => {
  const model = playingCardModel(reg, { cardId: 'core.cantrip', instanceId: 'x', upgraded: false });
  assert.deepEqual(model.sigils, { action: 'spell', school: null, mirror: 'attack' });
  const html = cardSigilsHtml(model.sigils);
  assert.match(html, /data-primary-sigil="spell"/);
  assert.match(html, /data-mirror="attack"/);
  const marks = [...html.matchAll(/data-sigil="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(marks, ['spell', 'attack'], 'Spell mark first, then the Attack mark');
  assert.match(html, /card-type-name[^>]*>Attack</);
  assert.match(sigilExplanationHtml(model.sigils), /Spell[\s\S]*Attack/);
});

test('footer of a smash mirror reads Smash; a spell that mirrors nothing still reads Spell', () => {
  assert.deepEqual(cardSigilIdentity('Spell', { camp: 'spell', mirrors: 'smash' }), { action: 'spell', school: null, mirror: 'smash' });
  assert.match(cardSigilsHtml(cardSigilIdentity('Spell', { camp: 'spell', mirrors: 'smash' })), /card-type-name[^>]*>Smash</);
  const special = playingCardModel(reg, { cardId: 'core.starseerSpecial', instanceId: 'y', upgraded: false });
  assert.deepEqual(special.sigils, { action: 'spell', school: null });
  const html = cardSigilsHtml(special.sigils);
  assert.deepEqual([...html.matchAll(/data-sigil="(\w+)"/g)].map(m => m[1]), ['spell']);
  assert.match(html, /card-type-name[^>]*>Spell</);
  assert.doesNotMatch(html, /data-mirror/);
  assert.deepEqual(cardSigilIdentity('Attack', { camp: 'physical', mirrors: 'smash' }), { action: 'attack', school: null }, 'only a Spell mirrors');
});

// ---- Equipment-bound profiles: a sceptre's or staff's basic cards (Current profile) ----
import { resolveCard, profileMirrors } from '../src/model/registries.js';
import { mirrorSigil } from '../src/content/combatSigils.js';
const cur = createRegistries(contentBundle);
const projected = (cardId, profileId) => resolveCard(reg, { cardId, profileId });
const projectedCurrent = (cardId, profileId) => resolveCard(cur, { cardId, profileId });

test('every magic/arcane profile mirrors its base card, derived from the profile rows', () => {
  const rows = reg.equipment.basicCardProfiles;
  const magical = rows.filter(p => ['magic', 'arcane'].includes(p.damageSchool));
  assert(magical.length >= 5, 'sceptre and staff profiles present');
  const want = { strike: 'attack', defend: 'defend', technique: 'technique' };
  for (const p of magical) assert.equal(profileMirrors(p), want[p.baseCardId], p.id);
  for (const p of rows.filter(p => !['magic', 'arcane'].includes(p.damageSchool))) assert.equal(profileMirrors(p), null, p.id);
});

test('Arcane Strike, Ritual Ward and Staff Channel are Spells and Cantrips in their basic\'s stance', () => {
  for (const [card, id, maneuver] of [['strike', 'sceptreArcaneAttack', 'attack'], ['strike', 'staffMagicAttack', 'attack'], ['defend', 'sceptreGuard', 'defend'], ['defend', 'staffGuard', 'defend'], ['technique', 'staffTechnique', 'casting']]) {
    const d = projected(card, id);
    for (const tag of ['camp:spell', 'source:spell', 'rank.cantrip']) assert(d.cardTags.includes(tag), id + ' ' + tag);
    assert.equal(stanceOf(d).camp, 'spell', id);
    assert.equal(stanceOf(d).maneuver, maneuver, id);
  }
  const slash = projected('strike', 'bladeAttack');
  assert.equal(slash.mirrors, undefined);
  assert.equal(stanceOf(slash).camp, 'physical');
});

test('footers: Arcane Strike [spell][attack] ATTACK, Ritual Ward [spell][defend] DEFEND, Staff Channel [spell][skill] TECHNIQUE', () => {
  const foot = (card, id) => { const m = playingCardModel(reg, { cardId: card, profileId: id, instanceId: 'p-' + id, upgraded: false }); return cardSigilsHtml(m.sigils); };
  const marks = html => [...html.matchAll(/data-sigil="(\w+)"/g)].map(m => m[1]);
  const word = html => html.match(/card-type-name[^>]*>([^<]*)</)[1];
  let h = foot('strike', 'sceptreArcaneAttack'); assert.deepEqual(marks(h), ['spell', 'attack']); assert.equal(word(h), 'Attack');
  h = foot('defend', 'sceptreGuard'); assert.deepEqual(marks(h), ['spell', 'defend']); assert.equal(word(h), 'Defend');
  h = foot('technique', 'staffTechnique'); assert.deepEqual(marks(h), ['spell', 'skill']); assert.equal(word(h), 'Technique');
  h = foot('strike', 'bladeAttack'); assert.deepEqual(marks(h), ['attack']); assert.equal(word(h), 'Attack');
  assert.equal(mirrorSigil('technique').mark.label, 'Technique');
});

test('a sceptre Strike chains Spell Mana with a staff guard, and a Slashing Strike breaks it', () => {
  const combat = live();
  const arcane = projected('strike', 'sceptreArcaneAttack'), ward = projected('defend', 'staffGuard'), slash = projected('strike', 'bladeAttack');
  const costly = { ...ward, manaCost: 3 };
  setProfileStance(combat, combat.player, { ...arcane, combatProfile: combatProfileFor(arcane) });
  assert.equal(stanceManaCost(3, combat.player, costly, combat), 2, 'Arcane Strike then a spell guard');
  setProfileStance(combat, combat.player, { ...slash, combatProfile: combatProfileFor(slash) });
  assert.equal(stanceManaCost(3, combat.player, costly, combat), 3);
});

// ---- The real play path: dispatch the card, read the stance the engine recorded ----
import { dispatch } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

function play(combat, ref) {
  const instanceId = 'play-' + (ref.profileId || ref.cardId);
  combat.piles.hand.push({ ...ref, instanceId, upgraded: false });
  combat.player.energy = 10; combat.player.stamina = 10; combat.player.mana = 10;
  primeAccuracyRolls(combat);
  dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: combat.enemies[0].id });
}

test('dispatching Arcane Spark records the Attack stance, and a Spell after it gets the Mana cut (Core 2)', () => {
  const combat = live();
  Object.assign(combat.enemies[0], { hp: 500, maxHp: 500 });
  play(combat, { cardId: 'core.cantrip' });
  assert.equal(combat.player.combatStance.maneuver, 'attack');
  assert.equal(combat.player.combatStance.camp, 'spell');
  assert.equal(combat.player.combatStance.mirrored, true);
  const costly = { ...card('core.starseerSpecial'), manaCost: 3 };
  assert.equal(profileCardCosts(combat, costly).mana, 2, 'the real stance gives the successive-Spell cut');
  play(combat, { cardId: 'core.strike' });
  assert.equal(combat.player.combatStance.camp, 'physical');
  assert.equal(profileCardCosts(combat, costly).mana, 3);
});

function currentCombat() {
  const run = createRunState({ seed: 702, classId: 'herald', registries: cur, combatExpansionVersion: 2 });
  const combat = createRunCombat({ registries: cur, rng: createRng(702), run, enemyIds: ['wanderingSoldier'], settings: {} });
  Object.assign(combat.enemies[0], { hp: 500, maxHp: 500 });
  delete combat.player.combatStance;
  return combat;
}
const playSelf = (combat, ref) => { const id = 'self-' + ref.profileId; combat.piles.hand.push({ ...ref, instanceId: id, upgraded: false });
  combat.player.energy = 10; combat.player.stamina = 10; combat.player.mana = 10; dispatch(combat, { type: 'playCard', cardInstanceId: id }); };

test('dispatching a sceptre Ritual Ward and Arcane Strike records Defend and Attack Spell stances (Core 2)', () => {
  const combat = live();
  Object.assign(combat.enemies[0], { hp: 500, maxHp: 500 });
  playSelf(combat, { cardId: 'defend', profileId: 'sceptreGuard' });
  assert.equal(combat.player.combatStance.maneuver, 'defend');
  assert.equal(combat.player.combatStance.camp, 'spell');
  assert.equal(combat.player.combatStance.mirrored, true);
  play(combat, { cardId: 'strike', profileId: 'sceptreArcaneAttack' });
  assert.equal(combat.player.combatStance.maneuver, 'attack');
  assert.equal(combat.player.combatStance.mirrored, true);
});

test('Current/v2 is unchanged: a sceptre Arcane Strike and Ritual Ward still stance casting with the old footer', () => {
  const strike = projectedCurrent('strike', 'sceptreArcaneAttack'), ward = projectedCurrent('defend', 'sceptreGuard');
  for (const d of [strike, ward]) {
    assert.equal(d.mirrors, undefined);
    assert(!d.cardTags.includes('rank.cantrip'));
    assert.equal(stanceOf(d).maneuver, 'casting');
    assert.equal(stanceOf(d).mirrored, undefined);
  }
  const combat = currentCombat();
  play(combat, { cardId: 'strike', profileId: 'sceptreArcaneAttack' });
  assert.equal(combat.player.combatStance.maneuver, 'casting');
  assert.equal(combat.player.combatStance.camp, 'spell');
  assert.equal(combat.player.combatStance.mirrored, undefined);
  const footer = cardSigilsHtml(playingCardModel(cur, { cardId: 'strike', profileId: 'sceptreArcaneAttack', instanceId: 'c', upgraded: false }).sigils);
  assert.deepEqual([...footer.matchAll(/data-sigil="(\w+)"/g)].map(m => m[1]), ['spell']);
  assert.match(footer, /card-type-name[^>]*>Spell</);
});

test('the Mana chain also sees a concurrent mirrored Spell stance', () => {
  const combat = live();
  const spark = card('core.cantrip'), costly = { ...card('core.starseerSpecial'), manaCost: 3 };
  combat.player.combatStance = { maneuver: 'neutral', camp: 'physical', range: 'melee' };
  combat.player.concurrentStances = [{ maneuver: 'attack', camp: 'spell', mirrored: true, range: 'melee' }];
  assert.equal(stanceManaCost(3, combat.player, costly, combat), 2);
  assert.equal(stanceManaCost(3, combat.player, { ...spark, manaCost: 3 }, combat), 2);
});
