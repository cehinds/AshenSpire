// Momentum in normal combat (SPEC §4.11; owner decision 2026-10-12). The rounds rules, reused: decay at the
// round start, one credit per side per exchange (hit, block, evade, counter), the stance bonus from
// stance-advantage.csv, the sum settled once and clamped to -3..+3. Momentum has no mechanical effect here
// (normal combat has no speed order and no hit roll), so these tests read the state and the events only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { STANCE_ADVANTAGE_CSV } from '../src/content/combatRounds.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { MOMENTUM_KEY, COMBAT_ROUNDS_KEY, MULTI_ACTION_KEY } from '../src/model/combatRounds.js';
import { parseStanceAdvantage } from '../src/engine/combatRounds/resolver.js';
import { decayNormalMomentum, displayedMomentum, enemyIntentStance, momentumOn, recordNormalExchange, settleNormalMomentum, withCardExchange } from '../src/engine/normalPreview.js';
import { momentumTab } from '../src/ui/models/CombatRoundsScreenModel.js';
import { cardKind } from '../src/model/tree.js';
import { resolveCard } from '../src/model/registries.js';

const registries = createRegistries(contentBundle);
const TABLE = parseStanceAdvantage(STANCE_ADVANTAGE_CSV);
const bonus = (a, d) => TABLE.get(`${a}>${d}`) ?? 0;
const ENEMY = 'wanderingSoldier';

// A minimal combat record for the rule tests: the recorder reads player, enemies, registries and the state only.
function fakeCombat({ momentum = true, intent = null } = {}) {
  return {
    registries,
    player: { id: 'player' },
    enemies: [{ id: 'e1', enemyId: ENEMY, intent }],
    normalPreview: { momentum, multiAction: false, state: { momentum: {}, poiseDouble: {}, pending: {} } },
  };
}
const pending = (c, id = 'e1') => c.normalPreview.state.pending[id] ?? 0;

test('a landed attack credits the player: gain 1 plus the stance bonus against the enemy stance', () => {
  const plain = fakeCombat();
  recordNormalExchange(plain, 'damageDealt', { isAttack: true, sourceId: 'player', targetId: 'e1', amount: 5, blocked: 0 });
  assert.equal(pending(plain), 1, 'no enemy stance: gain 1, no bonus');
  const guarding = fakeCombat({ intent: { moveId: 'guard', kind: 'block' } });
  const foe = enemyIntentStance(guarding, guarding.enemies[0]);
  assert.ok(foe, 'the guard move has a stance');
  recordNormalExchange(guarding, 'damageDealt', { isAttack: true, sourceId: 'player', targetId: 'e1', amount: 5, blocked: 1 });
  assert.equal(pending(guarding), 1 + bonus('attack', foe), 'a partly blocked attack still lands: the player wins with the stance bonus');
});

test('a fully blocked attack credits the enemy, with the block as its stance', () => {
  const c = fakeCombat();
  recordNormalExchange(c, 'damageDealt', { isAttack: true, sourceId: 'player', targetId: 'e1', amount: 4, blocked: 4 });
  assert.equal(pending(c), -(1 + bonus('block', 'attack')), 'the defender wins: the enemy gains against the player attack');
});

test('an enemy attack that lands credits the enemy; one that is fully blocked credits the player', () => {
  const landed = fakeCombat();
  recordNormalExchange(landed, 'damageDealt', { isAttack: true, sourceId: 'e1', targetId: 'player', amount: 6, blocked: 0 });
  assert.equal(pending(landed), -1, 'the enemy wins its exchange: the player side loses one');
  const blocked = fakeCombat();
  recordNormalExchange(blocked, 'damageDealt', { isAttack: true, sourceId: 'e1', targetId: 'player', amount: 3, blocked: 3 });
  assert.equal(pending(blocked), 1, 'the player block wins the exchange');
});

