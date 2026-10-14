import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createDocument,validateDocument,clone,cornerResize,scaleObjects,snapMove} from './editor/studio-model.mjs';
const entries=JSON.parse(fs.readFileSync(new URL('./catalog.json',import.meta.url))).entries;
const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('./editor/library-data.js',import.meta.url),'utf8'),context);
const library=context.window.BATTLEFIELD_LIBRARY;
const d=createDocument(entries),initial=clone(d);assert.deepEqual(validateDocument(d,entries,library,[]),d);
d.profiles.phone.objects[4].x=99;assert.deepEqual(d.profiles.desktop,initial.profiles.desktop);
const b={x:80,y:90,w:200,h:400};
for(const corner of ['nw','ne','sw','se']){
 const r=cornerResize(b,corner,corner.includes('w')?-20:20,corner.includes('n')?-40:40);
 assert.equal(r.w,220);assert.equal(r.h,440);
 assert.equal(corner.includes('w')?r.x+r.w:r.x,corner.includes('w')?b.x+b.w:b.x);
 assert.equal(corner.includes('n')?r.y+r.h:r.y,corner.includes('n')?b.y+b.h:b.y);
}
const small=cornerResize({x:0,y:0,w:100,h:20},'se',-999,-999);assert(small.w>=12&&small.h>=12);assert.equal(small.w/small.h,5);
const group=[{...b,locked:false},{...b,locked:true}];scaleObjects(group,1.5);assert.equal(group[0].y+group[0].h,490);assert.deepEqual(group[1],{...b,locked:true});scaleObjects(group,.0001);assert(group[0].w>=12&&group[0].h>=12);
const snap=snapMove({x:103,y:79,w:30,h:20},[],10);assert.equal(snap.x,100);assert.equal(snap.y,80);
const align=snapMove({x:104,y:79,w:30,h:20},[{x:106,y:300,w:20,h:20}],100,8);assert.equal(align.x,106);assert(align.guides.some(g=>g.axis==='x'));
for(const mutate of [v=>v.profiles.desktop.objects[0].libraryId='../../private',v=>v.profiles.phone.objects[0].w=-1,v=>v.effectDefaults.width=999,v=>v.profiles.desktop.objects.push(clone(v.profiles.desktop.objects[0]))]){const invalid=clone(initial);mutate(invalid);assert.throws(()=>validateDocument(invalid,entries,library,[]));}
const old=JSON.parse(fs.readFileSync(new URL('./editor/starting-layout.json',import.meta.url)));assert.equal(validateDocument(old,entries,library,[]).version,2);
fs.writeFileSync(new URL('./editor/starting-layout-v2.json',import.meta.url),JSON.stringify(initial,null,2));
console.log('PASS: four anchored corners, aspect and minimum size, independent profiles, locked scaling, snapping, validation, legacy import.');
