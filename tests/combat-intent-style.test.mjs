import test from 'node:test';
import assert from 'node:assert/strict';
import { combatIntentPresentation as view } from '../src/ui/models/CombatIntentModel.js';

test('knowledge reads retain unknown and broad-clue privacy', () => {
  const hidden = { kind:'unknown', stance:'unknown', moveId:null, hidden:true, damage:999 };
  assert.equal(view({ ...hidden, knowledgeRead:'unknown', label:'?' }).visibility, 'unknown');
  for (const [label,title] of [['Attack?','Attacking ?'],['Magic?','Preparing ?'],['Preparing?','Preparing ?']]) {
    const result = view({ ...hidden, knowledgeRead:'clue', label });
    assert.equal(result.title,title);
    assert.equal(result.parts[0].value,null);
  }
  assert.equal(view({ ...hidden, knowledgeRead:'clue', label:'private action' }).visibility,'unknown');
});

test('unknown and three partial families never expose concealed values', () => {
  assert.deepEqual(view({ kind:'unknown', moveId:null }), {visibility:'unknown', title:'?', parts:[], stance:'unknown', damageClass:null});
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
    [{kind:'block',stance:'countering',block:6,counterDamage:4},'Countering',[{icon:'counter',value:'6'},{icon:'attack',value:'4'}]],
    [{kind:'block',stance:'countering',block:6,counterDamage:0,counterPoiseDamage:4},'Countering',[{icon:'counter',value:'6'},{icon:'smash',value:'4'}]],
    [{kind:'debuff',stance:'casting'},'Casting',[{icon:'cast',value:null}]],
    [{kind:'buff',stance:'casting'},'Buffing',[{icon:'buff',value:null}]],
    [{kind:'block',block:6},'Defending',[{icon:'defend',value:'6'}]],
  ]) {
    const result = view(intent); assert.equal(result.visibility,'known');
    assert.equal(result.title,title); assert.deepEqual(result.parts,parts);
  }
});

test('mixed counters preserve separate HP and Poise values without relabeling either amount', () => {
  assert.deepEqual(view({kind:'block',stance:'countering',block:6,counterDamage:3,counterPoiseDamage:4}).parts,
    [{icon:'counter',value:'6'},{icon:'attack',value:'3'},{icon:'smash',value:'4'}]);
  assert.deepEqual(view({hidden:true,stance:'countering',block:6,counterDamage:3,counterPoiseDamage:4}).parts,
    [{icon:'defend',value:null}]);
});

test('damage sequences and zero values stay readable without inventing missing amounts', () => {
  assert.equal(view({kind:'attack',damage:2,hits:3,hitDamages:[2,5,5]}).parts[0].value,'2+5+5');
  assert.equal(view({kind:'block',block:0}).parts[0].value,'0');
  assert.equal(view({kind:'block',stance:'countering',block:6}).parts[1].value,null);
});

test('read intents tint only when the read passes: clues and known or partial families', () => {
  const hidden = { kind:'unknown', stance:'unknown', moveId:null, hidden:true, damage:999 };
  const attackClue = view({ ...hidden, knowledgeRead:'clue', label:'Attack?' });
  assert.equal(attackClue.damageClass,'physical'); assert.equal(attackClue.parts[0].icon,'attack');
  const magicClue = view({ ...hidden, knowledgeRead:'clue', label:'Magic?' });
  assert.equal(magicClue.damageClass,'magic'); assert.equal(magicClue.parts[0].icon,'cast');
  assert.equal(magicClue.title,'Preparing ?');
  assert.equal(view({ ...hidden, knowledgeRead:'clue', label:'Preparing?' }).damageClass,null);
  assert.equal(view({ ...hidden, knowledgeRead:'unknown', label:'?' }).damageClass,null);
  assert.equal(view({ kind:'unknown', moveId:null }).damageClass,null);
  assert.equal(view({ kind:'staggered', damage:5 }).damageClass,null);
  for (const [intent,damageClass] of [
    [{kind:'attack',damage:8},'physical'],
    [{kind:'attack',stance:'smashing',damage:12},'physical'],
    [{kind:'attack',stance:'ranged',damage:4},'physical'],
    [{kind:'attack',stance:'sweeping',damage:4},'physical'],
    [{kind:'attack',profile:{camp:'spell'},damage:8},'magic'],
    [{kind:'block',block:6},null],
    [{kind:'block',stance:'countering',block:6,counterDamage:4},null],
    [{kind:'buff',stance:'casting'},null],
    [{kind:'debuff',stance:'casting'},null],
    [{kind:'debuff',stance:'casting',profile:{camp:'magic'}},'magic'],
  ]) assert.equal(view(intent).damageClass,damageClass, JSON.stringify(intent));
  assert.equal(view({hidden:true,stance:'attacking',damage:99}).damageClass,'physical');
  assert.equal(view({hidden:true,stance:'defending',block:9}).damageClass,null);
  assert.equal(view({hidden:true,stance:'casting',profile:{camp:'spells'}}).damageClass,'magic');
});
