import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { handRulesDefaults } from '../src/content/handRules.js';
import { handRulesRows, resolveHandRules, handRow, scaledCards, HAND_RULES_PREFIX as prefix } from '../src/model/handRules.js';
import { handStatRows } from '../src/model/statRows.js';
import { statRowValue } from '../src/model/derivedStats.js';
import { discardChoicePlan } from '../src/engine/handRules.js';
import { drawCards } from '../src/engine/actions.js';
import { advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';

const registries = createRegistries(contentBundle);
// The rules these mechanic tests were written against: fill to a flat ten,
// keep overflow, open on 3 + INT/10. The shipped defaults changed (owner's
// exported config, 2026-09-24), so each fight pins these explicitly and the
// mechanics stay covered whatever the defaults become. Pass `{}` as `base`
// and SHIPPED_ROWS as `rows` to fight under the shipped defaults instead.
//
// Since ruleset 7 the counts are the three stat rows (content/derivedStats.js)
// and only the behaviour options are settings. The rows below state the old
// groups' numbers exactly: the opening hand was 3 + floor(max(0, INT − 10) ÷
// 10), which is 2 + floor(INT × 0.1) never below 3; the draw a flat 2 (0–10);
// the hand size a flat 10 (1–30).
const LEGACY_RULES = { drawMode: 'fill', overflow: 'keep' };
const LEGACY_ROWS = {
  openingHand: { base: 2, intelligence: 0.1, min: 3, max: 10 },
  draw: { base: 2, min: 0, max: 10 },
  handSize: { base: 10, min: 1, max: 30 },
};
const SHIPPED_ROWS = handStatRows(registries, null);
// LEGACY_ROWS with some fields of some rows replaced: `{ handSize: { base: 2 } }`.
const rowsWith = (patch = {}, rows = LEGACY_ROWS) =>
  Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, { ...row, ...patch[id] }]));
const settingsOf = (overrides = {}, base = LEGACY_RULES) =>
  Object.fromEntries(Object.entries({ ...base, ...overrides }).map(([k, v]) => [prefix + k, v]));
function fight(overrides = {}, attributes = { intelligence: 10 }, base = LEGACY_RULES, rows = LEGACY_ROWS) {
  const settings = settingsOf(overrides, base);
  return createCombat({ registries, rng: createRng(2309), handRules: resolveHandRules(settings, rows),
    player: { classId: 'reaver', maxHp: 10000, hp: 10000, maxMana: 0, energyMax: 3, drawPerTurn: 5, attributes,
      deck: Array.from({ length: 25 }, (_, i) => ({ instanceId: `c${i}`, cardId: 'strike', upgraded: false })), relicIds: [] },
    enemyIds: ['wanderingSoldier'],
  });
}

test('the default opening follows the shipped starting rule; unplayed cards survive and fill mode fills capacity', () => {
  const intelligence = { intelligence: 10 };
  const shipped = fight({}, intelligence, {}, SHIPPED_ROWS);
  assert.equal(shipped.piles.hand.length, scaledCards(SHIPPED_ROWS.openingHand, intelligence));
  assert.equal(shipped.piles.hand.length, 8); // 4 + floor(10 × 0.45), inside 3–15
  const c = fight();
  const ids = c.piles.hand.map(c => c.instanceId);
  assert.equal(c.piles.hand.length, 3);
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, 10);
  assert(ids.every(id => c.piles.hand.some(c => c.instanceId === id)));
  const draw = [...c.piles.draw];
  dispatch(c, { type: 'endTurn' });
  assert.deepEqual(c.piles.draw, draw);
});

