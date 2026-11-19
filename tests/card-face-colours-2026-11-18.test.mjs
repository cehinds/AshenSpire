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
import { staticCardTokens } from '../src/model/playingCard.js';
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
const classes = (html) => [...html.matchAll(/<span class="(val[^"]*)">(\d+)<\/span>/g)].map(match => match[1].replace('val', '').trim() || 'black');
function damageFace({ combat, enemy, registries: reg }, cardId) {
  combat.piles.hand.push({ instanceId: `c-${cardId}-${combat.piles.hand.length}`, cardId });
  const inst = combat.piles.hand.at(-1);
  const preview = previewCard(combat, inst.instanceId, enemy.id);
  const def = reg.cards.get(cardId);
  const line = cardFaceLines(def, preview, reg, null).find(row => row.kind === 'damage');
  return { classes: classes(line.html), value: preview.values.find(row => row.op === 'damage').faceValue,
    baseline: staticCardTokens(def, reg, preview.faceRules).damage, preview };
}
const damageClasses = (world, cardId) => damageFace(world, cardId).classes;

test('a face outside combat is always black', () => {
  const { run } = fight('starseer');
  const text = cardFaceLines(registries.cards.get('blightTouch'), undefined, registries, run).map(row => row.html).join('');
  assert.ok(!/class="val (up|down)"/.test(text));
  assert.ok(/class="val"/.test(text));
});

test('attributes and gear alone leave a combat number black', () => {
  const world = fight('starseer');
  // The static face (run rules) and the live preview agree on blightTouch, so the figure carries no mark.
  const live = damageClasses(world, 'blightTouch');
  assert.deepEqual(live, ['black'], 'the always-on Divine WIS bonus is part of the baseline');
  assert.equal(damageClasses(world, 'blightTouch').length, 1);
});

test('a fight boost turns the number green', () => {
  const world = fight('starseer');
  ChangeAttribute(world.combat, world.combat.player, 'wisdom', 4);
  assert.deepEqual(damageClasses(world, 'blightTouch'), ['up']);
});

test('a fight debuff on the player turns the number red', () => {
  const world = fight('starseer');
  ChangeAttribute(world.combat, world.combat.player, 'wisdom', -2);
  assert.deepEqual(damageClasses(world, 'blightTouch'), ['down']);
});

test('the current stance bonus turns a physical attack green', () => {
  const world = fight('reaver');
  assert.deepEqual(damageClasses(world, 'core.strike'), ['up'], 'Attack stance and its matching bonus are in-combat effects');
});

test('Weak turns a physical attack without a stance bonus red', () => {
  const weak = fight('reaver');
  applyStatus(weak.combat, weak.combat.player, 'weak', 2, weak.combat.player);
  assert.deepEqual(damageClasses(fight('reaver'), 'core.sweep'), ['black'], 'Sweep carries no stance bonus: attributes alone leave it black');
  assert.deepEqual(damageClasses(weak, 'core.sweep'), ['down'], 'Weak cuts the STR bonus below the face outside combat');
});

test('the plain-text face never carries a mark', () => {
  const { run } = fight('reaver');
  assert.ok(!/val (up|down)/.test(cardPlainText(registries, { cardId: 'core.strike' }, { rules: run })));
});

test('a triggered relic effect that raises a hit turns the number green', () => {
  const world = fight('reaver');
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
  const ownProfile = Profile.resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
    effects: { spellTraditionsVersion: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1 },
  } });
  const world = fight('starseer', { ownProfile, attributes });
  // Isolate the attribute baseline: these casts otherwise enter a beneficial stance,
  // and Decay has its own damage multiplier. Unit side/physical scales also isolate
  // channel ownership from split rounding. Original tests above retain stance/colour coverage.
  delete world.combat.fixCoreRules.stanceBenefits;
  delete world.combat.fixCoreRules.elements;
  world.combat.stanceRules = { ...world.combat.stanceRules, offensiveRating: 0 };
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
  const world = fight('starseer', { attributes: { intelligence: 8, wisdom: 2 } });
  if (version === undefined) delete world.combat.fixCoreRules.spellTraditionsVersion;
  else world.combat.fixCoreRules.spellTraditionsVersion = version;
  assert.equal(world.combat.gameProfile.modules.effects.spellTraditionsVersion, 1);
  const face = damageFace(world, 'blightTouch');
  assert.equal(face.preview.faceRules.fixCoreRules.spellTraditionsVersion, version);
  assert.equal(face.value, face.baseline);
  assert.deepEqual(face.classes, ['black']);
  const def = world.registries.cards.get('blightTouch');
  assert.equal(staticCardTokens(def, world.registries, world.combat).damage, face.value, 'pile/combat face honors the saved policy');
  assert.equal(staticCardTokens(def, world.registries, { ...world.run, fixCoreRules: { spellTraditionsVersion: version } }).damage, face.value, 'saved run policy wins too');
  assert.equal(staticCardTokens(def, world.registries, { faceAttributes: face.preview.faceRules.faceAttributes, fixCoreRules: {} }).damage, face.value, 'registry profile fallback retains the saved policy');
});
