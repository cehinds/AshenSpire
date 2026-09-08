// Local coordinates in 512px inventory masters. These are reviewable attachment
// data, separate from pose selection and from mechanics.
export const GRIPS={
 straightSword:{grip:[116,401],tip:[490,20],length:220},greatsword:{grip:[147,365],support:[98,412],tip:[496,17],length:280},
 dagger:{grip:[135,377],tip:[430,60],length:110},shortbow:{grip:[256,256],tip:[260,50],length:190},
 katana:{grip:[129,369],tip:[490,20],length:220},halberd:{grip:[174,332],support:[105,413],tip:[415,56],length:300},
 warhammer:{grip:[140,385],tip:[381,130],length:205},twinblade:{grip:[251,253],support:[204,305],tip:[442,48],length:180},
 battleaxe:{grip:[150,374],tip:[375,119],length:220},
 buckler:{grip:[256,256],tip:[256,0],length:58},kiteShield:{grip:[255,150],tip:[255,5],length:60},
 towerShield:{grip:[256,150],tip:[256,0],length:76},roundShield:{grip:[256,256],tip:[256,0],length:70},
 spikedShield:{grip:[256,256],tip:[256,0],length:75},lantern:{grip:[256,79],tip:[256,0],length:40},
 torch:{grip:[150,364],tip:[390,86],length:150},parryDagger:{grip:[150,371],tip:[438,50],length:120},
 ashStaff:{grip:[228,282],support:[177,339],tip:[434,61],length:190},starstoneStaff:{grip:[241,275],support:[184,336],tip:[464,52],length:195},
 boneSceptre:{grip:[179,334],tip:[390,107],length:160},emberlightSceptre:{grip:[187,331],tip:[388,109],length:170},
 goldboughBranch:{grip:[161,350],tip:[379,117],length:170},blightRod:{grip:[181,337],tip:[381,115],length:155},
 gorefireBrand:{grip:[176,333],tip:[390,95],length:170},wyrmhornStaff:{grip:[190,326],tip:[394,108],length:185},
};
export function weaponTransform(id,anchor,angle,length){
 const def=GRIPS[id];if(!def)throw new Error(`Missing grip ${id}`);
 const axis=Math.atan2(def.tip[1]-def.grip[1],def.tip[0]-def.grip[0]);
 const scale=(length||def.length)/Math.hypot(def.tip[0]-def.grip[0],def.tip[1]-def.grip[1]);
 return {anchor,rotation:angle*Math.PI/180-axis,scale,grip:def.grip};
}
