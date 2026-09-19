import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece, stampDeck } from '../src/model/loadout.js';
import { itemUpgradeRows, resolveUpgradedEquipment } from '../src/model/itemUpgrades.js';
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
  const attack = refs.find(c => c.kitRole === 'attack');
  const before = resolveCard(r, attack).effects.find(e => e.op === 'damage').amount;
  run.itemUpgradeLevels = { [`armament/${id}`]: 1 };
  stampDeck(r, run);
  const after = resolveCard(r, run.deck.find(c => c.instanceId === attack.instanceId)).effects.find(e => e.op === 'damage').amount;
  assert.ok(after > before, `${id}: smithing reaches generated attack`);
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
