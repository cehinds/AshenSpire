// Owner, 2026-11-18: face numbers are BLACK by default, including everything the character carries outside the fight (attributes, gear, level,
// the global multipliers). A number is GREEN only when something in the fight raises it (a boost, the current stance's bonus, a relic or card
// trigger active now) and RED only when something in the fight lowers it (Weak, Frail, ...). The baseline is the same card's face outside combat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { rederivePools } from '../src/model/levelup.js';
import { staticCardTokens, playingCardModel } from '../src/model/playingCard.js';
import { evadeStackGainPhrase } from '../src/model/fixCoreMechanics.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { ChangeAttribute } from '../src/engine/liveStats.js';
import { applyStatus } from '../src/engine/statuses.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const profile = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } };

function fight(classId, { ownProfile = profile, attributes = {} } = {}) {
  const reg = ownProfile === profile ? registries : Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, ownProfile)), ownProfile);
  const run = createRunState({ registries: reg, classId, seed: 31, profileMeta: META });
  run.relics = [];
  Object.assign(run.attributes, attributes);
  rederivePools(reg, run, 'face colour fixture');
  const combat = createRunCombat({ registries: reg, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  primeAccuracyRolls(combat, { count: 2 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const enemy = combat.enemies[0];
  enemy.weaknesses = [];
  enemy.hp = enemy.maxHp = 5000;
  return { run, combat, enemy, registries: reg };
}
function damageTints(html, preview) {
  const damage = [], poise = [];
  for (const [, tint, value, label] of html.matchAll(/<span class="val(?: (up|down))?">(\d+)<\/span>( Poise\b)?/g)) {
    const color = tint || 'black';
    if (label) poise.push({ color, value: Number(value) });
    else damage.push(color);
  }
  const weaponPoise = preview.values.find(row => row.op === 'damage' && row.weaponPoise > 0);
  if (weaponPoise) {
    assert.deepEqual(poise, [{ color: 'black', value: weaponPoise.weaponPoiseBase }], 'the unchanged weapon Poise stays black and keeps its own value');
  }
  return damage;
}
function damageFace({ combat, enemy, registries: reg }, cardId, instance = {}) {
  combat.piles.hand.push({ instanceId: `c-${cardId}-${combat.piles.hand.length}`, cardId, ...instance });
  const inst = combat.piles.hand.at(-1);
  const preview = previewCard(combat, inst.instanceId, enemy.id);
  const def = reg.cards.get(cardId);
  const line = cardFaceLines(def, preview, reg, null).find(row => row.kind === 'damage');
  return { classes: damageTints(line.html, preview), value: preview.values.find(row => row.op === 'damage').faceValue,
    baseline: staticCardTokens(def, reg, preview.faceRules).damage, preview };
}
const damageClasses = (world, cardId) => damageFace(world, cardId).classes;
function isolateAttributeColours(world) {
  // These casts enter a beneficial stance, and Decay has its own damage multiplier.
  // Keep Gear enabled while isolating channel ownership from these combat-only effects.
  delete world.combat.fixCoreRules.stanceBenefits;
  delete world.combat.fixCoreRules.elements;
  world.combat.stanceRules = { ...world.combat.stanceRules, offensiveRating: 0 };
}
const unitDamageProfile = (modules = {}) => Profile.resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
  ...modules,
  effects: { spellTraditionsVersion: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1 },
} });

test('a face outside combat is always black', () => {
  const { run } = fight('starseer');
  const text = cardFaceLines(registries.cards.get('core.venomSpray'), undefined, registries, run).map(row => row.html).join('');
  assert.ok(!/class="val (up|down)"/.test(text));
  assert.ok(/class="val"/.test(text));
});

test('attributes and gear alone leave a combat number black', () => {
  const world = fight('starseer');
  // The static face (run rules) and the live preview agree on core.venomSpray, so the figure carries no mark.
  const live = damageClasses(world, 'core.venomSpray');
  assert.deepEqual(live, ['black'], 'the always-on Divine WIS bonus is part of the baseline');
  assert.equal(damageClasses(world, 'core.venomSpray').length, 1);
});

test('a fight boost turns the number green', () => {
  const world = fight('starseer');
  ChangeAttribute(world.combat, world.combat.player, 'wisdom', 4);
  assert.deepEqual(damageClasses(world, 'core.venomSpray'), ['up']);
});

