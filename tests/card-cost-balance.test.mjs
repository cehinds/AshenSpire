// Playtest 2026-11-17, theme C (chore/CardCostBalance): card drawbacks and the upgrades that ease them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { applyGameProfileToContent } from '../src/model/gameProfile.js';
import { upgradedDefinition } from '../src/model/cardUpgrade.js';
import { projectCardBehavior } from '../src/engine/cardBehavior.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { commitCardUpgrade, planCardUpgrade, PlanRestCardUpgrade } from '../src/model/cardUpgradeService.js';
import { cards, registries, profile, fresh, fight, withScoring } from './helpers/drawback-contract.mjs';
import { dispatch } from '../src/engine/combat.js';

const contractTest = (name, body) => test(name, () => withScoring(body));
const coreContent = () => applyGameProfileToContent(contentBundle, profile);
// A fight context that has seen `plays` earlier plays of the card.
const playedCtx = (cardId, plays) => ({ player: { abilityRiders: { cardUsesCombat: { [cardId]: plays } } } });

contractTest('an authored upgrade may stop a rising cost, and the schema accepts it', () => {
  const content = coreContent();
  const card = content.cards.find((row) => row.id === cards.plain.id);
  const rising = { ...card, costGrowth: { stamina: 1, perUse: 1, max: 3 }, upgrade: { ...(card.upgrade || {}), costGrowth: { stamina: 0, mana: 0 } } };
  content.cards = content.cards.map((row) => (row.id === card.id ? rising : row));
  const problems = validateContent(content).errors.filter((row) => row.path.startsWith(`cards.${card.id}`));
  assert.deepEqual(problems, []);
  assert.equal(projectCardBehavior(playedCtx(card.id, 2), { cardId: card.id }, rising).staminaCost, 3, 'the base card costs 1 more per earlier play');
  assert.equal(projectCardBehavior(playedCtx(card.id, 2), { cardId: card.id }, upgradedDefinition(rising)).staminaCost, 1, 'the upgrade holds the printed cost');
});

const inst = (id, cardId, steps) => ({ instanceId: id, cardId, ...(steps ? { upgraded: true, upgradeSteps: steps } : { upgraded: false }) });
const fxOffered = (cardId) => nextUpgradeOptions({ seed: 7, gameProfile: registries.gameProfile, rangePolicy: {} }, { instanceId: 'x', cardId, rank: 2, upgraded: false },
  registries.cards.get(cardId), registries, 40, { noAuthored: true })
  // An ease offered at uncommon or rare is a combo whose first step is the ease (upgrade rarity, #2920).
  .map((s) => (s.k === 'combo' ? s.steps[0] : s)).filter((s) => s.k === 'fx').map((s) => s.fx);

contractTest('the upgrade menu offers to drop Ethereal and to stop a rising cost, only on a card that has them', () => {
  assert.ok(fxOffered(cards.rising.id).includes('steady'), 'Shifting Cost may stop its rising cost');
  assert.ok(!fxOffered(cards.plain.id).includes('steady'), 'Strike has no rising cost');
  assert.ok(!fxOffered(cards.plain.id).includes('unethereal'), 'Strike is not Ethereal');
  const face = applyUpgradeSteps(registries.cards.get(cards.exhaust.id), [{ k: 'fx', fx: 'unethereal' }]);
  assert.ok(!face.keywords.includes('ethereal') && face.keywords.includes('exhaust'));
});

contractTest('a card upgraded off Ethereal stays in the deck at the end of the turn', () => {
  const c = fight([inst('plain', cards.exhaust.id), inst('kept', cards.exhaust.id, [{ k: 'fx', fx: 'unethereal' }, { k: 'fx', fx: 'unexhaust' }])]);
  dispatch(c, { type: 'endTurn' });
  const where = (id) => Object.entries(c.piles).filter(([, pile]) => pile.some((card) => card.instanceId === id)).map(([name]) => name);
  assert.deepEqual(where('plain'), ['exhaust'], 'an Ethereal card left in hand exhausts');
  assert.ok(!where('kept').includes('exhaust'), 'the upgraded copy is not exhausted');
});

