import assert from 'node:assert/strict';
import { createRng } from '../src/engine/rng.js';
import { enemyKnowledge } from '../src/content/enemyKnowledge.js';
import { snapshotEnemyKnowledgeRules, enemyKnowledgeRuleProblems } from '../src/model/enemyKnowledgeRules.js';
import { identificationChance, predictionCategory, broadIntentLabel, rollKnowledgeRead, concealKnowledgeIntent } from '../src/model/enemyIntentKnowledge.js';
import { emptyEnemyKnowledge, mergeEnemyKnowledge, enemyKnowledgeProblems, knowledgePoints, knowledgeProgress } from '../src/model/enemyKnowledgeProfile.js';
import { advancePerception, perceptionProblems } from '../src/model/perception.js';

const rules = snapshotEnemyKnowledgeRules();
assert.equal(identificationChance(rules), .3);
assert.ok(Math.abs(identificationChance(rules, { wisdom: 3, intelligence: 2 }, 5, 2) - .43) < 1e-12);
assert.equal(identificationChance(rules, { wisdom: 999 }, 999, 999), .9);
assert.equal(identificationChance(rules, { wisdom: -100 }, -3, -100), .3);
assert.equal(identificationChance(rules, {}, 1, 0, 'Clue'), .5);
const originalBase = enemyKnowledge.reads.baseExact;
rules.reads.baseExact = .25;
assert.equal(enemyKnowledge.reads.baseExact, originalBase);
rules.reads.baseExact = .3;
assert.deepEqual(enemyKnowledgeRuleProblems(rules), []);
const invalid = structuredClone(rules); invalid.reads.minimumExact = .2; invalid.reads.maximumExact = .1;
assert.ok(enemyKnowledgeRuleProblems(invalid).length);
invalid.reads.minimumExact = 0; invalid.reads.maximumExact = .9; invalid.bestiary.perEnemy.missing = { encountersToMaster: 30 };
assert.ok(enemyKnowledgeRuleProblems(invalid, new Set(['soldier'])).length);

for (const [maneuver, category] of Object.entries({ attack: 'Attack', smash: 'Smash', sweep: 'Sweep', ranged: 'Ranged', defend: 'Defend', counter: 'Counter' })) {
  assert.equal(predictionCategory({ profile: { camp: 'martial', maneuver } }), category);
  assert.equal(broadIntentLabel(category), ['Defend', 'Counter'].includes(category) ? 'Preparing?' : 'Attack?');
}
assert.equal(predictionCategory({ stance: 'casting', profile: { camp: 'spell' } }), 'Spell');
assert.equal(predictionCategory({ profile: { camp: 'spell' } }, undefined, { charging: true }), 'Casting');
assert.equal(broadIntentLabel('Spell'), 'Magic?');
assert.equal(predictionCategory({ kind: 'staggered', profile: { camp: 'spell' } }), 'Staggered');
assert.equal(predictionCategory({ kind: 'support' }), 'Preparing');

const rng = createRng(74291), untouched = createRng(74291);
const counts = { exact: 0, clue: 0, unknown: 0 };
for (let n = 0; n < 30000; n++) counts[rollKnowledgeRead(rng, rules, { attributes: {}, level: 1, perception: 0 }, 'Attack').visibility]++;
for (const [key, probability] of Object.entries({ exact: .3, clue: .35, unknown: .35 })) assert.ok(Math.abs(counts[key] / 30000 - probability) < .015, `${key} distribution ${counts[key]}`);
assert.equal(rng.getCounters().enemyIntentVisibility, 30000);
assert.equal(rng.getCounters().enemyIntentClue, 30000);
assert.equal(rng.float('enemyAI'), untouched.float('enemyAI'));
const saved = createRng(rng.seed, rng.getCounters());
assert.deepEqual(rollKnowledgeRead(rng, rules, {}, 'Spell'), rollKnowledgeRead(saved, rules, {}, 'Spell'));
const read = { visibility: 'clue', label: 'Attack?', prediction: 'Smash', credited: true };
const before = structuredClone(read), counters = rng.getCounters();
for (let n = 0; n < 30; n++) assert.deepEqual(concealKnowledgeIntent(read, 8), {
  kind: 'unknown', hidden: true, revealed: false, stance: 'unknown', moveId: null, label: 'Attack?', knowledgeRead: 'clue', actionSerial: 8,
});
assert.deepEqual(read, before); assert.deepEqual(rng.getCounters(), counters);
assert.equal(concealKnowledgeIntent({ visibility: 'unknown', label: 'Smash?' }, 3).label, '?');