test('an evaded attack credits the defender: the player evading, or the enemy evading the player', () => {
  const playerEvades = fakeCombat();
  recordNormalExchange(playerEvades, 'attackEvaded', { sourceId: 'e1', targetId: 'player' });
  assert.equal(pending(playerEvades), 1, 'the player wins its evade');
  const enemyEvades = fakeCombat();
  recordNormalExchange(enemyEvades, 'attackEvaded', { sourceId: 'player', targetId: 'e1' });
  assert.equal(pending(enemyEvades), -(1 + bonus('evade', 'attack')), 'the enemy wins its evade, with the evade stance against the attack');
});

test('a counter that fires credits its owner with the counter-beats-attack bonus; its own damage is not credited again', () => {
  const c = fakeCombat();
  recordNormalExchange(c, 'combatCounterTriggered', { sourceId: 'player', targetId: 'e1', amount: 2 });
  assert.equal(pending(c), 1 + bonus('counter', 'attack'), 'the counter owner wins its exchange');
  recordNormalExchange(c, 'damageDealt', { isAttack: true, sourceId: 'player', targetId: 'e1', amount: 2, blocked: 0 });
  assert.equal(pending(c), 1 + bonus('counter', 'attack'), 'the counter damage that follows is the counter\'s own exchange: no second credit');
  recordNormalExchange(c, 'damageDealt', { isAttack: true, sourceId: 'player', targetId: 'e1', amount: 2, blocked: 0 });
  assert.equal(pending(c), (1 + bonus('counter', 'attack')) + 1, 'a later landed attack is credited again, with no enemy stance (no bonus)');
});

test('events that are not exchanges change nothing: damage without isAttack, zero damage, and other types', () => {
  const c = fakeCombat();
  recordNormalExchange(c, 'damageDealt', { isAttack: false, sourceId: 'player', targetId: 'e1', amount: 5, blocked: 0 });
  recordNormalExchange(c, 'damageDealt', { isAttack: true, sourceId: 'player', targetId: 'e1', amount: 0, blocked: 0 });
  recordNormalExchange(c, 'hpLost', { targetId: 'e1', amount: 5 });
  assert.deepEqual(c.normalPreview.state.pending, {});
});

test('decay moves each enemy one step toward 0 at the round start, never past it', () => {
  const c = fakeCombat();
  c.normalPreview.state.momentum = { e1: 2, e2: -3, e3: 0, e4: 1 };
  decayNormalMomentum(c);
  assert.deepEqual(c.normalPreview.state.momentum, { e1: 1, e2: -2, e3: 0, e4: 0 });
});

test('settle adds the summed deltas to the decayed start once, clamps to -3..+3, and flags an overflow', () => {
  const c = fakeCombat();
  c.normalPreview.state.momentum = { e1: 2 };
  c.normalPreview.state.pending = { e1: 5 };
  settleNormalMomentum(c);
  assert.equal(c.normalPreview.state.momentum.e1, 3, 'a raw 7 is clamped to 3');
  assert.equal(c.normalPreview.state.poiseDouble.player, true, 'the raw total past the cap flags the player side');
  assert.deepEqual(c.normalPreview.state.pending, {}, 'the round scratch clears');
  const d = fakeCombat();
  d.normalPreview.state.pending = { e1: -4 };
  settleNormalMomentum(d);
  assert.equal(d.normalPreview.state.momentum.e1, -3);
  assert.equal(d.normalPreview.state.poiseDouble.e1, true, 'an enemy overflow flags that enemy');
  const e = fakeCombat();
  e.normalPreview.state.momentum = { e1: 1 };
  e.normalPreview.state.pending = { e1: 2 };
  settleNormalMomentum(e);
  assert.equal(e.normalPreview.state.momentum.e1, 3, 'a raw 3 is the cap, not past it');
  assert.equal(e.normalPreview.state.poiseDouble.player, undefined, 'no flag at exactly the cap');
});

