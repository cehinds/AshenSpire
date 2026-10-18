// These cases use the production content boot door, not just the compiler API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { compileBindings, validateParameterSchema } from '../engine/runtime/bindings.mjs';
import { loadMechanics } from '../engine/runtime/interpreter.mjs';
const mechanics=loadMechanics();
const tag='defense:wardProtection';
const mutate=(table,index,edit)=>{
  const copy={...contentBundle,equipment:{...contentBundle.equipment}};
  const keys=table.split('.');let parent=copy;for(const key of keys.slice(0,-1))parent=parent[key];
  const key=keys.at(-1),rows=parent[key].map(row=>({...row}));parent[key]=rows;
  edit(rows[index]);return validateContent(copy);
};
for(const [table,tag] of [['cards','defense:wardProtection'],['relics','defense:wardProtection'],['statuses','defense:wardProtection'],['classes','defense:wardProtection'],['enemies','defense:wardProtection'],['equipment.armaments','defense:wardProtection'],['equipment.armour','defense:wardProtection']]) {
  test(`${table} JSON attachments validate registration and parameters at content boot`,()=>{
    const result=mutate(table,0,row=>{row.mechanicBindings=[{tag,parameters:{multiplier:0.6}}];});
    const attachmentErrors=result.errors.filter(e=>e.path.includes('mechanic'));
    assert.deepEqual(attachmentErrors,[]);
    const invalid=mutate(table,0,row=>{row.mechanicBindings=[{tag,parameters:{multplier:0.6}}];});
    assert.ok(invalid.errors.some(e=>e.path.includes('mechanicBindings') && /unknown parameter/.test(e.msg)),JSON.stringify(invalid.errors));
    const unknown=mutate(table,0,row=>{row.mechanicTags=['defense:misspelled'];});
    assert.ok(unknown.errors.some(e=>/unknown behavior tag/.test(e.msg)),JSON.stringify(unknown.errors));
  });
}
test('required unsupported mechanics, invalid schema keywords and missing primitives are refused',()=>{
  const unsupported={manifest:{id:'inert',tag:'defense:inert',portability:'legacy',attaches:['entity']},service:{handlers:[]}};
  assert.throws(()=>compileBindings({mechanics:new Map([['inert',unsupported]]),attachments:[{ownerId:'a',sourceInstanceId:'a',kind:'entity',tags:['defense:inert']}]}),/no executable behavior/);
  assert.throws(()=>validateParameterSchema({type:'number',minimum:Infinity}),/bounds must be finite/);
  assert.throws(()=>validateParameterSchema({type:'number',executable:'x'}),/unsupported parameter schema field/);
  assert.throws(()=>compileBindings({mechanics,moduleParameters:{'missing.mechanic':{a:1}}}),/unknown mechanic/);
});
