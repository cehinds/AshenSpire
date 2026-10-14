import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { effectiveWeaponSource, weaponSourceFor, infusionForAttack } from '../src/model/weaponInfusion.js';
import { foundationSource, foundationDamage, createFoundation } from '../src/engine/combatRules.js';
import { combatRules } from '../src/content/combatRules.js';
import { effectCarrier } from '../src/engine/combatExpansionActions.js';
import { playingCardModel, combatCardSummary } from '../src/model/playingCard.js';

function fixture({ version = 2, subclassId = 'frostMonarch', effects, attack, offhand = false, coop = false, recipe } = {}) {
  const cards = contentBundle.cards.map(card => card.id === 'strike' ? { ...card,
    effects: effects || [{ op: 'damage', target: 'enemy', amount: 6 }],
    attack: attack || { source: 'weapon', damageType: 'slashing' }, upgrade: undefined,
    cost: 0, manaCost: 0, costRule: 'fixed', damageSchool: 'physical', exposureBuildupPerHit: 0 } : card);
  const subclasses = contentBundle.subclasses.map(row => row.id === 'frostMonarch' && recipe ? { ...row, weaponInfusion: recipe } : row);
  const registries = createRegistries({ ...contentBundle, cards, subclasses });
  const player = id => ({ ...(id ? { id } : {}), classId: 'starseer', combatExpansionVersion: version, ...(subclassId === undefined ? {} : { subclassId }),
    maxHp: 100, hp: 100, maxStamina: 30, stamina: 30, energyMax: 30, maxMana: 30, mana: 30, drawPerTurn: 3,
    deck: [{ instanceId: 'weapon', cardId: 'strike', upgraded: false, ...(offhand ? { sourceHand: 'left' } : {}) },
      { instanceId: 'spell', cardId: 'starstonePebble', upgraded: false }],
    loadout: { sets: { rightHand: [offhand ? null : 'straightSword'], leftHand: [offhand ? 'straightSword' : null], armor: ['default'] },
      active: { rightHand: 0, leftHand: 0, armor: 0 }, storage: [] } });
  const input = { registries, rng: createRng(903), combatExpansionVersion: version, reactionRulesVersion: 1,
    enemyIds: ['wanderingSoldier', 'wanderingSoldier'] };
  const combat = coop ? createCoopCombat({ ...input, players: [player('a'), { ...player('b'), subclassId: 'battleMage' }] })
    : createCombat({ ...input, player: player() });
  for (const enemy of combat.enemies) {
    enemy.hp = enemy.maxHp = 100; enemy.block = enemy.barrier = 0;
    enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {};
    enemy.combatTraits = {}; enemy.damageResistanceBySchool = {};
    delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
    if (version === 2) {
      enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
      enemy.persistentPoise = { max: 0, value: 0 }; enemy.persistentWard = { max: 0, value: 0 };
    }
  }
  return { combat, registries };
}

function hit(combat) {
  const enemy = combat.enemies[0], before = enemy.hp;
  const shown = previewCard(combat, 'weapon', enemy.id).values.find(row => row.op === 'damage');
  const result = dispatch(combat, { type: 'playCard', cardInstanceId: 'weapon', targetId: enemy.id });
  const damage = result.events.filter(row => row.type === 'damageDealt' && row.targetId === enemy.id);
  assert.equal(before - enemy.hp, shown.totalDamage, 'card preview and live HP loss share the source recipe');
  return { enemy, shown, damage, result };
}

test('selected FrostMonarch adds typed Cold and Frost to weapon hits without registry mutation', () => {
  const { combat, registries } = fixture();
  const stored = JSON.stringify({ equipment: registries.equipment, card: registries.cards.get('strike') });
  const counters = combat.rng.getCounters();
  const projected = weaponSourceFor(combat, combat.player, { attack: { source: 'weapon' }, combatProfile: { camp: 'physical' } });
  assert(projected.tags.includes('damage:frost'));
  previewCard(combat, 'weapon', combat.enemies[0].id);
  assert.deepEqual(combat.rng.getCounters(), counters);
  const face = previewCard(combat, 'weapon');
  const model = playingCardModel(registries, { cardId: 'strike' }, { preview: face });
  assert(model.tags.some(tag => tag.id === 'damage:frost' && tag.inheritedFrom.includes('Straight Sword')));
  const summary = combatCardSummary(face.resolvedDefinition, face, registries);
  assert.match(summary, /6 Slashing/); assert.match(summary, /2 Cold/); assert.match(summary, /1 Frost buildup after each hit causes HP loss/);
  const { enemy, shown, damage } = hit(combat);
  assert.equal(shown.totalDamage, 8);
  assert.deepEqual(shown.sourceInfusion, registries.subclasses.get('frostMonarch').weaponInfusion);
  assert.equal(damage[0].sourceInstanceId, shown.sourceInstanceId);
  assert.deepEqual(damage[0].components, [{ type: 'slashing', amount: 6 }, { type: 'frost', amount: 2 }]);
  assert.equal(enemy.statusControl.gauges.frost.value, 1);
  assert.equal(JSON.stringify({ equipment: registries.equipment, card: registries.cards.get('strike') }), stored);
});

