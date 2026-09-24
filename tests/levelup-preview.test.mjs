// SPEC §13.4o — the shrine's before→after preview is the real door's answer,
// and the spoils door knows when a level was climbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { applyLevelUp, awardLevelXp, xpToNext } from '../src/model/levelup.js';
import { stampDeck } from '../src/model/loadout.js';
import { levelUpPreview, levelUpValues, weaponScalingFacts } from '../src/model/levelUpPreview.js';
import { combatXpGains, levelUpMoment } from '../src/model/rewardprogress.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const registries = createRegistries(contentBundle);

function runWithPoints(classId, points) {
  const run = createRunState({ seed: 11, classId, registries });
  run.level.unspentPoints = points;
  return run;
}

/** The run's own values after the points are really spent, then restamped as the next fight will. */
function actualAfter(run, pending) {
  const real = structuredClone(run);
  for (const [id, n] of Object.entries(pending)) for (let i = 0; i < n; i++) applyLevelUp(registries, real, id);
  stampDeck(registries, real);
  return { real, values: new Map(levelUpValues(registries, real).map((row) => [row.id, row.value])) };
}

for (const [classId, pending] of [
  ['reaver', { strength: 1 }],
  ['reaver', { strength: 2, constitution: 1 }],
  ['starseer', { intelligence: 1, wisdom: 2 }],
  ['rogue', { dexterity: 3 }],
  ['herald', { wisdom: 1, constitution: 1 }],
]) {
  test(`${classId} ${JSON.stringify(pending)}: the preview's after equals the run after Assign`, () => {
    const total = Object.values(pending).reduce((a, b) => a + b, 0);
    const run = runWithPoints(classId, total);
    const untouched = structuredClone(run);
    const preview = levelUpPreview(registries, run, pending);
    assert.deepEqual(run, untouched, 'the preview writes nothing to the run');
    const { real, values } = actualAfter(run, pending);
    for (const row of preview.rows) assert.equal(row.after, values.get(row.id), `${row.label}: preview ${row.after}, actual ${values.get(row.id)}`);
    // The pools the run itself carries agree with the projection's rows.
    const byId = new Map(preview.rows.map((row) => [row.id, row]));
    assert.equal(byId.get('stat:hp').after, real.maxHp);
    assert.equal(byId.get('stat:mana').after, real.maxMana);
    assert.equal(byId.get('stat:stamina').after, real.maxStamina);
    assert.equal(byId.get('stat:energy').after, real.energyMax);
    // Every attack card in the real deck reads the preview's number.
    for (const inst of real.deck.filter((card) => card.equipmentRole === 'attack')) {
      const row = preview.rows.find((r) => r.id === `card:attack:${inst.profileId}:${inst.sourceArmamentId || '-'}`);
      assert.ok(row, `${inst.instanceId} has a preview row`);
      assert.equal(row.after, inst.profileReceipt.value);
    }
    assert.ok(preview.changed.length > 0, 'a point moves something visible');
  });
}

test('a Reaver\'s two points of Strength show the Strike rising, and Constitution the HP', () => {
  const run = runWithPoints('reaver', 3);
  const preview = levelUpPreview(registries, run, { strength: 2, constitution: 1 });
  const strike = preview.changed.find((row) => row.role === 'attack' && row.pieceId === 'straightSword');
  assert.ok(strike, 'the Straight Sword strike is in the changed rows');
  assert.equal(strike.after - strike.before, 2, 'Straight Sword STR B: +1 a point above the anchor');
  const hp = preview.changed.find((row) => row.id === 'stat:hp');
  assert.ok(hp && hp.after > hp.before);
  assert.deepEqual(levelUpPreview(registries, run, {}).changed, [], 'no pending point, no change');
});

test('Assign alone moves the deck: the next fight deals the previewed Strike, no restamp between', () => {
  // Regression: applyLevelUp re-derived the pools but left every stamped card
  // at its old amount, and combat copies the stamp in — so the Strike the
  // preview promised arrived one fight late. Nothing here restamps by hand.
  const run = runWithPoints('reaver', 3);
  const preview = levelUpPreview(registries, run, { strength: 3 });
  for (let i = 0; i < 3; i++) applyLevelUp(registries, run, 'strength');
  const cardRows = preview.rows.filter((row) => row.kind === 'card');
  assert.ok(cardRows.some((row) => row.after > row.before), 'a card moves');
  for (const row of cardRows) {
    const inst = run.deck.find((c) => `card:${c.kitRole || c.equipmentRole}:${c.profileId}:${c.sourceArmamentId || '-'}` === row.id);
    assert.ok(inst, `${row.label} is in the deck`);
    assert.equal(inst.profileReceipt.value, row.after, `${row.label}: the run holds ${inst.profileReceipt.value}, the preview said ${row.after}`);
  }
  const combat = createCombat({ registries, rng: createRng(5), enemyIds: [contentBundle.enemies[0].id], player: {
    ...structuredClone(run), classId: run.class, relicIds: run.relics,
  } });
  const strike = preview.changed.find((row) => row.role === 'attack' && row.pieceId === 'straightSword');
  const inFight = Object.values(combat.piles).flat().filter((c) => c.equipmentRole === 'attack' && c.sourceArmamentId === 'straightSword');
  assert.ok(inFight.length > 0);
  for (const c of inFight) assert.equal(c.profileReceipt.value, strike.after);
});

test('the preview refuses what applyLevelUp refuses', () => {
  const run = runWithPoints('reaver', 1);
  assert.throws(() => levelUpPreview(registries, run, { strength: 2 }), /no attribute point waiting/);
  assert.throws(() => levelUpPreview(registries, run, { luck: 1 }), /'luck' is not an attribute id/);
});

test('the row fact says what the next point adds to the equipped graded weapon', () => {
  const run = runWithPoints('reaver', 2);
  const facts = weaponScalingFacts(registries, run, { ...run.attributes });
  assert.equal(facts.strength[0].grade, 'B');
  assert.equal(facts.strength[0].perPoint, 1);
  assert.equal(facts.strength[0].label, 'STR B — +1 dmg next point on Straight Sword');
  // DEX 1 is under the anchor: the line says where the grade starts.
  assert.equal(facts.dexterity[0].perPoint, 0);
  assert.match(facts.dexterity[0].label, /the grade pays above 3/);
  // The fact is the card's own receipt difference.
  const preview = levelUpPreview(registries, run, { strength: 1 });
  const strike = preview.rows.find((row) => row.role === 'attack' && row.pieceId === 'straightSword');
  assert.equal(strike.after - strike.before, facts.strength[0].perPoint);
});

test('a fight that climbs a level records it, and the spoils door reads the level live', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  const award = awardLevelXp(registries, run, xpToNext(registries, 1) + 5);
  assert.equal(award.levelUps, 1);
  const gains = combatXpGains({ levelGained: award.gained, levelUps: award.levelUps });
  assert.equal(gains.levelUps, 1);
  assert.deepEqual(levelUpMoment(run, gains), { level: 2, levelUps: 1, points: 1 });
  // No climb, and an offer saved before the field: no banner, and the old shape.
  assert.deepEqual(combatXpGains({ levelGained: 10 }), { level: 10, tracks: {} });
  assert.equal(levelUpMoment(run, { level: 10, tracks: {} }), null);
  assert.equal(levelUpMoment(run, null), null);
});
