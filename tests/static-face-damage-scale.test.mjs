// A card face read outside combat with the run's rules states the base the card deals, for every maneuver.
// Owner ruling 2026-11-28: the base-damage scale is 1, so it is the stored base (+ STR), as combat starts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { staticCardTokens } from '../src/model/playingCard.js';
import { computeTokenBindings, cardTokenEffects } from '../src/model/validate.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';

const profile = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } };

const SHIPPED_BASE_SCALE = 1;

test('Strike, Smash, Sweep and Counter faces outside combat state the base combat\'s first hit starts from', () => {
  assert.equal(profile.modules.effects.baseDamageMultiplier, SHIPPED_BASE_SCALE);
  const run = createRunState({ registries, classId: 'reaver', seed: 7, profileMeta: META });
  const combat = createRunCombat({ registries, run, rng: createRng(7), enemyIds: ['wanderingSoldier'] });
  // Owner, 2026-11-18 (static faces): the run's always-on STR joins the scaled base before the cuts.
  const STR = gameProfileEffectiveAttributes(registries, run).strength;
  for (const id of ['core.strike', 'core.smash', 'core.sweep', 'core.counter']) {
    const def = registries.cards.get(id);
    assert.ok(def, id);
    const effects = cardTokenEffects(def);
    const index = effects.findIndex(effect => effect.op === 'damage' && typeof effect.amount === 'number');
    assert.ok(index >= 0, `${id} has a constant damage effect`);
    const binding = computeTokenBindings(effects).find(row => row.index === index && row.field === 'amount');
    assert.ok(binding, `${id} prints its damage`);
    const authored = effects[index].amount;
    for (const rules of [run]) {
      const face = staticCardTokens(def, registries, rules)[binding.token];
      // A Counter's armed base takes no STR (its return is final damage); the rest add STR.
      const expected = id === 'core.counter'
        ? authored
        : Math.max(1, authored + STR);
      assert.equal(face, expected, `${id} face (run rules): ${authored} stored, ${expected} shown`);
      // Combat's own first hit of the card: the receipt's scaled base is the face number (AR, stance and defence add from there).
      const receipt = profileDamageReceipt(combat, combat.player, combat.enemies[0], authored, { ...combatProfileFor(def), counterReturnAttack: false });
      const scaled = receipt.damageReceipt.hits[0].sources.find(row => row.id === 'base-damage-scale')?.effective ?? authored;
      assert.equal(scaled, authored, `${id}: combat's first hit starts from the stored base`);
      if (id === 'core.counter') assert.equal(face, scaled, `${id}: the face equals combat's base`);
      else assert.equal(face, Math.max(1, scaled + STR), `${id}: the face equals combat's base plus STR`);
    }
  }
});
