import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { importLegacyContent } from '../src/framework/importer.js';
import { createRegistries } from '../src/model/registries.js';
import { weapons } from '../src/content/generated/weapons.js';
import { tagging } from '../src/content/generated/tagging.js';
import { nodes } from '../src/content/generated/nodes.js';
import { resolveGearItem } from '../engine/kernel/gameConfig.js';
import { projectGearRangeMetadata } from '../tools/lib/gear-range-metadata.mjs';
import { authorEnemyRange } from '../tools/lib/core-range-content.mjs';
import { equipmentCardModel } from '../src/model/equipmentCard.js';
import { entryDetail } from '../src/ui/models/CompendiumModel.js';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';

const json = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const dir = 'games/ashenspire/packs/core/';
const gear = json(dir + 'gear.json'), settings = json('engine/modules/gear/defaults.json');

test('authored Core range content passes the actual profile schema', () => {
  const profile = resolveGameAuthor(json('games/ashenspire/presets/core.json'), loadGameProfileCatalog());
  assert.ok(profile.content.cards.some(card => card.id === 'core.advance'));
  assert.ok(profile.content.enemyCards.some(card => card.id === 'wanderingSoldier.advance'));
});

test('authored range/property metadata survives framework import without changing weapon contracts', () => {
  const imported = importLegacyContent(contentBundle);
  const registry = createRegistries(contentBundle);
  for (const weapon of weapons) {
    const entity = imported.entities.find(row => row.kind === 'EQUIPMENT' && row.explicitOverrides?.legacyId === weapon.id);
    assert.equal(entity.explicitOverrides.range, weapon.range, weapon.id);
    const piece = registry.equipment.armaments.find(row => row.id === weapon.id);
    for (const [field, authored] of [['itemWeight', 'weight'], ['attackRatingBonus', 'attackRating'], ['defenseRating', 'defenseRating'], ['mods', 'mods']]) assert.deepEqual(entity.explicitOverrides[field], piece[authored], `${weapon.id}/${field}`);
  }
  const dagger = registry.equipment.armaments.find(row => row.id === 'dagger');
  assert.ok(dagger.propertyTags.includes('throw'));
  assert.equal(dagger.tags.includes('throw'), false, 'property identity is distinct from gameplay tags');
  assert.ok(imported.entities.find(row => row.explicitOverrides?.legacyId === 'dagger').explicitOverrides.propertyTags.includes('throw'));
  const changedRange = importLegacyContent({ ...contentBundle, equipment: { ...contentBundle.equipment,
    armaments: contentBundle.equipment.armaments.map(piece => ({ ...piece, range: 'ranged' })) } });
  assert.deepEqual(changedRange.entities.filter(row => row.kind !== 'EQUIPMENT'), imported.entities.filter(row => row.kind !== 'EQUIPMENT'), 'range metadata must not reprice or rewrite any base-card entity');
  const bad = { ...contentBundle, equipment: { ...contentBundle.equipment, armaments: [{ ...weapons[0], range: 'near' }] } };
  assert.throws(() => importLegacyContent(bad), /unknown range/);
});

test('metadata projection preserves stats, prices, upgrades and equipment grants, including source aliases', () => {
  const dagger = gear.find(row => row.id === 'dagger');
  const old = { ...dagger, id: 'custom-dagger', tags: dagger.tags.filter(id => id !== 'throw'), rank: 3,
    points: { ar: 2 }, grantedCards: [{ card: 'core.manaSurge', copies: 2 }], price: 17 };
  delete old.range;
  const [updated] = projectGearRangeMetadata([old], weapons, tagging, nodes, settings);
  assert.equal(updated.range, 'melee');
  assert.ok(updated.tags.includes('throw'));
  assert.deepEqual(updated.grantedCards, old.grantedCards);
  assert.equal(updated.price, 17); assert.equal(updated.rank, 3);
  for (const field of ['points', 'values', 'modifiers', 'tagCost', 'budget']) assert.deepEqual(resolveGearItem(updated, settings)[field], resolveGearItem(old, settings)[field], field);
  assert.deepEqual(projectGearRangeMetadata(gear, weapons, tagging, nodes, settings), gear, 'refresh is idempotent');
  assert.throws(() => projectGearRangeMetadata([{ ...old, source: { id: 'unknown' } }], weapons, tagging, nodes, settings), /no authored weapon/);
});

