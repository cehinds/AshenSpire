// The Dodge Roll card is a flat defence (owner, 2026-10-05: "change dodge
// card. Just make it add a flat block and ward and poise equal to 3 + dr
// bonuses"; SPEC §12.1). It no longer rolls: it grants 3 Block, 3 Poise and
// 3 Ward, each plus the DR bonus a physical skill's Block reads. Poise and
// Ward are guards that absorb impact before the matching meter fills and
// clear at the start of the player's next turn, with Block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { dealPoiseDamage } from '../src/engine/actions.js';
import { applyRatingImpact } from '../src/engine/combatRatings.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { isPureDodge } from '../src/framework/importer.js';
import { mechanics } from '../src/framework/data/mechanics.js';
import { combatEffectForEvent } from '../src/model/combatEffectEvents.js';

const registries = createRegistries(contentBundle);

function fight({ ratings = false } = {}) {
  return createCombat({
    registries, rng: createRng(0xd0d6e),
    ...(ratings ? { ratingsRules: resolveCombatRatings({}, contentBundle) } : {}),
    player: {
      classId: 'reaver', maxHp: 100, hp: 100, mana: 0, maxMana: 0, maxStamina: 9, stamina: 9, energyMax: 9, drawPerTurn: 5,
      // Every attribute 10: DR = 0.5 STR + 0.75 DEX + 0.25 CON + 0.35 WIS + 0.15 INT,
      // each term floored = 5 + 7 + 2 + 3 + 1 = 18 (combat-ratings.test.mjs).
      ...(ratings ? { attributes: { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 } } : {}),
      deck: ['d1', 'd2', 'd3', 'd4', 'd5'].map((instanceId) => ({ instanceId, cardId: 'dodgeRoll', upgraded: false })),
      relicIds: [], flasks: [],
    },
    enemyIds: [contentBundle.enemies[0].id],
  });
}

function play(combat) {
  const card = combat.piles.hand.find((c) => c.cardId === 'dodgeRoll');
  assert.ok(card, 'a Dodge Roll is in hand');
  const preview = previewCard(combat, card.instanceId, null);
  const { events } = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
  return { preview, events };
}

test('the Dodge Roll card is authored as a flat Block, Poise and Ward of 3, with no roll and no upgrade', () => {
  const def = registries.cards.get('dodgeRoll');
  assert.deepEqual(def.effects.map((e) => [e.op, e.amount]), [['block', 3], ['gainPoise', 3], ['gainWard', 3]]);
  assert.equal(def.effects.some((e) => e.op === 'dodgeRoll'), false, 'it no longer rolls');
  assert.equal(def.upgrade, undefined, 'no upgrade');
  assert.match(def.textTemplate, /\{block\} Block, \{gainPoise\} Poise and \{gainWard\} Ward/);
  // Evasive Guard keeps the roll.
  assert.equal(registries.cards.get('evasiveGuard').effects.some((e) => e.op === 'dodgeRoll'), true);
});

test('the Dodge Roll keeps the Weight Class price', () => {
  const def = registries.cards.get('dodgeRoll');
  assert.equal(isPureDodge(def), true);
  const rows = Object.fromEntries(mechanics.weight.classes.map((row) => [row.id, row]));
  for (const id of ['light', 'medium', 'heavy']) {
    const profile = registries.framework.costProfile(def, { weightClass: rows[id] });
    assert.equal(profile.stamina, rows[id].dodgeStaminaCost, `${id} stamina`);
  }
  assert.equal(registries.framework.viewFor(def).properties.some((p) => p.propertyId === 'utility.evasion'), true);
});

