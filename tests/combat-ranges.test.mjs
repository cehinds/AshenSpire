import { attackHitPreview } from '../src/engine/stanceHit.js';
// The combat range vocabulary (owner, 2026-10-12): melee | reach | ranged, with
// the pre-rename contact | near | far read through an alias so old saves load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANGES, LEGACY_RANGE, normalizeRange, bringRangesForward } from '../src/model/combatRanges.js';

test('the vocabulary is melee, reach, ranged and the legacy names alias onto it', () => {
  assert.deepEqual([...RANGES], ['melee', 'reach', 'ranged']);
  assert.deepEqual({ ...LEGACY_RANGE }, { contact: 'melee', near: 'reach', far: 'ranged' });
  assert.equal(normalizeRange('contact'), 'melee');
  assert.equal(normalizeRange('near'), 'reach');
  assert.equal(normalizeRange('far'), 'ranged');
  assert.equal(normalizeRange('reach'), 'reach');
  assert.equal(normalizeRange('spell'), 'spell');
});

test('bringRangesForward renames legacy keys and values in place and leaves other meanings alone', () => {
  const saved = {
    matchups: {
      counter: { defaultCoverage: { melee: { camps: ['physical'], reaches: ['contact'] }, ranged: { reaches: ['near', 'far'] } },
        schoolMatchups: { frost: { strongReaches: ['contact'], weakSchools: ['fire'] } } },
      evade: { areaDifficulty: { contact: 0, near: 2, far: 4 } },
      distance: { nearChance: 20, farChance: 35, maximumBaseChance: 50 },
    },
    statuses: { prone: { status: 'prone', contactPercent: 25, rangedSinglePercent: -25, nearEvade: 2, farEvade: 4, standCost: 1 } },
    player: { combatStance: { maneuver: 'ranged', camp: 'physical', reach: 'far' } },
    carrier: { cardTags: ['camp:spell', 'reach:near'], combatProfile: { reach: 'contact' } },
    animation: { reach: 1 }, seat: 'reach', cue: 'contact', status: 'far',
  };
  assert.equal(bringRangesForward(saved), true);
  assert.deepEqual(saved, {
    matchups: {
      counter: { defaultCoverage: { melee: { camps: ['physical'], ranges: ['melee'] }, ranged: { ranges: ['reach', 'ranged'] } },
        schoolMatchups: { frost: { strongRanges: ['melee'], weakSchools: ['fire'] } } },
      evade: { areaDifficulty: { melee: 0, reach: 2, ranged: 4 } },
      distance: { reachChance: 20, rangedChance: 35, maximumBaseChance: 50 },
    },
    statuses: { prone: { status: 'prone', meleePercent: 25, rangedSinglePercent: -25, reachEvade: 2, rangedEvade: 4, standCost: 1 } },
    player: { combatStance: { maneuver: 'ranged', camp: 'physical', range: 'ranged' } },
    carrier: { cardTags: ['camp:spell', 'range:reach'], combatProfile: { range: 'melee' } },
    animation: { reach: 1 }, seat: 'reach', cue: 'contact', status: 'far',
  });
  // Key order is kept, so a re-serialized save reads in the same order.
  assert.deepEqual(Object.keys(saved.statuses.prone), ['status', 'meleePercent', 'rangedSinglePercent', 'reachEvade', 'rangedEvade', 'standCost']);
  assert.equal(bringRangesForward(saved), false, 'a current table is already forward');
});

// ---- an old frozen run, end to end ------------------------------------------
import { readFileSync } from 'node:fs';
import { createCombatExpansionRuleSnapshot, bringCombatExpansionRulesForward, combatExpansionRulesProblems, backfillCombatStatusRuleRows } from '../src/model/combatExpansionRules.js';
import { resolveAvoidance } from '../src/engine/combatAvoidance.js';
import { combatProfileFor, combatProfileTags } from '../src/model/combatCardProfile.js';

// The schema-23 capture was frozen before the rename; the fixture is never edited.
const CORPUS = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
// Status rows added since that capture are backfilled exactly as the load door does.
const frozenBeforeRename = () => backfillCombatStatusRuleRows(JSON.parse(CORPUS.versions['23'].bytes)).combatExpansionRules;