// Since 2026-11-28 a class starts with 1 point, in its main stat. The debuff scenarios below give the
// stat they lower one more base point, so the cut lands above the floor of 0 and moves the face.
const DEBUFF_HEADROOM = 1;
test('a fight debuff on the player turns the number red', () => {
  const world = fight('starseer', { attributes: { wisdom: DEBUFF_HEADROOM } });
  ChangeAttribute(world.combat, world.combat.player, 'wisdom', -2);
  assert.deepEqual(damageClasses(world, 'core.venomSpray'), ['down']);
});

test('the current stance bonus turns a physical attack green', () => {
  const world = fight('reaver');
  assert.deepEqual(damageClasses(world, 'core.strike'), ['up'], 'Attack stance and its matching bonus are in-combat effects');
});

test('Weak turns a physical attack without a stance bonus red', () => {
  const strength = { strength: 1 + DEBUFF_HEADROOM };
  const calm = fight('reaver', { attributes: strength });
  const weak = fight('reaver', { attributes: strength });
  isolateAttributeColours(calm);
  isolateAttributeColours(weak);
  applyStatus(weak.combat, weak.combat.player, 'weak', 2, weak.combat.player);
  assert.deepEqual(damageClasses(calm, 'core.sweep'), ['black'], 'Sweep carries no stance bonus: attributes alone leave it black');
  assert.deepEqual(damageClasses(weak, 'core.sweep'), ['down'], 'Weak cuts the STR bonus below the face outside combat');
});

test('the plain-text face never carries a mark', () => {
  const { run } = fight('reaver');
  assert.ok(!/val (up|down)/.test(cardPlainText(registries, { cardId: 'core.strike' }, { rules: run })));
});

test('a triggered relic effect that raises a hit turns the number green', () => {
  const world = fight('reaver');
  isolateAttributeColours(world);
  // A relic or card trigger that fires in the fight changes a number the same way any in-combat boost does: here the Reaver's STR rises for the turn.
  assert.deepEqual(damageClasses(world, 'core.sweep'), ['black']);
  ChangeAttribute(world.combat, world.combat.player, 'strength', 3, { thisTurn: true });
  assert.deepEqual(damageClasses(world, 'core.sweep'), ['up']);
});

for (const [label, cardId, attributes, matching, other] of [
  ['Arcane', 'cometFragment', { intelligence: 2, wisdom: 8 }, 'intelligence', 'wisdom'],
  ['Divine', 'blightTouch', { intelligence: 8, wisdom: 2 }, 'wisdom', 'intelligence'],
  ['shared INT', 'core.cinderDart', { intelligence: 8, wisdom: 2 }, 'intelligence', 'wisdom'],
  ['shared WIS', 'core.cinderDart', { intelligence: 2, wisdom: 8 }, 'wisdom', 'intelligence'],
]) test(`${label} faces use their own always-on baseline and colour only relevant fight changes`, () => {
  const ownProfile = unitDamageProfile();
  const world = fight('starseer', { ownProfile, attributes });
  // Unit side/physical scales isolate split rounding; original tests retain full stance/colour coverage.
  isolateAttributeColours(world);
  assert.equal(world.combat.gameProfile.modules.gear.typeEffectsVersion, 1);
  assert.equal(world.combat.gameProfile.modules.effects.spellTraditionsVersion, 1);
  const first = damageFace(world, cardId);
  assert.deepEqual(first.classes, ['black']);
  assert.equal(first.value, first.baseline, 'the live forecast equals the face outside combat');
  assert.equal(staticCardTokens(world.registries.cards.get(cardId), world.registries, world.run).damage, first.value, 'the run face agrees');
  for (const delta of [1, -1]) {
    ChangeAttribute(world.combat, world.combat.player, other, delta);
    const unchanged = damageFace(world, cardId);
    assert.equal(unchanged.value, first.value, `${other} ${delta} does not affect this hit`);
    assert.deepEqual(unchanged.classes, ['black']);
  }
  ChangeAttribute(world.combat, world.combat.player, matching, 4);
  const boosted = damageFace(world, cardId);
  assert.ok(boosted.value > first.value);
  assert.deepEqual(boosted.classes, ['up']);
  ChangeAttribute(world.combat, world.combat.player, matching, -6);
  const reduced = damageFace(world, cardId);
  assert.ok(reduced.value < first.value);
  assert.deepEqual(reduced.classes, ['down']);
});

