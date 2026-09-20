import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { EQUIPMENT_ANIMATIONS, selectEquipmentAnimation, equipmentAnimationForLoadout, validateEquipmentAnimations, animationClip, animationView } from '../src/model/equipmentAnimation.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { gripOf } from '../src/model/loadout.js';

const pack = new URL('../art/twin-sword-reference-2026-09-19/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', pack), 'utf8'));
const attack = JSON.parse(readFileSync(new URL('attack-sequence.json', pack), 'utf8'));
assert.equal(manifest.groups.length, 32);
assert.deepEqual(manifest.coverage.missingAppearances, []);
const registries = createRegistries(contentBundle);
const rows = contentBundle.equipment.armour;
assert.equal(rows.length, 35);
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
  for (const frame of Object.values(animation.frames)) assert.ok(existsSync(new URL('../' + frame.file, import.meta.url)));
  const loadout = createRunState({ seed: 896, classId: row.classId, registries }).loadout;
  loadout.sets.armor[loadout.active.armor || 0] = row.id;
  for (const [slot, id] of [['rightHand', 'straightSword'], ['leftHand', 'katana']]) loadout.sets[slot][loadout.active[slot] || 0] = id;
  assert.equal(gripOf(registries, loadout, row.classId).mode, 'dual');
  assert.equal(equipmentAnimationForLoadout(registries, loadout, row.classId).setId, animation.setId);
  for (const [rightId, leftId] of [['katana', 'straightSword'], ['straightSword', 'straightSword'], ['katana', 'katana'], ['straightSword', null]]) {
    for (const [slot, id] of [['rightHand', rightId], ['leftHand', leftId]]) loadout.sets[slot][loadout.active[slot] || 0] = id;
    assert.equal(equipmentAnimationForLoadout(registries, loadout, row.classId), null, `${row.classId}/${row.id}: unauthored order retains fallback`);
  }
}
assert.equal(selectedSets.size, 32, 'only catalog-authorized aliases reuse paintings');
for (const [classId, alias, original] of [['reaver', 'bastion', 'warden'], ['starseer', 'rimeweave', 'starlit'], ['rogue', 'waywatcher', 'nightveil']]) {
  const input = { classId, rightId: 'straightSword', leftId: 'katana', grip: 'dual' };
  assert.equal(selectEquipmentAnimation({ ...input, armourId: alias }).setId, selectEquipmentAnimation({ ...input, armourId: original }).setId);
}
const changed = structuredClone(EQUIPMENT_ANIMATIONS);
changed.motionProfiles.twinSword.clips.twinSwordAttack.frameMs = 200;
for (const row of rows) assert.equal(animationClip(selectEquipmentAnimation({ classId: row.classId, armourId: row.id, rightId: 'straightSword', leftId: 'katana', grip: 'dual' }, changed), 'attack').frameMs, 200);
for (const invalid of [{ right: [], left: ['katana'] }, { right: ['missing'], left: ['katana'] }, { right: ['straightSword'], left: null }, { right: ['straightSword', 'straightSword'], left: ['katana'] }]) {
  const bad = structuredClone(EQUIPMENT_ANIMATIONS); bad.motionProfiles.twinSword.supportedHandItems = invalid;
  assert.throws(() => validateEquipmentAnimations(bad), /invalid supported hand items/);
}
assert.equal(validateEquipmentAnimations(EQUIPMENT_ANIMATIONS), true);
console.log('PASS twin-sword: 35 armor entries, 32 appearances, 16 poses, shared timing, actual ordered loadouts, explicit fallback and validation.');
