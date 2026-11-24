import test from 'node:test';
import assert from 'node:assert/strict';
import { cardChoicePlan, cardPlayCosts, createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { beginAbilityTurn } from '../src/engine/abilityRiders.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { createRng } from '../src/engine/rng.js';
import { triggerOwnerKey } from '../src/engine/triggers.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { bandsFight, registries } from './helpers/bands-fight.mjs';

const fight = () => bandsFight({ hand: ['dodgeRoll', 'dodgeRoll'], classId: 'rogue', stamina: 40 });
function recycle(c, id) {
  for (const pile of Object.values(c.piles)) {
    const index = pile.findIndex(card => card.instanceId === id);
    if (index >= 0 && pile !== c.piles.hand) c.piles.hand.push(pile.splice(index, 1)[0]);
  }
  // Compare the same casting conditions; a previous play may enter a discounted stance.
  c.player.stanceId = null; c.player.combatStance = null; // the stance cut no longer stops at 1 (owner 2026-11-22), so it must not leak into the next quote
}
const quote = (c, id = 'qa0', choice = 'retreat') => previewCard(c, id, undefined, undefined, { choice });
function play(c, id = 'qa0', choice = 'retreat') {
  const shown = quote(c, id, choice), before = c.player.stamina;
  const costs = cardPlayCosts(c, id, undefined, { choice });
  assert.equal(shown.staminaCost, costs.stamina);
  dispatch(c, { type: 'playCard', cardInstanceId: id, ...(choice == null ? {} : { choice }) });
  assert.equal(before - c.player.stamina, shown.staminaCost, 'selected preview equals paid Stamina');
  return shown.staminaCost;
}
const ledger = c => structuredClone({ instance: c.player.abilityRiders.instanceModeUsesCombat, card: c.player.abilityRiders.cardModeUsesCombat });

test('Dodge Roll Retreat grows per copy without a cap, while Advance and the other copy stay at base', () => {
  const c = fight();
  assert.equal(c.fixCoreRules.retreatRulesVersion, 1);
  const costs = [];
  for (let i = 0; i < 6; i++) {
    costs.push(play(c));
    recycle(c, 'qa0');
    assert.equal(quote(c, 'qa0', 'advance').staminaCost, 1);
    assert.equal(quote(c, 'qa1').staminaCost, 1);
  }
  assert.deepEqual(costs, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ledger(c), { instance: { qa0: { retreat: 6 } }, card: { dodgeRoll: { retreat: 6 } } });
  assert.equal(play(c, 'qa0', 'advance'), 1);
  recycle(c, 'qa0');
  assert.equal(quote(c).staminaCost, 7, 'Advance never increments the Retreat count');
  assert.equal(play(c, 'qa1'), 1);
});

test('undefined choice keeps first Advance and mode previews contain only the selected movement', () => {
  const c = fight();
  const first = quote(c, 'qa0', null), retreat = quote(c);
  assert.deepEqual(first.chargedEffects.filter(effect => effect.op === 'moveEngagement').map(effect => effect.mode), ['advance']);
  assert.deepEqual(retreat.chargedEffects.filter(effect => effect.op === 'moveEngagement').map(effect => effect.mode), ['retreat']);
  play(c, 'qa0', null);
  assert.equal(c.player.abilityRiders.instanceModeUsesCombat, undefined);
  recycle(c, 'qa0');
  assert.equal(play(c), 1);
});

test('the picker resolves each selected price and affordability without committing or spending', () => {
  const c = fight();
  play(c); recycle(c, 'qa0');
  c.player.stamina = 1;
  const before = serializeCombatSnapshot(c);
  const plan = cardChoicePlan(c, 'qa0');
  assert.deepEqual(plan.options.map(option => [option.id, option.costs.stamina, option.affordable]), [['advance', 1, true], ['retreat', 2, false]]);
  assert.deepEqual(serializeCombatSnapshot(c), before, 'opening, selecting or canceling the picker is a pure read');
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'qa0', choice: 'retreat' }), /Not enough/);
  assert.deepEqual(serializeCombatSnapshot(c), before, 'unaffordable play rolls back completely');
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'qa0', choice: 'invalid' }), /Choose one/);
  assert.deepEqual(serializeCombatSnapshot(c), before, 'invalid mode rolls back completely');
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'missing', choice: 'retreat' }), /not in hand/);
  assert.deepEqual(serializeCombatSnapshot(c), before);
});

