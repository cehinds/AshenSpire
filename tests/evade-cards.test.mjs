// Owner, 2026-11-15 (W25-EvadeCards): the old Evade cards add Evade stacks and some retreat, advance, counter, boost or cost more.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { LiveAttribute } from '../src/engine/liveStats.js';
import { bandsFight, registries } from './helpers/bands-fight.mjs';
import { cardChoicePlan } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
import { serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';

const evade = c => c.player.statuses?.evade?.stacks || 0;
const play = (c, id = 'qa0', extra = {}) => dispatch(c, { type: 'playCard', cardInstanceId: id, ...extra });
const preGearRegistries = legacyGearRegistries(registries);
// Intrinsic card grants are separate from the Light armour type's +1 per gain; the parity case below explicitly keeps current gear.
const fight = (id, { currentGear = false, ...opts } = {}) => bandsFight({ registries: currentGear ? registries : preGearRegistries, hand: [id], classId: 'rogue', ...opts });
const def = id => registries.cards.get(id);
const upg = id => ({ ...def(id), ...def(id).upgrade });

test('every card grants Evade through the configured stack metric (cost and Evade as designed)', () => {
  const table = { evasiveGuard: [1, 1], dodgeRoll: [1, 1], quickstep: [1, 1], backstep: [1, 1], 'core.backstep': [1, 1], acrobaticsRogue: [1, 1], shadowstep: [2, 2], crawlingShot: [1, 1] };
  for (const [id, [cost, stacks]] of Object.entries(table)) {
    const card = def(id), eff = card.effects.find(e => e.status === 'evade');
    assert.equal(card.cost, cost, id);
    assert.equal(eff.stacks.metric, 'evadeStackGain', id);
    assert.equal(eff.stacks.per ?? 1, stacks, id);
    if (card.gradeProfiles) assert.equal(card.gradeProfiles[3].effects.find(e => e.status === 'evade').stacks.per, 2, `${id} grade 3`);
    else if (card.upgrade?.effects) assert.equal(card.upgrade.effects.find(e => e.status === 'evade')?.stacks.per, 2, `${id} upgrade`);
  }
  assert.equal(upg('shadowstep').cost, 1, 'Shadowstep upgrade is -1 SP');
});

test('Evasive Guard: Evade 1 and 2 Block; Acrobatics: Evade, +1 DEX this turn, draws', () => {
  const c = fight('evasiveGuard'); const block = c.player.block;
  play(c); assert.equal(evade(c), 1); assert.ok(c.player.block >= block + 2);
  const a = fight('acrobaticsRogue'); const dex = LiveAttribute(a.player, 'dexterity');
  const hand = a.piles.hand.length;
  play(a); assert.equal(evade(a), 1);
  assert.equal(LiveAttribute(a.player, 'dexterity'), dex + 1);
  assert.equal(a.piles.hand.length, hand - 1 + 2 - 1, 'draw 2, discard 1');
  dispatch(a, { type: 'endTurn' });
  assert.equal(LiveAttribute(a.player, 'dexterity'), dex, 'the boost ends with the turn');
});

test('Dodge Roll offers Advance or Retreat and plays only the picked one', () => {
  const c = fight('dodgeRoll');
  const plan = cardChoicePlan(c, 'qa0');
  assert.deepEqual(plan.options.map(o => o.id), ['advance', 'retreat']);
  assert.throws(() => play(c, 'qa0', { choice: 'swim' }), /Choose one/);
  play(c, 'qa0', { choice: 'advance' });
  assert.equal(evade(c), 1); assert.ok(c.player.advanced > 0);
  const r = fight('dodgeRoll'); r.player.advanced = 0;
  const { SetAdvanced } = awaitSet; SetAdvanced(r, r.player, true);
  play(r, 'qa0', { choice: 'retreat' });
  assert.equal(evade(r), 1); assert.ok(!(r.player.advanced > 0));
});
import * as bandRows from '../src/engine/bandRows.js';
const awaitSet = bandRows;

test('Backstep (rogue and core) retreats and prepares; Shadowstep advances for 2 SP with Evade 2', () => {
  for (const id of ['backstep', 'core.backstep']) {
    const c = fight(id); bandRows.SetAdvanced(c, c.player, true);
    play(c); assert.equal(evade(c), 1, id); assert.ok(!(c.player.advanced > 0), id);
    assert.ok(c.player.statuses.prepared?.stacks >= 1, id);
  }
  const s = fight('shadowstep', { stamina: 6 });
  assert.equal(previewCard(s, 'qa0', undefined).staminaCost, 2);
  play(s); assert.equal(evade(s), 2); assert.ok(s.player.advanced > 0); assert.equal(s.player.stamina, 4);
});

test('Quickstep: Evade, a Counter and a draw', () => {
  const c = fight('quickstep', { classId: 'reaver' });
  const d = resolveCombatCard(c, c.piles.hand[0]);
  assert.equal(d.combatProfile?.maneuver ?? d.tags.find(t => t.startsWith('maneuver:')).slice(9), d.tags.find(t => t.startsWith('maneuver:')).slice(9));
  assert.ok(d.tags.includes('maneuver:counter'));
  const hand = c.piles.hand.length;
  play(c); assert.equal(evade(c), 1); assert.equal(c.piles.hand.length, hand - 1 + 1);
});

test('Nightstep pays exactly 1 SP and 1 MP (no spell surcharge), gives Evade 2 and +1 INT this turn', () => {
  const c = fight('progression-nightstep', { stamina: 3 });
  c.player.mana = 1; // the shared bandsFight helper tops Mana up to 3 for Gale Push (1 MP, owner 2026-11-19); this test pins the Rogue's own one Mana
  assert.equal(c.player.mana, 1, 'the Rogue starts with one Mana');
  const pv = previewCard(c, 'qa0', undefined);
  assert.deepEqual([pv.staminaCost, pv.manaCost], [1, 1]);
  const int = LiveAttribute(c.player, 'intelligence');
  play(c);
  assert.equal(c.player.stamina, 2); assert.equal(c.player.mana, 0);
  assert.equal(evade(c), 2); assert.equal(LiveAttribute(c.player, 'intelligence'), int + 1);
  dispatch(c, { type: 'endTurn' });
  assert.equal(LiveAttribute(c.player, 'intelligence'), int);
});

test('Crawling Shot deals its shot, gives Evade and retreats', () => {
  const c = fight('crawlingShot'); bandRows.SetAdvanced(c, c.player, true);
  const hp = c.enemies[0].hp;
  play(c, 'qa0', { targetId: 'e1' });
  assert.equal(evade(c), 1); assert.ok(c.enemies[0].hp < hp); assert.ok(!(c.player.advanced > 0));
});

test('shown = dealt: the forecast Evade equals what the card grants', () => {
  const c = fight('shadowstep', { currentGear: true });
  assert.equal(c.gameProfile.modules.gear.typeEffectsVersion, 1, 'this forecast includes current Light armour');
  const before = serializeCombatSnapshot(c), counters = c.rng.getCounters();
  const shown = previewCard(c, 'qa0', undefined).values?.find(v => v.status === 'evade' || v.op === 'applyStatus');
  assert.ok(shown, 'the forecast has an Evade row');
  assert.equal(shown.value, 2 + 1, 'Shadowstep base 2 + Light armour per-gain bonus 1');
  assert.deepEqual(serializeCombatSnapshot(c), before, 'forecast is pure');
  assert.deepEqual(c.rng.getCounters(), counters);
  play(c);
  assert.equal(shown.value, evade(c));
  assert.equal(evade(c), 2 + 1);
});

test('a fight without the rows rule: Advance and Retreat do nothing, the card still gives its Evade', () => {
  const saved = fixCoreMechanics.bands; delete fixCoreMechanics.bands;
  let c; try { c = bandsFight({ registries: preGearRegistries, hand: ['shadowstep'], classId: 'rogue' }); } finally { fixCoreMechanics.bands = saved; }
  const before = JSON.stringify(c.rangeState.engagements);
  play(c); assert.equal(evade(c), 2); assert.equal(c.player.advanced, undefined);
  assert.equal(JSON.stringify(c.rangeState.engagements), before);
});