test('live spell power reaches the damage quote and landed hit exactly once', () => {
  const cases = [
    { cardId: 'core.cinderDart', attributes: { intelligence: 2, wisdom: 8 }, stat: 'intelligence', boost: 1, delta: 0 },
    { cardId: 'core.cinderDart', attributes: { intelligence: 2, wisdom: 8 }, stat: 'intelligence', boost: 9, delta: 3 },
    { cardId: 'core.cinderDart', attributes: { intelligence: 2, wisdom: 8 }, stat: 'wisdom', boost: 1, delta: 1 },
    { cardId: 'core.cinderDart', attributes: { intelligence: 8, wisdom: 2 }, stat: 'intelligence', boost: 1, delta: 1 },
    { cardId: 'cometFragment', attributes: { intelligence: 2, wisdom: 8 }, stat: 'intelligence', boost: 1, delta: 1 },
    { cardId: 'cometFragment', attributes: { intelligence: 2, wisdom: 8 }, stat: 'intelligence', boost: 1, status: true, delta: 3 },
    { cardId: 'cometFragment', attributes: { intelligence: 2, wisdom: 8 }, stat: 'intelligence', boost: 1, status: true, delta: 3, poisePolicy: 'disabled' },
    { cardId: 'cometFragment', attributes: { intelligence: 2, wisdom: 8 }, stat: 'intelligence', boost: 1, status: true, delta: 1, poisePolicy: 'historical' },
  ];
  const ownProfile = unitDamageProfile({ stances: { advantageMultiplier: 1, defenseMitigation: 0 } });
  for (const { cardId, attributes, stat, boost, status, delta, poisePolicy } of cases) {
    const world = fight('starseer', { ownProfile, attributes });
    const { combat, enemy } = world;
    isolateAttributeColours(world);
    if (poisePolicy === 'disabled') combat.fixCoreRules.poise.weaponPoiseEnabled = false;
    if (poisePolicy === 'historical') delete combat.fixCoreRules.poise.weaponPoiseEnabled;
    enemy.block = 0;
    enemy.persistentPoise.value = 0;
    combat.player.mana = combat.player.stamina = combat.player.energy = 100;
    combat.piles.hand = [{ instanceId: 'live-spell', cardId, upgraded: false }];
    const quote = () => previewCard(combat, 'live-spell', enemy.id, undefined, { rangeRoute: 'advance' })
      .values.find(row => row.op === 'damage').perTargetHitDamages[enemy.id][0];
    const baseline = quote();
    ChangeAttribute(combat, combat.player, stat, boost);
    if (status) applyStatus(combat, combat.player, 'intelligence', 1, combat.player);
    const expected = baseline + delta;
    const label = `${cardId} ${JSON.stringify(attributes)} +${boost} ${stat}${status ? ' and 1 Intelligence status' : ''} (${poisePolicy ?? 'current'})`;
    assert.equal(quote(), expected, label);
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'live-spell', targetId: enemy.id, rangeRoute: 'advance' });
    const hit = combat.eventLog.slice(start).find(event => event.type === 'damageDealt' && event.targetId === enemy.id);
    assert.equal(hit?.hpLoss, expected, label);
    const namedBuff = hit.damageReceipt.hits[0].sources.find(row => row.id === 'status:intelligence');
    assert.equal(namedBuff?.amount, status && poisePolicy !== 'historical' ? 2 : undefined, label);
  }
});

test('a genuine incoming Dev profile keeps its max(INT, WIS) face and live colours', () => {
  const ownProfile = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-6727a255.json.gz', import.meta.url))));
  const hash = ownProfile.hash;
  const world = fight('starseer', { ownProfile, attributes: { intelligence: 8, wisdom: 2 } });
  assert.equal(world.combat.fixCoreRules.spellTraditionsVersion, undefined);
  const before = damageFace(world, 'blightTouch');
  assert.equal(before.value, before.baseline);
  assert.deepEqual(before.classes, ['black']);
  ChangeAttribute(world.combat, world.combat.player, 'wisdom', 2);
  assert.deepEqual(damageClasses(world, 'blightTouch'), ['black'], 'the lower attribute remains below the legacy max');
  ChangeAttribute(world.combat, world.combat.player, 'intelligence', 4);
  assert.deepEqual(damageClasses(world, 'blightTouch'), ['up'], 'legacy Decay still gains INT');
  assert.equal(ownProfile.hash, hash);
  assert.equal(ownProfile.modules.effects.spellTraditionsVersion, undefined);
});

