// Owner decision #19 (docs/design/rebalance-owner-decisions.md): weapon cards
// with no fixed damage tag deal the equipped weapon's type, in v1 and v2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { tacticalCarrier } from '../src/engine/combatCardTactics.js';
import { effectCarrier } from '../src/engine/combatExpansionActions.js';
import { foundationSource, foundationCarrier } from '../src/engine/combatRules.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRng } from '../src/engine/rng.js';
import { applyCombatExpansionMartial } from '../src/content/combatExpansionMartial.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { hitRiders } from '../src/engine/combatMatchups.js';
import { validateAttack } from '../src/model/combatRules.js';
import { weaponDamageComponents } from '../src/model/attackTags.js';

const regs = createRegistries(contentBundle);
// blade (slashing), blade (piercing), blunt, bow, bare hands.
const WEAPONS = { blade: 'straightSword', dagger: 'dagger', blunt: 'warhammer', bow: 'shortbow', unarmed: null };
const WEAPON_TYPED = { blade: 'slashing', dagger: 'piercing', blunt: 'blunt', bow: 'piercing', unarmed: 'blunt' };
const EXPECTED = {
  strike: WEAPON_TYPED,
  cheapShot: WEAPON_TYPED,
  bloodhuntersStrike: WEAPON_TYPED,
  guardCounter: WEAPON_TYPED,
  // Weapon half + Necrotic half (owner #24): the label is the weapon half (first on the tie).
  bloodTithe: { blade: 'slashing', dagger: 'piercing', blunt: 'slashing', bow: 'piercing', unarmed: 'slashing' },
  // Mixed Necrotic + Force (owner #23; Necrotic replaced Blunt, owner 2026-10-13): the label is the heavier part.
  ruinousBlow: { blade: 'decay', dagger: 'decay', blunt: 'decay', bow: 'decay', unarmed: 'decay' },
  deathblow: { blade: 'arcane', dagger: 'arcane', blunt: 'arcane', bow: 'arcane', unarmed: 'arcane' },
};
const MIXED = {
  ruinousBlow: [{ type: 'decay', weight: 60 }, { type: 'arcane', weight: 40 }],
  deathblow: [{ type: 'decay', weight: 40 }, { type: 'arcane', weight: 60 }],
};
const FIXED_TAGS = { ruinousBlow: ['damage:decay', 'damage:arcane'], deathblow: ['damage:decay', 'damage:arcane'], bloodTithe: ['damage:decay'] };

function fight(cardId, weapon, version, extra = {}) {
  const player = { classId: 'reaver', maxHp: 200, hp: 200, maxMana: 50, mana: 50, energyMax: 10, drawPerTurn: 5,
    deck: [{ instanceId: 'card1', cardId }], relicIds: [],
    loadout: { sets: { rightHand: [weapon], leftHand: [null], armor: ['default'] }, active: { rightHand: 0, leftHand: 0, armor: 0 } } };
  const c = createCombat({ registries: regs, rng: createRng(5), player, enemyIds: ['wanderingSoldier'], combatExpansionVersion: version, ...extra });
  const enemy = c.enemies[0];
  enemy.hp = enemy.maxHp = 500;
  return { c, enemy };
}

test('only the mixed cards carry fixed damage tags', () => {
  for (const cardId of Object.keys(EXPECTED)) {
    const tags = regs.cards.get(cardId).tags.filter(tag => tag.startsWith('damage:'));
    assert.deepEqual(tags, FIXED_TAGS[cardId] || [], cardId);
  }
});

for (const version of [1, 2]) test(`v${version}: Ruinous Blow is 60 Necrotic / 40 Force and Deathblow 40 Necrotic / 60 Force`, () => {
  for (const [cardId, components] of Object.entries(MIXED)) for (const [label, weapon] of Object.entries(WEAPONS)) {
    const { c } = fight(cardId, weapon, version);
    const base = regs.cards.get(cardId);
    const def = version === 2 ? applyCombatExpansionMartial(base) : base;
    assert.deepEqual(def.attack.components, components, `v${version} ${cardId}`);
    const carrier = tacticalCarrier(def, {}, c, c.player);
    assert.deepEqual(carrier.combatProfile.damageComponents, components, `v${version} ${cardId} with ${label}`);
  }
});

test('v2: a Force resistance blunts only the Force share of a mixed hit, in preview and live alike', () => {
  const dealt = (cardId, resist) => {
    const { c, enemy } = fight(cardId, 'straightSword', 2);
    if (resist) enemy.damageResistPercent = { arcane: 50 };
    const shown = previewCard(c, 'card1', enemy.id).values.filter((row, i) => row.op === 'damage' && !regs.cards.get(cardId).effects[i].if)
      .reduce((sum, row) => sum + (row.perTarget?.[enemy.id] ?? row.value ?? 0), 0);
    const live = dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: enemy.id }).events
      .filter(event => event.type === 'damageDealt' && event.sourceId === 'player').reduce((sum, event) => sum + event.amount, 0);
    assert.equal(live, shown, `${cardId} resist ${resist}`);
    return live;
  };
  for (const [cardId, [, force]] of Object.entries(MIXED)) {
    const full = dealt(cardId, false), resisted = dealt(cardId, true);
    // About half the Force share is lost (each type rounds on its own), never the Blunt share.
    assert.ok(Math.abs((full - resisted) - full * force.weight / 100 / 2) <= 2, `${cardId}: ${full} -> ${resisted}`);
  }
});