test('unauthorized, controlled and late failed plays never advance a mode count', () => {
  const c = fight();
  c.phase = 'enemy';
  let before = serializeCombatSnapshot(c);
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'qa0', choice: 'retreat' }), /player turn/);
  assert.deepEqual(serializeCombatSnapshot(c), before);
  c.phase = 'player';
  c.player.statuses.sleep = { stacks: 1 };
  before = serializeCombatSnapshot(c);
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'qa0', choice: 'retreat' }), /control statuses/);
  assert.deepEqual(serializeCombatSnapshot(c), before);
  delete c.player.statuses.sleep;
  c.gameProfileCommands = 1000000; // Rejected after the tentative payment and rider recording.
  before = serializeCombatSnapshot(c);
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'qa0', choice: 'retreat' }), /work budget/);
  assert.deepEqual(serializeCombatSnapshot(c), before, 'late transactional failure restores payment and both ledgers');
});

test('a host refusing the completed save leaves a Retreat unplayed and uncounted', () => {
  const c = fight(), before = serializeCombatSnapshot(c);
  c.beforeCombatCommit = () => ({ ok: false });
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'qa0', choice: 'retreat' }), /save was refused/);
  assert.deepEqual(serializeCombatSnapshot(c), before);
});

test('reaction candidate previews do not count, a stale interrupted offer pays nothing, and an accepted reaction counts once', () => {
  for (const stale of [true, false]) {
    const c = fight();
    c.player.reactionsEnabled = true;
    dispatch(c, { type: 'endTurn' });
    const offerId = c.pendingReaction?.id;
    const option = c.pendingReaction?.options.find(row => row.play.cardInstanceId === 'qa0' && row.play.choice === 'retreat');
    assert.ok(option, 'the real incoming root offers the selected Retreat mode');
    assert.equal(c.player.abilityRiders.instanceModeUsesCombat, undefined, 'reaction enumeration is detached');
    if (stale) {
      c.piles.hand = c.piles.hand.filter(card => card.instanceId !== 'qa0');
      const before = serializeCombatSnapshot(c);
      assert.throws(() => dispatch(c, { type: 'chooseReaction', offerId, optionId: option.id }), /no longer playable/);
      assert.deepEqual(serializeCombatSnapshot(c), before);
    } else {
      const out = dispatch(c, { type: 'chooseReaction', offerId, optionId: option.id });
      const played = out.events.filter(event => event.type === 'cardPlayed' && event.cardInstanceId === 'qa0');
      assert.equal(played.length, 1);
      assert.equal(played[0].staminaSpent, option.staminaCost);
      assert.equal(c.player.abilityRiders.instanceModeUsesCombat.qa0.retreat, 1);
      assert.equal(c.player.abilityRiders.cardModeUsesCombat.dodgeRoll.retreat, 1);
    }
  }
});

test('mode counters survive turn changes and saved fights, and reset with the next fight', () => {
  const c = fight();
  play(c); recycle(c, 'qa0'); play(c); recycle(c, 'qa0');
  const counts = ledger(c);
  beginAbilityTurn(c.player);
  assert.deepEqual(ledger(c), counts);
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(c)));
  const restored = restoreCombatSnapshot({ registries: c.registries, rng: createRng(777, c.rng.getCounters()), snapshot: saved });
  assert.deepEqual(ledger(restored), counts);
  assert.equal(play(restored), 3);
  assert.equal(quote(fight()).staminaCost, 1);
});

test('upgraded Dodge Roll retains the Retreat price policy and its selected effects', () => {
  const c = fight();
  c.piles.hand[0].upgraded = true;
  const resolved = resolveCombatCard(c, c.piles.hand[0]);
  assert.equal(resolved.choiceModes.find(mode => mode.id === 'retreat').costGrowth.uncapped, true);
  assert.equal(play(c), 1); recycle(c, 'qa0');
  assert.equal(play(c), 2);
});