test('Core movement cards have explicit paid movement and preserve existing Evade strength and starting decks', () => {
  const cards = json(dir + 'cards.json'), evade = cards.find(row => row.id === 'core.evade');
  const advance = cards.find(row => row.id === 'core.advance');
  assert.equal(advance.staminaCost, 1); assert.equal(advance.rarity, 'common');
  assert.deepEqual(advance.effects, [{ op: 'moveEngagement', target: 'enemy', bands: -1 }]);
  assert.equal(advance.stanceTrigger, undefined);
  for (const [id, bands] of [['core.closingDodge', -1], ['core.backstep', 1]]) {
    const card = cards.find(row => row.id === id);
    assert.equal(card.staminaCost, 4); assert.equal(card.manaCost, 0); assert.equal(card.rarity, 'uncommon');
    assert.deepEqual(card.effects[0], evade.effects[0]);
    assert.deepEqual(card.effects[1], { op: 'moveEngagement', target: 'enemy', bands });
    assert.ok(card.tags.includes('trait:reaction')); assert.equal(card.stanceTrigger.stance, 'evade');
  }
  assert.equal(JSON.stringify(json(dir + 'starterDeck.json')).includes('core.advance'), false);
  assert.equal(contentBundle.cards.find(row => row.id === 'backstep').effects.some(effect => effect.op === 'moveEngagement'), false, 'Legacy Backstep is unchanged');
});

test('every Core enemy owns an explicitly priced closing move and authored starting range without pool changes', () => {
  const cards = json(dir + 'enemyCards.json');
  for (const row of json(dir + 'characters.json').filter(row => row.tags.includes('character.enemy'))) {
    const enemy = { ...row, ...row.enemy }, id = `${row.id}.advance`;
    assert.equal(enemy.rangeClosingMove, 'advance'); assert.equal(enemy.rangeRoutePolicy, 'advance');
    assert.equal(enemy.defaultDeck.filter(card => card === id).length, 1);
    assert.equal(enemy.cardHints[id].legacyMove, 'advance');
    const card = cards.find(card => card.id === id);
    assert.equal(card.staminaCost, 1); assert.equal(card.manaCost, 0);
    assert.deepEqual(card.effects, [{ op: 'moveEngagement', target: 'enemy', bands: -1 }]);
    assert.equal(card.tags.some(tag => tag.startsWith('maneuver:')), false);
    const projected = authorEnemyRange(enemy, gear);
    assert.equal(enemy.startingRange, projected.startingRange);
    assert.deepEqual(projected.defaultDeck, enemy.defaultDeck, 'converter is idempotent');
    for (const field of ['attributes', 'attributePriority', 'levelProfile']) assert.deepEqual(projected[field], enemy[field]);
  }
  for (const id of ['chainScavenger.hookCast', 'chainScavenger.chainSnare', 'chainScavenger.draggingBlow']) assert.equal(cards.find(card => card.id === id).range, 'reach');
});

test('Core equipment explains property tags while withheld Compendium entries and Legacy stay unchanged', () => {
  const registry = createRegistries(contentBundle), dagger = registry.equipment.armaments.find(row => row.id === 'dagger');
  const core = { ...registry, gameProfile: { formatVersion: 1, modules: { effects: { fixCoreVersion: 1 } } } };
  assert.ok(equipmentCardModel(core, dagger).tags.some(row => row.value === 'throw'));
  assert.equal(equipmentCardModel(registry, dagger).tags.some(row => row.value === 'throw'), false);
  const options = { showProperties: true, tags: registry.tags };
  assert.ok(entryDetail(dagger, { state: 'held' }, options).tags.some(row => row.id === 'throw'));
  for (const state of ['listed', 'unknown']) assert.deepEqual(entryDetail(dagger, { state }, options).tags, []);
});
