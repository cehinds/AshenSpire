import test from 'node:test';
import assert from 'node:assert/strict';
import { manifestIds } from '../tools/art-source.mjs';
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
// Raw shared-armour signatures used before the equipment rework. Keep coverage
// of their propagation in a fixture separate from today's empty raw mod rows.
const legacySignatures = {
  wayfarerPlate: ['defend.block=+2', 'self.maxHp=+4'],
  nightweave: ['power.potency=+1', 'self.maxMana=+1'],
  riteVestments: ['defend.block=+1', 'self.maxHp=+6'],
  gutterLeathers: ['strike.damage=+1', 'self.maxStamina=+1'],
};
const legacy = createRegistries({
  ...contentBundle,
  equipment: {
    ...contentBundle.equipment,
    armour: contentBundle.equipment.armour.map(piece => piece.sharedSet
      ? { ...piece, mods: legacySignatures[piece.id] }
      : piece),
  },
});

test('all sixteen class/outfit combinations have distinct complete sprite sets', () => {
  const menuFiles = new Set();
  const defeatFiles = new Set();
  for (const cls of r.classes.ids()) for (const id of ids) {
    const art = paintedOutfit(cls, id);
    menuFiles.add(art.menu.stand);
    defeatFiles.add(art.defeated.file);
    for (const pose of ['idle', 'guard', 'attack1', 'attack2', 'attack3', 'attack4', 'power1', 'power2', 'power3', 'hit', 'prepared', 'starstoneCharge', 'bloodRite', 'shieldGuard3', 'parry3', 'shieldBash3']) {
      const frame = art.frames[pose];
      assert.ok(frame, `${cls}/${id} has ${pose}`);
      assert.match(frame.file, new RegExp(`shared-${cls}-${id}/`));
      assert.ok(frame.box.x0 >= 0 && frame.box.y0 >= 0 && frame.box.x1 < 640 && frame.box.y1 === 599);
    }
  }
  assert.equal(menuFiles.size, 16);
  assert.equal(defeatFiles.size, 16);
});

test('shared armor validates and preserves existing creation choices', () => {
  assert.equal(validateContent(contentBundle).ok, true);
  assert.deepEqual(validateEquipment(r), []);
  for (const cls of r.classes.ids()) {
    assert.equal(r.equipment.armour.filter(p => p.classId === cls && p.sharedSet).length, 4);
    assert.ok(startingArmourViews(r, cls).every(p => !ids.includes(p.id)));
  }
});

for (const cls of r.classes.ids()) for (const id of ids) test(`${cls} can equip purchased ${id} only when its requirement is met`, () => {
  const run = createRunState({ seed: 31, classId: cls, registries: r });
  const piece = r.equipment.armour.find(p => p.classId === cls && p.id === id);
  const [attribute, minimum] = Object.entries(piece.requirements.attributes)[0];
  assert.equal(ownership(r, { loadout: run.loadout }).has(piece), false, 'shared armour requires acquisition');
  run.loadout.boughtArmour = [{ classId: cls, id }];
  const owned = ownership(r, { loadout: run.loadout });
  assert.ok(owned.has(piece), 'purchased armour belongs to this run');
  const ctx = { inCombat: false, classId: cls, attributes: { ...run.attributes, [attribute]: minimum - 1 } };
  const before = structuredClone(run.loadout);
  assert.equal(equipPiece(r, run.loadout, 'armor', 0, id, owned, ctx), false);
  assert.deepEqual(run.loadout, before, 'rejection cannot mutate equipment');
  ctx.attributes[attribute] = minimum;
  assert.ok(equipmentRequirementReceipt(r, piece, ctx.attributes).ok);
  assert.ok(equipPiece(r, run.loadout, 'armor', 0, id, owned, ctx));
  assert.ok(equippedPieces(r, run.loadout, cls).some(p => p.id === id && p.classId === cls));
  assert.equal(run.class, cls, 'wearing a set does not change gameplay class');
  assert.deepEqual(piece.mods, [], 'the current shared outfit has no raw signature');
  const card = equipmentCardModel(r, piece);
  assert.match(card.type, /All classes/);
  // SPEC §13.4m (lean scale, 2026-09-20): every outfit minimum rebased to 3 on the 1–4 scale.
  assert.equal(minimum, 3);
  assert.match(card.requirement, new RegExp(`\\b${minimum}\\b`));
  assert.deepEqual(card.bonuses, []);
  assert.equal(card.facts.find(f => f.label === 'Block').value, 0);
  assert.equal(card.tags.length, 2);
  assert.ok(manifestIds().has(armourMenuAsset(cls, id)));
  const visual = paintedOutfit(cls, id);
  assert.equal(armourArtClass(cls, id), cls, 'outfit preserves wearer identity');
  assert.equal(visual.classId, cls);
  assert.equal(visual.outfitId, id);
  assert.notEqual(visual, paintedOutfit(cls, 'default'));
  assert.ok(manifestIds().has(visual.defeated.file));
  assert.deepEqual(visual.readiness, {}, 'no fallback to another costume for readiness');
  assert.equal(new Set(Object.values(visual.frames).map(f => f.file)).size, 7);
  for (const frame of Object.values(visual.frames)) assert.ok(manifestIds().has(frame.file), frame.file);
});

for (const cls of legacy.classes.ids()) for (const id of ids) test(`${cls} applies explicit legacy ${id} signatures to its deck and resource maximum`, () => {
  const run = createRunState({ seed: 31, classId: cls, registries: legacy });
  run.loadout.boughtArmour = [{ classId: cls, id }];
  const owned = ownership(legacy, { loadout: run.loadout });
  const [attribute, minimum] = Object.entries(legacy.equipment.armour.find(p => p.classId === cls && p.id === id).requirements.attributes)[0];
  const context = { inCombat: false, classId: cls, attributes: { ...run.attributes, [attribute]: minimum } };
  assert.ok(equipPiece(legacy, run.loadout, 'armor', 0, id, owned, context));
  const [authoredCardMod, rawPool] = legacySignatures[id];
  const [, pool, delta] = rawPool.split(/[.=]/);
  const before = run[pool];
  const cardRules = cardMods(legacy, run.loadout, cls);
  const [target, bonus] = authoredCardMod.split('.');
  assert.ok([...cardRules.values()].flat().includes(bonus));
  assert.equal(runMods(legacy, run.loadout, cls)[pool], Number(delta));
  stampDeck(legacy, run, undefined, { adoptEquipmentBonuses: true });
  assert.equal(run[pool], before + Number(delta));
  const cardId = (legacy.equipment.targets.find(row => row.target === target && row.classId === cls)
    || legacy.equipment.targets.find(row => row.target === target && row.classId === '*')).cardId;
  const affected = run.deck.filter(card => card.cardId === cardId);
  assert.ok(affected.length);
  for (const card of affected) {
    assert.ok(card.mods.includes(bonus));
    assert.ok(resolveCard(legacy, card).effects.length);
  }
});
