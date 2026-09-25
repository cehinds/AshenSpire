import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { handRulesDefaults } from '../src/content/handRules.js';
import { handRulesRows, resolveHandRules, handRulesForClass, scaledCards, scaledCardsReceipt, HAND_RULES_PREFIX as prefix } from '../src/model/handRules.js';
import { discardChoicePlan } from '../src/engine/handRules.js';
import { drawCards } from '../src/engine/actions.js';
import { advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';

const registries = createRegistries(contentBundle);
// The rules these mechanic tests were written against: fill to a flat ten,
// keep overflow, open on 3 + INT/10. The shipped defaults changed (owner's
// exported config, 2026-09-24), so each fight pins these explicitly and the
// mechanics stay covered whatever the defaults become. Pass `{}` as `base` to
// fight under the shipped defaults instead.
const LEGACY_RULES = {
  drawMode: 'fill', overflow: 'keep',
  'starting.base': 3, 'starting.statEnabled': true, 'starting.baseline': 10, 'starting.pointsPerCard': 10, 'starting.minimum': 0, 'starting.maximum': 10,
  'turn.base': 2, 'turn.statEnabled': false, 'turn.baseline': 10, 'turn.pointsPerCard': 10, 'turn.minimum': 0, 'turn.maximum': 10,
  'capacity.base': 10, 'capacity.statEnabled': false, 'capacity.baseline': 10, 'capacity.pointsPerCard': 10, 'capacity.minimum': 1, 'capacity.maximum': 30,
};
const settingsOf = (overrides = {}, base = LEGACY_RULES) =>
  Object.fromEntries(Object.entries({ ...base, ...overrides }).map(([k, v]) => [prefix + k, v]));
function fight(overrides = {}, attributes = { intelligence: 10 }, base = LEGACY_RULES) {
  const settings = settingsOf(overrides, base);
  return createCombat({ registries, rng: createRng(2309), handRules: resolveHandRules(settings, contentBundle.attributes),
    player: { classId: 'reaver', maxHp: 10000, hp: 10000, maxMana: 0, energyMax: 3, drawPerTurn: 5, attributes,
      deck: Array.from({ length: 25 }, (_, i) => ({ instanceId: `c${i}`, cardId: 'strike', upgraded: false })), relicIds: [] },
    enemyIds: ['wanderingSoldier'],
  });
}

test('the default opening follows the shipped starting rule; unplayed cards survive and fill mode fills capacity', () => {
  const intelligence = { intelligence: 10 };
  const shipped = fight({}, intelligence, {});
  assert.equal(shipped.piles.hand.length, scaledCards(handRulesDefaults.starting, intelligence));
  assert.equal(shipped.piles.hand.length, 6); // 4 + floor((10 − 1) ÷ 2) = 8, kept within 3–6 (owner, 2026-09-24)
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

test('stat selection, baseline, whole intervals, bounds and scaling off', () => {
  const rules = resolveHandRules(settingsOf({ 'starting.stat': 'strength', 'starting.pointsPerCard': 3 }), contentBundle.attributes);
  assert.equal(scaledCards(rules.starting, { strength: 18 }), 5);
  assert.equal(scaledCards(rules.starting, { strength: 1 }), 3);
  rules.starting.statEnabled = false;
  assert.equal(scaledCards(rules.starting, { strength: 99 }), 3);
  assert.equal(fight({ 'capacity.base': 2 }).piles.hand.length, 2);
  assert.equal(fight({}, { intelligence: 30 }).piles.hand.length, 5);
});

test('fixed draws are the shipped default, two below the turn baseline, and can be changed or scaled', () => {
  assert.equal(handRulesDefaults.drawMode, 'fixed');
  // INT 4 sits on the turn baseline: opening 4 + floor(3 ÷ 2) = 5, capacity 7, then a fixed two.
  const shipped = fight({}, { intelligence: 4 }, {});
  assert.equal(shipped.piles.hand.length, 5);
  dispatch(shipped, { type: 'endTurn' });
  assert.equal(shipped.piles.hand.length, 7);
  const c = fight({ drawMode: 'fixed' });
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, 5);
  const d = fight({ drawMode: 'fixed', 'turn.base': 1, 'turn.statEnabled': true, 'turn.pointsPerCard': 5 }, { intelligence: 20 });
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

test('configuration export preserves stat and draw-mode choices', () => {
  const settings = { [prefix + 'drawMode']: 'fixed', [prefix + 'starting.stat']: 'wisdom', [prefix + 'starting.base']: 3 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [prefix + 'starting.pointsPerCard']: 0 }), contentBundle));
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [prefix + 'starting.minimum']: 9, [prefix + 'starting.maximum']: 2 }), contentBundle));
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