test('attribute choice, whole-point flooring, bounds and scaling off', () => {
  // Strength instead of Intelligence, at a weight that floors: 0.3 per point.
  const rules = resolveHandRules(settingsOf(), rowsWith({ openingHand: { base: 0, intelligence: 0, strength: 0.3 } }));
  const opening = handRow(rules, 'openingHand');
  assert.equal(scaledCards(opening, { strength: 18 }), 5); // floor(5.4)
  assert.equal(scaledCards(opening, { strength: 1, intelligence: 30 }), 3); // floor(0.3) = 0, raised to the min of 3
  opening.strength = 0;
  assert.equal(scaledCards(opening, { strength: 99 }), 3);
  assert.equal(fight({}, undefined, undefined, rowsWith({ handSize: { base: 2 } })).piles.hand.length, 2);
  assert.equal(fight({}, { intelligence: 30 }).piles.hand.length, 5); // 2 + floor(30 × 0.1)
});

test('fixed draws are the shipped default, two below the turn baseline, and can be changed or scaled', () => {
  assert.equal(handRulesDefaults.drawMode, 'fixed');
  // INT 4: opening 4 + floor(4 × 0.45) = 5, hand size 7 + floor(4 × 0.19) = 7,
  // then a fixed 2 + floor(4 × 0.1) = 2.
  const shipped = fight({}, { intelligence: 4 }, {}, SHIPPED_ROWS);
  assert.equal(shipped.piles.hand.length, 5);
  dispatch(shipped, { type: 'endTurn' });
  assert.equal(shipped.piles.hand.length, 7);
  const c = fight({ drawMode: 'fixed' });
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, 5);
  // INT 20: opening 2 + floor(2) = 4, then 1 + floor(20 × 0.1) = 3 drawn.
  const d = fight({ drawMode: 'fixed' }, { intelligence: 20 }, undefined, rowsWith({ draw: { base: 1, intelligence: 0.1 } }));
  dispatch(d, { type: 'endTurn' });
  assert.equal(d.piles.hand.length, 7);
});

test('retention off discards ordinary cards; optional choice validates atomically', () => {
  const c = fight({ retain: false, drawMode: 'fixed' });
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, 2);
  assert.equal(c.piles.discard.length, 3);
  const d = fight({ promptDiscard: true, discardLimit: 1, drawMode: 'fixed', replaceDiscards: true });
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
  const c = fight({ overflow: 'discard' });
  c.handRules.rows.handSize.base = 1;
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
  const c = fight({ reshuffle: false });
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

// The counts are edited as the stat rows' own keys since ruleset 7.
const ROW = 'gameConfig.derivedStatRules.rules.';

test('configuration export preserves stat and draw-mode choices', () => {
  const settings = { [prefix + 'drawMode']: 'fixed', [ROW + 'openingHand.wisdom']: 0.2, [ROW + 'openingHand.base']: 3 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [ROW + 'openingHand.wisdom']: -1 }), contentBundle));
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [ROW + 'openingHand.base']: -1 }), contentBundle));
});

// Split from the test above so the rest of it stays green while this fails:
// ruleset 7 removed the settings-level check (handRulesSettingsProblems now
// returns []) and nothing at the import door replaced it, yet the run door
// refuses the same row (derivedStatRuleProblems) and so does a restored
// fight (handRulesProblems).
test('a configuration whose hand row has min above max is refused at import', () => {
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [ROW + 'openingHand.min']: 9, [ROW + 'openingHand.max']: 2 }), contentBundle));
});

test('ethereal exhausts despite auto-retention and cannot be chosen to avoid it', () => {
  const c = fight({ promptDiscard: true });
  c.piles.hand.push({ instanceId: 'ethereal', cardId: 'lastStand', upgraded: false });
  assert(!discardChoicePlan(c).cards.some(card => card.instanceId === 'ethereal'));
  assert.throws(() => dispatch(c, { type: 'endTurn', discardIds: ['ethereal'] }));
  dispatch(c, { type: 'endTurn' });
  assert(c.piles.exhaust.some(card => card.instanceId === 'ethereal'));
});