test('every offhand hit and target receives its own source infusion', () => {
  const { combat } = fixture({ offhand: true, effects: [{ op: 'damage', target: 'allEnemies', amount: 6, hits: 2 }] });
  const { shown, damage } = hit(combat);
  assert.equal(shown.totalDamage, 16);
  assert.equal(damage.length, 2);
  for (const enemy of combat.enemies) {
    assert.equal(enemy.hp, 84);
    assert.equal(enemy.statusControl.gauges.frost.value, 2);
  }
});

test('typed Cold resistance, Ward and Frost resistance use existing defense paths', () => {
  const { combat } = fixture({ effects: [{ op: 'damage', target: 'enemy', amount: 6, hits: 2 }] });
  const enemy = combat.enemies[0];
  enemy.damageResistanceFlat.frost = 1;
  enemy.combatTraits.buildupResistance = { frost: 50 };
  enemy.ratings.ward = 1; enemy.persistentWard = { max: 1, value: 1 };
  const { shown, damage } = hit(combat);
  assert.equal(shown.totalDamage, 14, 'once-per-action Cold flat defense plus Ward each absorbs 1');
  assert.equal(damage.reduce((sum, row) => sum + (row.wardAbsorbed || 0), 0), 1);
  assert.equal(enemy.statusControl.gauges.frost.value, 1);
});

test('full protection and avoidance grant no source buildup', () => {
  const { combat } = fixture();
  const enemy = combat.enemies[0]; enemy.block = 100; enemy.barrier = 100;
  const { shown } = hit(combat);
  assert.equal(shown.totalDamage, 0);
  assert.equal(enemy.statusControl.gauges.frost, undefined);
});

test('pure spells, classless characters, other subclasses and legacy identities receive no infusion', () => {
  for (const subclassId of ['battleMage', null]) {
    const { combat } = fixture({ subclassId: subclassId || 'frostMonarch' });
    if (!subclassId) delete combat.player.subclassId;
    assert.equal(hit(combat).shown.totalDamage, 6);
  }
  const { combat } = fixture();
  combat.player.classUnequipped = true;
  assert.equal(hit(combat).shown.totalDamage, 6);
  const spell = fixture().combat;
  const before = spell.enemies[0].hp;
  const plain = fixture({ subclassId: 'battleMage' }).combat;
  const baseline = plain.enemies[0].hp;
  dispatch(spell, { type: 'playCard', cardInstanceId: 'spell', targetId: spell.enemies[0].id });
  dispatch(plain, { type: 'playCard', cardInstanceId: 'spell', targetId: plain.enemies[0].id });
  assert.equal(before - spell.enemies[0].hp, baseline - plain.enemies[0].hp);
  assert.equal(spell.enemies[0].statusControl.gauges.frost, undefined);
});

test('equipment changes remove infusion from bare hands and preserve it on newly equipped weapons', () => {
  const { combat } = fixture();
  combat.loadout.sets.rightHand[0] = null;
  assert.equal(weaponSourceFor(combat, combat.player, { attack: { source: 'weapon' } }), null);
  assert.equal(hit(combat).shown.totalDamage, 6);
  const next = fixture().combat;
  next.loadout.sets.rightHand[0] = 'warhammer';
  const projected = weaponSourceFor(next, next.player, { attack: { source: 'weapon' } });
  assert.equal(projected.itemId, 'warhammer'); assert(projected.tags.includes('damage:frost'));
  assert.equal(hit(next).enemy.statusControl.gauges.frost.value, 1);
});

test('Cold and Frost amounts come from the active authored subclass recipe', () => {
  const { combat } = fixture({ recipe: { tags: ['damage:frost'], components: [{ type: 'frost', amount: 3 }], buildup: [{ status: 'frost', amount: 2 }] } });
  const { shown, enemy } = hit(combat);
  assert.equal(shown.totalDamage, 9); assert.equal(enemy.statusControl.gauges.frost.value, 2);
});