test('an authored perCard mode shares fresh-copy counts without affecting other modes', () => {
  const original = structuredClone(registries.cards.get('dodgeRoll'));
  delete original.retreatRuleFaces; // This fixture authors its own policy, rather than inheriting Dodge Roll's two faces.
  const def = { ...original, id: 'fixture.sharedMode', choiceModes: original.choiceModes.map(mode => mode.id === 'retreat'
    ? { ...mode, costGrowth: { ...mode.costGrowth, perCard: true } } : mode) };
  const cards = { ...registries.cards, get: id => id === def.id ? def : registries.cards.get(id) };
  const c = bandsFight({ registries: { ...registries, cards }, hand: [def.id, def.id], classId: 'rogue', stamina: 10 });
  assert.equal(play(c, 'qa0'), 1);
  c.player.stanceId = null; c.player.combatStance = null; // the stance cut no longer stops at 1 (owner 2026-11-22), so it must not leak into the next quote
  assert.equal(quote(c, 'qa1', 'advance').staminaCost, 1);
  assert.equal(play(c, 'qa1'), 2);
});

test('mode-specific preparing predicates, Mana affordability and payment read the same selected effects', () => {
  const def = structuredClone(registries.cards.get('dodgeRoll'));
  delete def.retreatRuleFaces;
  def.id = 'fixture.preparingModes';
  def.costRule = 'fixed';
  def.manaCost = 3;
  def.effects.push({ op: 'damage', target: 'allEnemies', amount: 1, mode: 'advance' });
  const custom = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, def] });
  const policy = structuredClone(fight().fixCoreRules);
  for (const [choice, mana] of [['advance', 1], ['retreat', 3]]) {
    // An explicitly opted-in custom rule set retains the generic preparing discount policy.
    const c = createCombat({ registries: custom, rng: createRng(777), combatExpansionVersion: 2,
      enemyIds: ['wanderingSoldier'], player: { classId: 'rogue', hp: 100, maxHp: 100,
        stamina: 10, maxStamina: 10, energyMax: 10, mana: 3, maxMana: 3, drawPerTurn: 1,
        deck: [{ instanceId: 'qa0', cardId: def.id, upgraded: false }] } });
    c.fixCoreRules = structuredClone(policy);
    c.propertyMounts[triggerOwnerKey(c, c.player)].modeFixture = { kind: 'feat', id: 'modeFixture', rules: [{ triggers: [{
      on: 'cardPreparing', if: { p: 'cardTargetsAllEnemies' },
      do: [{ op: 'grantCardCharge', target: 'self', key: 'modeFixture', manaDiscount: 2 }],
    }] }] };
    const before = serializeCombatSnapshot(c);
    assert.equal(quote(c, 'qa0', choice).manaCost, mana);
    assert.equal(cardPlayCosts(c, 'qa0', undefined, { choice }).mana, mana);
    const plan = cardChoicePlan(c, 'qa0');
    assert.deepEqual(plan.options.map(row => [row.id, row.costs.mana]), [['advance', 1], ['retreat', 3]]);
    assert.deepEqual(serializeCombatSnapshot(c), before);
    const previous = c.player.mana;
    play(c, 'qa0', choice);
    assert.equal(previous - c.player.mana, mana);
  }
});

test('saved fight absence or zero defeats an active profile and ignores new global mode metadata', () => {
  for (const flag of [undefined, 0]) {
    const c = fight();
    if (flag === undefined) delete c.fixCoreRules.retreatRulesVersion;
    else c.fixCoreRules.retreatRulesVersion = flag;
    for (let i = 0; i < 3; i++) { assert.equal(play(c), 1); recycle(c, 'qa0'); }
    assert.equal(c.player.abilityRiders.instanceModeUsesCombat, undefined);
    assert.equal(c.player.abilityRiders.cardModeUsesCombat, undefined);
    const restored = restoreCombatSnapshot({ registries: c.registries, rng: createRng(777, c.rng.getCounters()), snapshot: JSON.parse(JSON.stringify(serializeCombatSnapshot(c))) });
    assert.equal(quote(restored).staminaCost, 1);
    assert.equal(restored.fixCoreRules.retreatRulesVersion, flag);
  }
});
