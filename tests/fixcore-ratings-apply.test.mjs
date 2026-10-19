import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { configuredModule, profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { stanceRulesFor } from '../src/model/stanceRules.js';
import { fixCoreRules } from '../src/model/fixCoreMechanics.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

// Owner, 2026-10-19: AR, DR, PR and Poise still apply to cards in Core, and spell effectiveness still uses PR.
// Each rating comes from the CHARACTER (derived-stat rows: STR -> AR, DEX -> DR, INT -> PR, CON -> Poise) and from
// EQUIPMENT (weapon AR, Smith tiers, armor/shield DR and Poise, staff PR). Every source is raised on its own, in a fresh
// Core run, and the card value must move by the configured weight, in the preview and in live combat alike.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const N = 3;

function world(classId, mutate, { targetStance = null } = {}) {
  const run = createRunState({ registries: reg, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  mutate?.(run);
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const target = combat.enemies[0];
  Object.assign(target, { hp: 5000, maxHp: 5000, block: 0, barrier: 0, statuses: {}, persistentPoise: { value: 20, max: 20 }, attributes: { dexterity: 0 } });
  delete target.combatStance; delete target.combatCounter;
  if (targetStance) target.combatStance = { maneuver: targetStance, camp: 'physical', range: 'melee' };
  combat.player.stamina = 20; combat.player.mana = 20;
  return { run, combat, target };
}
const weights = combat => {
  const fx = configuredModule(combat, 'effects');
  return { ar: fx.attackRatingWeight, pr: fx.attackRatingWeight, dr: fx.defenseRatingWeight };
};
function hand(combat, cardId) {
  const instanceId = `rt_${cardId}`;
  combat.piles.hand.push({ instanceId, cardId, upgraded: false });
  return instanceId;
}
// One damaging card: preview first (pure), then the same card played live. Returns pre-protection and final damage.
function damage(w, cardId) {
  const { combat, target } = w; const id = hand(combat, cardId);
  const value = previewCard(combat, id, target.id).values.find(v => v.op === 'damage');
  primeAccuracyRolls(combat);
  const hp = target.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: target.id });
  const live = combat.eventLog.filter(row => row.type === 'damageDealt').at(-1).damageReceipt;
  const out = { incoming: value.damageReceipt.hits[0].incoming, liveIncoming: live.hits[0].incoming, preview: value.totalDamage, liveLoss: hp - target.hp };
  assert.equal(out.liveIncoming, out.incoming, `${cardId}: live incoming matches the preview`);
  assert.equal(out.liveLoss, out.preview, `${cardId}: live HP loss matches the preview`);
  return out;
}
// One Block card (Defend, or Counter's Block): preview value against the Block actually gained live.
function block(w, cardId) {
  const { combat, target } = w; const id = hand(combat, cardId);
  // Both are self-targeted stances.
  const aim = combat.player.id;
  const preview = previewCard(combat, id, aim).values.find(v => v.op === 'block').value;
  const before = combat.player.block || 0;
  dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: aim });
  const live = (combat.player.block || 0) - before;
  assert.equal(live, preview, `${cardId}: live Block matches the preview`);
  return preview;
}
const ratings = w => ({ ...w.combat.player.ratings });

// ---- the sources: [label, class, mutate(run)] -------------------------------------------------------------------
const stat = attr => run => { run.attributes[attr] += N; };
const sources = {
  ar: [
    ['STR (stat)', 'reaver', stat('strength')],
    ['weapon Smith tier', 'reaver', run => { run.itemUpgradeLevels['armament/greatsword'] = 2; }],
  ],
  dr: [
    ['DEX (stat)', 'reaver', stat('dexterity')],
    ['armor (Warden)', 'reaver', run => { run.loadout.sets.armor[0] = 'warden'; }],
    ['shield (Tower Shield)', 'reaver', run => { run.loadout.sets.leftHand[0] = 'towerShield'; }],
  ],
  pr: [
    ['INT (stat)', 'starseer', stat('intelligence')],
    ['staff (Emberlight Sceptre)', 'starseer', run => { run.loadout.sets.rightHand[0] = 'emberlightSceptre'; }],
  ],
  poise: [
    ['CON (stat)', 'reaver', stat('constitution')],
    ['armor (Warden)', 'reaver', run => { run.loadout.sets.armor[0] = 'warden'; }],
    ['shield (Tower Shield)', 'reaver', run => { run.loadout.sets.leftHand[0] = 'towerShield'; }],
  ],
};
const raised = (id, [label, classId, mutate], fn) => {
  const base = world(classId), up = world(classId, mutate);
  const delta = ratings(up)[id] - ratings(base)[id];
  assert.ok(delta > 0, `${label}: the source must raise ${id.toUpperCase()} (got ${delta})`);
  return fn({ base, up, delta, w: weights(up.combat), label });
};

