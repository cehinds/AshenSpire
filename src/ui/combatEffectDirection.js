export const EFFECT_DIRECTIONS = Object.freeze({right:0,down:90,left:180,up:-90});

// Art is authored facing right. Aim between box centers in layer coordinates.
export function combatEffectAngle(from,to){
 if(!from||!to)return 0;
 return Math.atan2(to.top+to.height/2-from.top-from.height/2,to.left+to.width/2-from.left-from.width/2)*180/Math.PI;
}

export function combatEffectOrientation(direction='right'){
 const angle=typeof direction==='number'&&Number.isFinite(direction)?direction:(EFFECT_DIRECTIONS[direction]??0);
 const normalized=((angle+180)%360+360)%360-180;
 // Mirror backward shots so their vertical detail stays upright.
 const flip=Math.abs(normalized)>90;
 const rotation=flip?normalized-(normalized<0?-180:180):normalized;
 return `rotate(${rotation}deg) scaleX(${flip?-1:1})`;
}
