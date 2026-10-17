import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
test('offline summary overlaps phase windows and validates immutable pins', () => {
  const dir=mkdtempSync(join(tmpdir(),'combat-summary-'));
  const sourceCommit='499ecee90255201d99be6b18d7e5cf620332f1fe';
  const helperCommit='7a550cdb1941f4d86dfd728daca02ea6edbe76fa';
  const put=(name,data)=>writeFileSync(join(dir,name),JSON.stringify(data));
  const run=()=>spawnSync(process.execPath,[resolve('tools/combat-feedback-summary.mjs'),dir],{encoding:'utf8'});
  try {
    put('manifest.json',{sourceCommit,helperCommit});
    for(let i=1;i<=3;i++) {
      const base={sourceCommit,clock:{metrics:{NavigationStart:1}},errors:[]};
      put(`play-${i}-cpu.json`,{...base,profile:{startTime:1000000,nodes:[{id:1,callFrame:{functionName:'example',url:'local',lineNumber:0}}],samples:[1],timeDeltas:[30000]}});
      put(`play-${i}-trace.json`,{...base,traceEvents:[{name:'Layout',ph:'X',ts:1005000,dur:20000}],dropped:0});
      put(`play-${i}-measurements.json`,{...base,sample:{diagnostic:{up:10,contact:20,number:30,trace:[]}}});
    }
    const good=run(); assert.equal(good.status,0,good.stderr);
    const lines=good.stdout.split('\n').filter(x=>x.startsWith('OBSERVATIONAL PHASE SUMMARY '));
    assert.equal(lines.length,3);
    for(const line of lines) {
      assert.ok(Buffer.byteLength(line.slice(28))<=24*1024);
      const value=JSON.parse(line.slice('OBSERVATIONAL PHASE SUMMARY '.length));
      assert.equal(value.phases[0].self[0].ms,10);
      assert.equal(value.phases[0].events[0].overlap,10);
      assert.equal(value.phases[1].events[0].overlap,5);
    }
    put('manifest.json',{sourceCommit,helperCommit:'wrong'}); assert.notEqual(run().status,0);
    put('manifest.json',{sourceCommit,helperCommit}); put('unexpected.json',{}); assert.notEqual(run().status,0);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