contractTest('rest and blacksmith quotes offer only the drawback removal that a controlled grade applies', () => {
  const run = fresh();
  const quickstep = { ...inst(cards.grade.id, cards.grade.id), abilityRank: 3 };
  run.sideboard.push(quickstep);
  assert.ok(PlanRestCardUpgrade(run, registries, quickstep.instanceId).ok, 'the controlled CP scenario permits the applicable grade upgrade');
  run.level.level = 5;
  const step = { k: 'fx', fx: 'unexhaust' };
  const rest = PlanRestCardUpgrade(run, registries, quickstep.instanceId);
  const smith = planCardUpgrade(run, registries, quickstep.instanceId, { choices: 3 });

  assert.ok(rest.ok && smith.ok);
  assert.deepEqual(rest.step, step);
  assert.deepEqual(smith.options.map((option) => option.step), [step]);
  assert.ok(rest.before.keywords.includes('exhaust'));
  assert.ok(!rest.after.keywords.includes('exhaust'));
  assert.ok(rest.after.tags.includes('upgrade:refined'));
  assert.doesNotMatch(rest.after.textTemplate, /Exhaust/i);
  assert.equal(rest.after.abilityRank, 3);
  assert.equal(rest.after.rarity, rest.before.rarity, 'a legal grade-only upgrade does not force a rarity promotion');
  assert.equal(rest.after.rank, rest.before.rank);
  assert.deepEqual(rest.after.effects, rest.before.effects);
  assert.ok(Object.isFrozen(rest.after) && Object.isFrozen(rest.after.effects));
  assert.deepEqual(smith.options[0].after, rest.after);
  assert.equal(commitCardUpgrade(run, registries, rest).n, 1);
  assert.deepEqual(quickstep.upgradeSteps, [step]);
  assert.equal(quickstep.rank, undefined, 'the grade keeps its ability identity instead of receiving a fabricated CP rank');
});

// Puts a played copy back in hand, so the same copy can be played again this fight.
function backToHand(c, id) {
  for (const pile of Object.values(c.piles)) { const at = pile.findIndex((card) => card.instanceId === id); if (at >= 0 && pile !== c.piles.hand) c.piles.hand.push(pile.splice(at, 1)[0]); }
}
// Stance discounts are zero in this fixture, so only this copy's uses change its price.
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

contractTest('a steady upgrade holds the printed cost on every play', () => {
  assert.equal(thirdPlayCost(cards.rising.id, null).stamina, 3, 'the third play costs its printed 1 plus two prior uses');
  assert.equal(thirdPlayCost(cards.rising.id, [{ k: 'fx', fx: 'steady' }]).stamina, 1, 'the steady copy keeps its printed cost');
});

// Explicit authored growth and its authored upgrade are independent of the current Hold Block card.
contractTest('an explicit authored upgrade stops per-copy cost growth', () => {
  const plays = (steps) => {
    const c = fight([{ instanceId: 'a', cardId: cards.hold.id, upgraded: !!steps }], 'reaver');
    return [0, 1, 2].map(() => { const before = c.player.stamina; backToHand(c, 'a'); dispatch(c, { type: 'playCard', cardInstanceId: 'a' }); return before - c.player.stamina; });
  };
  const base = plays(false);
  const held = plays(true);
  assert.equal(base[2] - base[1], 1, `the third play costs 1 more than the second: ${base}`);
  assert.equal(new Set(held).size, 1, `the upgrade holds the cost: ${held}`);
  assert.equal(base[2], held[2] + 2, `the rising copy pays more by its third play: ${base} vs ${held}`);
});

contractTest('a rising cost counts plays of each copy, never another copy', () => {
  const c = fight([inst('up', cards.hold.id, [{ k: 'authored' }]), inst('a', cards.hold.id), inst('b', cards.hold.id)], 'reaver');
  for (let n = 0; n < 2; n += 1) { backToHand(c, 'up'); dispatch(c, { type: 'playCard', cardInstanceId: 'up' }); }
  dispatch(c, { type: 'playCard', cardInstanceId: 'a' });
  const before = c.player.stamina;
  dispatch(c, { type: 'playCard', cardInstanceId: 'b' });
  assert.equal(before - c.player.stamina, 1, 'a fresh copy pays its printed cost (less nothing), whatever other copies did');
  backToHand(c, 'a');
  const again = c.player.stamina;
  dispatch(c, { type: 'playCard', cardInstanceId: 'a' });
  assert.equal(again - c.player.stamina, 2, "only this copy's prior play increases its cost");
});
