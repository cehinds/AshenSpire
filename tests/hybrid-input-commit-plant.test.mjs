import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const tool = readFileSync(new URL('../tools/hybrid-input-parity.mjs', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');

test('duplicate-commit plant still patches the real range-aware commit and trips its existing receipt judge', () => {
  const literal = tool.match(/\{\n      name: 'playCard commit door records a duplicate cardPlayed event',[\s\S]*?\n    \}/)?.[0];
  assert.ok(literal, 'read the actual plant object');
  const plant = runInNewContext(`(${literal})`);
  assert.equal(screen.split(plant.find).length - 1, 1, 'exactly one production commit door');
  assert.ok(screen.replace(plant.find, plant.replace).includes(plant.replace));
  assert.match(plant.find, /rangeRoute: rangeRoutesByCard\.get\(instanceId\) \?\? 'advance'/);
  const oneCommit = tool.match(/const oneCommit = ([\s\S]*?);\n/)?.[1];
  const heldJudge = tool.match(/check\((activations === 1 && heldCommits\.length === 1[\s\S]*?),\n        'held controller Confirm fires one activation and one multi-target commit'/)?.[1];
  assert.ok(oneCommit && heldJudge, 'use the real browser receipt predicate');
  const judge = context => runInNewContext(`const oneCommit = ${oneCommit}; ${heldJudge}`, context);
  for (const rangeRoute of ['advance', 'throw']) for (const statement of [plant.find, plant.replace]) {
    const combat = { eventLog: [] }, commands = [];
    const context = { combat, instanceId: 'strike', targetId: 'e1', rank: 2, choice: 'variant',
      rangeRoutesByCard: new Map([['strike', rangeRoute]]),
      dispatch: (_combat, command) => { commands.push(command); combat.eventLog.push({ type: 'cardPlayed', cardInstanceId: command.cardInstanceId }); return {}; } };
    runInNewContext(`let out; ${statement}`, context);
    assert.equal(commands.length, 1);
    assert.equal(commands[0].rangeRoute, rangeRoute, 'plant preserves the selected paid route');
    assert.equal(commands[0].choice, 'variant');
    const after = { plays: combat.eventLog.length, lastPlay: combat.eventLog.at(-1), pad: { mapping: 'standard', reads: 3 } };
    const accepted = judge({ activations: 1, heldCommits: combat.eventLog.map(event => event.cardInstanceId),
      multi: { id: 'strike' }, before: { plays: 0 }, after, heldReads: 2 });
    assert.equal(accepted, statement === plant.find, 'clean accepts; duplicate receipt is rejected');
  }
});