test('save restore retains selected infusion and another co-op seat remains uninfused', () => {
  const { combat, registries } = fixture();
  const restored = restoreCombatSnapshot({ registries, rng: createRng(903), snapshot: JSON.parse(JSON.stringify(serializeCombatSnapshot(combat))) });
  assert.equal(restored.player.subclassId, 'frostMonarch');
  assert.equal(hit(restored).shown.totalDamage, 8);
  const team = fixture({ coop: true }).combat;
  const a = playCard(team, 'a', 'weapon', team.enemies[0].id);
  const b = playCard(team, 'b', 'weapon', team.enemies[0].id);
  assert.equal(a.events.find(row => row.type === 'damageDealt').magicAmount, 2);
  assert.equal(b.events.find(row => row.type === 'damageDealt').magicAmount, 0);
  assert.equal(team.enemies[0].statusControl.gauges.frost.value, 1);
});

test('foundation recipes stack with rune buildup and mitigate bonus Cold independently', () => {
  const { combat, registries } = fixture({ version: 1 });
  combat.foundation = createFoundation(combatRules, { player: { sources: { mainHand: {
    id: 'rune-sword', sourceType: 'weapon', family: 'blade', grip: 'oneHand', weight: 5, damageType: 'slashing',
    tags: ['source:weapon'], buildup: [{ status: 'frost', amount: 1 }] } } }, [combat.enemies[0].id]: { resistances: { frost: 0.5 } } }, registries);
  const source = foundationSource(combat, combat.player, { attack: { source: 'weapon' } });
  assert(source.tags.includes('damage:frost')); assert.equal(source.buildup[0].amount, 1);
  const receipt = foundationDamage(combat, combat.player, combat.enemies[0], 6, { attack: { source: 'weapon' } });
  assert.deepEqual(receipt.components, [{ type: 'slashing', amount: 6 }, { type: 'frost', amount: 1 }]);
  assert.equal(receipt.amount, 7);
  const { shown, enemy } = hit(combat);
  assert.equal(shown.totalDamage, 7);
  assert.equal(enemy.statuses.frost.meter.value, 2, 'rune and selected subclass pressure both resolve');
});

test('source classification excludes focus spells, bare-hand techniques and unrelated damage', () => {
  const { combat, registries } = fixture();
  combat.loadout.sets.rightHand[0] = 'ashStaff';
  for (const carrier of [
    { cardId: 'starstonePebble', attack: { source: 'spell' }, combatProfile: { camp: 'spell' } },
    { cardId: 'bashingBlow', attack: { source: 'unarmed' }, combatProfile: { camp: 'physical' } },
    {}, null,
  ]) assert.equal(infusionForAttack(combat, combat.player, carrier), null);
  const physicalStaff = weaponSourceFor(combat, combat.player, { cardId: 'strike', sourceArmamentId: 'ashStaff',
    attack: { source: 'weapon', damageType: 'blunt' }, combatProfile: { camp: 'physical' } });
  assert(physicalStaff.tags.includes('damage:frost'), 'an actual physical weapon attack may use a focus item');
  const changedEffect = effectCarrier({ weaponSource: physicalStaff, derivedTags: ['damage:frost'],
    attack: { source: 'weapon' }, combatProfile: { camp: 'physical' } },
    { attack: { source: 'spell' }, tags: ['camp:spell', 'source:spell'] });
  assert(!changedEffect.derivedTags.includes('damage:frost'));
  assert.equal(changedEffect.weaponSource, undefined);
  const sword = registries.equipment.armaments.find(piece => piece.id === 'straightSword');
  assert(effectiveWeaponSource(registries, { class: 'starseer', subclassId: 'frostMonarch' }, sword).tags.includes('damage:frost'),
    'inventory and sheet readers can project every owned weapon from run identity');
  const borrowed = effectiveWeaponSource(registries, { ...combat.player, classId: 'rogue' },
    { ...registries.equipment.armaments.find(piece => piece.id === 'ashStaff'), sourceType: 'weapon' });
  assert.equal(borrowed.weaponInfusion, undefined, 'changing active class removes the derived recipe');
  combat.piles.hand.find(card => card.instanceId === 'weapon').sourceArmamentId = 'ashStaff';
  const resolved = hit(combat);
  assert.equal(resolved.shown.totalDamage, 8, 'a physical staff strike receives actual Cold damage');
  assert.equal(resolved.enemy.statusControl.gauges.frost.value, 1);
});