for (const version of [undefined, 0]) test(`saved combat tradition policy ${version} wins over a current profile face`, () => {
  const world = fight('starseer', { ownProfile: unitDamageProfile(), attributes: { intelligence: 8, wisdom: 2 } });
  isolateAttributeColours(world);
  if (version === undefined) delete world.combat.fixCoreRules.spellTraditionsVersion;
  else world.combat.fixCoreRules.spellTraditionsVersion = version;
  assert.equal(world.combat.gameProfile.modules.effects.spellTraditionsVersion, 1);
  assert.equal(world.combat.gameProfile.modules.gear.typeEffectsVersion, 1);
  const face = damageFace(world, 'blightTouch');
  assert.equal(face.preview.faceRules.fixCoreRules.spellTraditionsVersion, version);
  assert.equal(face.value, face.baseline);
  assert.deepEqual(face.classes, ['black']);
  const def = world.registries.cards.get('blightTouch');
  assert.equal(staticCardTokens(def, world.registries, world.combat).damage, face.value, 'pile/combat face honors the saved policy');
  assert.equal(staticCardTokens(def, world.registries, { ...world.run, fixCoreRules: world.combat.fixCoreRules }).damage, face.value, 'saved run policy wins too');
  assert.equal(staticCardTokens(def, world.registries, { ...face.preview.faceRules, gameProfile: undefined }).damage, face.value, 'registry profile fallback retains the saved policy and Gear context');
});

test('current Sceptre damage enters the spell baseline once, while a triggered Gear bonus stays green and quote equals play', () => {
  const world = fight('starseer', { ownProfile: unitDamageProfile(), attributes: { intelligence: 8, wisdom: 2 } });
  isolateAttributeColours(world);
  assert.equal(world.combat.gameProfile.modules.gear.typeEffectsVersion, 1);
  assert.equal(world.combat.gameProfile.modules.effects.spellTraditionsVersion, 1);
  const calm = damageFace(world, 'core.cinderDart');
  const base = calm.preview.faceRules.faceDefinition;
  assert.equal(base.effects[0].amount, 3, 'the selected card before combat Gear projection');
  assert.equal(calm.preview.resolvedDefinition.effects[0].amount, 4, 'Sceptre adds exactly one base damage');
  assert.equal(calm.baseline, calm.value);
  assert.deepEqual(calm.classes, ['black']);
  assert.deepEqual(damageTints(cardFaceLines(calm.preview.resolvedDefinition, calm.preview, world.registries).find(row => row.kind === 'damage').html, calm.preview), ['black'], 'the renderer also accepts its already projected live definition');
  const rulesBefore = structuredClone(world.combat.player.itemProps.cardRules);
  world.combat.player.itemProps.cardRules.push({ selector: 'spell', arg: null, conds: [{ name: 'first', arg: 'fight' }], stat: 'damage', amount: 8, mode: 'add', source: 'handCrossbow' });
  const lit = damageFace(world, 'core.cinderDart');
  assert.equal(lit.baseline, calm.baseline, 'triggered Gear never enters the baseline');
  assert.ok(lit.value > calm.value);
  assert.deepEqual(lit.classes, ['up']);
  assert.deepEqual(world.combat.player.itemProps.cardRules.slice(0, -1), rulesBefore, 'preview did not rewrite Gear rules');
  lit.preview.faceRules.faceDefinition.effects[0].amount = 999;
  const card = world.combat.piles.hand.at(-1);
  const quote = previewCard(world.combat, card.instanceId, world.enemy.id);
  assert.equal(quote.faceRules.faceDefinition.effects[0].amount, 3, 'baseline metadata is detached');
  const expected = quote.values.find(row => row.op === 'damage').perTargetHitDamages[world.enemy.id].reduce((sum, amount) => sum + amount, 0);
  const before = world.enemy.hp;
  world.combat.player.energy = world.combat.player.stamina = world.combat.player.mana = 100;
  dispatch(world.combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: world.enemy.id });
  assert.equal(before - world.enemy.hp, expected, 'the active Gear/tradition forecast equals committed damage');
});

