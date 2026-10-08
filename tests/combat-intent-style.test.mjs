import test from 'node:test';
import assert from 'node:assert/strict';
import { combatIntentPresentation as view } from '../src/ui/models/CombatIntentModel.js';

test('unknown and three partial families never expose concealed values', () => {
  assert.deepEqual(view({ kind:'unknown', moveId:null }), {visibility:'unknown', title:'?', parts:[], stance:'unknown'});
  for (const [stance,title,icon] of [
    ['attacking','Attacking ?','attack'], ['smashing','Attacking ?','attack'],
    ['ranged','Attacking ?','attack'], ['defending','Defending ?','defend'],
    ['countering','Defending ?','defend'], ['casting','Preparing ?','prepare'],
  ]) {
    const result = view({hidden:true, stance, damage:99, block:88, counterDamage:77});
    assert.equal(result.visibility,'partial'); assert.equal(result.title,title);
    assert.deepEqual(result.parts,[{icon,value:null}]);
  }
});

test('known intent titles and icon rows match the approved six states', () => {
  for (const [intent,title,parts] of [
    [{kind:'attack',damage:8},'Attacking',[{icon:'attack',value:'8'}]],
    [{kind:'attack',stance:'smashing',damage:12},'Smashing',[{icon:'smash',value:'12'}]],
    [{kind:'block',stance:'countering',block:6,counterDamage:4},'Countering',[{icon:'defend',value:'6'},{icon:'attack',value:'4'}]],
    [{kind:'debuff',stance:'casting'},'Casting',[{icon:'cast',value:null}]],
    [{kind:'buff',stance:'casting'},'Buffing',[{icon:'buff',value:null}]],
    [{kind:'block',block:6},'Defending',[{icon:'defend',value:'6'}]],
  ]) {
    const result = view(intent); assert.equal(result.visibility,'known');
    assert.equal(result.title,title); assert.deepEqual(result.parts,parts);
  }
});

test('damage sequences and zero values stay readable without inventing missing amounts', () => {
  assert.equal(view({kind:'attack',damage:2,hits:3,hitDamages:[2,5,5]}).parts[0].value,'2+5+5');
  assert.equal(view({kind:'block',block:0}).parts[0].value,'0');
  assert.equal(view({kind:'block',stance:'countering',block:6}).parts[1].value,null);
});
