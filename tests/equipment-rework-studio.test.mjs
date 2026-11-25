import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { scoring } from '../src/content/generated/scoring.js';
import { itemCombatPower } from '../src/content/generated/combatPower.js';
import { itemArtLayers } from '../src/content/generated/itemArtLayers.js';
import { ScoreItem, ItemName, ItemNameParts, ModValue, ModLabel, PropertyValue, RankOf } from '../src/model/combatPower.js';
import { ValidateScoringConfig } from '../src/model/activeScoring.js';
import { ItemArtComposition } from '../src/ui/itemArtComposition.js';
import { ItemArtLayersParts } from '../src/ui/itemArtLayers.js';
import { buildItemRoster, scoreItemEntry, livePieceFromEntry } from '../tools/score-studio/itemStudio.js';
import { weightSentence, weightExample } from '../tools/score-studio/weightExamples.js';
import { readStudioConfig, saveStudioItemArtLayers } from '../tools/score-studio-save.mjs';

test('CP module scores inherent weapon poise damage, armour poise bonuses, and gear-vocabulary mods cleanly', () => {
  assert.deepEqual(ValidateScoringConfig(scoring), []);
  // Weapon poise damage above baseline (1) adds weighted CP; weapon weight/poiseThreshold is NOT scored as poise.
  const dagger = ScoreItem({ kind: 'weapon', id: 'd', rarity: 'common', poiseDamage: 1, poise: 3, typeMods: [], mods: [] }, scoring);
  const hammer = ScoreItem({ kind: 'weapon', id: 'h', rarity: 'common', poiseDamage: 3, poise: 9, typeMods: [], mods: [] }, scoring);
  assert.equal(dagger.parts['Weapon Poise'], undefined);
  assert.equal(dagger.parts['Poise threshold'], undefined);
  assert.equal(hammer.parts['Weapon Poise'], 2);
  assert.equal(hammer.parts['Poise threshold'], undefined, 'weapon poiseThreshold is weight, never Poise');

  // Armour poise threshold and self.statPoise BOTH contribute weighted Poise CP.
  const plate = ScoreItem({ kind: 'armour', id: 'p', rarity: 'common', poise: 6, typeMods: [['self.statPoise', 2]], mods: [] }, scoring);
  assert.equal(plate.parts['Poise threshold'], 3);
  assert.equal(plate.parts['Poise bonus'], 4);

  // Gear-vocabulary mods resolve through scoring.items.gearFields with selector & condition factors.
  assert.equal(ModLabel('smash.hitBurn', scoring), 'Burn on hit');
  assert.ok(ModValue('smash.hitBurn', 1, scoring) > 0 && ModValue('smash.hitBurn', 1, scoring) < ModValue('anyAttack.hitBurn', 1, scoring));
  assert.ok(ModValue('spell@stance:prepared.cardMana', -1, scoring) > 0, 'negative mana cost is a positive benefit');
});

test('relic scoring treats owner-targeted buffs as positive and divides everyNthCardThisCombat triggers', () => {
  const ownerBuff = PropertyValue({ triggers: [{ on: 'combatStart', do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 1 }] }] }, scoring);
  assert.equal(ownerBuff, 15, 'owner-targeted Strength is positive');
  const every12 = PropertyValue({ triggers: [{ on: 'cardPlayed', everyNth: 12, cond: true, do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 1 }] }] }, scoring);
  assert.ok(every12 > 10 && every12 < 12, `every-12th-card Strength scores ~11.25 over 9 plays, got ${every12}`);
  assert.ok(itemCombatPower['relic:sentinelsOath'].raw > 0, 'Sentinel Oath is positive, no longer -94');
  assert.ok(itemCombatPower['relic:titansCinder'].cp <= 12, 'Titan Cinder is toned down from 40 CP');
  assert.ok(itemCombatPower['relic:watchmansBadge'].cp <= 10, 'Watchman Badge is toned down from 26 CP');
  assert.ok(itemCombatPower['relic:travelersWhetstone'].cp <= 10, 'Traveler Whetstone is toned down');
});

test('reworked weapons, armours, and relics stay within lean CP bands', () => {
  const weapons = Object.entries(itemCombatPower).filter(([k]) => k.startsWith('weapon:'));
  const armours = Object.entries(itemCombatPower).filter(([k]) => k.startsWith('armour:'));
  const relics = Object.entries(itemCombatPower).filter(([k]) => k.startsWith('relic:'));
  assert.equal(weapons.length, 61);
  assert.equal(armours.length, 40);
  assert.equal(relics.length, 80);

  for (const [k, row] of weapons) assert.ok(row.rank <= 6, `${k} should be <= Rank 6 (got R${row.rank}, CP ${row.cp})`);
  for (const [k, row] of armours) assert.ok(row.rank <= 7, `${k} should be <= Rank 7 (got R${row.rank}, CP ${row.cp})`);
  for (const [k, row] of relics) assert.ok(row.rank <= 5, `${k} should be <= Rank 5 (got R${row.rank}, CP ${row.cp})`);
});