test('the pre-Gear baseline preserves an upgraded copy, card rank and the selected effect variant', () => {
  const ownProfile = unitDamageProfile({ progression: { cardRanks: true } });
  for (const [instance, amount] of [[{ upgraded: true }, 4], [{ rank: 3 }, 5]]) {
    const world = fight('starseer', { ownProfile });
    isolateAttributeColours(world);
    const face = damageFace(world, 'core.cinderDart', instance);
    const card = world.combat.piles.hand.at(-1);
    const projected = Profile.projectGameCard(world.combat, card);
    assert.equal(projected.effects[0].amount, amount, 'the upgraded/ranked card differs from the raw registry');
    assert.deepEqual(face.preview.faceRules.faceDefinition.effects, projected.effects);
    assert.equal(face.preview.resolvedDefinition.effects[0].amount, amount + 1, 'Sceptre applies after upgrade/rank');
    assert.equal(face.value, face.baseline);
    assert.deepEqual(face.classes, ['black']);
    assert.deepEqual(resolveCombatCard(world.combat, card, { applyGear: false }).effects, projected.effects);
  }
  const world = fight('reaver', { ownProfile });
  world.combat.player.combatStance = { maneuver: 'smash', camp: 'physical', range: 'melee' };
  const face = damageFace(world, 'base.current-stance-variant');
  const live = face.preview.resolvedDefinition, base = face.preview.faceRules.faceDefinition;
  assert.equal(live.activeEffectVariant, 0);
  assert.equal(base.activeEffectVariant, live.activeEffectVariant, 'the same variant is selected before Gear');
  assert.deepEqual(base.effects, base.effectVariants[0].effects);
  assert.equal(base.effects[0].op, 'damage', 'the selected Smash branch replaces the base branch');
  assert.equal(base.effects[0].amount, 12);
});

test('faceDefinition retains fallback cards and instance proposal changes through the same resolver', () => {
  const world = fight('starseer', { ownProfile: unitDamageProfile() });
  isolateAttributeColours(world);
  assert.equal(Profile.projectGameCard(world.combat, { cardId: 'blightTouch' }), null, 'this real spell takes the registry fallback path');
  const fallback = damageFace(world, 'blightTouch');
  assert.equal(fallback.preview.faceRules.faceDefinition.id, 'blightTouch');
  assert.equal(fallback.preview.resolvedDefinition.effects[0].amount, fallback.preview.faceRules.faceDefinition.effects[0].amount + 1, 'Sceptre still projects the fallback card once');
  assert.deepEqual(fallback.classes, ['black']);
  const proposed = damageFace(world, 'core.cinderDart', { proposalChanges: { range: 'ranged', maneuver: 'ranged', retain: true } });
  const face = proposed.preview.faceRules.faceDefinition;
  assert.equal(face.range, 'ranged');
  assert.equal(face.combatProfile.range, 'ranged');
  assert.equal(face.combatProfile.maneuver, 'ranged');
  assert.ok(face.keywords.includes('retain'));
});

test('faceDefinition never replaces a different card or an anonymous synthetic definition', () => {
  const world = fight('starseer');
  const face = damageFace(world, 'core.cinderDart').preview.faceRules;
  const withoutDefinition = { ...face, faceDefinition: undefined };
  for (const def of [{ id: 'unrelated', effects: [{ op: 'block', target: 'self', amount: 3 }] }, { effects: [{ op: 'block', target: 'self', amount: 3 }] }]) {
    assert.deepEqual(staticCardTokens(def, world.registries, face), staticCardTokens(def, world.registries, withoutDefinition));
  }
  assert.deepEqual(staticCardTokens({ effects: [] }), {}, 'no face rules and no ID are valid');
});

test('the hand saved-rule context preserves the preview numeric baseline and live colour changes', () => {
  const world = fight('starseer', { ownProfile: unitDamageProfile(), attributes: { intelligence: 8, wisdom: 2 } });
  isolateAttributeColours(world);
  assert.equal(world.combat.gameProfile.modules.gear.typeEffectsVersion, 1);
  assert.equal(world.combat.gameProfile.modules.effects.spellTraditionsVersion, 1);
  const first = damageFace(world, 'core.cinderDart');
  const instance = world.combat.piles.hand.at(-1);
  const rendered = playingCardModel(world.registries, instance, { preview: first.preview, rules: world.combat });
  assert.equal(rendered.baseTokens.damage, first.baseline, 'the full combat context cannot reapply Sceptre to an already projected definition');
  assert.equal(playingCardModel(world.registries, instance, { rules: world.combat }).baseTokens.damage, first.baseline, 'the outside face without a preview keeps its existing numeric path');
  const lines = cardFaceLines(first.preview.resolvedDefinition, first.preview, world.registries, world.combat);
  assert.deepEqual(damageTints(lines.find(row => row.kind === 'damage').html, first.preview), ['black']);
  ChangeAttribute(world.combat, world.combat.player, 'intelligence', 4);
  const boosted = previewCard(world.combat, instance.instanceId, world.enemy.id);
  const liveModel = playingCardModel(world.registries, instance, { preview: boosted, rules: world.combat });
  assert.equal(liveModel.baseTokens.damage, first.baseline, 'saved context and live boosts do not alter the baseline');
  assert.ok(boosted.values.find(row => row.op === 'damage').faceValue > first.value);
  const liveLines = cardFaceLines(boosted.resolvedDefinition, boosted, world.registries, world.combat);
  assert.deepEqual(damageTints(liveLines.find(row => row.kind === 'damage').html, boosted), ['up']);
});

