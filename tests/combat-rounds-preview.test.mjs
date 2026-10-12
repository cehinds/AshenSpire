// Combat Rounds Preview (SPEC §4.11), phase P2: the setting row, the frozen
// rules, and the fight's `combatRounds` field, which exists only when on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigRows } from '../src/model/advancedConfig.js';
import { COMBAT_ROUNDS_KEY, combatRoundsFor, combatRoundsRows } from '../src/model/combatRounds.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { categoryHandler } from '../src/ui/screens/settings.js';
import { advancedSection } from '../src/ui/models/AdvancedSettingsGroups.js';
import { visibleAdvancedGroups } from '../src/ui/screens/settings.js';

const registries = createRegistries(contentBundle);
const ENEMY = 'wanderingSoldier';
const fight = (run, settings = {}) => createRunCombat({ registries, rng: createRng(4242), run, enemyIds: [ENEMY], settings });

test('the preview is off by default, in the row and in the rules', () => {
  const [row] = combatRoundsRows();
  assert.equal(row.key, COMBAT_ROUNDS_KEY);
  assert.equal(row.def, false);
  assert.equal(combatRoundsFor({}), null);
  assert.equal(combatRoundsFor({ [COMBAT_ROUNDS_KEY]: false }), null);
  assert.equal(combatRoundsFor({ [COMBAT_ROUNDS_KEY]: 'yes' }), null, 'only a boolean true turns it on');
  assert.equal(combatRoundsFor(undefined), null);
});

test('on: frozen rules with the speed merge and the parsed tables', () => {
  const rules = combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true });
  assert.deepEqual({ version: rules.version, merge: rules.merge, decay: rules.decay }, { version: 1, merge: 'speed', decay: 1 });
  assert.ok(Object.isFrozen(rules) && Object.isFrozen(rules.tables));
  assert.equal(rules.tables.stanceAdvantage['smash>block'], 2);
  assert.equal(rules.tables.evasionArmor.Cloth.dexCap, 4);
  assert.equal(rules.tables.evasionCards.Backstep, 5);
  assert.equal(rules.tables.evadeBonus.evade, 20);
  assert.equal(JSON.parse(JSON.stringify(rules)).merge, 'speed', 'the rules survive a JSON save');
});

test('the row sits in Advanced → Combat, and that group is debug-only', () => {
  const row = categoryHandler('Advanced').rows.find((r) => r.key === COMBAT_ROUNDS_KEY);
  assert.ok(row, 'the row is on the Advanced screen');
  assert.equal(advancedSection(row), 'Combat');
  assert.equal(row.label, 'Combat rounds preview');
  assert.ok(advancedConfigRows(contentBundle).some((r) => r.key === COMBAT_ROUNDS_KEY));
  assert.ok(visibleAdvancedGroups(true).some((g) => g.id === 'Combat'), 'dev and test builds show the group');
  assert.ok(!visibleAdvancedGroups(false).some((g) => g.id === 'Combat'), 'a release build hides it');
});

test('rules are frozen at New Run: a later live change does not reach the fight', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true } } });
  assert.equal(run.advancedConfigSnapshot.overrides[COMBAT_ROUNDS_KEY], true);
  // The live setting is now off; the fight reads the run's own snapshot.
  const on = fight(run, { [COMBAT_ROUNDS_KEY]: false });
  assert.deepEqual(on.combatRounds.rules, combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true }));
  // A run born with the preview off stays off even if the live setting is on.
  const off = createRunState({ seed: 3, classId: 'reaver', registries, profileMeta: { settings: {} } });
  assert.equal('combatRounds' in fight(off, { [COMBAT_ROUNDS_KEY]: true }), false);
  // A run from before the row existed has no snapshot key and reads as off.
  const legacy = { ...off, advancedConfigSnapshot: undefined };
  assert.equal('combatRounds' in fight(legacy, { [COMBAT_ROUNDS_KEY]: true }), false);
});

test('combat.combatRounds is stamped only when on, with empty state', () => {
  const run = createRunState({ seed: 5, classId: 'rogue', registries, profileMeta: { settings: {} } });
  const rng = createRng(4242);
  const offCombat = createRunCombat({ registries, rng, run, enemyIds: [ENEMY], settings: {} });
  assert.equal('combatRounds' in offCombat, false, 'off: the field is absent');
  assert.equal('combatRounds' in rng.getCounters(), false, 'off: no RNG counter is written');

  const onRun = createRunState({ seed: 5, classId: 'rogue', registries, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true } } });
  const onCombat = createRunCombat({ registries, rng: createRng(4242), run: onRun, enemyIds: [ENEMY], settings: {} });
  assert.deepEqual(Object.keys(onCombat.combatRounds).sort(), ['charges', 'momentum', 'poiseDouble', 'rules']);
  assert.deepEqual({ momentum: onCombat.combatRounds.momentum, poiseDouble: onCombat.combatRounds.poiseDouble, charges: onCombat.combatRounds.charges }, { momentum: {}, poiseDouble: {}, charges: {} });
  assert.equal(onCombat.combatRounds.rules.version, 1);
});
