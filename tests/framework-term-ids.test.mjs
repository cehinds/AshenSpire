import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntityTermOverlay } from '../src/framework/termOverlay.js';
test('term overlays preserve distinct namespaced and punctuation-bearing entity IDs',()=>{
  const ids=['base.persistent-block','basePersistentBlock','base.persistentBlock','e000062000061000073000065','base:status','01','λ-status'];
  const statuses=ids.map((id,index)=>({id,name:`Name ${index}`,tooltip:`Tooltip ${index}`}));
  const overlay=createEntityTermOverlay({statuses,stances:[]});
  for(const row of statuses)assert.deepEqual(overlay.statusDisplay(row.id),{name:row.name,tooltip:row.tooltip});
  assert.equal(overlay.statusDisplay('missing'),null);
});