// ---- PER-CLASS OPENING HAND (owner, 2026-09-24) -----------------------------
// "Class base 3–5, +1 from stats": base + floor(max(0, primary − 1) ÷ 2),
// kept within [base, 6], each class reading its own primary attribute.
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { attributeRules } from '../src/content/attributes.js';

const OPENING = { reaver: [3, 'strength'], rogue: [4, 'dexterity'], herald: [4, 'wisdom'], starseer: [5, 'intelligence'] };
const allOnes = { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 };

test('each class opens on its own base and primary attribute, capped at six', () => {
  const rules = resolveHandRules({}, contentBundle.attributes);
  for (const [classId, [base, stat]] of Object.entries(OPENING)) {
    const fightRules = handRulesForClass(rules, classId);
    assert.equal(fightRules.startingByClass, undefined, 'the per-class table does not ride into the fight');
    assert.equal(fightRules.starting.base, base);
    assert.equal(fightRules.starting.stat, stat);
    assert.equal(scaledCards(fightRules.starting, allOnes), base, `${classId} on all 1s opens on its base`);
    assert.equal(scaledCards(fightRules.starting, attributeRules.presets.lean[classId]), base + 1, `${classId}'s Standard preset (primary 3) opens base + 1`);
    assert.equal(scaledCards(fightRules.starting, { ...allOnes, [stat]: 40 }), 6, `${classId} never opens above six`);
    assert.equal(scaledCards(fightRules.starting, { ...allOnes, [stat]: 4 }), Math.min(6, base + 1), 'one point short of the next card adds nothing');
  }
  // A class with no row, or no class at all, keeps the shared rule.
  assert.deepEqual(handRulesForClass(rules, 'nobody').starting, rules.starting);
  assert.deepEqual(handRulesForClass(rules).starting, rules.starting);
});

test('a run fight deals the class opening hand and snapshots it', () => {
  const expected = { reaver: 4, rogue: 5, herald: 5, starseer: 6 };
  for (const [classId, count] of Object.entries(expected)) {
    const run = createRunState({ seed: 7, classId, registries });
    const combat = createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'] });
    assert.equal(combat.handRules.starting.base, OPENING[classId][0]);
    assert.equal(combat.piles.hand.length, Math.min(count, run.deck.length), `${classId} Standard preset opens on ${count}`);
    const saved = serializeCombatSnapshot(combat);
    assert.deepEqual(saved.handRules.starting, combat.handRules.starting, 'the snapshot carries the class hand it was born with');
    const restored = restoreCombatSnapshot({ registries, rng: createRng(8), snapshot: saved });
    assert.deepEqual(restored.handRules.starting, combat.handRules.starting);
  }
  // All 1s (an unspent Assign points shape is illegal; a legal eight with
  // nothing on the primary is the lowest a class can open on).
  const run = createRunState({ seed: 7, classId: 'reaver', registries, attributeMode: 'assign',
    attributes: { strength: 1, dexterity: 1, constitution: 4, wisdom: 1, intelligence: 1 } });
  const combat = createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.piles.hand.length, 3, 'a Reaver with Strength 1 opens on its base of 3');
});

test('each class\'s opening hand is its own pair of settings rows, and the shared base is retired', () => {
  const rows = handRulesRows(contentBundle.attributes, contentBundle.classes);
  for (const [classId, [base, stat]] of Object.entries(OPENING)) {
    const baseRow = rows.find(row => row.key === `${prefix}startingByClass.${classId}.base`);
    const statRow = rows.find(row => row.key === `${prefix}startingByClass.${classId}.stat`);
    assert.equal(baseRow.def, base);
    assert.equal(statRow.def, stat);
    assert.equal(baseRow.settingSection, 'Starting hand');
    assert.match(baseRow.label, /Opening hand base cards$/);
  }
  assert.ok(rows.find(row => row.key === `${prefix}starting.base`).retired, 'the shared base moves nothing a class can reach');
  assert.ok(rows.find(row => row.key === `${prefix}starting.stat`).retired);
  const tuned = handRulesForClass(resolveHandRules({ [`${prefix}startingByClass.reaver.base`]: 5, [`${prefix}startingByClass.reaver.stat`]: 'constitution' }, contentBundle.attributes), 'reaver');
  assert.equal(tuned.starting.base, 5);
  assert.equal(tuned.starting.stat, 'constitution');
});