test('with the toggle off nothing is recorded, decayed, settled or shown', () => {
  const c = fakeCombat({ momentum: false });
  assert.equal(momentumOn(c), false);
  recordNormalExchange(c, 'damageDealt', { isAttack: true, sourceId: 'player', targetId: 'e1', amount: 5, blocked: 0 });
  decayNormalMomentum(c);
  settleNormalMomentum(c);
  assert.deepEqual(c.normalPreview.state.pending, {});
  assert.deepEqual(displayedMomentum(c), {});
  assert.deepEqual(displayedMomentum({ normalPreview: undefined }), {}, 'a fight with no preview shows nothing');
});

test('the enemy intent stance uses the rounds stance names: an attack move is attack; no intent or a staggered one has none', () => {
  const c = fakeCombat();
  const def = registries.enemies.get(ENEMY);
  const attack = Object.keys(def.moves).find((id) => def.moves[id].damage != null || def.moves[id].intent === 'attack');
  assert.equal(enemyIntentStance(c, { enemyId: ENEMY, intent: { moveId: attack, kind: 'attack' } }), 'attack');
  assert.equal(enemyIntentStance(c, { enemyId: ENEMY, intent: { moveId: null } }), null, 'no intent, no stance');
  assert.equal(enemyIntentStance(c, { enemyId: ENEMY, intent: { moveId: attack, kind: 'staggered' } }), null, 'a staggered enemy has none');
});

test('a played fight: a landed attack credits its enemy by gain plus the stance bonus, and the turn settles it once', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries, profileMeta: { settings: { [MOMENTUM_KEY]: true } } });
  const c = createRunCombat({ registries, rng: createRng(4242), run, enemyIds: [ENEMY], settings: {} });
  assert.deepEqual({ momentum: c.normalPreview.momentum, multiAction: c.normalPreview.multiAction }, { momentum: true, multiAction: false });
  const enemy = c.enemies[0];
  const attacks = c.piles.hand.filter((x) => cardKind(resolveCard(registries, x)) === 'attack');
  const played = attacks.some((card) => {
    try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id }); return true; } catch { return false; }
  });
  assert.ok(played, 'the fixture plays an attack at the enemy');
  assert.equal('playerStance' in c.normalPreview.state, false, 'the played stance is cleared once the card resolves');
  const hit = c.eventLog.find((e) => e.type === 'damageDealt' && e.isAttack && e.sourceId === c.player.id && e.targetId === enemy.id);
  assert.ok(hit && hit.amount - (hit.blocked || 0) > 0, 'the attack lands on the enemy');
  assert.equal(pending(c, enemy.id), 1 + bonus('attack', enemyIntentStance(c, enemy)), 'the landed attack is credited once');
  dispatch(c, { type: 'endTurn' });
  while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  assert.deepEqual(c.normalPreview.state.pending, {}, 'the round scratch settles at the end of the enemy phase');
  const after = c.normalPreview.state.momentum[enemy.id];
  assert.ok(Number.isInteger(after) && after >= -3 && after <= 3, `settled momentum ${after} is within the cap`);
});

// PR #1953 review (Codex P2): an exchange is one played card against its target, or one enemy move, however many
// hits it lands, as a rounds timeline entry is (timeline.js resolveExchange shares one credited list per entry).
test('a multi-hit card is one exchange: its hits credit the player once per target', () => {
  const c = fakeCombat();
  c.enemies.push({ id: 'e2', enemyId: ENEMY, intent: null });
  const hit = (targetId) => recordNormalExchange(c, 'damageDealt', { isAttack: true, sourceId: 'player', targetId, amount: 3, blocked: 0 });
  withCardExchange(c, 'attack', () => { hit('e1'); hit('e1'); hit('e1'); hit('e2'); hit('e2'); });
  assert.equal(pending(c), 1, 'three hits on e1: one credit');
  assert.equal(pending(c, 'e2'), 1, 'a second target is its own exchange: one credit');
  assert.equal('cardExchange' in c.normalPreview.state, false, 'the scope closes with the card');
  withCardExchange(c, 'attack', () => hit('e1'));
  assert.equal(pending(c), 2, 'the next card is a new exchange');
});

