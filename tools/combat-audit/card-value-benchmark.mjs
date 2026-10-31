// Informational operation timings: no flaky wall-time assertions.
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { readFileSync, writeFileSync } from 'node:fs';
import { contentBundle } from '../../src/content/index.js';
import { materializeCardValueBonuses, projectAttackCardDamageBundle, attackCardDamageConfigProblems } from '../../src/model/attackCardDamage.js';
const baselineSource = process.env.CARD_VALUE_BASELINE_SHA
  ? execFileSync('git', ['show', `${process.env.CARD_VALUE_BASELINE_SHA}:src/model/attackCardDamage.js`], { encoding: 'utf8' }) : null;
const baseline = baselineSource ? await import(`data:text/javascript;base64,${Buffer.from(baselineSource).toString('base64')}`) : null;
const result = { load: readFileSync('/proc/loadavg', 'utf8').trim(), cards: contentBundle.cards.length, tagRows: contentBundle.tagging.length, operations: {} };
for (const operation of [materializeCardValueBonuses, projectAttackCardDamageBundle, attackCardDamageConfigProblems]) {
  const variants = baseline ? { before: baseline[operation.name], after: operation } : { current: operation };
  const samples = Object.fromEntries(Object.keys(variants).map(name => [name, []]));
  for (let i = 0; i < 3; i++) for (const fn of Object.values(variants)) fn(contentBundle);
  // Alternate versions in one process so each pair shares the same host load.
  for (let i = 0; i < 9; i++) for (const [name, fn] of Object.entries(variants)) {
    const began = performance.now(); fn(contentBundle); samples[name].push(+(performance.now() - began).toFixed(3));
  }
  result.operations[operation.name] = Object.fromEntries(Object.entries(samples).map(([name, values]) => {
    const ordered = [...values].sort((a, b) => a - b);
    return [name, { samples: values, medianMs: ordered[4] }];
  }));
}
console.log(JSON.stringify(result, null, 2));
if (process.env.CARD_VALUE_OUT) writeFileSync(process.env.CARD_VALUE_OUT, JSON.stringify(result, null, 2));
