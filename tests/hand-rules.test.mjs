import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { handRulesRows, resolveHandRules, handRulesDefaultsFor, scaledCards, scaledCardsReceipt, HAND_RULES_PREFIX as prefix } from '../src/model/handRules.js';
import { discardChoicePlan } from '../src/engine/handRules.js';
import { drawCards } from '../src/engine/actions.js';
import { advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';

const registries = createRegistries(contentBundle);
function fight(overrides = {}, attributes = { intelligence: 10 }) {
  const settings = Object.fromEntries(Object.entries(overrides).map(([k, v]) => [prefix + k, v]));
  return createCombat({ registries, rng: createRng(2309), handRules: resolveHandRules(settings, contentBundle.attributes),
    player: { classId: 'reaver', maxHp: 10000, hp: 10000, maxMana: 0, energyMax: 3, drawPerTurn: 5, attributes,
      deck: Array.from({ length: 25 }, (_, i) => ({ instanceId: `c${i}`, cardId: 'strike', upgraded: false })), relicIds: [] },
    enemyIds: ['wanderingSoldier'],
  });
}

// The retain-and-fill rules that were the default before plan A4, spelled out
// by the tests that exercise them.
const kept = { retain: true, drawMode: 'fill' };

test('default draws the Draw stat every turn and discards what is unplayed (plan A4)', () => {
  const c = fight();
  assert.equal(c.handRules.drawMode, 'derived');
  assert.equal(c.handRules.retain, false);
  assert.equal(c.piles.hand.length, 5, 'opening hand is drawPerTurn');
  const ids = c.piles.hand.map(c => c.instanceId);
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, 5, 'next hand is drawPerTurn again');
  assert(ids.every(id => c.piles.discard.some(c => c.instanceId === id)), 'unplayed cards were discarded');
  // A draw card now matters: the extra card stays until the turn ends.
  drawCards(c, 2);
  assert.equal(c.piles.hand.length, 7);
  // Capacity still caps the Draw stat.
  const small = fight({ 'capacity.base': 3 });
  assert.equal(small.piles.hand.length, 3);
});

test('a run born before ruleset 7 keeps retain-and-fill unless the profile chose otherwise', () => {
  assert.deepEqual([handRulesDefaultsFor(6).drawMode, handRulesDefaultsFor(6).retain], ['fill', true]);
  assert.deepEqual([handRulesDefaultsFor(7).drawMode, handRulesDefaultsFor(7).retain], ['derived', false]);
  assert.equal(handRulesDefaultsFor(undefined).drawMode, 'derived');
  const chosen = resolveHandRules({ [prefix + 'drawMode']: 'fixed' }, contentBundle.attributes, handRulesDefaultsFor(6));
  assert.equal(chosen.drawMode, 'fixed');
  assert.equal(chosen.retain, true);
});

test('fill mode: opening is three; unplayed cards survive and next turn fills capacity', () => {
  const c = fight(kept);
  const ids = c.piles.hand.map(c => c.instanceId);
  assert.equal(c.piles.hand.length, 3);
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, 10);
  assert(ids.every(id => c.piles.hand.some(c => c.instanceId === id)));
  const draw = [...c.piles.draw];
  dispatch(c, { type: 'endTurn' });
  assert.deepEqual(c.piles.draw, draw);
});

test('stat selection, baseline, whole intervals, bounds and scaling off', () => {
  const rules = resolveHandRules({ [prefix + 'starting.stat']: 'strength', [prefix + 'starting.pointsPerCard']: 3 }, contentBundle.attributes);
  assert.equal(scaledCards(rules.starting, { strength: 18 }), 5);
  assert.equal(scaledCards(rules.starting, { strength: 1 }), 3);
  rules.starting.statEnabled = false;
  assert.equal(scaledCards(rules.starting, { strength: 99 }), 3);
  assert.equal(fight({ ...kept, 'capacity.base': 2 }).piles.hand.length, 2);
  assert.equal(fight(kept, { intelligence: 30 }).piles.hand.length, 5);
});

test('fixed draws default to two and can be changed or scaled', () => {
  const c = fight({ ...kept, drawMode: 'fixed' });
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, 5);
  const d = fight({ ...kept, drawMode: 'fixed', 'turn.base': 1, 'turn.statEnabled': true, 'turn.pointsPerCard': 5 }, { intelligence: 20 });
  dispatch(d, { type: 'endTurn' });
  assert.equal(d.piles.hand.length, 7);
});

