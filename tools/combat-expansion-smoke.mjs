import { pathToFileURL } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardChoicePlan } from '../src/engine/combat.js';
import { payAshenBlight } from '../src/engine/ashenBlight.js';
import { botControlAction, firstAffordableCard, botCardTargetId, refusalsFor } from './simbot.mjs';

/** Bounded integration exercise; this is not a win-rate or balance estimate. */
export function runExpandedBotSmoke(registries = createRegistries(contentBundle), { maxTurns = 3, maxActions = 120 } = {}) {
  const rows = [];
  for (const cls of registries.classes.all()) {
    const run = createRunState({ registries, classId: cls.id, seed: 941, combatExpansionVersion: 2 });
    const combat = createRunCombat({ registries, run, rng: createRng(941), enemyIds: ['wanderingSoldier'] });
    payAshenBlight(combat, combat.player, { amount: 25, receiptId: 'smoke:milestone', combatKey: combat.combatKey });
    combat.player.statuses.sleep = { stacks: 1 };
    let actions = 0, recovery = 0, choices = 0;
    while (!combat.result && combat.turn <= maxTurns && actions < maxActions) {
      actions++;
      const control = botControlAction(combat);
      if (control) {
        dispatch(combat, control);
        if (control.type === 'recoverControl') recovery++;
        if (control.type === 'chooseBlightFeat') choices++;
        continue;
      }
      const refused = refusalsFor(combat), card = firstAffordableCard(registries, combat, refused);
      if (!card) { dispatch(combat, { type: 'endTurn' }); continue; }
      try {
        dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId,
          targetId: botCardTargetId(registries, combat, card, combat.enemies.find(enemy => enemy.alive)?.id),
          choice: cardChoicePlan(combat, card.instanceId)?.options[0]?.id });
      } catch (error) {
        if (!/^Evade is already active|^Dodge Roll already used this turn|^That stance is already active/.test(error.message)) throw error;
        refused.add(card.instanceId);
      }
    }
    if (!choices || !recovery || actions >= maxActions || (!combat.result && combat.turn <= maxTurns)) throw new Error(`Expanded bot stalled for ${cls.id}`);
    rows.push({ classId: cls.id, actions, turns: combat.turn, result: combat.result || 'bounded', choices, recovery });
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const row of runExpandedBotSmoke()) console.log(`${row.classId}: ${row.actions} actions, ${row.turns} turns, ${row.result}; milestone and recovery handled`);
}
