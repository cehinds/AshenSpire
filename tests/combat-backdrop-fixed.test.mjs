import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { alternativeFormation, ScaleFormationPlan } from '../src/ui/models/AlternativeFormationModel.js';
import { CombatBackdropInputs, BackdropGridLines, HeldBackdropGrid } from '../src/ui/models/CombatBackdropFitModel.js';

// Owner, 2026-11-20: "When combat begins, the background should be fixed (like a solid image).
// Sometimes when an enemy is defeated, the layers shift position." The backdrop fit depends only on
// the combat screen's size, the zoom and the scene: never on the enemies, the formation's occupancy or who is alive.

const SCREENS = [
  { label: 'desktop 1280x800', combatWidth: 1280, combatHeight: 800, fieldTop: 64, fieldHeight: 520, zoom: 1, narrow: false, formFactor: 'desktop', handTop: 470 },
  { label: 'phone 390x844', combatWidth: 390, combatHeight: 844, fieldTop: 48, fieldHeight: 560, zoom: 1, narrow: true, formFactor: 'mobile', handTop: 500 },
  { label: 'zoomed desktop 1440x900', combatWidth: 1440, combatHeight: 900, fieldTop: 80, fieldHeight: 600, zoom: 1.25, narrow: false, formFactor: 'desktop', handTop: 520 },
];

// The stage's own pipeline: plan the grid on the field, place the actors, scale it into real px.
const stagePlan = (screen, { enemies, party = 1, rangeRanks = null, handCardsTop = null }) => {
  const width = screen.combatWidth, height = screen.fieldHeight;
  const presentation = { perspectiveGrid: true, formationPreset: 'straight', rangeRanks };
  const plan = combatFormation({ width, height, presentation,
    friends: Array.from({ length: party }, (_, i) => `p${i}`),
    enemies: enemies.map(enemy => enemy.id) });
  alternativeFormation(plan, width, height, screen.narrow, { ...presentation, handTop: screen.handTop, handCardsTop, formFactor: screen.formFactor });
  return ScaleFormationPlan(plan, 1);
};

// The fit the stage makes from one plan on one screen.
const fitFor = (screen, plan, screenKey = screen.label) => CombatBackdropInputs({ ...screen,
  grid: BackdropGridLines({ plan, zoom: screen.zoom, narrow: screen.narrow, screenKey }) });

const enemiesOf = count => Array.from({ length: count }, (_, i) => ({ id: `e${i}` }));

// Every enemy listed stands; a dead one is not ranked (CombatRangeRankModel ranks the living only).
const ranksFor = (enemies, aliveIds, backIds) => Object.fromEntries([['p0', 'front'],
  ...enemies.filter(enemy => aliveIds.includes(enemy.id)).map(enemy => [enemy.id, backIds.includes(enemy.id) ? 'back' : 'front'])]);

test('the combat backdrop fit is the same for every formation on one screen', () => {
  for (const screen of SCREENS) {
    const reference = fitFor(screen, stagePlan(screen, { enemies: enemiesOf(1) }));
    assert.ok(Number.isFinite(reference.alternative.floorTop), `${screen.label}: the back rank line is drawn`);
    for (const count of [1, 3, 5]) for (const party of [1, 4]) {
      const inputs = fitFor(screen, stagePlan(screen, { enemies: enemiesOf(count), party }));
      assert.deepEqual(inputs, reference, `${screen.label}: ${count} enemies, party of ${party}`);
    }
  }
});

test('deaths never move the combat backdrop, including band A emptying while band B lives', () => {
  for (const screen of SCREENS) {
    const enemies = enemiesOf(3);
    // e0 and e1 stand in the back strip (band A), e2 in the front strip (band B).
    const backIds = ['e0', 'e1'];
    const start = fitFor(screen, stagePlan(screen, { enemies, rangeRanks: ranksFor(enemies, ['e0', 'e1', 'e2'], backIds) }));
    const bandOf = (aliveIds, id) => stagePlan(screen, { enemies, rangeRanks: ranksFor(enemies, aliveIds, backIds) }).slots.find(slot => slot.id === id)?.visualBand;
    assert.equal(bandOf(['e0', 'e1', 'e2'], 'e0'), 'A', `${screen.label}: the fixture fills band A`);
    assert.equal(bandOf(['e0', 'e1', 'e2'], 'e2'), 'B', `${screen.label}: the fixture fills band B`);
    for (const alive of [['e1', 'e2'], ['e2'], ['e0', 'e1'], ['e0'], []]) {
      const inputs = fitFor(screen, stagePlan(screen, { enemies, rangeRanks: ranksFor(enemies, alive, backIds) }));
      assert.deepEqual(inputs, start, `${screen.label}: alive ${alive.join(',') || 'none'}`);
    }
  }
});

