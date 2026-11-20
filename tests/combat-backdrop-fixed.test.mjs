import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { alternativeFormation, ScaleFormationPlan } from '../src/ui/models/AlternativeFormationModel.js';
import { CombatBackdropInputs } from '../src/ui/models/CombatBackdropFitModel.js';

// Owner, 2026-11-20: "When combat begins, the background should be fixed (like a solid image).
// Sometimes when an enemy is defeated, the layers shift position." The backdrop fit depends only on
// the combat screen's size, the zoom and the scene: never on the enemies, the formation's occupancy or who is alive.

const SCREENS = [
  { label: 'desktop 1280x800', combatWidth: 1280, combatHeight: 800, fieldTop: 64, fieldHeight: 520, zoom: 1, narrow: false, formFactor: 'desktop', handTop: 470 },
  { label: 'phone 390x844', combatWidth: 390, combatHeight: 844, fieldTop: 48, fieldHeight: 560, zoom: 1, narrow: true, formFactor: 'mobile', handTop: 500 },
  { label: 'zoomed desktop 1440x900', combatWidth: 1440, combatHeight: 900, fieldTop: 80, fieldHeight: 600, zoom: 1.25, narrow: false, formFactor: 'desktop', handTop: 520 },
];

// The stage's own pipeline: plan the grid on the field, place the actors, scale it into real px.
const stagePlan = (screen, { enemies, party = 1, rangeRanks = null }) => {
  const width = screen.combatWidth, height = screen.fieldHeight;
  const presentation = { perspectiveGrid: true, formationPreset: 'straight', rangeRanks };
  const plan = combatFormation({ width, height, presentation,
    friends: Array.from({ length: party }, (_, i) => `p${i}`),
    enemies: enemies.map(enemy => enemy.id) });
  alternativeFormation(plan, width, height, screen.narrow, { ...presentation, handTop: screen.handTop, formFactor: screen.formFactor });
  return ScaleFormationPlan(plan, 1);
};

const enemiesOf = count => Array.from({ length: count }, (_, i) => ({ id: `e${i}` }));

// Every enemy listed stands; a dead one is not ranked (CombatRangeRankModel ranks the living only).
const ranksFor = (enemies, aliveIds, backIds) => Object.fromEntries([['p0', 'front'],
  ...enemies.filter(enemy => aliveIds.includes(enemy.id)).map(enemy => [enemy.id, backIds.includes(enemy.id) ? 'back' : 'front'])]);

test('the combat backdrop fit is the same for every formation on one screen', () => {
  for (const screen of SCREENS) {
    const reference = CombatBackdropInputs({ ...screen, plan: stagePlan(screen, { enemies: enemiesOf(1) }) });
    assert.ok(Number.isFinite(reference.alternative.floorTop), `${screen.label}: the back rank line is drawn`);
    for (const count of [1, 3, 5]) for (const party of [1, 4]) {
      const inputs = CombatBackdropInputs({ ...screen, plan: stagePlan(screen, { enemies: enemiesOf(count), party }) });
      assert.deepEqual(inputs, reference, `${screen.label}: ${count} enemies, party of ${party}`);
    }
  }
});

test('deaths never move the combat backdrop, including band A emptying while band B lives', () => {
  for (const screen of SCREENS) {
    const enemies = enemiesOf(3);
    // e0 and e1 stand in the back strip (band A), e2 in the front strip (band B).
    const backIds = ['e0', 'e1'];
    const start = CombatBackdropInputs({ ...screen, plan: stagePlan(screen, { enemies, rangeRanks: ranksFor(enemies, ['e0', 'e1', 'e2'], backIds) }) });
    const bandOf = (aliveIds, id) => stagePlan(screen, { enemies, rangeRanks: ranksFor(enemies, aliveIds, backIds) }).slots.find(slot => slot.id === id)?.visualBand;
    assert.equal(bandOf(['e0', 'e1', 'e2'], 'e0'), 'A', `${screen.label}: the fixture fills band A`);
    assert.equal(bandOf(['e0', 'e1', 'e2'], 'e2'), 'B', `${screen.label}: the fixture fills band B`);
    for (const alive of [['e1', 'e2'], ['e2'], ['e0', 'e1'], ['e0'], []]) {
      const inputs = CombatBackdropInputs({ ...screen, plan: stagePlan(screen, { enemies, rangeRanks: ranksFor(enemies, alive, backIds) }) });
      assert.deepEqual(inputs, start, `${screen.label}: alive ${alive.join(',') || 'none'}`);
    }
  }
});

test('the combat backdrop fit follows the screen: a resize refits it', () => {
  const [screen] = SCREENS;
  const plan = { enemies: enemiesOf(3) };
  const before = CombatBackdropInputs({ ...screen, plan: stagePlan(screen, plan) });
  const resized = { ...screen, combatWidth: 1240, combatHeight: 770, fieldHeight: 500 };
  const after = CombatBackdropInputs({ ...resized, plan: stagePlan(resized, plan) });
  assert.notDeepEqual(after, before);
  assert.equal(after.alternative.width, 1240);
  assert.equal(after.environment.height, 770);
});
