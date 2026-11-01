// Weakness chips (owner, 2026-11-01; SPEC 5.3): an icon per trigger, a tooltip, and discovery gating.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { WEAKNESS_ICON, weaknessIconId } from '../src/model/weaknessIcons.js';
import { WEAKNESS_HIT_TRIGGERS, WEAKNESS_STATUSES } from '../src/model/enemyWeaknessRules.js';
import { hasTagSymbol } from '../src/ui/components/cardTagSymbols.js';

test('every weakness trigger and every authored weakness has a real icon, never a letter', () => {
  const triggers = new Set([...WEAKNESS_HIT_TRIGGERS, ...WEAKNESS_STATUSES]);
  for (const def of contentBundle.enemies) for (const row of def.weaknesses || []) triggers.add(row.to);
  assert.ok(triggers.size >= 15);
  for (const to of triggers) {
    assert.ok(weaknessIconId(to), `${to} has an icon id`);
    assert.ok(hasTagSymbol(weaknessIconId(to)), `${to} icon ${weaknessIconId(to)} resolves to a mark`);
  }
  assert.deepEqual([...triggers].filter(to => !Object.hasOwn(WEAKNESS_ICON, to)), []);
});

import { withKitDom } from './helpers/kit-dom.mjs';
import { weaknessChips, weaknessChipText } from '../src/ui/components/weaknessChips.js';

test('a chip is a labelled square icon with the badge tooltip attached', () => {
  withKitDom(() => {
    const [chip] = weaknessChips([{ to: 'piercing', effect: 'damage' }]);
    assert.equal(chip.getAttribute('aria-label'), 'Weak to Piercing: +25% damage');
    assert.equal(chip.dataset.weakness, 'piercing');
    assert.equal(chip.dataset.tipAttached, 'true', 'the shared tooltip is attached');
    assert.equal(chip.querySelectorAll('svg').length, 1, 'one real icon, no letter');
    assert.equal(chip.textContent, '');
    assert.equal(weaknessChipText({ to: 'burn', effect: 'tick' }).full, 'Weak to Burn: ticks harder');
  });
});

import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { discoveredWeaknesses, recordWeaknessDiscoveries, weaknessDiscoveryProblems } from '../src/model/weaknessDiscovery.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const newRun = () => createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const fight = (run, enemyIds = ['wanderingSoldier']) => createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds });
const shown = (run, enemy) => discoveredWeaknesses(enemy.weaknesses, run.weaknessDiscovery, enemy.enemyId);

test('an undiscovered weakness shows nothing; a weaknessTriggered event reveals it, with the right icon and tooltip text', () => {
  withKitDom(() => {
    const run = newRun(), combat = fight(run), enemy = combat.enemies[0];
    const [authored] = enemy.weaknesses;
    assert.deepEqual(shown(run, enemy), [], 'nothing before discovery');
    assert.deepEqual(weaknessChips(shown(run, enemy)), []);
    run.weaknessDiscovery ||= {};
    combat.emit('weaknessTriggered', { sourceId: 'player', targetId: enemy.id, to: authored.to, effect: authored.effect, amount: authored.amount });
    assert.equal(recordWeaknessDiscoveries(run.weaknessDiscovery, combat.eventLog, combat.enemies), true);
    assert.equal(recordWeaknessDiscoveries(run.weaknessDiscovery, combat.eventLog, combat.enemies), false, 'idempotent');
    const chips = weaknessChips(shown(run, enemy));
    assert.equal(chips.length, 1, 'only the triggered weakness');
    assert.equal(chips[0].dataset.weakness, authored.to);
    assert.equal(chips[0].getAttribute('aria-label'), weaknessChipText(authored).full);
    assert.match(chips[0].getAttribute('aria-label'), /^Weak to \w+: /);
  });
});

test('a discovery holds for every enemy of that type, on later fights, and through save and load', () => {
  const run = newRun(), first = fight(run).enemies[0];
  run.weaknessDiscovery = {};
  recordWeaknessDiscoveries(run.weaknessDiscovery, [{ type: 'weaknessTriggered', targetId: first.id, to: first.weaknesses[0].to, effect: first.weaknesses[0].effect }], [first]);
  const next = fight(run, ['wanderingSoldier', 'wanderingSoldier']);
  for (const enemy of next.enemies) assert.equal(shown(run, enemy).length, 1, 'same type, later fight');
  const loaded = deserializeRun(serializeRun(run));
  assert.deepEqual(loaded.weaknessDiscovery, run.weaknessDiscovery, 'save and load keep it');
  assert.equal(shown(loaded, next.enemies[0]).length, 1);
  const other = fight(run, ['lanternMoth']).enemies[0];
  assert.deepEqual(shown(run, other), [], 'another enemy type learns nothing');
  assert.deepEqual(weaknessDiscoveryProblems({ wanderingSoldier: ['blunt:damage'] }), []);
  assert.ok(weaknessDiscoveryProblems({ wanderingSoldier: 'blunt' }).length);
});

import { projectEnemyKnowledge } from '../src/model/enemyKnowledgeView.js';
import { weaknessTraitRows } from '../src/model/enemyWeaknessRules.js';

test('the inspector and bestiary rows follow the same discovery gate', () => {
  const run = newRun(), enemy = fight(run).enemies[0], def = reg.enemies.get(enemy.enemyId);
  const record = { target: 30, receipts: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`r${i}`, { bonus: false }])) };
  const names = () => projectEnemyKnowledge(def, record, { registries: reg, weaknesses: shown(run, enemy) }).traits.map(row => row.name);
  assert.ok(!names().some(name => name.startsWith('Weak to')), 'undiscovered: the inspector does not spoil it');
  run.weaknessDiscovery = {};
  recordWeaknessDiscoveries(run.weaknessDiscovery, [{ type: 'weaknessTriggered', targetId: enemy.id, to: enemy.weaknesses[0].to, effect: enemy.weaknesses[0].effect }], [enemy]);
  assert.deepEqual(names().filter(name => name.startsWith('Weak to')), weaknessTraitRows([enemy.weaknesses[0]]).map(row => row.name));
  assert.ok(!projectEnemyKnowledge(def, record, { registries: reg, weaknesses: [] }).traits.some(row => row.name.startsWith('Weak to')), 'the bestiary passes none');
});