for (const policy of ['current', 'saved attribute rule', 'saved disabled tradition']) test(`an Evade metric face renders its full detached ${policy} snapshot`, () => {
  const world = fight('rogue');
  const rules = world.combat.fixCoreRules;
  if (policy === 'saved attribute rule') {
    delete rules.spellTraditionsVersion;
    delete rules.accuracy.hitRoll;
    delete rules.accuracy.evadeStacksPerCard;
    Object.assign(rules.accuracy, { evadeStackBase: 5, evadeStackDex: 2 });
  } else if (policy === 'saved disabled tradition') {
    rules.spellTraditionsVersion = 0;
    rules.accuracy.evadeStacksPerCard = 4;
  }
  const before = structuredClone(rules);
  const def = world.registries.cards.get('core.evade');
  assert.equal(def.effects[0].stacks.metric, 'evadeStackGain', 'exercise the real configured metric consumer');
  world.combat.piles.hand.push({ instanceId: 'evade-face', cardId: def.id });
  const preview = previewCard(world.combat, 'evade-face');
  const snapshot = preview.faceRules.fixCoreRules;
  assert.deepEqual(snapshot, before, 'all saved rules and flag presence survive');
  assert.notEqual(snapshot, rules);
  assert.notEqual(snapshot.accuracy, rules.accuracy);
  assert.notEqual(snapshot.accuracy.precisionWeights, rules.accuracy.precisionWeights);
  assert.equal(Object.hasOwn(snapshot, 'spellTraditionsVersion'), Object.hasOwn(before, 'spellTraditionsVersion'));
  const accuracyGain = policy === 'saved attribute rule' ? 5 + 2 * world.combat.player.attributes.dexterity
    : policy === 'saved disabled tradition' ? 4 : 1;
  assert.equal(world.combat.gameProfile.modules.gear.typeEffectsVersion, 1);
  assert.equal(world.combat.player.itemProps.gainBonus?.evade, undefined, 'ordinary Light armour has no gain bonus');
  assert.equal(preview.values[0].value, accuracyGain, 'the saved accuracy formula sets the grant');
  assert.equal(evadeStackGainPhrase(preview.faceRules, def),
    policy === 'saved attribute rule' ? '5 plus 2× DEX' : String(accuracyGain), 'the metric reader accepts the full saved rule envelope');
  const lines = cardFaceLines(def, preview, world.registries, null);
  assert.ok(lines?.length > 0, 'the in-hand card renders');
  assert.match(lines.map(row => row.html).join(''), new RegExp(`>${accuracyGain}</span> Evade`));
  snapshot.accuracy.evadeStackBase = 999;
  snapshot.accuracy.precisionWeights.dex = 999;
  assert.deepEqual(rules, before, 'mutating nested face metadata cannot alter the saved combat');
});

test('an Evade face with no saved rule object keeps the historical default path', () => {
  const ownProfile = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-6727a255.json.gz', import.meta.url))));
  const world = fight('rogue', { ownProfile });
  delete world.combat.fixCoreRules;
  world.combat.piles.hand.push({ instanceId: 'old-evade-face', cardId: 'core.evade' });
  const preview = previewCard(world.combat, 'old-evade-face');
  assert.equal(preview.faceRules.fixCoreRules, undefined, 'no partial envelope or invented defaults are attached');
  const def = world.registries.cards.get('core.evade');
  assert.equal(staticCardTokens(def, world.registries, preview.faceRules).evade, '1');
  const lines = cardFaceLines(def, preview, world.registries, null);
  assert.match(lines.map(row => row.html).join(''), />1<\/span> Evade/);
  assert.equal(world.combat.fixCoreRules, undefined, 'rendering does not install a rule snapshot');
  assert.equal(ownProfile.modules.effects.spellTraditionsVersion, undefined, 'the genuine profile keeps its historical policy');
});