// ---- AR -> physical attack cards ---------------------------------------------------------------------------------
for (const card of ['core.strike', 'core.sweep', 'core.smash', 'core.reaverSpecial']) {
  for (const src of sources.ar) {
    test(`AR (${src[0]}) raises ${card} by the configured weight, preview == live`, () => {
      raised('ar', src, ({ base, up, delta, w }) => {
        const a = damage(base, card), b = damage(up, card);
        assert.equal(b.incoming - a.incoming, Math.floor(delta * w.ar), `${card} incoming`);
      });
    });
  }
}
for (const src of sources.ar) {
  test(`AR (${src[0]}) raises Smash against a Defend stance (at least by the weight), preview == live`, () => {
    const base = world(src[1], null, { targetStance: 'defend' }), up = world(src[1], src[2], { targetStance: 'defend' });
    const delta = ratings(up).ar - ratings(base).ar, w = weights(up.combat);
    assert.ok(delta > 0);
    const a = damage(base, 'core.smash'), b = damage(up, 'core.smash');
    assert.ok(b.incoming - a.incoming >= delta * w.ar, `Smash vs Defend: +${b.incoming - a.incoming} for +${delta} AR`);
  });
}

// ---- DR -> Block from Defend and Counter ---------------------------------------------------------------------------
for (const card of ['core.defend', 'core.counter']) {
  for (const src of sources.dr) {
    test(`DR (${src[0]}) raises ${card} Block by the configured weight, preview == live`, () => {
      raised('dr', src, ({ base, up, delta, w }) => {
        assert.equal(block(up, card) - block(base, card), Math.floor(delta * w.dr), `${card} Block`);
      });
    });
  }
}
test('the stance DR bonus applies to Block on top of the DR rating (Defend stance)', () => {
  const stanced = world('reaver'), dr = ratings(stanced).dr;
  stanced.combat.player.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  const cfg = stanceRulesFor(stanced.combat), printed = reg.cards.get('core.defend').effects.find(e => e.op === 'block').amount;
  assert.ok(cfg.defensiveRating > 0, 'the defensive stance rating is configured');
  // Matching stance also scales the Block by its effectiveness (SPEC; same formula as fixcore-stance-block).
  assert.equal(block(stanced, 'core.defend'),
    Math.floor((printed + (dr + cfg.defensiveRating) * weights(stanced.combat).dr) * fixCoreRules(stanced.combat).stance.effectivenessMultiplier));
});
test('Counter keeps its printed Block plus DR plus the Counter stance DR bonus (no AR in the Block)', () => {
  const w = world('reaver'), r = ratings(w);
  const printed = reg.cards.get('core.counter').effects.find(e => e.op === 'block').amount;
  const stanceDR = stanceRulesFor(w.combat).defensiveRating; // Counter is a defensive stance
  assert.equal(block(w, 'core.counter'), Math.floor(printed + (r.dr + stanceDR) * weights(w.combat).dr));
});
test('Core armor Smith tiers follow the armor budget (D14: flat across ranks), not a flat DR per tier', () => {
  // Owner question raised by the ratings audit: if armor Smith tiers should add DR, armorBudget.perRank must say so.
  const perRank = profile.modules.gear.armorBudget.perRank || 0;
  const base = world('reaver'), up = world('reaver', run => { run.itemUpgradeLevels['armor/reaver/default'] = 2; });
  const delta = ratings(up).dr - ratings(base).dr;
  if (perRank > 0) assert.ok(delta > 0, 'a configured armor rank budget must reach DR'); else assert.equal(delta, 0);
});

// ---- Poise rating -> the Poise pool ---------------------------------------------------------------------------------
for (const src of sources.poise) {
  test(`Poise rating (${src[0]}) sets the player's Poise pool one for one`, () => {
    raised('poise', src, ({ base, up, delta }) => {
      for (const w of [base, up]) {
        assert.equal(w.combat.player.persistentPoise.max, w.combat.player.ratings.poise);
        assert.equal(w.combat.player.persistentPoise.value, w.combat.player.persistentPoise.max);
      }
      assert.equal(up.combat.player.persistentPoise.max - base.combat.player.persistentPoise.max, delta);
    });
  });
}

