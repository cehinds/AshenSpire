// Owner playtest 2026-11-19: "the Counter badge disappears the moment I end my turn". The engine keeps the stacks (they fade only at the
// start of the holder's own turn, SPEC Owner decisions 2026-11-18, and a covered hit spends one); the badge vanished because the playback
// snapshot the HUD draws from during End Turn did not carry Counter (or Reflect) stacks, so the badge read the live fight, which End Turn has
// already advanced to the next player turn. These tests pin the badge to the paced beats: it stays through the end of the turn and the enemy
// turn, and goes only on the beat that spends or fades the last stack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { ApplyCombatBeat, CaptureCombatDisplay } from '../src/ui/models/CombatPlaybackModel.js';
import { applyCombatDisplayReceipt } from '../src/ui/models/CombatDisplayReceiptModel.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

function live() {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  Object.assign(combat.player, { hp: 9999, maxHp: 9999, energy: 99, basePrecisionBonus: 1000 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { combat, enemy: combat.enemies[0] };
}
const playCounter = (combat, instanceId = 'cx1') => {
  combat.piles.hand.push({ instanceId, cardId: 'core.counter' });
  dispatch(combat, { type: 'playCard', cardInstanceId: instanceId });
};
const snapshot = combat => CaptureCombatDisplay(combat, { registries, projectCombatIntent: () => null, previewCard: () => null,
  followMemo: { plan: () => null }, upcastRanksByCard: new Map(), paintedHandQuotes: new Map() });
// What the HUD reads for the badge (src/ui/screens/combat.js meterInputs): the paced entity first, the live one only as a fallback.
const badge = (disp, entity) => (disp?.ents[entity.id] || entity).counterStacks ?? entity.counterStacks ?? 0;

/** Ends the turn the way the screen does: snapshot first, then dispatch, then replay the new events one beat at a time. */
function endTurnPaced(combat) {
  const disp = snapshot(combat);
  const from = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(from);
  const seen = [];
  for (const event of events) {
    ApplyCombatBeat(disp, [event], { combat, registries, reduceFollowRows() {}, projectCombatIntent: () => null, findInst: () => null, playbackEvents: events });
    seen.push({ type: event.type, event, shown: badge(disp, combat.player) });
  }
  return { disp, seen, events };
}
const shownAt = (seen, type) => seen.find(row => row.type === type)?.shown;

test('Counter stacks are held through End Turn into the enemy turn; a hit spends one, the rest fades only at the player\'s next turn start', () => {
  const { combat } = live();
  playCounter(combat, 'cx1');
  playCounter(combat, 'cx2');
  const held = combat.player.counterStacks;
  assert.equal(held, 2, 'two Counter plays hold 2 stacks');
  const { seen } = endTurnPaced(combat);
  const at = type => seen.findIndex(row => row.type === type);
  assert.equal(shownAt(seen, 'playerTurnEnd'), held, 'the badge is still up when the turn ends');
  assert.equal(shownAt(seen, 'enemyTurnStart'), held, 'and when the enemy turn starts');
  const spend = seen.find(row => row.type === 'counterStacksChanged' && row.event.consumed && row.event.targetId === combat.player.id);
  assert.ok(spend && seen.indexOf(spend) > at('enemyTurnStart') && seen.indexOf(spend) < at('enemyTurnEnd'), 'the enemy\'s covered hit spends a stack in its turn');
  assert.equal(spend.shown, held - 1, 'the badge drops by one on that hit');
  assert.equal(shownAt(seen, 'enemyTurnEnd'), held - 1, 'the last stack is still shown when the enemy turn ends');
  const fade = seen.find(row => row.type === 'counterStacksChanged' && row.event.decay && row.event.targetId === combat.player.id);
  assert.ok(fade && seen.indexOf(fade) > at('enemyTurnEnd'), 'the fade comes at the player\'s next turn start, after the enemy turn');
  assert.equal(fade.shown, 0, 'and the badge goes on that beat');
  assert.equal(combat.player.counterStacks ?? 0, 0, 'the engine agrees');
});

test('an enemy hit spends the Counter: the badge drops on that hit\'s beat, not when the turn ends', () => {
  const { combat } = live();
  playCounter(combat);
  const held = combat.player.counterStacks;
  const { seen } = endTurnPaced(combat);
  const spend = seen.find(row => row.type === 'counterStacksChanged' && row.event.consumed && row.event.targetId === combat.player.id);
  assert.ok(spend, 'the enemy\'s attack was covered and spent a stack');
  const spendAt = seen.indexOf(spend);
  assert.ok(spendAt > seen.findIndex(row => row.type === 'enemyTurnStart'), 'the spend lands in the enemy turn');
  assert.ok(seen.slice(0, spendAt).every(row => row.shown === held), 'the badge shows every stack until the spending hit');
  assert.equal(spend.shown, spend.event.stacks, 'then shows what is left');
});

test('the playback snapshot carries Counter and Reflect stacks, and their receipts move them', () => {
  const { combat } = live();
  Object.assign(combat.player, { counterStacks: 2, reflectStacks: 3 });
  const disp = snapshot(combat);
  assert.equal(disp.ents[combat.player.id].counterStacks, 2);
  assert.equal(disp.ents[combat.player.id].reflectStacks, 3);
  delete combat.player.counterStacks; // the live fight moved on; the paced badge does not follow it
  assert.equal(badge(disp, combat.player), 2);
  const ents = disp.ents;
  assert.equal(applyCombatDisplayReceipt(ents, { type: 'counterStacksChanged', targetId: combat.player.id, stacks: 1, amount: -1, consumed: true }), true);
  assert.equal(ents[combat.player.id].counterStacks, 1);
  applyCombatDisplayReceipt(ents, { type: 'counterStacksChanged', targetId: combat.player.id, stacks: 0, amount: -1, decay: true });
  assert.equal(ents[combat.player.id].counterStacks, 0, 'zero is shown as zero, not read through to the live fight');
  applyCombatDisplayReceipt(ents, { type: 'reflectStacksChanged', targetId: combat.player.id, stacks: 2, amount: -1 });
  assert.equal(ents[combat.player.id].reflectStacks, 2);
  applyCombatDisplayReceipt(ents, { type: 'counterStacksChanged', targetId: 'missing', stacks: 4 });
  assert.equal(ents.missing, undefined, 'no entity is invented');
});