test('an explicit gear Evade bonus applies in the hand, target quote and live play', () => {
  const world = fight('rogue');
  assert.equal(world.combat.gameProfile.modules.gear.typeEffectsVersion, 1);
  assert.equal(world.combat.player.itemProps.gainBonus?.evade, undefined);
  world.combat.player.itemProps.gainBonus = { ...world.combat.player.itemProps.gainBonus, evade: 1 };
  world.combat.piles.hand = [{ instanceId: 'light-evade', cardId: 'core.evade' }];
  const before = world.combat.player.statuses.evade?.stacks || 0;
  const preview = previewCard(world.combat, 'light-evade');
  assert.equal(preview.values[0].value, 2, 'one configured stack plus one stack from the fixture gear bonus');
  const lines = cardFaceLines(world.registries.cards.get('core.evade'), preview, world.registries, null);
  assert.match(lines.map(row => row.html).join(''), />2<\/span> Evade/);
  world.combat.player.stamina = world.combat.player.energy = 100;
  dispatch(world.combat, { type: 'playCard', cardInstanceId: 'light-evade' });
  assert.equal(world.combat.player.statuses.evade.stacks - before, 2);
});

for (const upgraded of [false, true]) test(`always-on Gear is counted once on the original${upgraded ? ' upgraded' : ''} face, hand and live cast`, () => {
  const ownProfile = Profile.resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
    effects: { spellTraditionsVersion: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1 },
  } });
  const world = fight('starseer', { ownProfile, attributes: { intelligence: 8, wisdom: 2 } });
  delete world.combat.fixCoreRules.elements;
  delete world.combat.fixCoreRules.stanceBenefits;
  world.combat.stanceRules = { ...world.combat.stanceRules, offensiveRating: 0 };
  world.enemy.actorIntentRevealed = true;
  const authored = structuredClone(world.registries.cards.get('core.cinderDart'));
  const result = damageFace(world, 'core.cinderDart', { upgraded });
  const instance = world.combat.piles.hand.at(-1);
  const original = Profile.projectGameCard(world.combat, instance);
  assert.deepEqual(result.preview.faceRules.faceDefinition, original, 'the baseline owns the same upgrade as the card outside combat');
  assert.equal(result.preview.resolvedDefinition.effects[0].amount, original.effects[0].amount + 1, 'the real Sceptre supplies exactly one flat bonus');
  assert.equal(result.preview.faceRules.gearRules.filter(rule => rule.stat === 'damage').length, 1);
  assert.deepEqual(result.classes, ['black']);
  assert.equal(result.value, result.baseline);
  assert.equal(staticCardTokens(original, world.registries, world.run).damage, result.baseline, 'the outside face agrees');
  assert.equal(playingCardModel(world.registries, instance, { preview: result.preview }).baseTokens.damage, result.baseline, 'the full rendered-card model shares that baseline');
  world.combat.player.mana = world.combat.player.stamina = world.combat.player.energy = 100;
  const hp = world.enemy.hp;
  dispatch(world.combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: world.enemy.id });
  assert.equal(hp - world.enemy.hp, result.preview.values.find(value => value.op === 'damage').perTarget[world.enemy.id], 'the target quote equals the actual cast');
  result.preview.faceRules.faceDefinition.effects[0].amount = 999;
  assert.deepEqual(world.registries.cards.get('core.cinderDart'), authored, 'mutable presentation metadata cannot change authored card data');
  assert.deepEqual(Profile.projectGameCard(world.combat, instance), original);
});

test('triggered Gear stays outside the always-on face baseline', () => {
  const ownProfile = Profile.resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
    effects: { spellTraditionsVersion: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1 },
  } });
  const world = fight('starseer', { ownProfile, attributes: { intelligence: 8, wisdom: 2 } });
  delete world.combat.fixCoreRules.elements;
  delete world.combat.fixCoreRules.stanceBenefits;
  world.combat.stanceRules = { ...world.combat.stanceRules, offensiveRating: 0 };
  const before = damageFace(world, 'core.cinderDart');
  world.combat.player.itemProps.cardRules.push({ selector: 'spell', arg: null, conds: [{ name: 'first', arg: 'fight' }], stat: 'damage', amount: 4, mode: 'add', source: 'test:first-cast' });
  const triggered = damageFace(world, 'core.cinderDart');
  assert.equal(triggered.preview.resolvedDefinition.effects[0].amount, before.preview.resolvedDefinition.effects[0].amount + 4);
  assert.equal(triggered.baseline, before.baseline, 'only always-on Gear belongs to the baseline');
  assert.ok(triggered.value > before.value);
  assert.deepEqual(triggered.classes, ['up']);
  assert.equal(playingCardModel(world.registries, world.combat.piles.hand.at(-1), { preview: triggered.preview }).baseTokens.damage, before.baseline);
});

