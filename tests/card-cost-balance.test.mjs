// Playtest 2026-11-17, theme C (chore/CardCostBalance): card drawbacks and the upgrades that ease them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { resolveGameProfile, applyGameProfileToContent } from '../src/model/gameProfile.js';
import { upgradedDefinition } from '../src/model/cardUpgrade.js';
import { projectCardBehavior } from '../src/engine/cardBehavior.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { commitCardUpgrade, planCardUpgrade, PlanRestCardUpgrade } from '../src/model/cardUpgradeService.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const coreContent = () => applyGameProfileToContent(contentBundle, profile);
// A fight context that has seen `plays` earlier plays of the card.
const playedCtx = (cardId, plays) => ({ player: { abilityRiders: { cardUsesCombat: { [cardId]: plays } } } });

test('an authored upgrade may stop a rising cost, and the schema accepts it', () => {
  const content = coreContent();
  const card = content.cards.find((row) => row.id === 'core.strike');
  const rising = { ...card, costGrowth: { stamina: 1, perUse: 1, max: 3 }, upgrade: { ...(card.upgrade || {}), costGrowth: { stamina: 0, mana: 0 } } };
  content.cards = content.cards.map((row) => (row.id === card.id ? rising : row));
  const problems = validateContent(content).errors.filter((row) => row.path.startsWith(`cards.${card.id}`));
  assert.deepEqual(problems, []);
  assert.equal(projectCardBehavior(playedCtx(card.id, 2), { cardId: card.id }, rising).staminaCost, 3, 'the base card costs 1 more per earlier play');
  assert.equal(projectCardBehavior(playedCtx(card.id, 2), { cardId: card.id }, upgradedDefinition(rising)).staminaCost, 1, 'the upgrade holds the printed cost');
});

// A Core fight with exactly these cards in hand, plenty of Stamina and Mana, and Defends to draw.
function fight(cards, classId = 'starseer') {
  const run = createRunState({ registries, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  for (const pile of Object.values(combat.piles)) pile.length = 0;
  combat.piles.hand.push(...cards);
  for (let i = 0; i < 8; i += 1) combat.piles.draw.push({ instanceId: `f${i}`, cardId: 'core.defend', upgraded: false });
  for (const e of combat.enemies) Object.assign(e, { hp: 500, maxHp: 500, block: 0 });
  combat.player.stamina = combat.player.maxStamina = 20;
  combat.player.mana = combat.player.maxMana = 20;
  return combat;
}
const inst = (id, cardId, steps) => ({ instanceId: id, cardId, ...(steps ? { upgraded: true, upgradeSteps: steps } : { upgraded: false }) });
const fxOffered = (cardId) => nextUpgradeOptions({ seed: 7, gameProfile: registries.gameProfile, rangePolicy: {} }, { instanceId: 'x', cardId, upgraded: false },
  registries.cards.get(cardId), registries, 40, { noAuthored: true })
  // An ease offered at uncommon or rare is a combo whose first step is the ease (upgrade rarity, #2920).
  .map((s) => (s.k === 'combo' ? s.steps[0] : s)).filter((s) => s.k === 'fx').map((s) => s.fx);

test('the upgrade menu offers to drop Ethereal and to stop a rising cost, only on a card that has them', () => {
  assert.ok(fxOffered('base.cost-per-use').includes('steady'), 'Shifting Cost may stop its rising cost');
  assert.ok(!fxOffered('core.strike').includes('steady'), 'Strike has no rising cost');
  assert.ok(!fxOffered('core.strike').includes('unethereal'), 'Strike is not Ethereal');
  const face = applyUpgradeSteps(registries.cards.get('core.retreat'), [{ k: 'fx', fx: 'unethereal' }]);
  assert.ok(!face.keywords.includes('ethereal') && face.keywords.includes('exhaust'));
});

test('a card upgraded off Ethereal stays in the deck at the end of the turn', () => {
  const c = fight([inst('plain', 'core.retreat'), inst('kept', 'core.retreat', [{ k: 'fx', fx: 'unethereal' }, { k: 'fx', fx: 'unexhaust' }])]);
  dispatch(c, { type: 'endTurn' });
  const where = (id) => Object.entries(c.piles).filter(([, pile]) => pile.some((card) => card.instanceId === id)).map(([name]) => name);
  assert.deepEqual(where('plain'), ['exhaust'], 'an Ethereal card left in hand exhausts');
  assert.ok(!where('kept').includes('exhaust'), 'the upgraded copy is not exhausted');
});

test('rest and blacksmith quotes offer Quickstep only the upgrade its grade applies', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 5 });
  const quickstep = { ...inst('quickstep', 'quickstep'), abilityRank: 3 };
  run.sideboard.push(quickstep);
  const step = { k: 'fx', fx: 'unexhaust' };
  const rest = PlanRestCardUpgrade(run, registries, quickstep.instanceId);
  const smith = planCardUpgrade(run, registries, quickstep.instanceId, { choices: 3 });

  assert.ok(rest.ok && smith.ok);
  assert.deepEqual(rest.step, step);
  assert.deepEqual(smith.options.map((option) => option.step), [step]);
  assert.ok(rest.before.keywords.includes('exhaust'));
  assert.ok(!rest.after.keywords.includes('exhaust'));
  assert.doesNotMatch(rest.after.textTemplate, /Exhaust/i);
  assert.equal(rest.after.abilityRank, 3);
  assert.deepEqual(rest.after.effects, rest.before.effects);
  assert.ok(Object.isFrozen(rest.after) && Object.isFrozen(rest.after.effects));
  assert.deepEqual(smith.options[0].after, rest.after);
  assert.equal(commitCardUpgrade(run, registries, rest).n, 1);
  assert.deepEqual(quickstep.upgradeSteps, [step]);
});

