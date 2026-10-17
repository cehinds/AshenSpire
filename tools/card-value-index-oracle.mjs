// Record the independent pre-index implementation against today's content.
// Never generate parity expectations from the optimized production model.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { cardValueIndexCases, cardValueOracleOutput } from '../tests/helpers/card-value-index-cases.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const baselineCommit = '04adc68513b3f13f2b5c28702edce4ec513202a1';
const implementation = execFileSync('git', ['show', `${baselineCommit}:src/model/attackCardDamage.js`], { cwd: root, encoding: 'utf8' });
const digest = text => createHash('sha256').update(text).digest('hex');
const modelSha256 = digest(implementation);
if (modelSha256 !== '0ff1b72895151ead0a62edd338da3c80a1c84daaab306fb760ddc3f85c416dc1') throw new Error('Historical oracle implementation identity changed');
const oracle = await import(`data:text/javascript;base64,${Buffer.from(implementation).toString('base64')}`);
const baseline = { baselineCommit, baselineImplementation: 'unindexed Dev model with integrated Core/default and base-card content',
  modelSha256, contentSha256: digest(JSON.stringify(contentBundle)),
  scope: 'damage configuration, projected card definitions, validation problem rows', cases: {} };
for (const [name, bundle] of cardValueIndexCases()) {
  baseline.cases[name] = {};
  for (const method of ['materializeCardValueBonuses', 'projectAttackCardDamageBundle', 'attackCardDamageConfigProblems']) {
    try { baseline.cases[name][method] = { sha256: digest(JSON.stringify(cardValueOracleOutput(method, oracle[method](bundle))) ?? 'undefined') }; }
    catch (error) { baseline.cases[name][method] = { error: error.message, type: error.constructor.name }; }
  }
}
writeFileSync(new URL('../tests/fixtures/card-value-tag-index-baseline.json', import.meta.url), JSON.stringify(baseline, null, 2) + '\n');
console.log(`Recorded ${Object.keys(baseline.cases).length} current-content cases using pinned pre-index model ${modelSha256}`);