for (const upgraded of [false, true]) test(`selected Stance Echo keeps its original${upgraded ? ' upgraded' : ''} branch baseline and live Multi-hit`, () => {
  const ownProfile = Profile.resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
    effects: { spellTraditionsVersion: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1 },
  } });
  const world = fight('starseer', { ownProfile });
  delete world.combat.fixCoreRules.elements;
  delete world.combat.fixCoreRules.stanceBenefits;
  world.combat.fixCoreRules.stance.effectivenessMultiplier = 1;
  world.combat.stanceRules = { ...world.combat.stanceRules, offensiveRating: 0 };
  world.combat.player.combatStance = { maneuver: 'smash', camp: 'physical', range: 'melee' };
  world.combat.player.statuses.multiHit = { stacks: 2 };
  world.enemy.actorIntentRevealed = true;
  const result = damageFace(world, 'base.current-stance-variant', { upgraded });
  const instance = world.combat.piles.hand.at(-1), original = Profile.projectGameCard(world.combat, instance);
  const branch = result.preview.resolvedDefinition.activeEffectVariant;
  assert.equal(branch, 0, 'the real Smash branch is selected');
  assert.deepEqual(result.preview.faceRules.faceDefinition.effects, original.effectVariants[branch].effects, 'the baseline keeps the selected authored branch before Gear/status changes');
  assert.equal(result.preview.faceRules.faceDefinition.activeEffectVariant, branch);
  assert.equal(result.value, result.baseline);
  assert.equal(result.preview.values.find(value => value.op === 'damage').hits, 3);
  assert.equal(playingCardModel(world.registries, instance, { preview: result.preview }).baseTokens.damage, result.baseline);
  world.combat.player.mana = world.combat.player.stamina = world.combat.player.energy = 100;
  const hp = world.enemy.hp, start = world.combat.eventLog.length;
  dispatch(world.combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: world.enemy.id });
  const expected = result.preview.values.find(value => value.op === 'damage').perTargetHitDamages[world.enemy.id];
  const contacts = world.combat.eventLog.slice(start).filter(event => event.type === 'damageDealt' && event.targetId === world.enemy.id);
  assert.equal(hp - world.enemy.hp, expected.reduce((sum, amount) => sum + amount, 0));
  assert.deepEqual(contacts.map(event => event.hpLoss), expected);
  assert.equal(contacts.length, 3);
});




for (const version of [undefined, 0]) test(`saved combat tradition policy ${version} wins with default damage scales and active Gear`, () => {
  const world = fight('starseer', { attributes: { intelligence: 8, wisdom: 2 } });
  // This checks the saved casting policy, not Decay's multiplier or Prepared's bonus.
  // Keep current equipment and the real side scale while isolating those fight effects.
  delete world.combat.fixCoreRules.elements;
  delete world.combat.fixCoreRules.stanceBenefits;
  world.combat.stanceRules = { ...world.combat.stanceRules, offensiveRating: 0 };
  if (version === undefined) delete world.combat.fixCoreRules.spellTraditionsVersion;
  else world.combat.fixCoreRules.spellTraditionsVersion = version;
  assert.equal(world.combat.gameProfile.modules.effects.spellTraditionsVersion, 1);
  const face = damageFace(world, 'blightTouch');
  assert.equal(face.preview.faceRules.fixCoreRules.spellTraditionsVersion, version);
  assert.equal(face.value, face.baseline);
  assert.deepEqual(face.classes, ['black']);
  const def = world.registries.cards.get('blightTouch');
  assert.equal(staticCardTokens(def, world.registries, world.combat).damage, face.value, 'pile/combat face honors the saved policy');
  assert.equal(staticCardTokens(def, world.registries, { ...world.run, fixCoreRules: world.combat.fixCoreRules }).damage, face.value, 'saved run policy wins too');
  assert.equal(staticCardTokens(def, world.registries, { ...face.preview.faceRules, gameProfile: undefined }).damage, face.value, 'registry profile fallback retains the saved policy and the same equipment');
});