test('the combat backdrop fit follows the screen: a resize refits it', () => {
  const [screen] = SCREENS;
  const plan = { enemies: enemiesOf(3) };
  const before = fitFor(screen, stagePlan(screen, plan));
  const resized = { ...screen, combatWidth: 1240, combatHeight: 770, fieldHeight: 500 };
  const after = fitFor(resized, stagePlan(resized, plan));
  assert.notDeepEqual(after, before);
  assert.equal(after.alternative.width, 1240);
  assert.equal(after.environment.height, 770);
});

// Review of #2918: the grid's lines follow the resting cards' top, which moves with the number of cards in the hand.
// A hand change runs no pass, but the next pass (a death) brought the new lines and the floor jumped about 35 px.
test('the backdrop holds its grid lines per screen: a hand change then a death changes nothing', () => {
  for (const screen of SCREENS) {
    const enemies = enemiesOf(3);
    const alive = ids => ({ enemies, rangeRanks: ranksFor(enemies, ids, []) });
    const fit = (held, plan, screenKey = screen.label) => {
      const grid = HeldBackdropGrid(held, { screenKey, lines: () => BackdropGridLines({ plan, zoom: screen.zoom, narrow: screen.narrow, screenKey }) });
      return { grid, inputs: CombatBackdropInputs({ ...screen, grid }) };
    };
    const first = fit(null, stagePlan(screen, { ...alive(['e0', 'e1', 'e2']), handCardsTop: screen.handTop + 40 }));
    const handChanged = stagePlan(screen, { ...alive(['e1', 'e2']), handCardsTop: screen.handTop });
    assert.notDeepEqual(fitFor(screen, handChanged), first.inputs, `${screen.label}: the fixture's hand change moves the grid`);
    const afterDeath = fit(first.grid, handChanged);
    assert.equal(afterDeath.grid, first.grid, `${screen.label}: the held lines are kept`);
    assert.deepEqual(afterDeath.inputs, first.inputs, `${screen.label}: a death after a hand change moves nothing`);
    const resized = fit(first.grid, handChanged, `${screen.label} resized`);
    assert.notEqual(resized.grid, first.grid, `${screen.label}: a new screen takes the latest plan's lines`);
    assert.deepEqual(resized.inputs, fitFor(screen, handChanged), `${screen.label}: from that plan`);
  }
});

// Counts every write a fitter makes to a fake node's attributes and inline style.
const writeCounter = () => {
  const counter = { writes: 0 };
  counter.style = () => new Proxy({ setProperty(key, value) { counter.writes++; this[key] = value; } },
    { set(target, key, value) { counter.writes++; target[key] = value; return true; } });
  counter.node = (extra = {}) => ({ dataset: {}, style: counter.style(), getAttribute(name) { return this[`@${name}`] ?? null; },
    setAttribute(name, value) { counter.writes++; this[`@${name}`] = String(value); }, removeAttribute(name) { counter.writes++; delete this[`@${name}`]; }, ...extra });
  return counter;
};

test('a combat relayout with unchanged inputs writes nothing to the layered backdrop', async () => {
  const { fitSceneBackdrop } = await import('../src/ui/components/sceneBackdrop.js');
  const { LAYERED_SCENES } = await import('../src/content/layeredEnvironments.js');
  const scene = Object.values(LAYERED_SCENES)[0];
  const counter = writeCounter();
  const nodes = scene.layers.map((_, i) => counter.node({ dataset: { layerIndex: String(i) } }));
  const backdrop = { layeredRecipe: scene, dataset: {}, classList: { contains: () => true }, querySelectorAll: () => nodes };
  const [screen] = SCREENS;
  const inputs = fitFor(screen, stagePlan(screen, { enemies: enemiesOf(3) })).environment;
  const first = fitSceneBackdrop(backdrop, { width: screen.combatWidth, ...inputs });
  const writes = counter.writes;
  assert.ok(writes > 0, 'the first fit paints the layers');
  const again = fitSceneBackdrop(backdrop, { width: screen.combatWidth, ...inputs });
  assert.equal(counter.writes, writes, 'a death-triggered relayout writes nothing');
  assert.equal(again, first, 'and returns the same fit');
  fitSceneBackdrop(backdrop, { width: screen.combatWidth - 40, ...inputs });
  assert.ok(counter.writes > writes, 'a resize refits');
});
