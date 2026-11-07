// Owner bug 2026-11-02: Evade+ must cost 1 SP after Defend puts the Reaver in Defend stance, built the way the live game
// builds it (a real run, real combat, Defend played through dispatch), not by setting the stance by hand.
// The painted price is covered by evade-defend-discount-live.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, cardPlayCosts, previewCard } from '../src/engine/combat.js';
import { live } from './helpers/fixcore-combat-rules.mjs';

test('after Defend, Evade+ costs 1 SP and is affordable with 1 SP left', () => {
  const combat = live();
  combat.piles.draw.push(...combat.piles.hand);
  combat.piles.hand = [{ cardId: 'core.evade', instanceId: 'q.ev', upgraded: true, upgradeSteps: [{ k: 'cost', pool: 'sp' }] },
    { cardId: 'core.defend', instanceId: 'q.df', upgraded: false }];
  combat.player.energy = combat.player.stamina = combat.player.maxStamina = combat.player.energyMax = 2;
  assert.equal(cardPlayCosts(combat, 'q.ev').stamina, 2, 'outside Defend stance Evade+ costs its printed 2');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'q.df' });
  assert.equal(combat.player.combatStance.maneuver, 'defend');
  assert.equal(combat.player.stamina, 1);
  assert.equal(cardPlayCosts(combat, 'q.ev').stamina, 1, 'in Defend stance the Adept cut makes it 1');
  assert.equal(previewCard(combat, 'q.ev').staminaCost, 1, 'the hand quote the UI reads agrees');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'q.ev' });
  assert.equal(combat.player.stamina, 0, 'played with the 1 SP left');
});
