import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { alternativeFormation, ScaleFormationPlan } from '../src/ui/models/AlternativeFormationModel.js';
import { CombatBackdropInputs, BackdropGridLines, HeldBackdropGrid, BackdropScreenKey } from '../src/ui/models/CombatBackdropFitModel.js';

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
  grid: BackdropGridLines({ plan, zoom: screen.zoom, narrow: screen.narrow, screenKey, fieldTop: screen.fieldTop, fieldHeight: screen.fieldHeight }) });

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
// The stage stores lines only from a formation pass (HeldBackdropGrid); a fit without a pass uses what is held.
const passLines = (screen, plan, screenKey = screen.label) => BackdropGridLines({ plan, zoom: screen.zoom, narrow: screen.narrow, screenKey,
  fieldTop: screen.fieldTop, fieldHeight: screen.fieldHeight });

test('the backdrop holds its grid lines per screen: a hand change then a death changes nothing', () => {
  for (const screen of SCREENS) {
    const enemies = enemiesOf(3);
    const alive = ids => ({ enemies, rangeRanks: ranksFor(enemies, ids, []) });
    const first = HeldBackdropGrid(null, passLines(screen, stagePlan(screen, { ...alive(['e0', 'e1', 'e2']), handCardsTop: screen.handTop + 40 })));
    const handChanged = stagePlan(screen, { ...alive(['e1', 'e2']), handCardsTop: screen.handTop });
    assert.notDeepEqual(fitFor(screen, handChanged), CombatBackdropInputs({ ...screen, grid: first }), `${screen.label}: the fixture's hand change moves the grid`);
    const afterDeath = HeldBackdropGrid(first, passLines(screen, handChanged));
    assert.equal(afterDeath, first, `${screen.label}: a death's pass on the same screen keeps the held lines`);
    assert.deepEqual(CombatBackdropInputs({ ...screen, grid: afterDeath }), CombatBackdropInputs({ ...screen, grid: first }), `${screen.label}: and moves nothing`);
    const resized = HeldBackdropGrid(first, passLines(screen, handChanged, `${screen.label} resized`));
    assert.deepEqual(resized, passLines(screen, handChanged, `${screen.label} resized`), `${screen.label}: a pass on a new screen stores its own lines`);
  }
});

// Re-review of #2918: a fit without a pass (the combat box observer) could run between a screen change and its
// pass, store the old plan's lines under the new screen, and the new screen's pass then kept them.
test('a fit without a pass stores nothing: the pass for the new screen stores its own lines', () => {
  for (const screen of SCREENS) {
    const enemies = enemiesOf(3);
    const resized = { ...screen, label: `${screen.label} resized`, combatHeight: screen.combatHeight - 120, fieldHeight: screen.fieldHeight - 90 };
    const oldPlan = stagePlan(screen, { enemies }), newPlan = stagePlan(resized, { enemies });
    let held = HeldBackdropGrid(null, passLines(screen, oldPlan));
    // The box observer's fit on the new screen, before its pass: no pass, so the held lines are used and kept.
    const provisional = CombatBackdropInputs({ ...resized, grid: held });
    assert.ok(Number.isFinite(provisional.alternative.floorTop));
    // The pass for the new screen.
    held = HeldBackdropGrid(held, passLines(resized, newPlan));
    assert.deepEqual(held, passLines(resized, newPlan), `${screen.label}: the held lines are the new plan's`);
    assert.notDeepEqual(held.cellGrounds, passLines(screen, oldPlan).cellGrounds, `${screen.label}: which differ from the old plan's`);
  }
});

// Final review of #2918: the held lines are keyed on the grid's local inputs (the gate's canvas, field and hand boxes,
// the device), not on the real box or the zoom. A window resize that only scales the screen runs no pass and keeps the
// key, so a later pass with a moved hand (a death) still keeps the held lines; the lines are local px.
test('a scaled screen keeps its key and its lines; new local inputs store new lines', () => {
  for (const screen of SCREENS) {
    const enemies = enemiesOf(3);
    const localKey = `${screen.label} local inputs`;
    const plan = stagePlan(screen, { enemies, handCardsTop: screen.handTop + 40 });
    const held = HeldBackdropGrid(null, passLines(screen, plan, localKey));
    // The same plan seen through a 0.8 scale: real px shrink, the zoom with them, the local lines do not.
    const scale = .8, scaled = { ...screen, zoom: screen.zoom * scale, fieldTop: screen.fieldTop * scale, fieldHeight: screen.fieldHeight * scale };
    const scaledPlan = ScaleFormationPlan(structuredClone(plan), scale);
    const seen = passLines(scaled, scaledPlan, localKey);
    const close = (a, b) => Math.abs(a - b) < 1e-9;
    assert.ok(['backRankTop', 'fieldTop', 'fieldHeight'].every(key => close(seen[key], held[key])) && seen.cellGrounds.every((ground, i) => close(ground, held.cellGrounds[i])), `${screen.label}: the box and lines are local px`);
    const handMoved = ScaleFormationPlan(stagePlan(screen, { enemies: enemiesOf(2), handCardsTop: screen.handTop }), scale);
    assert.notDeepEqual(passLines(scaled, handMoved, localKey).backRankTop, held.backRankTop, `${screen.label}: the fixture's hand change moves the grid`);
    assert.equal(HeldBackdropGrid(held, passLines(scaled, handMoved, localKey)), held, `${screen.label}: a death on the scaled screen keeps the held lines`);
    const newLocal = passLines(scaled, handMoved, `${screen.label} other canvas`);
    assert.equal(HeldBackdropGrid(held, newLocal), newLocal, `${screen.label}: new local inputs store new lines`);
  }
});