test('ItemNameParts follows card naming conventions (rarity, trait, element, base, rank, upgrade, 24-char limit)', () => {
  const sword = ItemNameParts({
    kind: 'weapon', id: 'flamberge', name: 'Flamberge', rarity: 'rare', gearType: 'sword',
    poiseDamage: 2, typeMods: [['attack.cardDamage', 1]], mods: [['sweep.hitBurn', 1]], tags: ['damage:slashing'],
  }, 1, scoring);
  assert.equal(sword.base, 'Sword');
  assert.equal(sword.rarityWord, 'Greater');
  assert.ok(sword.name.endsWith('+'), `upgrade mark attached: ${sword.name}`);
  assert.ok(sword.name.length <= 24, `name within 24-char limit: ${sword.name}`);

  const plate = ItemNameParts({
    kind: 'armour', id: 'oathsworn', name: 'Gilded Oathsworn', rarity: 'uncommon', gearGroup: 'heavy',
    poise: 6, typeMods: [['self.statPoise', 2]], mods: [['self.statPoise', 1]],
  }, 0, scoring);
  assert.equal(plate.base, 'Plate');
  assert.equal(plate.effect, 'Steadfast');
  assert.match(plate.name, /Steadfast Plate [IVX]+$/);
});

test('layered art differentiates similar weapons, armours, and relics', () => {
  const reg = createRegistries(contentBundle);
  const byId = (arr, id) => arr.find((x) => x.id === id);

  const straight = ItemArtComposition(byId(contentBundle.equipment.armaments, 'straightSword'), { kind: 'weapon', registries: reg });
  const broad = ItemArtComposition(byId(contentBundle.equipment.armaments, 'broadsword'), { kind: 'weapon', registries: reg });
  const flamberge = ItemArtComposition(byId(contentBundle.equipment.armaments, 'flamberge'), { kind: 'weapon', registries: reg });
  assert.notEqual(JSON.stringify(straight.overlays.map((l) => l.id)), JSON.stringify(broad.overlays.map((l) => l.id)));
  assert.notEqual(JSON.stringify(broad.overlays.map((l) => l.id)), JSON.stringify(flamberge.overlays.map((l) => l.id)));
  assert.ok(flamberge.overlays.some((l) => l.id === 'fire-burn-glow'));
  assert.ok(ItemArtLayersParts(flamberge).under.includes('data-item-art-layers="under"'));
  assert.ok(ItemArtLayersParts(flamberge).over.includes('data-item-art-layers="over"'));

  const plate = ItemArtComposition(contentBundle.equipment.armour.find((a) => a.classId === 'reaver' && a.id === 'cinderforgedPlate'), { kind: 'armour', registries: reg });
  const rime = ItemArtComposition(contentBundle.equipment.armour.find((a) => a.classId === 'starseer' && a.id === 'rimeweave'), { kind: 'armour', registries: reg });
  assert.ok(plate.overlays.some((l) => l.id === 'armour-poise-crest'));
  assert.ok(plate.overlays.some((l) => l.id === 'fire-burn-glow'));
  assert.ok(rime.overlays.some((l) => l.id === 'frost-glow'));

  const coin = ItemArtComposition(byId(contentBundle.relics, 'cutpursesCoin'), { kind: 'relic', registries: reg });
  const sprout = ItemArtComposition(byId(contentBundle.relics, 'goldenSprout'), { kind: 'relic', registries: reg });
  assert.notEqual(JSON.stringify(coin.overlays.map((l) => l.id)), JSON.stringify(sprout.overlays.map((l) => l.id)));
});

test('Score Studio item roster, weight examples, and itemArtLayers persistence work end-to-end', () => {
  const { items, rules } = buildItemRoster(contentBundle);
  assert.equal(items.length, 181);
  const maul = items.find((x) => x.key === 'weapon:maul');
  assert.ok(maul && maul.poiseDamage === 4);
  const scored = scoreItemEntry(maul, scoring, rules);
  assert.equal(scored.rank, itemCombatPower['weapon:maul'].rank);
  assert.equal(livePieceFromEntry(maul).poiseDamage, 4);

  assert.match(weightSentence('items', 'weaponPoiseDamage.perPoint', scoring).mid, /Poise dmg/);
  assert.match(weightExample('items', 'weaponPoiseDamage.perPoint', scoring), /Hammer/);
  assert.match(weightExample('gearFields', 'statPoise', scoring), /Poise bonus/);

  const tmp = mkdtempSync(join(tmpdir(), 'ashenspire-item-layers-'));
  try {
    mkdirSync(join(tmp, 'content', 'source'), { recursive: true });
    writeFileSync(join(tmp, 'content', 'source', 'scoring.json'), JSON.stringify(scoring));
    const saved = saveStudioItemArtLayers(tmp, { path: 'content/source/customItemLayers.json', itemArtLayers, rebuild: false });
    assert.equal(saved.layerCount, itemArtLayers.layers.length);
    const loaded = readStudioConfig(tmp, { itemArtLayersPath: 'content/source/customItemLayers.json' });
    assert.equal(loaded.itemArtLayersExists, true);
    assert.equal(loaded.itemArtLayers.layers.length, itemArtLayers.layers.length);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
