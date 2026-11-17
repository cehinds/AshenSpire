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
  registries.cards.get(cardId), registries, 40, { noAuthored: true }).filter((s) => s.k === 'fx').map((s) => s.fx);

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

// What the third play of a card costs, after two earlier plays (the Attack stance the first play enters takes 1 off, never below 1).
function thirdPlayCost(cardId, steps, classId = 'reaver') {
  const c = fight([inst('a', cardId, steps), inst('b', cardId, steps), inst('c', cardId, steps)], classId);
  dispatch(c, { type: 'playCard', cardInstanceId: 'a', targetId: c.enemies[0].id });
  dispatch(c, { type: 'playCard', cardInstanceId: 'b', targetId: c.enemies[0].id });
  const before = { stamina: c.player.stamina, mana: c.player.mana };
  dispatch(c, { type: 'playCard', cardInstanceId: 'c', targetId: c.enemies[0].id });
  return { stamina: before.stamina - c.player.stamina, mana: before.mana - c.player.mana };
}

test('a steady upgrade holds the printed cost on every play', () => {
  assert.equal(thirdPlayCost('base.cost-per-use', null).stamina, 2, 'the third play costs 2 more, less the stance cut');
  assert.equal(thirdPlayCost('base.cost-per-use', [{ k: 'fx', fx: 'steady' }]).stamina, 1, 'the steady copy keeps its printed cost');
});

// The first play enters the casting stance; later plays take its 1-Stamina stance cut (never below 1), so the rise shows from the third play.
test('Hold Block costs more each play; upgraded it never rises', () => {
  const plays = (steps) => {
    const ids = ['a', 'b', 'c'];
    const c = fight(ids.map((id) => ({ instanceId: id, cardId: 'base.retain-block', ...(steps ? { upgraded: true } : { upgraded: false }) })), 'reaver');
    return ids.map((id) => { const before = c.player.stamina; dispatch(c, { type: 'playCard', cardInstanceId: id }); return before - c.player.stamina; });
  };
  const base = plays(false);
  const held = plays(true);
  assert.equal(base[2] - base[1], 1, `the third play costs 1 more than the second: ${base}`);
  assert.equal(new Set(held).size, 1, `the upgrade holds the cost: ${held}`);
  assert.equal(base[2], held[2] + 1, `the rising copy pays more by its third play: ${base} vs ${held}`);
});