test('a run frozen with contact/near/far rules loads, validates and normalizes to the current tables', () => {
  const old = frozenBeforeRename();
  assert.deepEqual(old.matchups.evade.areaDifficulty, { contact: 0, near: 2, far: 4 }, 'the fixture still holds the old names');
  assert.deepEqual(old.matchups.counter.defaultCoverage.ranged.reaches, ['near', 'far']);
  assert.ok(combatExpansionRulesProblems(old).length > 0, 'unmigrated, the old names are refused');
  assert.equal(bringCombatExpansionRulesForward(old), true);
  assert.deepEqual(combatExpansionRulesProblems(old), []);
  const now = createCombatExpansionRuleSnapshot();
  assert.deepEqual(old.matchups.evade, now.matchups.evade);
  assert.deepEqual(old.matchups.distance, now.matchups.distance);
  assert.deepEqual(old.matchups.counter.defaultCoverage, now.matchups.counter.defaultCoverage);
  // Frost is the school matchup keyed by range (strongRanges); later schools are not in the capture.
  assert.deepEqual(old.matchups.counter.schoolMatchups.frost, now.matchups.counter.schoolMatchups.frost);
  assert.deepEqual(old.statuses.prone, now.statuses.prone);
});

test('an old frozen rules object plays the same avoidance result as the new one for one seed', () => {
  const play = (rules, stance) => {
    const dice = [17, 9, 3];
    const rng = { int: (stream, min, max) => dice.shift() ?? min };
    const target = { id: 'player', kind: 'player', alive: true, hp: 40, statuses: {}, combatStance: stance,
      combatEvade: { charges: 1, bonus: 0, advantage: false, disadvantage: false, expiresOnOwnerCycle: 2 },
      attributes: { dexterity: 2, wisdom: 3, intelligence: 4 }, armorClass: 'light' };
    const ctx = { combatExpansionVersion: 2, combatExpansionRules: rules, rng, emit: () => {} };
    const incoming = { camp: 'physical', maneuver: 'attack', range: 'melee', targeting: 'single' };
    return [resolveAvoidance(ctx, { id: 'enemy' }, target, incoming, 9),
      resolveAvoidance({ ...ctx, rng: { int: (s, min) => min } }, { id: 'enemy' }, target, { ...incoming, range: 'ranged', targeting: 'area' }, 6), target.combatEvade.charges,
      attackHitPreview(ctx, { id: 'enemy', kind: 'enemy' }, target, { combatProfile: incoming })];
  };
  const old = frozenBeforeRename();
  const oldStance = { maneuver: 'ranged', camp: 'physical', reach: 'far' };
  bringCombatExpansionRulesForward(old);
  bringRangesForward(oldStance);
  const current = play(createCombatExpansionRuleSnapshot(), { maneuver: 'ranged', camp: 'physical', range: 'ranged' });
  assert.deepEqual(play(old, oldStance), current);
  assert.equal(current[0].distance, null, 'v2 uses one unified Accuracy decision rather than a second distance roll');
  assert.equal(current[3].hitChance, 0, 'melee cannot reach the migrated ranged stance');
  assert.equal(current[3].missReason, 'range');
  assert.equal(current[2], 1, 'range misses spend no prepared Evade charge');
});

test('tags parse range:reach, read legacy reach:near the same way, and chip as range:x', () => {
  const tagged = tags => combatProfileFor({ id: 'probe', cardTags: ['camp:physical', 'maneuver:attack', ...tags, 'targeting:single'] });
  assert.equal(tagged(['range:reach']).range, 'reach');
  assert.equal(tagged(['range:melee']).range, 'melee');
  assert.equal(tagged(['range:ranged']).range, 'ranged');
  assert.equal(tagged(['reach:near']).range, 'reach', 'a legacy tag is normalized');
  assert.equal(tagged([]).range, undefined);
  assert.throws(() => tagged(['range:reach', 'range:melee']), /conflicting range: tags/);
  assert.throws(() => tagged(['range:far']), /unknown range: tag 'far'/);
  const chip = combatProfileTags({ id: 'probe', cardTags: ['camp:physical', 'range:reach', 'targeting:single'] }).find(row => row.id.startsWith('range:'));
  assert.equal(chip.id, 'range:reach');
  assert.equal(chip.label, 'Reach');
});