for (const version of [1, 2]) {
  test(`v${version}: each card resolves the expected damage type per weapon`, () => {
    for (const [cardId, byWeapon] of Object.entries(EXPECTED)) for (const [label, weapon] of Object.entries(WEAPONS)) {
      const { c } = fight(cardId, weapon, version);
      const def = regs.cards.get(cardId);
      const carrier = tacticalCarrier(def, {}, c, c.player);
      const where = `v${version} ${cardId} with ${label}`;
      assert.equal(carrier.combatProfile.damageType, byWeapon[label], where);
      if (version === 2) for (const effect of def.effects.filter(row => row.op === 'damage')) {
        assert.equal(effectCarrier(carrier, effect).combatProfile.damageType, byWeapon[label], `${where} (effect)`);
      }
    }
  });

  test(`v${version}: preview and live damage agree for every card and weapon`, () => {
    for (const cardId of Object.keys(EXPECTED).filter(id => id !== 'guardCounter')) for (const [label, weapon] of Object.entries(WEAPONS)) {
      const { c, enemy } = fight(cardId, weapon, version);
      // A conditional effect previews its potential value; none of them fire here.
      const effects = regs.cards.get(cardId).effects;
      const shown = previewCard(c, 'card1', enemy.id).values
        .filter((row, index) => row.op === 'damage' && !effects[index].if)
        .reduce((sum, row) => sum + (row.perTarget?.[enemy.id] ?? row.value ?? 0), 0);
      const hits = dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: enemy.id }).events
        .filter(event => event.type === 'damageDealt' && event.sourceId === 'player');
      assert.equal(hits.reduce((sum, event) => sum + event.amount, 0), shown, `v${version} ${cardId} with ${label}`);
      // v2 names the type on the hit; v1 shows it through its matchup rider.
      // The v2 hit event names Force and Necrotic by their matchup aliases.
      if (version === 2) for (const hit of hits) assert.equal(hit.damageType, { arcane: 'force', decay: 'necrotic' }[EXPECTED[cardId][label]] || EXPECTED[cardId][label], `v2 ${cardId} with ${label}`);
      else {
        const type = EXPECTED[cardId][label];
        // Blood Tithe prints its own Bleed with every weapon (owner #24).
        assert.equal(!!enemy.statuses.bleed, type === 'slashing' || cardId === 'bloodTithe', `v1 ${cardId} with ${label}: Bleed rider`);
        if (type === 'blunt') assert(enemy.poiseMeter.value >= 2, `v1 ${cardId} with ${label}: Blunt Poise rider`);
      }
    }
  });
}

test('v2: an untagged Strike pays the enemy blunt weakness only with a blunt weapon or bare hands', () => {
  const dealt = (weapon) => dispatch(fight('strike', weapon, 2).c, { type: 'playCard', cardInstanceId: 'card1', targetId: 'e1' })
    .events.find(event => event.type === 'damageDealt').amount;
  assert(dealt('warhammer') > dealt('straightSword'));
  assert.equal(dealt(null), dealt('warhammer'));
  assert.equal(dealt('shortbow'), dealt('straightSword'));
});

test('a prepared Guard Counter replies with the equipped weapon type', () => {
  for (const version of [1, 2]) for (const [label, weapon] of Object.entries(WEAPONS)) {
    const { c } = fight('guardCounter', weapon, version);
    dispatch(c, { type: 'playCard', cardInstanceId: 'card1' });
    assert.equal(c.player.combatCounter.carrier.combatProfile.damageType, WEAPON_TYPED[label], `v${version} ${label}`);
  }
});

test('the rules-foundation source applies the same Blood Tithe restriction', () => {
  for (const [label, weapon] of Object.entries(WEAPONS)) {
    const { c } = fight('bloodTithe', weapon, 1, { ruleset: combatRules });
    const def = regs.cards.get('bloodTithe');
    assert.equal(foundationSource(c, c.player, { tags: def.tags, attack: def.attack }).damageType, EXPECTED.bloodTithe[label], label);
    assert.equal(foundationSource(c, c.player, { tags: regs.cards.get('strike').tags }).damageType, WEAPON_TYPED[label], `strike ${label}`);
  }
});

