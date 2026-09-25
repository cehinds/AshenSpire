import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mergeUnarmedAnimationFragment as merge, validateUnarmedFragmentCoverage } from '../tools/unarmed-animation-import.mjs';
import { EQUIPMENT_ANIMATIONS, validateEquipmentAnimations, selectEquipmentAnimation, animationClip, animationTiming } from '../src/model/equipmentAnimation.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const magic = read('../art/unarmed-magic-2026-09-19/runtime-fragment.json');
const physical = read('../art/unarmed-reference-2026-09-19/runtime-fragment.json');
const base = structuredClone(EQUIPMENT_ANIMATIONS);
delete base.motionProfiles.unarmed;
base.bindings = base.bindings.filter(b => !(b.rightGroup === 'empty' && b.leftGroup === 'empty'));
for (const [id, set] of Object.entries(base.sets)) if (set.motionProfile === 'unarmed') delete base.sets[id];

test('actual complete magic and physical packs compose in both orders and preserve other profiles', () => {
  validateUnarmedFragmentCoverage(magic, fileURLToPath(new URL('../', import.meta.url)));
  const both = merge(merge(base, physical), magic);
  assert.deepEqual(both, merge(merge(base, magic), physical));
  assert.deepEqual(both, merge(merge(both, physical), magic));
  assert.equal(validateEquipmentAnimations(both), true);
  for (const [id, profile] of Object.entries(base.motionProfiles)) assert.deepEqual(both.motionProfiles[id], profile);
  for (const [id, set] of Object.entries(base.sets)) assert.deepEqual(both.sets[id], set);
  assert.deepEqual(both.weaponGroups, base.weaponGroups);
  assert.deepEqual(both.bindings.filter(b => b.rightGroup !== 'empty' || b.leftGroup !== 'empty'), base.bindings);
});

test('shipped defaults select magic cast and buff for every armor while physical owns ordinary actions', () => {
  assert.equal(magic.bindings.length, 35);
  assert.equal(Object.keys(magic.sets).length, 32);
  for (const binding of magic.bindings) {
    const animation = selectEquipmentAnimation({ classId: binding.classId, armourId: binding.armourId });
    assert.equal(animation.setId, binding.setId);
    assert.deepEqual(animationClip(animation, 'cast'), magic.clips.magicChannel);
    assert.deepEqual(animationClip(animation, 'power'), magic.clips.magicBuff);
    assert.deepEqual(animationClip(animation, 'attack'), physical.clips.physicalAttack);
    assert.deepEqual(animationTiming(animation, 'cast'), { totalMs: 540, impactMs: 240 });
    for (const [role, clip] of Object.entries(physical.references)) assert.equal(animation.references[role], clip);
    for (const [id, clip] of Object.entries(magic.clips)) {
      assert.deepEqual(animation.clips[id], clip, `${binding.setId}/${id} remains configurable`);
      for (const pose of clip.frames) assert.deepEqual(animation.frames[pose], magic.sets[binding.setId].frames[pose]);
    }
  }
});