// "Draw / turn and opening hand" said 3 for a Standard Rogue who opened on 5
// (Codex, #1294). Creation's Hand and Draw chips come from the hand rules the
// class's first fight is handed, so each class's promise is the hand dealt.
import { statProjection, handResourceRows, withHandResources } from '../src/model/statProjection.js';

test('character creation\'s Hand chip is the opening hand combat deals, for every class under Standard presets', () => {
  for (const settings of [{}, settingsOf({}, LEGACY_RULES)]) {
    for (const classDef of contentBundle.classes) {
      const run = createRunState({ seed: 7, classId: classDef.id, registries });
      const rows = withHandResources(statProjection(registries, run).derived, handResourceRows(registries, run, settings));
      const hand = rows.find(row => row.id === 'openingHand');
      const draw = rows.filter(row => row.id === 'draw');
      const combat = createRunCombat({ registries, rng: createRng(7), run, settings, enemyIds: ['wanderingSoldier'] });
      assert.equal(hand.value, combat.piles.hand.length, `${classDef.id}: the Hand chip is the opening hand dealt`);
      assert.equal(hand.faceLabel, 'Hand');
      assert.match(hand.formula, new RegExp(`= ${hand.value}$`), 'the tooltip arithmetic ends on the chip value');
      assert.equal(draw.length, 1, 'the legacy derived draw row is replaced, not joined');
      assert.equal(draw[0].label, 'Cards drawn each turn');
      assert.doesNotMatch(rows.map(row => row.label).join(' | '), /opening hand and|Draw \/ turn/);
      // Turn 2 draws what the Draw chip says whenever the hand has the room.
      const kept = combat.piles.hand.length;
      dispatch(combat, { type: 'endTurn' });
      if (combat.turn === 2 && combat.handRules.drawMode === 'fixed') {
        const room = scaledCards(combat.handRules.capacity, run.attributes) - kept;
        assert.equal(combat.piles.hand.length - kept, Math.min(room, draw[0].value), `${classDef.id}: the Draw chip is the turn draw`);
      }
    }
  }
});

// A fixed turn draw of 2 into a hand capacity of 1 draws one card, not two:
// `turnDrawCount` deals min(room, wanted). The Draw chip said 2 (Codex,
// #1294), so it now reads `handDrawCount` into an empty hand — the same
// formula combat deals — and its arithmetic ends on the capped count.
test('character creation\'s Draw chip is capped by hand capacity when the turn draw exceeds it', () => {
  const settings = settingsOf({ drawMode: 'fixed', retain: false, 'turn.base': 2, 'capacity.base': 1 });
  for (const classDef of contentBundle.classes) {
    const run = createRunState({ seed: 7, classId: classDef.id, registries });
    const rows = handResourceRows(registries, run, settings);
    const draw = rows.find(row => row.id === 'draw');
    const hand = rows.find(row => row.id === 'openingHand');
    assert.equal(draw.value, 1, `${classDef.id}: at most capacity cards are drawn into an empty hand`);
    assert.match(draw.formula, /2 base, limited to hand capacity 1 = 1$/);
    assert.equal(hand.value, 1);
    assert.match(hand.formula, /limited to hand capacity 1 = 1$/);
    const combat = createRunCombat({ registries, rng: createRng(7), run, settings, enemyIds: ['wanderingSoldier'] });
    assert.equal(combat.piles.hand.length, hand.value, `${classDef.id}: the Hand chip is the opening hand dealt`);
    dispatch(combat, { type: 'endTurn' });
    if (combat.turn === 2) assert.equal(combat.piles.hand.length, draw.value, `${classDef.id}: the Draw chip is the turn draw dealt`);
  }
});
