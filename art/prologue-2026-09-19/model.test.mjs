import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateSequence,sceneCopy,motifColour,sceneNavigation} from './model.mjs';
const defaults=JSON.parse(await readFile(new URL('./sequence.json',import.meta.url),'utf8'));
test('all edits survive a JSON round trip, including distinct class dialogue',()=>{const draft=structuredClone(defaults);draft.scenes[0].text='A new line.\nAnd another.';draft.classes.reaver.line='Keep the gate.';draft.classes.herald.line='Keep the book.';draft.labels.setForth='Take the road';draft.presentation.tintSource='character';draft.presentation.characterTint='frost';draft.presentation.wash=.28;const imported=validateSequence(JSON.parse(JSON.stringify(draft)),defaults);assert.deepEqual(imported,draft);assert.equal(sceneCopy(imported.scenes[2],imported,'reaver').text,'Keep the gate.');assert.equal(sceneCopy(imported.scenes[2],imported,'herald').text,'Keep the book.');assert.equal(motifColour(imported),'#7fa8c9');});
test('invalid imports do not mutate existing state and cannot override artwork paths',()=>{for(const edit of [d=>d.scenes[0].seconds=-1,d=>d.scenes[1].id='warmth',d=>d.presentation.accent='unknown',d=>d.classes.rogue.line=null,d=>d.presentation.transitionSeconds=Infinity]){const draft=structuredClone(defaults),before=JSON.stringify(defaults);edit(draft);assert.throws(()=>validateSequence(draft,defaults));assert.equal(JSON.stringify(defaults),before);}const draft=structuredClone(defaults);draft.scenes[2].actor.desktop.height=999;draft.palettes.accent.gold='url(javascript:bad)';const imported=validateSequence(draft,defaults);assert.equal(imported.scenes[2].actor.desktop.height,defaults.scenes[2].actor.desktop.height);assert.equal(imported.palettes.accent.gold,defaults.palettes.accent.gold);});
test('empty and non-ASCII authored text remains editable',()=>{const d=structuredClone(defaults);d.scenes[3].speaker='';d.scenes[3].text='Cendres — 灰\n';assert.equal(validateSequence(d,defaults).scenes[3].text,d.scenes[3].text);});

test('shadow controls preserve old drafts and validate exported strength',()=>{
 const old=structuredClone(defaults); delete old.presentation.shadowStrength;
 assert.equal(validateSequence(old,defaults).presentation.shadowStrength,.7);
 old.presentation.shadowStrength=0;
 assert.equal(validateSequence(old,defaults).presentation.shadowStrength,0);
 old.presentation.shadowStrength=1.1;
 assert.throws(()=>validateSequence(old,defaults));
});

// The opening went from six scenes to five. `studio.mjs` carried the old count
// as literals (`index<5`, `index===5`, `${index+1} / 6`), so the LAST scene
// still advanced: `selectScene(5)` dereferenced `data.scenes[5]` (undefined)
// and threw, the counter read "5 / 6", and the final scene offered Continue
// instead of the set-forth label. The walk now comes from the sequence.
test('the walk ends at the real last scene, whatever the sequence length is',()=>{
  const walked=[];
  for(let index=0,step=sceneNavigation(defaults,0);;step=sceneNavigation(defaults,index)){
    walked.push(step.counter);
    assert.ok(defaults.scenes[index],`scene ${index} exists`);
    assert.equal(step.final,index===defaults.scenes.length-1);
    // The button label is the same question: set forth ONLY at the end.
    const label=step.final?defaults.labels.setForth:defaults.labels.continue;
    assert.equal(label===defaults.labels.setForth,index===defaults.scenes.length-1);
    if(step.next===null)break;
    assert.ok(defaults.scenes[step.next],'auto-advance never steps past the last scene');
    index=step.next;
  }
  assert.equal(defaults.scenes.length,5);
  assert.deepEqual(walked,['1 / 5','2 / 5','3 / 5','4 / 5','5 / 5']);
  assert.equal(sceneNavigation(defaults,defaults.scenes.length-1).next,null);
  // A six-scene sequence would walk six steps through the same function.
  assert.equal(sceneNavigation({scenes:new Array(6).fill({})},4).next,5);
  assert.equal(sceneNavigation({scenes:new Array(6).fill({})},5).counter,'6 / 6');
});

test('the studio carries no hard-coded scene count',async()=>{
  const source=await readFile(new URL('./studio.mjs',import.meta.url),'utf8');
  assert.ok(!/index\s*[<=]=?\s*5/.test(source),'no literal last-index');
  assert.ok(!/\/\s*6`/.test(source),'no literal "/ 6" counter');
});
