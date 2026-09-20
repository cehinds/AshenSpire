import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateSequence,sceneCopy,motifColour} from './model.mjs';
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
