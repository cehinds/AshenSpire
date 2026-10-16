import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { playingCardDefinition } from '../src/model/playingCard.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { alternativeCardAnimationFamily, cardSequenceTiming } from '../src/model/cardAnimationFamily.js';
import { selectedWeaponSequence } from '../src/model/selectedWeaponSequences.js';
import { classSmashSequence } from '../src/model/classSmashAnimations.js';
import { deckCardAnimationPlan } from '../src/ui/components/deckCardAnimationPreview.js';
import { ANIM_SPEEDS } from '../src/ui/animationPace.js';
const classes = ['reaver', 'rogue', 'starseer', 'herald'];
const tags = maneuver => ({ type: 'attack', cardTags: ['camp:physical', `maneuver:${maneuver}`] });

test('each character previews the exact live selected family and timing for every base action', () => {
  const registries = createRegistries(contentBundle);
  for (const classId of classes) {
    const run = createRunState({ seed: 21, classId, registries });
    const before = structuredClone(run);
    for (const cardId of ['strike', 'bashingBlow', 'crimsonCleave', 'guardCounter', 'defend', 'dodgeRoll', 'starstonePebble', 'ricochet']) {
      const preview = deckCardAnimationPlan(registries, run, { cardId });
      const live = alternativeCardAnimationFamily(classId, preview.presentation);
      assert.deepEqual(preview.sequence, live.family.sequences[preview.plan.technique], `${classId} ${cardId}`);
      assert.equal(preview.duration, cardSequenceTiming(preview.sequence, ANIM_SPEEDS.normal).totalMs);
      assert.equal(preview.classId, classId);
      for (const pose of preview.frames.filter(pose => pose !== 'origin')) {
        const frame = live.family.frames[pose];
        assert.ok(frame, `${classId} ${cardId}: ${pose} is backed by the selected character's art`);
        assert.ok(frame.path.includes(classId), `${classId} must not borrow another character's sprite`);
      }
    }
    assert.deepEqual(run, before);
  }
});

test('reviewed Reaver and other classes retain their actual attack and smash choreography', () => {
  const registries = createRegistries(contentBundle);
  for (const classId of classes) {
    const run = createRunState({ seed: 21, classId, registries });
    const attack = deckCardAnimationPlan(registries, run, { cardId: 'strike' });
    const smash = deckCardAnimationPlan(registries, run, { cardId: 'bashingBlow' });
    if (classId === 'reaver') assert.deepEqual(attack.frames, selectedWeaponSequence('attack').poses);
    assert.deepEqual(smash.frames, classId === 'reaver' ? selectedWeaponSequence('smash').poses : classSmashSequence().poses);
  }
});

test('Counter preparation is held in combat; preview demonstrates its conditional return, while pure Dodge uses evasion', () => {
  const registries = createRegistries(contentBundle);
  for (const classId of classes) {
    const run = createRunState({ seed: 21, classId, registries });
    const definition = playingCardDefinition(registries, { cardId: 'guardCounter' }, { rules: run });
    assert.equal(resolveCombatAnimation(definition, [], { classId }).technique, 'counterPrepare');
    const preview = deckCardAnimationPlan(registries, run, { cardId: 'guardCounter' });
    assert.ok(['counter', 'counter-guard'].includes(preview.plan.technique));
    const dodge = playingCardDefinition(registries, { cardId: 'dodgeRoll' }, { rules: run });
    assert.equal(resolveCombatAnimation(dodge, [], { classId }).technique, 'evade');
    const evade = deckCardAnimationPlan(registries, run, { cardId: 'dodgeRoll' });
    assert.equal(evade.plan.technique, 'evade');
    assert.equal(evade.sequence.fallbackAction, classId === 'reaver' ? undefined : 'defend');
  }
});

test('core and current keep class-default sprites when the mechanical loadout changes', () => {
  for (const profileId of ['core', 'current']) {
    const profile = resolveGameProfile(profileId);
    const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    for (const classId of classes) {
      const run = createRunState({ seed: 21, classId, registries, profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['one', 'two', 'three'] } } } });
      const ref = run.deck.find(card => card.cardId === 'core.strike' || card.cardId === 'strike');
      assert.ok(ref);
      const first = deckCardAnimationPlan(registries, run, ref);
      run.loadout.sets.rightHand[run.loadout.active.rightHand] = 'shortbow';
      run.loadout.sets.leftHand[run.loadout.active.leftHand] = null;
      const changed = deckCardAnimationPlan(registries, run, ref);
      assert.deepEqual(changed.presentation, first.presentation);
      assert.deepEqual(changed.frames, first.frames);
    }
  }
});


test('every supported action, including cast and ranged magic, has a sequence for each owning character', () => {
  for (const classId of classes) {
    const family = alternativeCardAnimationFamily(classId).family;
    for (const [maneuver, camp, expected] of [
      ['attack', 'physical', 'attack'], ['smash', 'physical', 'smash'], ['sweep', 'physical', 'sweep'],
      ['defend', 'physical', 'defend'], ['counter', 'physical', 'counterPrepare'],
      ['attack', 'spell', 'spell'], ['ranged', 'physical', 'ranged'], ['ranged', 'spell', 'rangedMagic'],
    ]) {
      const plan = resolveCombatAnimation({ type: 'attack', cardTags: [`camp:${camp}`, `maneuver:${maneuver}`] }, [], { classId });
      assert.equal(plan.technique, expected);
      assert.ok(family.sequences[plan.technique]?.poses.length, `${classId}: ${expected} is playable`);
    }
  }
});