test('saved rules reject malformed formulas, and old snapshots retain legacy behavior', () => {
  const c = fight();
  const saved = serializeCombatSnapshot(c);
  saved.handRules.rows.openingHand.base = -1;
  assert.throws(() => restoreCombatSnapshot({ registries, rng: createRng(8), snapshot: saved }));
  saved.handRules.rows.openingHand.base = 2;
  saved.handRules.rows.openingHand.min = 9;
  saved.handRules.rows.openingHand.max = 2;
  assert.throws(() => restoreCombatSnapshot({ registries, rng: createRng(8), snapshot: saved }));
  delete saved.handRules;
  delete saved.pendingDiscardDraw;
  const legacy = restoreCombatSnapshot({ registries, rng: createRng(8), snapshot: saved });
  dispatch(legacy, { type: 'endTurn' });
  assert.equal(legacy.piles.hand.length, 5);
  assert.equal(legacy.piles.discard.length, 3);
});

// A fight saved before ruleset 7 carries the retired single-stat groups
// (`starting`, `turn`, `capacity`) and no rows. It resumes and counts exactly
// as it did — and LEGACY_ROWS above state those same numbers, so the two
// fights stay in step.
test('a fight saved with the retired hand groups still counts exactly', () => {
  const c = fight();
  const saved = serializeCombatSnapshot(c);
  const { rows, ...options } = saved.handRules;
  saved.handRules = {
    ...options,
    starting: { base: 3, statEnabled: true, stat: 'intelligence', baseline: 10, pointsPerCard: 10, minimum: 0, maximum: 10 },
    turn: { base: 2, statEnabled: false, stat: 'intelligence', baseline: 10, pointsPerCard: 10, minimum: 0, maximum: 10 },
    capacity: { base: 10, statEnabled: false, stat: 'intelligence', baseline: 10, pointsPerCard: 10, minimum: 1, maximum: 30 },
  };
  const legacy = restoreCombatSnapshot({ registries, rng: createRng(8), snapshot: saved });
  for (const intelligence of [0, 9, 10, 19, 20, 30, 99]) {
    assert.equal(scaledCards(handRow(legacy.handRules, 'openingHand'), { intelligence }), Math.min(10, 3 + Math.floor(Math.max(0, intelligence - 10) / 10)));
    assert.equal(scaledCards(handRow(legacy.handRules, 'openingHand'), { intelligence }), scaledCards(rows.openingHand, { intelligence }));
  }
  const current = restoreCombatSnapshot({ registries, rng: createRng(8), snapshot: serializeCombatSnapshot(c) });
  dispatch(legacy, { type: 'endTurn' });
  dispatch(current, { type: 'endTurn' });
  assert.equal(legacy.piles.hand.length, 10);
  assert.deepEqual(legacy.piles, current.piles);
});

test('settings present each hand-rule subsection once, in the order a turn reads them', () => {
  // The Starting hand subsection holds only the Opening hand stat row since
  // ruleset 7; these are the behaviour options' own subsections.
  const sections = handRulesRows()
    .map(row => row.settingSection)
    .filter((section, index, all) => index === 0 || section !== all[index - 1]);
  assert.deepEqual(sections, ['Turn draws', 'Hand capacity', 'Retention & discards']);
});

// scaledCardsReceipt retired with the single-stat groups: a hand count is the
// one row formula, so its receipt IS statRowValue's, and a retired group is
// read through its exact adapter.
test('the hand receipt is the arithmetic scaledCards does', () => {
  const row = { base: 3, intelligence: 0.3, min: 1, max: 5 };
  const group = { base: 3, statEnabled: true, stat: 'intelligence', baseline: 4, pointsPerCard: 3, minimum: 1, maximum: 5 };
  for (const intelligence of [0, 4, 7, 10, 40]) {
    const receipt = statRowValue(row, { attributes: { intelligence } });
    assert.equal(receipt.value, scaledCards(row, { intelligence }));
    assert.equal(receipt.terms.intelligence, Math.floor(intelligence * 0.3 + 1e-9));
    assert.equal(scaledCards(group, { intelligence }), Math.min(5, Math.max(1, 3 + Math.floor(Math.max(0, intelligence - 4) / 3))));
  }
});