test('a multi-hit enemy move is one exchange: its hits credit the enemy once', () => {
  const c = fakeCombat();
  const hit = () => recordNormalExchange(c, 'damageDealt', { isAttack: true, sourceId: 'e1', targetId: 'player', amount: 3, blocked: 0 });
  recordNormalExchange(c, 'enemyMoveStarted', { sourceId: 'e1', moveId: 'slash' });
  hit(); hit(); hit();
  assert.equal(pending(c), -1, 'three landed hits of one move: one credit');
  recordNormalExchange(c, 'enemyMoveStarted', { sourceId: 'e1', moveId: 'slash' });
  hit();
  assert.equal(pending(c), -2, 'the next move is a new exchange');
  settleNormalMomentum(c);
  assert.equal('enemyExchange' in c.normalPreview.state, false, 'the enemy phase end closes the scope');
});

test('the banner tab reads the stored momentum; a fight with the toggle off shows none', () => {
  const c = fakeCombat();
  c.normalPreview.state.momentum = { e1: 2 };
  assert.deepEqual(momentumTab(displayedMomentum(c).e1), { tone: 'good', tab: '++' });
  c.normalPreview.state.momentum = { e1: -1 };
  assert.deepEqual(momentumTab(displayedMomentum(c).e1), { tone: 'warn', tab: '+-' });
  assert.equal(momentumTab(displayedMomentum(fakeCombat({ momentum: false })).e1 ?? 0), null);
});

test('a normal fight with momentum on saves and restores its momentum state', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries, profileMeta: { settings: { [MOMENTUM_KEY]: true } } });
  const c = createRunCombat({ registries, rng: createRng(4242), run, enemyIds: [ENEMY], settings: {} });
  c.normalPreview.state.momentum = { [c.enemies[0].id]: -2 };
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(c)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(4242), snapshot: saved });
  assert.deepEqual(restored.normalPreview.state.momentum, { [c.enemies[0].id]: -2 });
});

// The banner is drawn by the screen layer. A fake root and document are enough: the decorator only reads the ribbon.
import { decorateCombatRoundsScreen } from '../src/ui/components/combatRoundsScreen.js';
function fakeScreen(run) {
  const ribbon = { dataset: {}, children: [], append(node) { this.children.push(node); } };
  const root = { dataset: {}, querySelectorAll: () => [], querySelector: (sel) => (sel === '.turn-ribbon' ? ribbon : null) };
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ dataset: {}, className: '', textContent: '', setAttribute() {} }) };
  try {
    decorateCombatRoundsScreen(root, run.combat, { targetedId: run.combat.enemies[0].id });
  } finally {
    globalThis.document = previous;
  }
  return { root, ribbon };
}

test('the decorator draws the momentum tab in a normal fight whose toggle is on, and nothing when it is off', () => {
  const on = createRunCombat({ registries, rng: createRng(4242), run: createRunState({ seed: 5, classId: 'reaver', registries, profileMeta: { settings: { [MOMENTUM_KEY]: true } } }), enemyIds: [ENEMY], settings: {} });
  on.normalPreview.state.momentum = { [on.enemies[0].id]: 2 };
  const shown = fakeScreen({ combat: on });
  assert.equal(shown.ribbon.dataset.momentum, 'good');
  assert.equal(shown.ribbon.children.length, 1);
  assert.equal(shown.ribbon.children[0].textContent, '++');
  assert.equal('combatRounds' in shown.root.dataset, false, 'a normal fight has no rounds marker');
  const off = createRunCombat({ registries, rng: createRng(4242), run: createRunState({ seed: 5, classId: 'reaver', registries, profileMeta: { settings: {} } }), enemyIds: [ENEMY], settings: {} });
  const none = fakeScreen({ combat: off });
  assert.equal('momentum' in none.ribbon.dataset, false, 'off: no tone on the banner');
  assert.equal(none.ribbon.children.length, 0, 'off: no tab');
});
