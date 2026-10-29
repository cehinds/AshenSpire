// The hand's quotes come through createPreviewMemo (src/ui/models/PreviewMemoModel.js).
// A quote kept across a state change would show a wrong number, so each change a
// quote reads (a status on the player, a status on one target, a played card's
// spent stamina, the aimed target) must show up in the next quote, and every
// quote the memo hands out must equal a fresh engine preview of the same fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { previewCard, dispatch } from '../src/engine/combat.js';
import { createPreviewMemo } from '../src/ui/models/PreviewMemoModel.js';

function fight() {
  const profile = resolveGameProfile('default');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 'PVT' });
  return createRunCombat({ registries, run, rng: createRng('PVT'), enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
}
const idOf = (combat, cardId) => combat.piles.hand.find(c => c.cardId === cardId).instanceId;

test('a hand quote follows the fight: player status, target status, spent stamina, aimed target', () => {
  const combat = fight();
  const memo = createPreviewMemo({ combat, preview: previewCard, dispatch });
  const strike = idOf(combat, 'core.strike'), special = idOf(combat, 'core.reaverSpecial'), defend = idOf(combat, 'core.defend');
  const quote = (id, target) => memo.previewCard(combat, id, target);
  const damage = (target) => quote(strike, target).values[0].value;
  const agrees = () => {
    for (const id of [strike, special, defend]) for (const target of [undefined, 'e1', 'e2']) {
      assert.deepEqual(quote(id, target), previewCard(combat, id, target), `${id} -> ${target}`);
    }
  };

  const base = damage('e1');
  assert.equal(damage('e2'), base, 'two identical enemies take the same hit');
  assert.equal(quote(strike, 'e1'), quote(strike, 'e1'), 'a repeat on an unchanged fight is kept');
  agrees();

  // The aimed target changes the number the moment it carries a status.
  combat.enemies[1].statuses.vulnerable = { stacks: 2 };
  memo.invalidate();
  assert.equal(damage('e1'), base, 'the unmarked enemy is unchanged');
  assert.ok(damage('e2') > base, 'the vulnerable enemy takes more');
  agrees();

  // A status on the player changes every quote of the card.
  combat.player.statuses.weak = { stacks: 1 };
  memo.invalidate();
  assert.ok(damage('e1') < base, 'weak lowers the hit');
  agrees();
  delete combat.player.statuses.weak;
  memo.invalidate();
  assert.equal(damage('e1'), base, 'and clearing it restores the hit');

  // Spending stamina by playing a card goes through the memo's dispatch.
  const before = quote(special).staminaCost, staminaBefore = combat.player.stamina;
  memo.dispatch(combat, { type: 'playCard', cardInstanceId: defend });
  assert.ok(combat.player.stamina < staminaBefore, 'the played card spent stamina');
  assert.equal(quote(special).staminaCost, before);
  assert.ok(!combat.piles.hand.some(c => c.instanceId === defend), 'the played card left the hand');
  agrees();
});

test('a shared knowledge view prices every card exactly as a private one does', () => {
  const combat = fight();
  assert.ok(combat.enemyKnowledge, 'this fight hides enemy intents, the case the shared view serves');
  const view = {};
  for (const inst of combat.piles.hand) for (const target of [undefined, 'e1', 'e2']) {
    assert.deepEqual(previewCard(combat, inst.instanceId, target, undefined, { knowledgeView: view }), previewCard(combat, inst.instanceId, target), `${inst.cardId} -> ${target}`);
  }
  assert.ok(view.visible, 'the view was built once and kept');
  assert.equal(view.visible._knowledgePreview, true);
});