test('a mixed-damage profile keeps its weighted parts, labelled by the heaviest (first on a tie)', () => {
  const profile = (components) => combatProfileFor({ tags: ['camp:physical'], attack: { components } });
  const heavy = profile([{ type: 'blunt', weight: 40 }, { type: 'arcane', weight: 60 }]);
  assert.equal(heavy.damageType, 'arcane');
  assert.deepEqual(heavy.damageComponents, [{ type: 'blunt', weight: 40 }, { type: 'arcane', weight: 60 }]);
  assert.equal(profile([{ type: 'piercing', weight: 50 }, { type: 'decay', weight: 50 }]).damageType, 'piercing');
  assert.equal(profile([{ type: 'blunt', weight: 1 }]).damageComponents, undefined);
  // Each part brings its own rider, once.
  const cfg = { damageRiders: { blunt: { poise: 2 }, arcane: { wardDrain: 2 } } };
  assert.deepEqual(hitRiders(cfg, 'arcane', { combatProfile: heavy }), [{ wardDrain: 2 }, { poise: 2 }]);
});

// Owner decision #24: half the equipped piece's cut or stab, half Necrotic, and Bleed on hit.
const TITHE = { sword: ['straightSword', 'slashing'], dagger: ['dagger', 'piercing'], spikedShield: ['spikedShield', 'piercing'],
  bow: ['shortbow', 'piercing'], hammer: ['warhammer', 'slashing'], unarmed: [null, 'slashing'] };
for (const version of [1, 2]) test(`v${version}: Blood Tithe deals its weapon half plus Necrotic, and Bleeds, with every piece`, () => {
  for (const [label, [weapon, part]] of Object.entries(TITHE)) {
    const where = `v${version} Blood Tithe with ${label}`;
    const base = regs.cards.get('bloodTithe');
    const def = version === 2 ? applyCombatExpansionMartial(base) : base;
    const { c, enemy } = fight('bloodTithe', weapon, version);
    const carrier = tacticalCarrier(def, {}, c, c.player);
    assert.deepEqual(carrier.combatProfile.damageComponents, [{ type: part, weight: 50 }, { type: 'decay', weight: 50 }], where);
    assert.equal(carrier.combatProfile.damageType, part, where);
    if (version === 2) for (const effect of def.effects.filter(row => row.op === 'damage')) {
      assert.deepEqual(effectCarrier(carrier, effect).combatProfile.damageComponents, carrier.combatProfile.damageComponents, `${where} (effect)`);
    }
    dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: enemy.id });
    // v1 prints 2 Bleed; v2 projects it as 8 Bleed build-up (4 per stack).
    if (version === 1) assert.ok(enemy.statuses.bleed, `${where}: Bleed`);
    else assert.ok(enemy.statusControl?.gauges?.bleed?.value > 0, `${where}: Bleed build-up`);
  }
  const bleed = (version === 2 ? applyCombatExpansionMartial(regs.cards.get('bloodTithe')) : regs.cards.get('bloodTithe')).effects
    .filter(row => row.status === 'bleed').map(row => [row.op, row.stacks ?? row.amount]);
  assert.deepEqual(bleed, [version === 2 ? ['buildup', 8] : ['applyStatus', 2]]);
});

test('the rules foundation splits Blood Tithe into the weapon half and Necrotic', () => {
  for (const [label, [weapon, part]] of Object.entries(TITHE)) {
    const { c } = fight('bloodTithe', weapon, 1, { ruleset: combatRules });
    const def = regs.cards.get('bloodTithe');
    const carrier = foundationCarrier(c, c.player, { tags: def.tags, attack: def.attack });
    assert.deepEqual(carrier.attack.components, [{ type: part, weight: 50 }, { type: 'decay', weight: 50 }], label);
  }
});

test('a weapon part can sit beside fixed components: exactly one part follows the weapon', () => {
  const attack = { weaponDamage: { families: ['blade'], types: ['slashing', 'piercing'] },
    components: [{ type: 'slashing', weight: 50 }, { type: 'decay', weight: 50 }] };
  validateAttack(attack, combatRules);
  assert.deepEqual(weaponDamageComponents(attack, 'blade', 'piercing'), [{ type: 'piercing', weight: 50 }, { type: 'decay', weight: 50 }]);
  assert.deepEqual(weaponDamageComponents(attack, 'hammer', 'blunt'), attack.components);
  assert.throws(() => validateAttack({ ...attack, components: [{ type: 'decay', weight: 1 }] }, combatRules), /exactly one component/);
  assert.throws(() => validateAttack({ ...attack, damageType: 'slashing', components: undefined }, combatRules), /fixed damageType/);
});

// Owner decision #22: Lethal Dose is a thrown vial at Reach, never a Ranged maneuver.
test('Lethal Dose is thrown (projectile) at Reach, not Ranged, in v1 and v2', () => {
  const v1 = regs.cards.get('lethalDose');
  const v2 = applyCombatExpansionMartial(v1);
  for (const [label, def] of [['v1', v1], ['v2', v2]]) {
    assert.ok(def.tags.includes('delivery:projectile'), `${label} delivery`);
    assert.ok(!def.tags.includes('delivery:melee'), `${label} no melee delivery`);
    assert.ok(def.tags.includes('reach:near'), `${label} reach`);
    assert.ok(def.tags.includes('maneuver:attack') && !def.tags.includes('maneuver:ranged'), `${label} maneuver`);
    assert.ok(def.tags.includes('damage:poison'), `${label} damage`);
  }
  assert.equal(v2.reach, 'near');
  assert.equal(v2.projectile, true);
});
