// Owner, 2026-11-14 (W25-L): attributes change during a fight, everything derived follows at once, and everything returns after it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch } from '../src/engine/combat.js';
import { runCombatEnd } from '../src/engine/runCombat.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { ChangeAttribute, ClearTurnAttributeBoosts, RestoreLiveStats, LiveAttribute, ElementStatScale, StatScaledNumber } from '../src/engine/liveStats.js';
import { ratingValue } from '../src/model/combatRatings.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1 } } }); // the playtest physical cut is off: this file pins its own hand-sized arithmetic
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(classId = 'reaver', seed = 511) {
  const run = createRunState({ registries: reg, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  return { run, combat };
}
const hit = (combat, base = 6) => profileDamageReceipt(combat, combat.player, combat.enemies[0], base, {});

test('+2 STR raises AR at once and the next hit quote', () => {
  const { combat } = live();
  const p = combat.player;
  const ar = ratingValue(combat, p, 'ar');
  const before = hit(combat).rawHit;
  assert.ok(ChangeAttribute(combat, p, 'strength', 2));
  assert.equal(LiveAttribute(p, 'strength'), p.liveStats.base.attributes.strength + 2);
  assert.equal(ratingValue(combat, p, 'ar'), ar + 2);
  assert.equal(p.ratingSources.find(r => r.kind === 'attribute').ar, p.liveStats.base.attributeRow.ar + 2, 'the per-source readers follow too');
  assert.equal(hit(combat).rawHit, before + 2, 'the quote changed by the AR gained');
});

test('the quote rises by the AR gained (shown = dealt)', () => {
  const a = live().combat, b = live().combat;
  const plain = hit(a).rawHit;
  ChangeAttribute(b, b.player, 'strength', 2);
  const boosted = hit(b).rawHit;
  assert.equal(boosted, plain + 2);
});

test('+2 CON raises max HP without Poise; the fight restores Health and HP is trimmed', () => {
  const { combat } = live();
  const p = combat.player;
  const start = { maxHp: p.maxHp, hp: p.hp, maxStamina: p.maxStamina, energyMax: p.energyMax, poise: p.ratings.poise, pMax: p.persistentPoise.max };
  ChangeAttribute(combat, p, 'constitution', 2);
  assert.ok(p.maxHp > start.maxHp, 'max HP follows the HP row');
  assert.equal(p.hp, start.hp, 'a higher maximum does not heal');
  assert.equal(p.ratings.poise, start.poise, 'Constitution no longer raises Poise');
  assert.equal(p.persistentPoise.max, p.ratings.poise);
  assert.ok(p.maxStamina >= start.maxStamina);
  p.hp = p.maxHp; // full on the raised maximum
  RestoreLiveStats(combat);
  assert.equal(p.maxHp, start.maxHp);
  assert.equal(p.hp, start.maxHp, 'HP above the restored maximum is trimmed');
  assert.equal(p.ratings.poise, start.poise);
  assert.equal(p.persistentPoise.max, start.pMax);
  assert.equal(p.liveStats, undefined);
});

test('CON raises Stamina when its row answers to it, and the run is untouched', () => {
  const { run, combat } = live();
  const p = combat.player;
  const attrs = structuredClone(run.attributes);
  const maxHp = run.maxHp;
  ChangeAttribute(combat, p, 'constitution', 8);
  ChangeAttribute(combat, p, 'dexterity', 8);
  assert.ok(p.maxStamina > run.maxStamina, 'Stamina follows CON and DEX');
  assert.ok(p.energyMax >= p.maxStamina - 0);
  assert.deepEqual(run.attributes, attrs, 'the run attributes are never written');
  assert.equal(run.maxHp, maxHp);
  runCombatEnd(run, combat);
  assert.equal(run.maxHp, maxHp, 'the fight leaves the run its own maximum');
  assert.equal(run.maxStamina, 3);
  assert.deepEqual(run.attributes, attrs);
});

test('hand size and draw change live and return', () => {
  const { combat } = live();
  const hand = combat.handMax, draw = combat.drawPerTurn;
  const int = LiveAttribute(combat.player, 'intelligence');
  ChangeAttribute(combat, combat.player, 'intelligence', 3);
  // Owner 2026-11-18 (ruling §9): the hand is 5 + floor(INT / 4), so +3 INT adds one card only when it crosses a multiple of 4.
  assert.equal(combat.handMax, hand + Math.floor((int + 3) / 4) - Math.floor(int / 4), 'the hand size reads Intelligence');
  assert.ok(combat.drawPerTurn >= draw);
  RestoreLiveStats(combat);
  assert.equal(combat.handMax, hand);
  assert.equal(combat.drawPerTurn, draw);
});

test('a this-turn change leaves at the end of the owner\'s turn; a rest-of-fight change stays and stacks', () => {
  const { combat } = live();
  const p = combat.player;
  const str = LiveAttribute(p, 'strength');
  ChangeAttribute(combat, p, 'strength', 2, { thisTurn: true });
  ChangeAttribute(combat, p, 'strength', 1);
  ChangeAttribute(combat, p, 'strength', 1);
  assert.equal(LiveAttribute(p, 'strength'), str + 4);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(LiveAttribute(p, 'strength'), str + 2, 'only the two fight-long points remain');
});

test('enemies change live too', () => {
  const { combat } = live();
  const e = combat.enemies[0];
  const ar = e.ratings.ar, maxHp = e.maxHp;
  ChangeAttribute(combat, e, 'strength', 2);
  ChangeAttribute(combat, e, 'constitution', 3);
  assert.equal(e.ratings.ar, ar + 2);
  assert.ok(e.maxHp > maxHp);
  RestoreLiveStats(combat);
  assert.equal(e.ratings.ar, ar);
  assert.equal(e.maxHp, maxHp);
});

test('a mid-fight INT boost raises the stat-scaled element numbers at once and they revert', () => {
  const { combat } = live();
  const p = combat.player;
  const fire = ElementStatScale(p, 'fire'), shock = ElementStatScale(p, 'lightning'), chill = ElementStatScale(p, 'frost');
  ChangeAttribute(combat, p, 'intelligence', 2);
  assert.equal(ElementStatScale(p, 'fire'), fire + 2, 'Fire ignores Poise per WIS + INT');
  assert.equal(ElementStatScale(p, 'frost'), chill + 2);
  assert.ok(ElementStatScale(p, 'lightning') >= shock);
  assert.equal(StatScaledNumber(p, ['intelligence', 'wisdom'], 'max'), Math.max(LiveAttribute(p, 'intelligence'), LiveAttribute(p, 'wisdom')));
  RestoreLiveStats(combat);
  assert.equal(ElementStatScale(p, 'fire'), fire);
  assert.equal(ElementStatScale(p, 'frost'), chill);
});

test('a mid-fight INT or WIS boost raises PR under max(INT, WIS)', () => {
  const { combat } = live('starseer');
  const p = combat.player;
  const pr = ratingValue(combat, p, 'pr');
  const high = Math.max(LiveAttribute(p, 'intelligence'), LiveAttribute(p, 'wisdom'));
  ChangeAttribute(combat, p, 'wisdom', high + 3 - LiveAttribute(p, 'wisdom')); // WIS becomes the highest
  assert.equal(ratingValue(combat, p, 'pr'), pr + 3);
  RestoreLiveStats(combat);
  assert.equal(ratingValue(combat, p, 'pr'), pr);
});

test('boosts survive a save of the fight (plain JSON) and still revert', () => {
  const { combat } = live();
  const p = combat.player;
  ChangeAttribute(combat, p, 'strength', 2);
  const copy = JSON.parse(JSON.stringify(p.liveStats));
  assert.deepEqual(copy, p.liveStats);
  const ar = p.ratings.ar;
  p.liveStats = copy;
  RestoreLiveStats(combat);
  assert.equal(p.ratings.ar, ar - 2);
});
