import { writeFileSync } from 'node:fs';
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { createRunState } from '../../src/model/state.js';
import { startingDeckRefs } from '../../src/model/loadout.js';
const r = createRegistries(contentBundle);
const weapons = r.equipment.armaments.map(w => ({id:w.id,name:w.name,kind:w.kind,hand:w.hand}));
const families = [
 ['sword','Sword',['straightSword','katana']], ['greatsword','Greatsword',['greatsword']],
 ['dagger','Dagger / parrying blade',['dagger','parryDagger']], ['bow','Bow',['shortbow']],
 ['polearm','Polearm',['halberd']], ['hammer','Hammer',['warhammer']],
 ['twinblade','Twinblade',['twinblade']], ['axe','Axe',['battleaxe']],
 ['shield','Shield',['buckler','kiteShield','towerShield','roundShield','spikedShield']],
 ['lantern','Lantern',['lantern']], ['torch','Torch',['torch']],
 ['staff','Staff',['ashStaff','starstoneStaff']],
 ['sceptre','Sceptre / casting focus',['boneSceptre','emberlightSceptre','goldboughBranch','blightRod','gorefireBrand','wyrmhornStaff']],
].map(([id,name,members])=>({id,name,members}));
const familyOf = id => id ? families.find(f=>f.members.includes(id))?.id : null;
for(const w of weapons)if(!familyOf(w.id))throw new Error(`Unmapped armament ${w.id}`);
const classes = r.classes.all().map(c => ({id:c.id,name:c.name}));
const pairs=[];
for(const c of classes){
 const run=createRunState({seed:896,classId:c.id,registries:r});
 for(const right of [null,...weapons])for(const left of [null,...weapons]){
  if(right && left && right.id===left.id)continue;
  if(right && !['right','either'].includes(right.hand))continue;
  if(left && !['left','either'].includes(left.hand))continue;
  for(const [slot,w] of [['rightHand',right],['leftHand',left]]){
   run.loadout.active[slot]=0;run.loadout.sets[slot][0]=w?.id||null;
  }
  try {startingDeckRefs(r,run.loadout,c.id);} catch {continue;}
  pairs.push({id:`${c.id}__${right?.id||'empty'}__${left?.id||'empty'}`,classId:c.id,right:right?.id||null,left:left?.id||null,status:'pending'});
 }
}
const grouped = new Map();
for(const p of pairs){const right=familyOf(p.right),left=familyOf(p.left),id=`${p.classId}__${right||'empty'}__${left||'empty'}__oneHand`;if(!grouped.has(id))grouped.set(id,{id,classId:p.classId,right,left,grip:'oneHand',status:'pending',catalogExamples:[]});grouped.get(id).catalogExamples.push([p.right,p.left]);}
// Explicit two-hand grips currently authored by the opt-in equipment prototype.
for(const c of classes)for(const right of ['greatsword','staff']){const id=`${c.id}__${right}__empty__twoHand`;grouped.set(id,{id,classId:c.id,right,left:null,grip:'twoHand',status:'pending',catalogExamples:[[right==='staff'?'ashStaff':'greatsword',null]],ruleset:'opt-in prototype'});}
const result={schema:'ashenspire/art-coverage/v2',classes,weapons:families,catalogWeapons:weapons,pairs:[...grouped.values()],notes:['Coverage is weapon GROUP plus ordered hand combination, not each named item. Group members are explicit.','Current catalog hand slots and deck composer determine compatibility. Ownership and attribute progression are not art restrictions.','A repeated family is included only where distinct legal named members exist. Empty hands are included.','Two-handed greatsword and staff are explicit opt-in prototype grip variants.','Pending means not generated. Review means an initial sample of that motion group, not all named weapon skins or runtime integration.']};
writeFileSync(new URL('./coverage.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(`${classes.length} classes, ${families.length} weapon groups, ${result.pairs.length} hand/grip groups, ${result.pairs.length*14} requested poses plus portraits.`);