test('with no DR bonus the Dodge Roll grants exactly 3 Block, 3 Poise and 3 Ward', () => {
  const combat = fight();
  const p = combat.player;
  const { preview, events } = play(combat);
  assert.equal(events.some((e) => e.type === 'dodgeRolled'), false, 'no roll');
  assert.deepEqual([p.block, p.poiseGuard, p.wardGuard], [3, 3, 3]);
  assert.deepEqual(events.filter((e) => e.type === 'meterGuardGained').map((e) => [e.meter, e.amount, e.total]), [['poise', 3, 3], ['ward', 3, 3]]);
  assert.deepEqual([preview.tokens.block, preview.tokens.gainPoise, preview.tokens.gainWard], [3, 3, 3], 'the face shows what the play grants');
  const cues = events.map((e) => combatEffectForEvent(e)).filter((cue) => cue?.kind === 'dodge');
  assert.deepEqual(cues, [{ kind: 'dodge', targetId: p.id }], 'the dodge visual still plays, once per play');
  assert.equal(combatEffectForEvent({ type: 'meterGuardGained', meter: 'poise', amount: 3, targetId: p.id }), null, 'a guard from any other card is not a dodge');
  play(combat);
  assert.deepEqual([p.block, p.poiseGuard, p.wardGuard], [6, 6, 6], 'a second play stacks, like Block');
});

test('with DR the Dodge Roll grants 3 + DR of each, and the guards absorb impact before the meter fills', () => {
  const combat = fight({ ratings: true });
  const p = combat.player;
  const dr = p.ratings.dr;
  assert.equal(dr, 10, 'DEX 10 gives DR 10 at +1 per point');
  const { preview } = play(combat);
  assert.deepEqual([p.block, p.poiseGuard, p.wardGuard], [3 + dr, 3 + dr, 3 + dr]);
  assert.deepEqual([preview.tokens.block, preview.tokens.gainPoise, preview.tokens.gainWard], [3 + dr, 3 + dr, 3 + dr]);

  const seen = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => { if (type === 'ratingImpact') seen.push(payload); return emit(type, payload); };
  const poiseBefore = p.poiseMeter.value;
  applyRatingImpact(combat, combat.enemies[0], p, { damageSchool: 'physical' }, 3 + dr + 2);
  assert.equal(p.poiseGuard, 0, 'the Poise guard is spent first');
  assert.equal(p.poiseMeter.value, poiseBefore + 2, 'only the overflow reaches the Poise meter');
  const wardBefore = p.wardMeter.value;
  applyRatingImpact(combat, combat.enemies[0], p, { damageSchool: 'magic' }, 4);
  assert.equal(p.wardGuard, 3 + dr - 4, 'the Ward guard takes magical impact');
  assert.equal(p.wardMeter.value, wardBefore, 'a fully guarded hit does not fill the Ward meter');
  assert.deepEqual(seen.map((e) => [e.meter, e.amount, e.guarded]), [['poise', 2, 3 + dr], ['ward', 0, 4]]);
  combat.emit = emit;
});

test('without ratings the Poise guard still absorbs poise damage', () => {
  const combat = fight();
  const p = combat.player;
  play(combat);
  p.poiseMeter = { value: 0, max: 20 }; // a body that can be rocked
  const before = p.poiseMeter.value;
  dealPoiseDamage(combat, p, 5);
  assert.equal(p.poiseGuard, 0);
  assert.equal(p.poiseMeter.value, before + 2);
});

test('the guards expire at the start of the next turn, survive a snapshot, and are validated', () => {
  const combat = fight();
  const p = combat.player;
  play(combat);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(0xd0d6e), snapshot: serializeCombatSnapshot(combat) });
  assert.deepEqual([restored.player.poiseGuard, restored.player.wardGuard], [3, 3], 'a saved fight keeps its guards');
  const bad = serializeCombatSnapshot(combat);
  bad.player.poiseGuard = -1;
  assert.ok(combatSnapshotProblems(bad).some((m) => /poiseGuard/.test(m)), 'a negative guard is refused by name');
  dispatch(combat, { type: 'endTurn' });
  assert.equal(p.block, 0);
  assert.equal(p.poiseGuard, undefined);
  assert.equal(p.wardGuard, undefined);
});
