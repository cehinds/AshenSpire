import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { EQUIPMENT_ANIMATIONS, validateEquipmentAnimations, selectEquipmentAnimation, equipmentAnimationForLoadout, animationClip, animationView, animationTiming } from '../src/model/equipmentAnimation.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { armourArtKey } from '../src/model/paintedOutfitArt.js';

const approved = ['STANCE-READY','ATK-07','ATK-04','ATK-02','ATK-03','ATK-05','ATK-01','ATK-04','STANCE-READY'];
const base = { classId:'reaver', rightId:'greatsword', leftId:null };
const set = selectEquipmentAnimation(base);
assert.equal(set.setId,'reaverGreatsword');
assert.deepEqual(animationClip(set,'attack').frames,approved);
assert.deepEqual(animationTiming(set,'attack'),{totalMs:900,impactMs:500});
assert.deepEqual(animationTiming(set,'attack',{lungeMs:130}),{totalMs:450,impactMs:250});
assert.match(animationView(set,'portrait'),/PORTRAIT.webp$/);
assert.match(animationView(set,'conversation'),/STANCE-READY.webp$/);
assert.equal(animationClip(set,'power'),animationClip(set,'buff'));
assert.equal(animationClip(set,'hit'),animationClip(set,'hurt'));
assert.equal(animationClip(set,'victory'),null,'unprovided roles delegate to existing class art');
for(const patch of [{classId:'missing'},{rightId:'dagger'},{leftId:'buckler'},{armourId:'missing'},{rightId:'missing'}]) assert.equal(selectEquipmentAnimation({...base,...patch}),null);
const data=structuredClone(EQUIPMENT_ANIMATIONS);
data.bindings.push({classId:'reaver',armourId:'default',rightGroup:'sword',leftGroup:'shield',setId:'reaverGreatsword'});
assert.equal(selectEquipmentAnimation({...base,rightId:'katana',leftId:'kiteShield'},data).setId,'reaverGreatsword','named members share a group binding');
assert.equal(selectEquipmentAnimation({...base,rightId:'kiteShield',leftId:'katana'},data),null,'ordered hands are not interchangeable');
data.bindings.push({...data.bindings[0],grip:'two'});
assert.equal(validateEquipmentAnimations(data),true,'specific grip can override a generic pairing');
for(const mutate of [
 d=>d.motionProfiles.greatswordTwoHand.clips.greatswordAttack.frames.push('MISSING'),
 d=>d.motionProfiles.greatswordTwoHand.references.portrait='MISSING',
 d=>d.motionProfiles.greatswordTwoHand.clips.greatswordAttack.impactIndex=99,
 d=>d.motionProfiles.greatswordTwoHand.clips.greatswordAttack.frameMs=0,
 d=>d.sets.reaverGreatsword.motionProfile='missing',
 d=>d.weaponGroups.dagger.push('greatsword'),
 d=>d.bindings.push({...d.bindings[0]}),
 d=>delete d.motionProfiles.greatswordTwoHand.references.buff,
 d=>d.sets.reaverGreatsword.frames['ATK-01'].file='../private.webp',
]) {const bad=structuredClone(EQUIPMENT_ANIMATIONS);mutate(bad);assert.throws(()=>validateEquipmentAnimations(bad),/equipmentAnimations/);}
const outfitRows=contentBundle.equipment.armour;
const r=createRegistries(contentBundle);
assert.ok(Array.isArray(outfitRows),'armor catalog available');
assert.equal(outfitRows.length,35,'all current class/armor entries are exercised');
for(const outfit of outfitRows){
 const equipped=createRunState({seed:896,classId:outfit.classId,registries:r}).loadout;
 equipped.sets.armor[equipped.active.armor||0]=outfit.id;
 for(const grip of ['one','two'])for(const [rightId,leftId] of [['greatsword',null],[null,'greatsword']]){
  const component=selectEquipmentAnimation({classId:outfit.classId,armourId:outfit.id,rightId,leftId,grip});
  assert.ok(component,`${outfit.classId}/${outfit.id} selects greatsword`);
  for(const [slot,id] of [['rightHand',rightId],['leftHand',leftId]])equipped.sets[slot][equipped.active[slot]||0]=id;
  assert.equal(equipmentAnimationForLoadout(r,equipped,outfit.classId)?.setId,component.setId,'equipped loadout preserves the selected class and armor appearance');
  assert.equal(component.motionProfile,'greatswordTwoHand');
  assert.deepEqual(animationClip(component,'attack').frames,approved);
  const artId=armourArtKey(outfit.classId,outfit.id);
  const directory=outfit.classId+(artId==='default'?'':'-'+artId);
  assert.ok(animationView(component,'portrait').includes('/'+directory+'/'),'outfit appearance retained');
  for(const frame of Object.values(component.frames))assert.ok(existsSync(new URL('../'+frame.file,import.meta.url)),frame.file);
 }
}
const changed=structuredClone(EQUIPMENT_ANIMATIONS);changed.motionProfiles.greatswordTwoHand.clips.greatswordAttack.frameMs=120;
for(const classId of ['reaver','rogue','herald','starseer'])assert.equal(animationTiming(selectEquipmentAnimation({...base,classId},changed),'attack').totalMs,1080,'one profile edits all classes');
const run=createRunState({seed:896,classId:'reaver',registries:r});
function equip(right,left){for(const [slot,id]of [['rightHand',right],['leftHand',left]]){run.loadout.active[slot]=0;run.loadout.sets[slot][0]=id;}run.loadout.sets.armor[run.loadout.active.armor||0]='default';}
equip('greatsword',null);assert.equal(equipmentAnimationForLoadout(r,run.loadout,'reaver').setId,'reaverGreatsword');
equip('greatsword','buckler');assert.equal(equipmentAnimationForLoadout(r,run.loadout,'reaver'),null);
equip('shortbow',null);assert.equal(equipmentAnimationForLoadout(r,run.loadout,'reaver'),null,'catalog identity, not dagger art alias, selects group');
for(const frame of Object.values(set.frames))assert.ok(existsSync(new URL('../'+frame.file,import.meta.url)),frame.file);
console.log('PASS equipment animation component: ordered groups, equip swaps, references, approved timeline, fallback, validation and asset paths');