// Review of #2918, phone: an upcastable card in hand reserves room for its controls, and the field's height follows it
// (mobileFieldOverlap). The held box and lines are keyed on the screen only, so neither that nor the hand's rest top
// moves the backdrop; a new canvas or form factor stores new values.
test('a field box change from the hand keeps the backdrop on the same screen', () => {
  for (const screen of SCREENS) {
    const enemies = enemiesOf(3);
    const screenKey = `${screen.label} canvas`;
    const held = HeldBackdropGrid(null, passLines(screen, stagePlan(screen, { enemies }), screenKey));
    const reserve = { ...screen, fieldTop: screen.fieldTop + 4, fieldHeight: screen.fieldHeight - 35 };
    const later = passLines(reserve, stagePlan(reserve, { enemies: enemiesOf(2), handCardsTop: screen.handTop - 30 }), screenKey);
    assert.notDeepEqual(later, held, `${screen.label}: the fixture moves the field and the grid`);
    const kept = HeldBackdropGrid(held, later);
    assert.equal(kept, held, `${screen.label}: a pass on the same screen keeps the held box and lines`);
    assert.deepEqual(CombatBackdropInputs({ ...reserve, grid: kept }), CombatBackdropInputs({ ...screen, grid: held }), `${screen.label}: the backdrop inputs are unchanged`);
    for (const otherScreen of [`${screen.label} other canvas`, `${screen.label} other form factor`]) {
      const fresh = passLines(reserve, stagePlan(reserve, { enemies }), otherScreen);
      assert.equal(HeldBackdropGrid(held, fresh), fresh, `${otherScreen}: stores new values`);
    }
  }
});

// Review of #2918, form-factor switch: the stage's forced pass can run before combatLayout writes the new bands, and
// the redo after them ran on the same canvas. combatLayout's bands are in the key, so the redo stores fresh values;
// the phone's field overlap, the field's live height and the hand's rest top are not, so a hand change keeps them.
test('the bands from combatLayout key the held values; the overlap, field height and hand do not', () => {
  for (const screen of SCREENS) {
    const enemies = enemiesOf(3);
    const keyFor = bands => BackdropScreenKey({ canvasWidth: screen.combatWidth, canvasHeight: screen.combatHeight, narrow: screen.narrow, formFactor: screen.formFactor, bands });
    const preBands = keyFor(['92px', '265px', '92px']), landed = keyFor(['84px', '318px', '89px']);
    assert.notEqual(landed, preBands, `${screen.label}: new bands make a new key`);
    assert.equal(keyFor(['84.00000000000001px', '317.99999999999994px', '89px']), landed, `${screen.label}: float noise in a rewritten band keeps the key`);
    const stale = HeldBackdropGrid(null, passLines(screen, stagePlan(screen, { enemies }), preBands));
    const settledScreen = { ...screen, fieldTop: screen.fieldTop - 6, fieldHeight: screen.fieldHeight + 40 };
    const fresh = passLines(settledScreen, stagePlan(settledScreen, { enemies }), landed);
    const held = HeldBackdropGrid(stale, fresh);
    assert.equal(held, fresh, `${screen.label}: the redo after the bands land stores fresh values`);
    // Same canvas and bands: the overlap, the field's height and the hand's rest top move, the key does not.
    const handMoved = { ...settledScreen, fieldHeight: settledScreen.fieldHeight - 35 };
    const later = passLines(handMoved, stagePlan(handMoved, { enemies: enemiesOf(2), handCardsTop: screen.handTop - 30 }), keyFor(['84px', '318px', '89px']));
    assert.notDeepEqual(later, held, `${screen.label}: the fixture moves the field and the grid`);
    assert.equal(HeldBackdropGrid(held, later), held, `${screen.label}: the held values are kept`);
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