test('retention off discards ordinary cards; optional choice validates atomically', () => {
  const c = fight({ retain: false, drawMode: 'fixed' });
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, 2);
  assert.equal(c.piles.discard.length, 3);
  const d = fight({ ...kept, promptDiscard: true, discardLimit: 1, drawMode: 'fixed', replaceDiscards: true });
  const ids = d.piles.hand.map(c => c.instanceId);
  const before = serializeCombatSnapshot(d);
  for (const discardIds of [[ids[0], ids[1]], [ids[0], ids[0]], ['missing']]) {
    assert.throws(() => dispatch(d, { type: 'endTurn', discardIds }));
    assert.deepEqual(serializeCombatSnapshot(d), before);
  }
  dispatch(d, { type: 'endTurn', discardIds: [ids[0]] });
  assert.equal(d.piles.hand.length, 5);
  assert(d.piles.discard.some(c => c.instanceId === ids[0]));
});

test('overflow requires the selected excess; full hands never churn the draw pile', () => {
  const c = fight({ ...kept, overflow: 'discard' });
  c.handRules.capacity.base = 1;
  const plan = discardChoicePlan(c);
  assert.equal(plan.minimum, 2);
  assert.throws(() => dispatch(c, { type: 'endTurn' }));
  dispatch(c, { type: 'endTurn', discardIds: plan.cards.slice(0, 2).map(c => c.instanceId) });
  assert.equal(c.piles.hand.length, 1);
  const before = [...c.piles.draw];
  drawCards(c, 3);
  assert.deepEqual(c.piles.draw, before);
});

test('empty draw pile respects reshuffle toggle', () => {
  const c = fight({ ...kept, reshuffle: false });
  c.piles.discard.push(...c.piles.draw.splice(0));
  drawCards(c, 2);
  assert.equal(c.piles.hand.length, 3);
  c.handRules.reshuffle = true;
  drawCards(c, 2);
  assert.equal(c.piles.hand.length, 5);
});

test('combat snapshot keeps rules and resumes deterministically', () => {
  const c = fight({ drawMode: 'fixed', promptDiscard: true });
  const snapshot = serializeCombatSnapshot(c);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(8), snapshot });
  assert.deepEqual(restored.handRules, c.handRules);
  dispatch(c, { type: 'endTurn' });
  dispatch(restored, { type: 'endTurn' });
  assert.deepEqual(restored.piles, c.piles);
  assert.equal(restored.turn, c.turn);
});

test('configuration export preserves stat and draw-mode choices', () => {
  const settings = { [prefix + 'drawMode']: 'fixed', [prefix + 'starting.stat']: 'wisdom', [prefix + 'starting.base']: 3 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [prefix + 'starting.pointsPerCard']: 0 }), contentBundle));
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [prefix + 'starting.minimum']: 9, [prefix + 'starting.maximum']: 2 }), contentBundle));
});

test('ethereal exhausts despite auto-retention and cannot be chosen to avoid it', () => {
  const c = fight({ ...kept, promptDiscard: true });
  c.piles.hand.push({ instanceId: 'ethereal', cardId: 'lastStand', upgraded: false });
  assert(!discardChoicePlan(c).cards.some(card => card.instanceId === 'ethereal'));
  assert.throws(() => dispatch(c, { type: 'endTurn', discardIds: ['ethereal'] }));
  dispatch(c, { type: 'endTurn' });
  assert(c.piles.exhaust.some(card => card.instanceId === 'ethereal'));
});

test('saved rules reject malformed formulas, and old snapshots retain legacy behavior', () => {
  const c = fight(kept);
  const saved = serializeCombatSnapshot(c);
  saved.handRules.starting.pointsPerCard = 0;
  assert.throws(() => restoreCombatSnapshot({ registries, rng: createRng(8), snapshot: saved }));
  delete saved.handRules;
  delete saved.pendingDiscardDraw;
  const legacy = restoreCombatSnapshot({ registries, rng: createRng(8), snapshot: saved });
  dispatch(legacy, { type: 'endTurn' });
  assert.equal(legacy.piles.hand.length, 5);
  assert.equal(legacy.piles.discard.length, 3);
});

test('settings present each hand-rule subsection once, in the order a turn reads them', () => {
  const sections = handRulesRows(contentBundle.attributes)
    .map(row => row.settingSection)
    .filter((section, index, all) => index === 0 || section !== all[index - 1]);
  assert.deepEqual(sections, ['Starting hand', 'Turn draws', 'Hand capacity', 'Retention & discards']);
});

test('the hand receipt is the arithmetic scaledCards does', () => {
  const rule = { base: 3, statEnabled: true, stat: 'intelligence', baseline: 4, pointsPerCard: 3, minimum: 1, maximum: 5 };
  for (const intelligence of [0, 4, 7, 10, 40]) {
    const receipt = scaledCardsReceipt(rule, { intelligence });
    assert.equal(receipt.value, scaledCards(rule, { intelligence }));
    assert.equal(receipt.bonus, Math.floor(Math.max(0, intelligence - 4) / 3));
  }
});
