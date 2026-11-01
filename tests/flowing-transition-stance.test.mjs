// Flowing Transition (base.immediate-stance-transition): "Immediately choose a
// maneuver stance." Playing it with a pick must leave the player in that stance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createCombat, dispatch, cardChoicePlan } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const CARD = 'base.immediate-stance-transition';
function fight(profileId) {
  const gameProfile = resolveGameProfile(profileId);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  return createCombat({ registries, rng: createRng(311), gameProfile,
    ...(profileId === 'current' ? { ruleset: combatRules } : {}), ratingsRules: null,
    ...(profileId === 'current' ? { combatExpansionVersion: 2, reactionRulesVersion: 1 } : {}),
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', hp: 80, maxHp: 80, mana: 5, maxMana: 5,
      stamina: 5, maxStamina: 5, energyMax: 5, drawPerTurn: 5, attributes: {}, relicIds: [],
      deck: [{ instanceId: 'ft', cardId: CARD }, ...Array.from({ length: 6 }, (_, i) => ({ instanceId: `s${i}`, cardId: profileId === 'core' ? 'core.strike' : 'strike' }))] } });
}
const current = c => c.player.combatStance && c.player.combatStance.maneuver;

for (const profile of ['core', 'current']) {
  for (const maneuver of ['attack', 'smash', 'defend', 'sweep', 'counter', 'casting', 'evade']) {
    test(`Flowing Transition (${profile}) choosing ${maneuver} enters ${maneuver}`, () => {
      const c = fight(profile);
      assert.ok(c.piles.hand.some(x => x.instanceId === 'ft'), 'card in opening hand');
      assert.equal(cardChoicePlan(c, 'ft').kind, 'stance');
      dispatch(c, { type: 'playCard', cardInstanceId: 'ft', choice: maneuver });
      // Core names the casting stance 'prepared' (configuredStance); the other six keep their id.
      assert.equal(current(c), profile === 'core' && maneuver === 'casting' ? 'prepared' : maneuver);
    });
  }
}
