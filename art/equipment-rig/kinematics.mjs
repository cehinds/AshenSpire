export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export function solveArm(shoulder,target,upper,lower,bend=1){
 const dx=target[0]-shoulder[0],dy=target[1]-shoulder[1];
 const desired=Math.hypot(dx,dy),d=clamp(desired,Math.abs(upper-lower)+.001,upper+lower-.001);
 const angle=Math.atan2(dy,dx),a=Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d),-1,1));
 const elbow=[shoulder[0]+Math.cos(angle+bend*a)*upper,shoulder[1]+Math.sin(angle+bend*a)*upper];
 const wrist=[shoulder[0]+Math.cos(angle)*d,shoulder[1]+Math.sin(angle)*d];
 return {shoulder,elbow,wrist,error:Math.max(0,desired-d)};
}
export function weaponPoint(item,wrist,angle,point){
 const base=Math.atan2(item.tip[1]-item.grip[1],item.tip[0]-item.grip[0]);
 const a=angle*Math.PI/180-base,x=(point[0]-item.grip[0])*item.scale,y=(point[1]-item.grip[1])*item.scale;
 return [wrist[0]+Math.cos(a)*x-Math.sin(a)*y,wrist[1]+Math.sin(a)*x+Math.cos(a)*y];
}
// Each family owns one motion; items supply dimensions and attachment points only.
const blade=[ [0,342,330,-65,0],[.2,299,288,-155,-4],[.43,321,200,-120,-8],[.64,386,303,22,9],[.82,357,358,65,4],[1,342,330,-65,0] ];
const heavy=[ [0,345,328,-65,0],[.24,310,270,-155,-6],[.46,318,185,-110,-9],[.69,382,316,36,10],[.85,353,355,60,5],[1,345,328,-65,0] ];
const cast=[ [0,342,330,-70,0],[.28,325,296,-85,-3],[.52,358,282,-30,3],[.7,372,275,-20,5],[1,342,330,-70,0] ];
const guard=[ [0,342,330,-65,0],[.27,332,290,-75,-3],[.62,346,279,-55,2],[.8,339,297,-65,1],[1,342,330,-65,0] ];
export function sampleMotion(family,action,t){
 const frames=action==='cast'?cast:action==='guard'?guard:family==='heavy'?heavy:blade;
 t=clamp(t,0,1);let i=frames.findIndex((f,j)=>j>0&&f[0]>=t);if(i<1)i=frames.length-1;
 const a=frames[i-1],b=frames[i],u=(t-a[0])/(b[0]-a[0]),s=u*u*(3-2*u);
 const values=a.slice(1).map((v,k)=>lerp(v,b[k+1],s));
 return {wrist:values.slice(0,2),angle:values[2],lean:values[3],phase:t};
}
