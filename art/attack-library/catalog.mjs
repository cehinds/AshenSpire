import {ARMAMENTS,ARMOUR as OUTFITS} from '../../src/content/equipment.js';

export const FRAME_NAMES=['Guard','Gather','Windup','Strike','Follow-through','Recover','Guard'];
export const FRAME_MS=[180,100,150,70,100,140,180];
export function frameNamesFor(action,clip){
 if(clip==='twin')return ['Guard','Coil','Main strike','Offhand strike','Twin finish','Recover','Guard'];
 if(action==='cast'||clip==='focus'||clip.startsWith('cast-'))return ['Guard','Gather','Channel','Release','Sustain','Recover','Guard'];
 const names={block:['Guard','Raise','Brace','Impact','Absorb','Recover','Guard'],defend:['Guard','Raise','Brace','Hold','Hold','Settle','Guard'],dodge:['Guard','Gather','Evade','Withdraw','Plant','Recover','Guard'],hurt:['Guard','Flinch','Recoil','Hit','Balance','Recover','Guard'],buff:['Guard','Gather','Invoke','Bless','Sustain','Recover','Guard']};
 return names[action]||FRAME_NAMES;
}
export const CLASS_IDS=['reaver','rogue','starseer','herald'];
export const CLIPS={
 'empty':{name:'Attack · empty offhand',offhand:'empty'},
 'shield':{name:'Attack · shield cover',offhand:'shield'},
 'staff':{name:'Attack · offhand focus',offhand:'staff'},
 'twin':{name:'Twin attack · alternating hands',offhand:'weapon'},
 'two-hand':{name:'Two-handed attack',offhand:'support'},
 'bow':{name:'Bow · draw and release',offhand:'bowstring'},
 'bash':{name:'Shield / tool strike',offhand:'empty'},
 'focus':{name:'Focus · gather and discharge',offhand:'empty'},
};
const SHIELDS=new Set(['buckler','kiteShield','roundShield','towerShield','spikedShield']);
const HEAVY=new Set(['greatsword','halberd','twinblade']);
export function armamentFamily(item){
 if(!item)return 'empty';
 if(SHIELDS.has(item.id))return 'shield';
 if(item.kind==='staff')return 'focus';
 if(item.id==='parryDagger'||item.id==='dagger')return 'dagger';
 if(item.id==='shortbow')return 'bow';
 if(HEAVY.has(item.id))return 'two-hand';
 if(item.id==='lantern'||item.id==='torch')return 'tool';
 if(item.id==='warhammer'||item.id==='battleaxe')return 'impact';
 return 'blade';
}
export const WEAPONS=ARMAMENTS.map(item=>({id:item.id,name:item.name,kind:item.kind,family:armamentFamily(item),image:`assets/equipment/icon_${item.id}.webp`}));
export const OUTFIT_ROWS=OUTFITS.map(o=>({id:o.id,classId:o.classId,name:o.name,key:o.id==='default'?o.classId:`${o.classId}-${o.id}`}));
// Presentation consumes the equipment system's resolved hand count. It never
// invents a Strength threshold or changes legal equipment combinations.
export function resolveAttack({classId,outfit='default',main,off=null,handsRequired,oneHandAllowed=false}){
 if(!CLASS_IDS.includes(classId))throw new Error(`Unknown class: ${classId}`);
 const suit=OUTFIT_ROWS.find(x=>x.classId===classId&&x.id===outfit);
 if(!suit)throw new Error(`Unknown outfit: ${classId}/${outfit}`);
 const primary=WEAPONS.find(x=>x.id===main),secondary=off&&WEAPONS.find(x=>x.id===off);
 if(!primary||off&&!secondary)throw new Error('Unknown armament');
 const two=handsRequired===2||primary.family==='bow'||handsRequired==null&&primary.family==='two-hand'&&!oneHandAllowed;
 if(two&&secondary)return {allowed:false,reason:'Both hands are needed; this configuration has an occupied offhand.'};
 if(secondary&&(secondary.family==='bow'||secondary.family==='two-hand')&&!oneHandAllowed)return {allowed:false,reason:'The offhand armament needs a resolved one-handed allowance.'};
 let clip;
 if(two)clip=primary.family==='bow'?'bow':'two-hand';
 else if(secondary){
  if(secondary.family==='shield')clip='shield';
  else if(secondary.family==='focus'||secondary.family==='tool')clip='staff';
  else clip='twin';
 }else clip=primary.family==='shield'||primary.family==='tool'?'bash':primary.family==='focus'?'focus':'empty';
 return {allowed:true,classId,outfit:suit.key,clip,primary:primary.id,secondary:secondary?.id||null,frames:7,tags:['attack',primary.family,`offhand:${secondary?.family||'empty'}`,clip==='twin'?'twin-attack':clip,`class:${classId}`,`outfit:${suit.key}`]};
}
