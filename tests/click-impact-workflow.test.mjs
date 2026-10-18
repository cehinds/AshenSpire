import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/quick-start.yml',import.meta.url),'utf8');
const start=workflow.indexOf('      - name: Click to contact within 400 ms');
const next=workflow.indexOf('\n      - name:',start+1);
const acceptance=workflow.slice(start,next<0?undefined:next);

test('timing acceptance is uninstrumented and a failed gate remains authoritative',()=>{
 assert.ok(start>=0);
 assert.match(acceptance,/id: click_impact/);
 assert.match(acceptance,/node tools\/verdict\.mjs -- node tools\/click-impact-probe\.mjs 2>&1 \| tee \/tmp\/probe\.log/);
 assert.match(acceptance,/exit \$rc\s*$/,'the probe exit code stays the step verdict');
 assert.doesNotMatch(acceptance,/--diagnostics|continue-on-error|\|\|\s*true/);
});

test('diagnostics run only after acceptance failure and cannot replace the gate',()=>{
 assert.ok(next>start,'a separate diagnostic step follows acceptance');
 const diagnostics=workflow.slice(next);
 assert.match(diagnostics,/if:.*failure\(\).*steps\.click_impact\.outcome == 'failure'/);
 assert.match(diagnostics,/run: node tools\/verdict\.mjs -- node tools\/click-impact-probe\.mjs --diagnostics/);
 assert.doesNotMatch(diagnostics,/continue-on-error|\|\|\s*true/);
});
