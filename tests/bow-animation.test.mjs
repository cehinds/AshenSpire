import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { selectEquipmentAnimation, equipmentAnimationForLoadout, animationClip } from '../src/model/equipmentAnimation.js';

const registries = createRegistries(contentBundle);
const bow = registries.equipment.armaments.find(item => item.id === 'shortbow');
const frames = Array.from({ length: 7 }, (_, index) => `BOW-${String(index + 1).padStart(2, '0')}`);

test('bow set covers every armor appearance and either hand', () => {
  for (const outfit of contentBundle.equipment.armour) {
    for (const [rightId, leftId] of [['shortbow', null], [null, 'shortbow']]) {
      const component = selectEquipmentAnimation({ classId: outfit.classId, armourId: outfit.id, rightId, leftId });
      assert.ok(component, `${outfit.classId}/${outfit.id}: bow binding`);
      assert.equal(component.motionProfile, 'bow');
      assert.deepEqual(animationClip(component, 'bowAttack').frames, frames);
      assert.notDeepEqual(animationClip(component, 'attack').frames, frames, 'other attacks keep their physical motion');
      assert.equal(animationClip(component, 'cast').frames.length, 9, 'magic remains a separate sequence');
      for (const name of frames) assert.ok(existsSync(new URL(`../${component.frames[name].file}`, import.meta.url)), component.frames[name].file);
    }
  }
});

test('Bow Attack fires the bow clip; other ranged cards and spells keep their own motion', () => {
  const run = createRunState({ seed: 21, classId: 'rogue', registries });
  run.loadout.active.rightHand = 0;
  run.loadout.active.leftHand = 0;
  run.loadout.sets.rightHand[0] = 'shortbow';
  run.loadout.sets.leftHand[0] = 'parryDagger';
  const component = equipmentAnimationForLoadout(registries, run.loadout, 'rogue');
  assert.ok(animationClip(component, 'bowAttack'), 'bow attack is available with an offhand weapon');
  const shot = resolveCard(registries, { cardId: 'strike', profileId: 'bowPierceAttack' });
  const tags = shot.cardTags;
  assert.ok(tags.includes('bow'), 'the profile has an explicit Bow tag');
  assert.equal(resolveCombatAnimation({ ...shot, cardTags: tags, sourceArmamentId: 'shortbow' }, [bow], { animation: component }).technique, 'bowAttack');
  const offhand = resolveCombatAnimation({ ...shot, cardTags: tags, sourceArmamentId: 'parryDagger' }, [bow], { animation: component });
  assert.equal(offhand.technique, 'attack');
  assert.notDeepEqual(animationClip(component, offhand.technique).frames, frames);
  assert.equal(resolveCombatAnimation({ kindIds: ['classification.attack'], tags: ['ranged'] }, [bow], { animation: component }).technique, 'attack');
  assert.equal(resolveCombatAnimation({ kindIds: ['classification.attack'], tags: ['bow', 'source:spell'] }, [bow], { animation: component }).technique, 'cast');
});
