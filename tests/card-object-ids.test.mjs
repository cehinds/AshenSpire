import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeCardObjects } from '../tools/card-components.mjs';
import { contentBundle } from '../src/content/index.js';

test('standalone card objects export the real catalog including dotted namespace IDs',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ashen-card-objects-'));
  try {
    const cards=Object.fromEntries(contentBundle.cards.map(card=>[card.id,{id:card.id,name:card.name}]));
    writeCardObjects({cards},dir);
    assert.deepEqual(JSON.parse(readFileSync(join(dir,'cards','base.persistent-protection.json'),'utf8')),cards['base.persistent-protection']);
    assert.deepEqual(JSON.parse(readFileSync(join(dir,'cards','index.json'),'utf8')).cards,Object.keys(cards));
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
test('card export rejects traversal, separators, empty namespace segments and its reserved index file',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ashen-card-objects-'));
  try {
    for(const id of ['../escaped','base/escaped','base\\escaped','.base','base..card','base.','..','index','base.\0card']) {
      assert.throws(()=>writeCardObjects({cards:{[id]:{id}}},dir),/Unsafe card id/);
    }
    assert.equal(existsSync(join(dir,'escaped.json')),false);
    assert.equal(existsSync(join(dir,'cards','index.json')),false);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
