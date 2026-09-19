import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece, stampDeck } from '../src/model/loadout.js';
import { itemUpgradeRows, parseItemUpgradeTag, resolveUpgradedEquipment } from '../src/model/itemUpgrades.js';
import { armourMenuAsset, armourArtKey } from '../src/model/paintedOutfitArt.js';
const r = createRegistries(contentBundle);
const owns = { has: () => true };
for (const [id, art, status] of [['frostSpear', 'rimeThrust', 'frost'], ['cinderAxe', 'kilnCleave', 'burn'], ['duskChime', 'vesperWard', 'regen']]) {
  const piece = r.equipment.armaments.find(p => p.id === id);
  assert.ok(piece.dropWeight > 0 && !piece.unlock, `${id}: ordinary weighted discovery`);
  assert.ok(existsSync(`assets/equipment/icon_${piece.inventoryArtKey}.webp`));
  assert.ok(existsSync(`assets/equipment/weapon_${piece.artKey}.webp`));
  const run = createRunState({ seed: 17, classId: 'reaver', registries: r });
  assert.ok(equipPiece(r, run.loadout, 'rightHand', 0, id, owns, { inCombat: false, attributes: run.attributes }));
  stampDeck(r, run);
  const refs = run.deck.filter(c => c.grantedBy === id);
  assert.equal(refs.length, 3);
  const ref = refs.find(c => c.cardId === art);
  assert.ok(resolveCard(r, ref).effects.some(e => e.status === status));
  assert.ok(resolveCard(r, { ...ref, upgraded: true }).effects.some(e => e.status === status));
  assert.ok(itemUpgradeRows(r, `armament/${id}`, 1).length > 1);
  // Every advertised card-effect upgrade must reach a real item-lent card.
  // In particular, the signature Art is not a legacy technique-role card.
  const upgradeTargets = itemUpgradeRows(r, `armament/${id}`, 1)
    .filter(row => row.tag.startsWith('card:'))
    .map(row => {
      const descriptor = parseItemUpgradeTag(row.tag);
      assert.equal(descriptor?.kind, 'cardEffect', `${id}: supported authored card upgrade`);
      const targets = refs.filter(card => (card.kitRole || card.equipmentRole) === descriptor.role);
      assert.ok(targets.length, `${id}: ${row.tag} reaches a granted role`);
      return targets.map(card => {
        const effects = resolveCard(r, card).effects.filter(effect => effect.op === descriptor.op);
        assert.equal(effects.length, 1, `${id}: ${row.tag} reaches one effect`);
        return { instanceId: card.instanceId, op: descriptor.op, before: effects[0].amount, delta: row.value };
      });
    }).flat();
  const attack = refs.find(c => c.kitRole === 'attack');
  const before = resolveCard(r, attack).effects.find(e => e.op === 'damage').amount;
  run.itemUpgradeLevels = { [`armament/${id}`]: 1 };
  stampDeck(r, run);
  const after = resolveCard(r, run.deck.find(c => c.instanceId === attack.instanceId)).effects.find(e => e.op === 'damage').amount;
  assert.ok(after > before, `${id}: smithing reaches generated attack`);
  for (const target of upgradeTargets) {
    const card = run.deck.find(card => card.instanceId === target.instanceId);
    const effect = resolveCard(r, card).effects.find(effect => effect.op === target.op);
    assert.equal(effect.amount, target.before + target.delta, `${id}: smithing applies the exact ${target.op} delta`);
  }
}
for (const [classId, id, alias] of [['reaver', 'bastion', 'warden'], ['starseer', 'rimeweave', 'starlit'], ['rogue', 'waywatcher', 'nightveil']]) {
  const piece = r.equipment.armour.find(p => p.classId === classId && p.id === id);
  assert.ok(piece.unlock && piece.mods.length === 2);
  const run = createRunState({ seed: 17, classId, registries: r });
  assert.ok(equipPiece(r, run.loadout, 'armor', 0, id, owns, { inCombat: false, attributes: run.attributes }));
  stampDeck(r, run);
  assert.equal(armourArtKey(classId, id), alias);
  assert.ok(existsSync(armourMenuAsset(classId, id)));
  assert.ok(existsSync(`assets/equipment/body_${classId}_${alias}.webp`));
  assert.equal(resolveUpgradedEquipment(r, `armor/${classId}/${id}`, 1).poiseThreshold, piece.poiseThreshold + 1);
}
console.log('PASS content expansion equipment: discovery weights, equip, three-card packages, status Arts, upgrades and reused art');
import { readFileSync } from 'node:fs';
import { armamentIconAsset } from '../src/model/equipmentArt.js';
import { inventoryItemCardModel } from '../src/ui/models/ArmouryModels.js';
import { mountServiceModel } from '../src/ui/models/MountServiceModel.js';
import { smithSelectionModel } from '../src/ui/models/SmithSelectionModel.js';

// Exercise the actual read models used by inventory and both smith services.
for (const id of ['frostSpear', 'cinderAxe', 'duskChime', 'straightSword', 'shortbow']) {
  const piece = r.equipment.armaments.find(p => p.id === id);
  const expected = `assets/equipment/icon_${piece.inventoryArtKey || id}.webp`;
  assert.equal(armamentIconAsset(piece), expected);
  assert.ok(existsSync(expected));
  const row = { item: piece, id, key: id, name: piece.name, category: 'Weapon', equippedLabels: [] };
  assert.equal(inventoryItemCardModel(row).properties.artAsset, expected);
  const candidate = { itemKind: 'armament', itemId: id, itemRef: `armament/${id}`, mounts: [], affectedCards: [], requirements: [] };
  for (const service of ['extract', 'install']) {
    assert.equal(mountServiceModel(r, { service, candidates: [candidate], stones: 1 }).properties.candidates[0].artAsset, expected);
  }
  assert.equal(smithSelectionModel(r, { candidates: [candidate], stones: 1 }).properties.candidates[0].artAsset, expected);
}
// Screens must share the same identity resolution rather than rebuilding a URL
// from reduced presentation facts (which intentionally do not contain aliases).
for (const [file, count] of [['src/ui/assets.js', 1], ['src/ui/screens/equipment.js', 1], ['src/ui/screens/compendium.js', 2]]) {
  const source = readFileSync(file, 'utf8');
  assert.equal(source.split('armamentIconAsset(piece)').length - 1, count, file);
  assert.ok(!source.includes('assets/equipment/icon_${'), `${file}: no bypass of authored alias`);
}
console.log('PASS inventory icon aliases: inventory, extraction, installation, smithing, equipment, compendium and shared card art');
