import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ARMOUR} from '../src/content/equipment.js';
import {EQUIPMENT_ANIMATIONS,selectEquipmentAnimation,animationClip,animationTiming,animationView,equipmentAnimationForLoadout} from '../src/model/equipmentAnimation.js';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState} from '../src/model/state.js';
import {gripOf} from '../src/model/loadout.js';
const manifest=JSON.parse(readFileSync(fileURLToPath(new URL('../art/dagger-outfits-2026-09-19/manifest.json',import.meta.url))));
const sequence=JSON.parse(readFileSync(fileURLToPath(new URL('../art/dagger-outfits-2026-09-19/attack-sequence.json',import.meta.url))));
assert.equal(manifest.groups.length,32);
assert.deepEqual(manifest.missingAppearances,[]);
assert.equal(manifest.outfits.length,ARMOUR.length);
assert.deepEqual(manifest.attack,sequence);
const registries=createRegistries(contentBundle), selectedSets=new Set();
for(const outfit of ARMOUR){
 const selector={classId:outfit.classId,armourId:outfit.id,rightId:'dagger',leftId:null,grip:'one'};
 const component=selectEquipmentAnimation(selector);
 assert.ok(component,JSON.stringify(selector));selectedSets.add(component.setId);
 assert.equal(component.motionProfile,'daggerSingle');
 assert.deepEqual(component.authoredEquipment,{rightGroup:'dagger',leftGroup:'empty'});
 assert.deepEqual(animationClip(component,'attack'),sequence);
 assert.deepEqual(animationTiming(component,'attack'),{totalMs:540,impactMs:240});
 assert.equal(Object.keys(component.frames).length,16);
 assert.match(animationView(component,'conversation'),/CONVERSATION.webp$/);
 assert.match(animationView(component,'buff'),/BUFF.webp$/);
 assert.equal(selectEquipmentAnimation({...selector,rightId:'parryDagger'}).setId,component.setId,'same dagger group, same family');
 for(const patch of [{rightId:null,leftId:'dagger'},{leftId:'parryDagger',grip:'dual'},{rightId:'shortbow'},{rightId:'dagger',grip:'two'},{leftId:'buckler'}])assert.notEqual(selectEquipmentAnimation({...selector,...patch})?.motionProfile,'daggerSingle','single-dagger selector must not claim other hand configurations');
 const loadout=createRunState({seed:14,classId:outfit.classId,registries}).loadout;
 loadout.active.rightHand=0;loadout.active.leftHand=0;loadout.active.armor=0;
 loadout.sets.rightHand[0]='dagger';loadout.sets.leftHand[0]=null;loadout.sets.armor[0]=outfit.id;
 assert.equal(equipmentAnimationForLoadout(registries,loadout,outfit.classId).setId,component.setId);
 loadout.sets.leftHand[0]='parryDagger';assert.equal(gripOf(registries,loadout,outfit.classId).mode,'dual');
 assert.notEqual(equipmentAnimationForLoadout(registries,loadout,outfit.classId)?.motionProfile,'daggerSingle');
 for(const frame of Object.values(component.frames))assert.ok(existsSync(fileURLToPath(new URL('../'+frame.file,import.meta.url))));
}
assert.equal(selectedSets.size,32,'35 entries resolve to exactly 32 skins');
for(const group of manifest.groups){
 for(const [pose,info] of Object.entries(group.frames)){
  const file=fileURLToPath(new URL('../art/dagger-outfits-2026-09-19/'+info.file,import.meta.url));
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),info.sha256);
  const runtime=fileURLToPath(new URL('../assets/animations/dagger-outfits/'+group.id+'/'+pose+'.webp',import.meta.url));
  assert.equal(createHash('sha256').update(readFileSync(runtime)).digest('hex'),info.sha256,'runtime copy matches validated export');
  for(let axis=0;axis<2;axis++)assert.ok(Math.abs(info.anchor[axis]-manifest.bodyAnchor[axis])<=0.5,'stable foot anchor');
 }
}
const changed=structuredClone(EQUIPMENT_ANIMATIONS);
changed.motionProfiles.daggerSingle.clips.daggerAttack.frameMs=120;
for(const outfit of ARMOUR)assert.equal(animationTiming(selectEquipmentAnimation({classId:outfit.classId,armourId:outfit.id,rightId:'dagger'},changed),'attack').totalMs,1080,'one motion setting applies to all skins');
assert.deepEqual(changed.motionProfiles.greatswordTwoHand,EQUIPMENT_ANIMATIONS.motionProfiles.greatswordTwoHand);
assert.deepEqual(changed.motionProfiles.swordShield,EQUIPMENT_ANIMATIONS.motionProfiles.swordShield);
console.log('PASS single dagger: 35 legal ordered bindings, 32 skins, 512 frames, shared timing, aliases, hashes and exclusions');