const ledger = (entries, target = 30) => ({ version: 1, enemies: { soldier: { target, receipts: Object.fromEntries(entries.map(([id, bonus]) => [id, { bonus }])) } } });
let knowledge = mergeEnemyKnowledge(ledger([['run1:node1:1', false]]), emptyEnemyKnowledge());
assert.equal(knowledgeProgress(knowledge.enemies.soldier).stage, 1);
knowledge = mergeEnemyKnowledge(ledger([['run1:node1:1', false]]), knowledge);
assert.equal(knowledgePoints(knowledge.enemies.soldier), 1);
knowledge = mergeEnemyKnowledge(ledger([['run1:node1:1', true], ['run2:node1:1', false]]), knowledge);
assert.equal(knowledgePoints(knowledge.enemies.soldier), 3);
assert.equal(knowledge.enemies.soldier.receipts['run1:node1:1'].bonus, true);
knowledge = mergeEnemyKnowledge(ledger([['run1:node1:1', false]], 50), knowledge);
assert.equal(knowledge.enemies.soldier.target, 30);
assert.equal(knowledgePoints(knowledge.enemies.soldier), 3);
const nearMastery = ledger(Array.from({ length: 29 }, (_, n) => [`a${n}`, false]));
const staleBatch = ledger(Array.from({ length: 30 }, (_, n) => [`b${n}`, false]));
const mastered = mergeEnemyKnowledge(staleBatch, nearMastery);
assert.equal(Object.keys(mastered.enemies.soldier.receipts).length, 30);
assert.equal(knowledgeProgress(mastered.enemies.soldier).stage, 5);
assert.deepEqual(mergeEnemyKnowledge(staleBatch, mastered), mastered);
const counterMastery = mergeEnemyKnowledge(ledger(Array.from({ length: 15 }, (_, n) => [`c${n}`, true])), emptyEnemyKnowledge());
assert.equal(knowledgePoints(counterMastery.enemies.soldier), 30);
assert.equal(Object.keys(counterMastery.enemies.soldier.receipts).length, 15);
for (const [points, stage] of [[1, 1], [5, 1], [6, 2], [12, 3], [21, 4], [30, 5]]) assert.equal(knowledgeProgress(ledger(Array.from({ length: points }, (_, n) => [`s${n}`, false])).enemies.soldier).stage, stage);
assert.equal(knowledgeProgress(null).stage, 0);
assert.equal(knowledgeProgress(null).nextStage.points, 1);
assert.ok(enemyKnowledgeProblems(ledger(Array.from({ length: 31 }, (_, n) => [`x${n}`, false]))).length);
assert.ok(enemyKnowledgeProblems(JSON.parse('{"version":1,"enemies":{"__proto__":{"target":30,"receipts":{"r":{"bonus":false}}}}}')).length);
assert.ok(enemyKnowledgeProblems(ledger([['r', 1]])).length);

const perception = { xp: 0, level: 0, pendingDrafts: 0 };
assert.equal(advancePerception(perception, rules.perception, 2).levelUps, 0);
assert.equal(advancePerception(perception, rules.perception, 1).levelUps, 1);
assert.deepEqual(perception, { xp: 0, level: 1, pendingDrafts: 0 });
assert.equal(advancePerception(perception, rules.perception, 5).levelUps, 1);
assert.deepEqual(perceptionProblems(perception, rules.perception), []);
assert.ok(perceptionProblems({ ...perception, pendingDrafts: 1 }, rules.perception).length);
advancePerception(perception, rules.perception, 10000);
assert.equal(perception.level, 10);
assert.deepEqual(perceptionProblems(perception, rules.perception), []);
console.log('PASS enemy knowledge models: seeded conditional reads, inert projection, bounded monotonic receipts, stages and run Perception');