// ---- PR -> spells (Arcane Spark is Core's cantrip); AR must not change a spell ---------------------------------------
for (const src of sources.pr) {
  test(`PR (${src[0]}) raises the Arcane Spark cantrip by the configured weight, preview == live`, () => {
    raised('pr', src, ({ base, up, delta, w }) => {
      const a = damage(base, 'core.cantrip'), b = damage(up, 'core.cantrip');
      assert.equal(b.incoming - a.incoming, Math.floor(delta * w.pr), 'cantrip incoming moves with PR');
    });
  });
}
for (const [label, mutate] of [['STR (stat)', stat('strength')], ['weapon Smith tier', run => { run.itemUpgradeLevels['armament/boneSceptre'] = 2; }]]) {
  test(`AR (${label}) does not change the Arcane Spark cantrip`, () => {
    const base = world('starseer'), up = world('starseer', mutate);
    assert.ok(ratings(up).ar > ratings(base).ar && ratings(up).pr === ratings(base).pr, 'AR up, PR unchanged');
    assert.equal(damage(up, 'core.cantrip').incoming, damage(base, 'core.cantrip').incoming);
  });
}
test('PR (INT) does not change a physical attack card', () => {
  const base = world('reaver'), up = world('reaver', stat('intelligence'));
  assert.ok(ratings(up).pr > ratings(base).pr && ratings(up).ar === ratings(base).ar);
  assert.equal(damage(up, 'core.strike').incoming, damage(base, 'core.strike').incoming);
});

// ---- PR bonus routes to the magical part of a split; enemies keep AR for their spells --------------------------------
test('PR bonus lands in the magical half of Arcane Spark; the physical half is unchanged', () => {
  const base = world('starseer'), up = world('starseer', stat('intelligence'));
  const part = w => { const { combat, target } = w; const id = hand(combat, 'core.cantrip');
    const hit = previewCard(combat, id, target.id).values.find(v => v.op === 'damage').damageReceipt.hits[0]; return hit; };
  const a = part(base), b = part(up), w = weights(up.combat).pr, delta = ratings(up).pr - ratings(base).pr;
  assert.ok(a.magical > 0 && a.physical > 0, 'Arcane Spark is a split hit');
  assert.equal(b.magical - a.magical, Math.floor(delta * w), 'PR goes to the magical part');
  assert.equal(b.physical, a.physical, 'the physical part does not move');
});
test('AR bonus keeps its routing on a physical card (physical part)', () => {
  const base = world('reaver'), up = world('reaver', stat('strength'));
  const hit = w => previewCard(w.combat, hand(w.combat, 'core.strike'), w.target.id).values.find(v => v.op === 'damage').damageReceipt.hits[0];
  const a = hit(base), b = hit(up);
  assert.equal(b.magical, a.magical);
  assert.ok(b.physical > a.physical);
});
test('an enemy spell-camp attack keeps reading AR (its PR is 0), exactly as before', () => {
  const { combat, target } = world('starseer');
  const enemy = combat.enemies[0];
  enemy.ratings = { ...enemy.ratings, ar: 4, pr: 0 };
  const carrier = { cardId: 'core.cantrip', damageSchool: 'magic', combatProfile: { camp: 'spell', maneuver: 'casting', range: 'melee' } };
  const noBonus = profileDamageReceipt(combat, { ...enemy, ratings: { ar: 0, pr: 0 } }, combat.player, 10, carrier).damageReceipt.hits[0].incoming;
  const rated = profileDamageReceipt(combat, enemy, combat.player, 10, carrier).damageReceipt.hits[0].incoming;
  assert.equal(rated - noBonus, Math.floor(4 * weights(combat).ar));
});
test('a technique whose magic identity is only combatProfile.school reads PR, not AR', () => {
  const { combat } = world('reaver');
  const target = combat.enemies[0];
  const player = { ...combat.player, ratings: { ...combat.player.ratings, ar: 0, pr: 4 } };
  const none = { ...combat.player, ratings: { ...combat.player.ratings, ar: 0, pr: 0 } };
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee', school: 'frost' } };
  const at = source => profileDamageReceipt(combat, source, target, 10, carrier).damageReceipt.hits[0].incoming;
  assert.equal(at(player) - at(none), Math.floor(4 * weights(combat).pr));
  const plain = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  const arOnly = { ...combat.player, ratings: { ...combat.player.ratings, ar: 4, pr: 0 } };
  const atPlain = source => profileDamageReceipt(combat, source, target, 10, plain).damageReceipt.hits[0].incoming;
  assert.equal(atPlain(arOnly) - atPlain(none), Math.floor(4 * weights(combat).ar), 'a plain physical attack still reads AR');
});
