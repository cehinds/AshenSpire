// Review of #2820 (2026-11-17): a card face read outside combat states the base the card deals under the active profile, so a halved
// Core base (effects.baseDamageMultiplier 0.5) is printed halved for every maneuver, not only Counter, when read with the run's rules. Its damage token
// equals the scaled base that combat's first hit of the same card starts from (its receipt's base-damage-scale row).
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

test('Strike, Smash, Sweep and Counter faces outside combat state the scaled base combat\'s first hit starts from', () => {
  assert.equal(profile.modules.effects.baseDamageMultiplier, 0.5);
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
      // Owner, 2026-11-18: the player's side scale (x0.7, floored, never 0) follows the halving; a Counter's armed base takes none (its return is final damage).
      const side = id === 'core.counter' ? Math.ceil(authored / 2) : Math.max(1, Math.floor((Math.ceil(authored / 2) + STR) * 0.7 * 0.7)); // + the physical x0.7 cut (owner, 2026-11-18, second cut)
      assert.equal(face, side, `${id} face (run rules): ${authored} halves to ${Math.ceil(authored / 2)}, scaled to ${side}`);
      // Combat's own first hit of the card: the receipt's scaled base is the face number (AR, stance and defence add from there).
      const receipt = profileDamageReceipt(combat, combat.player, combat.enemies[0], authored, { ...combatProfileFor(def), counterReturnAttack: false });
      const scaled = receipt.damageReceipt.hits[0].sources.find(row => row.id === 'base-damage-scale')?.effective ?? authored;
      if (id === 'core.counter') assert.equal(face, scaled, `${id}: the face equals combat's scaled base`);
      else assert.equal(face, Math.max(1, Math.floor((scaled + STR) * 0.7 * 0.7)), `${id}: the face equals combat's scaled base, then the physical cut and the player side scale`);
    }
  }
});
