import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { completeStatusAction } from '../src/engine/combatStatusControl.js';
import { statusReach } from '../tools/statusreach.mjs';
import { cardDetailHtml } from '../src/ui/components/card.js';
import { combatCardSummary } from '../src/model/playingCard.js';

test('status census reaches all expanded statuses through actual projected speakers', () => {
  const report = statusReach(contentBundle);
  assert.equal(report.verdict, 'PASS');
  for (const id of ['bleeding', 'frozen', 'chilled', 'paralysis', 'dazed', 'offBalance', 'prone', 'concealed']) {
    assert.ok(report.witness.get(id)?.some(route => route.startsWith('R7')), id);
  }
});

test('Star Path grants its printed Concealed utility at either grade and Sweep reveals it', () => {
  const registries = createRegistries(contentBundle);
  for (const upgraded of [false, true]) {
    const combat = createCombat({ registries, rng: createRng(314), combatExpansionVersion: 2,
      player: { classId: 'starseer', hp: 100, maxHp: 100, mana: 10, maxMana: 10,
        stamina: 10, maxStamina: 10, energyMax: 10, drawPerTurn: 3, orderedDraw: true,
        deck: [{ instanceId: 'path', cardId: 'starPath', upgraded }] }, enemyIds: ['wanderingSoldier'] });
    const definition = resolveCombatCard(combat, combat.piles.hand[0]);
    assert.match(definition.textTemplate, /Concealed.*Sweep and Holy/);
    assert.ok(definition.effects.some(effect => effect.op === 'applyStatus' && effect.status === 'concealed'));
    const preview = previewCard(combat, 'path');
    assert.equal(preview.tokens.concealed, 1);
    assert.match(combatCardSummary(definition, preview, registries), /Gain 1 Concealed/);
    // Full inspection reads the already resolved face. Avoid resolving its
    // permanent grade a second time through this static inspection adapter.
    const resolvedRegistry = { ...registries, cards: { ...registries.cards,
      get: id => id === 'starPath' ? { ...definition, gradeProfiles: undefined } : registries.cards.get(id) } };
    const inspection = cardDetailHtml(resolvedRegistry, { cardId: 'starPath', upgraded: false });
    assert.match(inspection, /Concealed for 2 turns/);
    assert.doesNotMatch(inspection, /\{concealed\}/);
    dispatch(combat, { type: 'playCard', cardInstanceId: 'path' });
    assert.equal(combat.player.statuses.concealed.stacks, 1);
    completeStatusAction(combat, combat.player, { maneuver: 'sweep' }, { actionKey: 'reveal' });
    assert.equal(combat.player.statuses.concealed, undefined);
  }
});
