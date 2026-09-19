import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece, ownership, equipmentRequirementReceipt, equippedPieces, cardMods, runMods, validateEquipment, stampDeck } from '../src/model/loadout.js';
import { startingArmourViews } from '../src/model/startingKits.js';
import { armourMenuAsset, paintedOutfit, armourArtClass } from '../src/model/paintedOutfitArt.js';
import { equipmentCardModel } from '../src/model/equipmentCard.js';
import { validateContent } from '../src/model/validate.js';
const r = createRegistries(contentBundle);
const ids = ['wayfarerPlate', 'nightweave', 'riteVestments', 'gutterLeathers'];

test('shared armor validates and preserves existing creation choices', () => {
  assert.equal(validateContent(contentBundle).ok, true);
  assert.deepEqual(validateEquipment(r), []);
  for (const cls of r.classes.ids()) {
    assert.equal(r.equipment.armour.filter(p => p.classId === cls && p.sharedSet).length, 4);
    assert.ok(startingArmourViews(r, cls).every(p => !ids.includes(p.id)));
  }
});

for (const cls of r.classes.ids()) for (const id of ids) test(`${cls} can equip ${id} only when its requirement is met`, () => {
  const run = createRunState({ seed: 31, classId: cls, registries: r });
  const piece = r.equipment.armour.find(p => p.classId === cls && p.id === id);
  const [attribute, minimum] = Object.entries(piece.requirements.attributes)[0];
  const owned = ownership(r, { loadout: run.loadout });
  assert.ok(owned.has(piece), 'available in Armoury without profile unlock');
  const ctx = { inCombat: false, classId: cls, attributes: { ...run.attributes, [attribute]: minimum - 1 } };
  const before = structuredClone(run.loadout);
  const beforePools = { maxHp: run.maxHp, maxMana: run.maxMana, maxStamina: run.maxStamina };
  assert.equal(equipPiece(r, run.loadout, 'armor', 0, id, owned, ctx), false);
  assert.deepEqual(run.loadout, before, 'rejection cannot mutate equipment');
  ctx.attributes[attribute] = minimum;
  assert.ok(equipmentRequirementReceipt(r, piece, ctx.attributes).ok);
  assert.ok(equipPiece(r, run.loadout, 'armor', 0, id, owned, ctx));
  assert.ok(equippedPieces(r, run.loadout, cls).some(p => p.id === id && p.classId === cls));
  assert.equal(run.class, cls, 'wearing a set does not change gameplay class');
  const mods = cardMods(r, run.loadout, cls);
  const authoredCardMod = piece.mods.find(m => !m.startsWith('self.'));
  assert.ok([...mods.values()].flat().includes(authoredCardMod.split('.').slice(1).join('.')));
  const pool = piece.mods.find(m => m.startsWith('self.')).split(/[.=]/);
  assert.equal(runMods(r, run.loadout, cls)[pool[1]], Number(pool[2]));
  stampDeck(r, run, undefined, { adoptEquipmentBonuses: true });
  assert.equal(run[pool[1]], beforePools[pool[1]] + Number(pool[2]), 'the actual resource maximum changes');
  const target = authoredCardMod.split('.')[0];
  const cardId = (r.equipment.targets.find(t => t.target === target && t.classId === cls)
    || r.equipment.targets.find(t => t.target === target && t.classId === '*')).cardId;
  const affected = run.deck.filter(c => c.cardId === cardId);
  assert.ok(affected.length, 'bonus reaches a card in the real starting deck');
  for (const card of affected) {
    assert.ok(card.mods.includes(authoredCardMod.slice(target.length + 1)));
    assert.ok(resolveCard(r, card).effects.length);
  }
  const card = equipmentCardModel(r, piece);
  assert.match(card.type, /All classes/);
  assert.match(card.requirement, /12/);
  assert.equal(card.bonuses.length, 2);
  assert.equal(card.tags.length, 2);
  assert.ok(existsSync(armourMenuAsset(cls, id)));
  const visual = paintedOutfit(cls, id);
  assert.equal(visual, paintedOutfit(armourArtClass(cls, id), 'default'));
  for (const frame of Object.values(visual.frames)) assert.ok(existsSync(frame.file));
});
