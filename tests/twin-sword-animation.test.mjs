import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { manifestIds } from '../tools/art-source.mjs';
import { EQUIPMENT_ANIMATIONS, selectEquipmentAnimation, equipmentAnimationForLoadout, validateEquipmentAnimations, animationClip, animationView } from '../src/model/equipmentAnimation.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { gripOf } from '../src/model/loadout.js';
import { fileURLToPath } from 'node:url';

// The art studio's export files, kept as fixtures when art/ left for
// cehinds/AshenSpire-art (docs/EXTERNAL-ASSETS-PLAN.md step 13); a frame ships
// when art-manifest.json lists it.
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/art-exports/twin-sword-reference-2026-09-19/manifest.json', import.meta.url)), 'utf8'));
const attack = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/art-exports/twin-sword-reference-2026-09-19/attack-sequence.json', import.meta.url)), 'utf8'));
assert.equal(manifest.groups.length, 32);
assert.deepEqual(manifest.coverage.missingAppearances, []);
const registries = createRegistries(contentBundle);
const rows = contentBundle.equipment.armour;
// Preserve the export's 32 skins and three original aliases; Codex adds no paintings.
const codexAppearanceAliases = [
  ['reaver', 'cinderforgedPlate', 'warden'],
  ['reaver', 'wyrmscaleMail', 'vigil'],
  ['herald', 'ringmailHauberk', 'pilgrim'],
  ['rogue', 'huntersHide', 'nightveil'],
  ['starseer', 'sagesRobe', 'astral'],
];
const outfitKey = row => `${row.classId}/${row.id}`;
const originalAliases = [['reaver', 'bastion', 'warden'], ['starseer', 'rimeweave', 'starlit'], ['rogue', 'waywatcher', 'nightveil']];
const exportedOutfits = new Set([...manifest.groups.map(row => outfitKey({classId:row.classId,id:row.armourId})), ...originalAliases.map(([classId,id]) => outfitKey({classId,id}))]);
assert.equal(manifest.coverage.catalogEntries, 35);
assert.equal(exportedOutfits.size,manifest.coverage.catalogEntries);
assert.deepEqual(rows.filter(row => exportedOutfits.has(outfitKey(row))).map(outfitKey).sort(), [...exportedOutfits].sort(), 'every historical export outfit remains covered');
assert.deepEqual(rows.filter(row => !exportedOutfits.has(outfitKey(row))).map(row => [row.classId,row.id,row.artKey]).sort(), [...codexAppearanceAliases].sort(), 'only the five declared Codex appearance aliases extend the export');
assert.equal(rows.length,manifest.coverage.catalogEntries+codexAppearanceAliases.length);
const selectedSets = new Set();
for (const row of rows) {
  const input = { classId: row.classId, armourId: row.id, rightId: 'straightSword', leftId: 'katana', grip: 'dual' };
  const animation = selectEquipmentAnimation(input);
  assert.ok(animation, `${row.classId}/${row.id} selects twin swords`);
  selectedSets.add(animation.setId);
  assert.equal(animation.motionProfile, 'twinSword');
  assert.deepEqual(animationClip(animation, 'attack').frames, attack.frames);
  assert.equal(animationClip(animation, 'attack').frameMs, attack.frameMs);
  assert.equal(animationClip(animation, 'attack').impactIndex, attack.impactIndex);
  assert.equal(Object.hasOwn(EQUIPMENT_ANIMATIONS.sets[animation.setId], 'clips'), false, 'outfits share one choreography');
  assert.deepEqual(animation.supportedHandItems, { right: ['straightSword'], left: ['katana'] });
  assert.match(animationView(animation, 'conversation'), /CONVERSATION.webp$/);
  assert.match(animationView(animation, 'portrait'), /PORTRAIT.webp$/);
  assert.deepEqual(Object.keys(animation.frames), manifest.poses);
  for (const frame of Object.values(animation.frames)) assert.ok(manifestIds().has(frame.file), frame.file);
  const loadout = createRunState({ seed: 896, classId: row.classId, registries }).loadout;
  loadout.sets.armor[loadout.active.armor || 0] = row.id;
  for (const [slot, id] of [['rightHand', 'straightSword'], ['leftHand', 'katana']]) loadout.sets[slot][loadout.active[slot] || 0] = id;
  assert.equal(gripOf(registries, loadout, row.classId).mode, 'dual');
  assert.equal(equipmentAnimationForLoadout(registries, loadout, row.classId).setId, animation.setId);
  for (const [rightId, leftId] of [['katana', 'straightSword'], ['straightSword', 'straightSword'], ['katana', 'katana'], ['straightSword', null]]) {
    for (const [slot, id] of [['rightHand', rightId], ['leftHand', leftId]]) loadout.sets[slot][loadout.active[slot] || 0] = id;
    const borrowed = equipmentAnimationForLoadout(registries, loadout, row.classId);
    assert.ok(borrowed, `${row.classId}/${row.id}: Blade can borrow a sword motion`);
    assert.deepEqual(animationClip(borrowed, 'bladeAttack').frames.length, rightId && leftId ? attack.frames.length : 9);
  }
}
assert.equal(selectedSets.size, 32, 'only catalog-authorized aliases reuse paintings');
for (const [classId, alias, original] of [...originalAliases, ...codexAppearanceAliases]) {
  const input = { classId, rightId: 'straightSword', leftId: 'katana', grip: 'dual' };
  const borrowed = selectEquipmentAnimation({ ...input, armourId: alias });
  const authored = selectEquipmentAnimation({ ...input, armourId: original });
  assert.equal(borrowed.setId, authored.setId, alias + ' borrows its declared appearance');
  assert.deepEqual(borrowed.frames, authored.frames, alias + ' reuses existing exported frames');
}
const changed = structuredClone(EQUIPMENT_ANIMATIONS);
changed.motionProfiles.twinSword.clips.twinSwordAttack.frameMs = 200;
for (const row of rows) assert.equal(animationClip(selectEquipmentAnimation({ classId: row.classId, armourId: row.id, rightId: 'straightSword', leftId: 'katana', grip: 'dual' }, changed), 'attack').frameMs, 200);
for (const invalid of [{ right: [], left: ['katana'] }, { right: ['missing'], left: ['katana'] }, { right: ['straightSword'], left: null }, { right: ['straightSword', 'straightSword'], left: ['katana'] }]) {
  const bad = structuredClone(EQUIPMENT_ANIMATIONS); bad.motionProfiles.twinSword.supportedHandItems = invalid;
  assert.throws(() => validateEquipmentAnimations(bad), /invalid supported hand items/);
}
assert.equal(validateEquipmentAnimations(EQUIPMENT_ANIMATIONS), true);
console.log('PASS twin-sword: 35 exported outfits plus 5 Codex borrowers, 32 appearances, 16 poses, shared timing, all 40 actual ordered loadouts, explicit fallback and validation.');