// Puts a played copy back in hand, so the same copy can be played again this fight.
function backToHand(c, id) {
  for (const pile of Object.values(c.piles)) { const at = pile.findIndex((card) => card.instanceId === id); if (at >= 0 && pile !== c.piles.hand) c.piles.hand.push(pile.splice(at, 1)[0]); }
}
// What the third play of ONE copy costs, after its two earlier plays (the Attack stance the first play enters takes 1 off, with no floor of 1: owner 2026-11-22).
function thirdPlayCost(cardId, steps, classId = 'reaver') {
  const c = fight([inst('a', cardId, steps)], classId);
  dispatch(c, { type: 'playCard', cardInstanceId: 'a', targetId: c.enemies[0].id });
  backToHand(c, 'a');
  dispatch(c, { type: 'playCard', cardInstanceId: 'a', targetId: c.enemies[0].id });
  backToHand(c, 'a');
  const before = { stamina: c.player.stamina, mana: c.player.mana };
  dispatch(c, { type: 'playCard', cardInstanceId: 'a', targetId: c.enemies[0].id });
  return { stamina: before.stamina - c.player.stamina, mana: before.mana - c.player.mana };
}

test('a steady upgrade holds the printed cost on every play', () => {
  assert.equal(thirdPlayCost('base.cost-per-use', null).stamina, 2, 'the third play costs 2 more, less the stance cut');
  assert.equal(thirdPlayCost('base.cost-per-use', [{ k: 'fx', fx: 'steady' }]).stamina, 0, 'the steady copy keeps its printed cost (1), less the stance cut that no longer stops at 1');
});

// The first play enters the casting stance; later plays take its 1-Stamina stance cut (no floor of 1, owner 2026-11-22), so the rise shows from the third play.
test('Hold Block costs more each play; upgraded it never rises', () => {
  const plays = (steps) => {
    const c = fight([{ instanceId: 'a', cardId: 'base.retain-block', upgraded: !!steps }], 'reaver');
    return [0, 1, 2].map(() => { const before = c.player.stamina; backToHand(c, 'a'); dispatch(c, { type: 'playCard', cardInstanceId: 'a' }); return before - c.player.stamina; });
  };
  const base = plays(false);
  const held = plays(true);
  assert.equal(base[2] - base[1], 1, `the third play costs 1 more than the second: ${base}`);
  assert.equal(held[1], held[2], `the upgrade holds the cost after the first play: ${held}`);
  assert.equal(base[2], held[2] + 2, `the rising copy pays more by its third play: ${base} vs ${held}`);
});

test('a rising cost counts plays of each copy, never another copy', () => {
  const c = fight([inst('up', 'base.retain-block', [{ k: 'authored' }]), inst('a', 'base.retain-block'), inst('b', 'base.retain-block')], 'reaver');
  for (let n = 0; n < 2; n += 1) { backToHand(c, 'up'); dispatch(c, { type: 'playCard', cardInstanceId: 'up' }); }
  dispatch(c, { type: 'playCard', cardInstanceId: 'a' });
  const before = c.player.stamina;
  dispatch(c, { type: 'playCard', cardInstanceId: 'b' });
  assert.equal(before - c.player.stamina, 0, 'a fresh copy pays its printed cost (1) less the stance cut, whatever other copies did');
  backToHand(c, 'a');
  const again = c.player.stamina;
  dispatch(c, { type: 'playCard', cardInstanceId: 'a' });
  assert.equal(again - c.player.stamina, 1, 'its second play costs 1 more (2), less the 1-Stamina stance cut');
});
