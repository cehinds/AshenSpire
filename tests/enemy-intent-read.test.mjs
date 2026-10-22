import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enemyIntentRead } from '../src/ui/models/EnemyIntentReadModel.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { baseRegistries } from './helpers/fixcore-combat-rules.mjs';

for (const flags of [{ hidden: true }, { revealed: false }]) test(`unread intent ${JSON.stringify(flags)} never looks up a private action`, () => {
  const combat = { registries: { enemies: { get() { throw new Error('private action was read'); } } } };
  const view = enemyIntentRead(combat, { enemyId: 'secret' }, { preview: { ...flags, moveId: 'secretAction', label: 'Concealed', stance: 'prepared' }, unknownDetail: 'Unknown' });
  assert.equal(view.name, 'Concealed');
  assert.equal(view.detail, 'Unknown');
  assert.equal(view.hidden, true);
});

test('a revealed boss support tooltip resolves only its current formula and condition, without state or RNG changes', () => {
  const run = createRunState({ registries: baseRegistries, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries: baseRegistries, run, rng: createRng(511), enemyIds: ['marrowOrganist'] });
  const enemy = combat.enemies[0], def = baseRegistries.enemies.get(enemy.enemyId);
  const move = { ...def.moves.quietRefrain, name: 'Quiet Refrain', effects: [{ op: 'heal', target: 'self',
    amount: { f: 'percentMaxHp', of: 'self', pct: 10 }, if: { p: 'hasStatus', of: 'self', status: 'strength' } }] };
  const moves = new Proxy({ quietRefrain: move }, {
    ownKeys() { throw new Error('tooltip enumerated the full move set'); },
    get(target, key) { if (key !== 'quietRefrain') throw new Error(`tooltip read another move: ${String(key)}`); return target[key]; },
  });
  combat.registries = { ...baseRegistries, enemies: { ...baseRegistries.enemies, get(id) {
    return id === enemy.enemyId ? { ...def, moves } : baseRegistries.enemies.get(id);
  } } };
  enemy.maxHp = 1000; enemy.hp = 500; enemy.statuses = {};
  const before = JSON.stringify({ enemy, player: combat.player, queue: combat.queue, events: combat.eventLog, rng: combat.rng.getCounters() });
  const preview = { kind: 'buff', moveId: 'quietRefrain', hidden: false, revealed: true, knowledgeRead: 'exact', stance: 'prepared' };
  const view = enemyIntentRead(combat, enemy, { preview });
  assert.equal(view.name, 'Quiet Refrain');
  assert.match(view.detail, /Heal self for 100 \(condition not met\)/);
  assert.doesNotMatch(view.detail, /variable|\[object Object\]|"f"/);
  assert.equal(view.knowledgeRead, 'exact');
  assert.equal(view.active, true);
  assert.equal(JSON.stringify({ enemy, player: combat.player, queue: combat.queue, events: combat.eventLog, rng: combat.rng.getCounters() }), before);
  assert.deepEqual(enemyIntentRead(combat, enemy, { preview }), view);
  enemy.statuses.strength = { stacks: 1 };
  assert.doesNotMatch(enemyIntentRead(combat, enemy, { preview }).detail, /condition not met/);
});

test('full inspection can reuse its already resolved current row without another lookup', () => {
  const combat = { registries: { enemies: { get() { throw new Error('duplicate projection'); } } } };
  const view = enemyIntentRead(combat, {}, { preview: { moveId: 'heal', revealed: true },
    inspectedMoves: [{ moveId: 'heal', name: 'Heal', detail: 'Heal self for 7' }] });
  assert.equal(view.detail, 'Heal self for 7');
});

test('the intent tooltip projects a fresh current read without opening full combatant inspection', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const tooltip = source.slice(source.indexOf('  function intentEl(enemy)'), source.indexOf('  function renderEnemies()'));
  assert.match(tooltip, /enemyIntentRead\(combat, enemy/);
  assert.match(tooltip, /projectCombatIntent\(combat, enemy.id\)/);
  assert.match(tooltip, /busy \|\| enemyPlayback \|\| combat.pendingReaction/);
  assert.match(tooltip, /disp\?\.ents\[enemy.id\]\?\.intentPreview/);
  assert.doesNotMatch(tooltip, /combatantSubject|enemyDeckInspection|Object\.keys/);
});
