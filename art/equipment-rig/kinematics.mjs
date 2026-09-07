import {referenceKeys} from './reference-poses.mjs';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const radians=d=>d*Math.PI/180;
export const degrees=r=>r*180/Math.PI;
export const wrapAngle=a=>((a+180)%360+360)%360-180;
export const rotate=(p,a)=>{const r=radians(a);return [p[0]*Math.cos(r)-p[1]*Math.sin(r),p[0]*Math.sin(r)+p[1]*Math.cos(r)]};
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
export const LIMITS={
 nearArm:{joint:[-155,172],flex:[8,165]},farArm:{joint:[-172,140],flex:[8,165]},
 leg:{joint:[-25,160],flex:[8,145]},wrist:[-50,50],ankle:[-60,60],spine:[-12,40],
};
export function solveArm(shoulder,target,upper,lower,bend=1,limits={joint:[-360,360],flex:[.01,179.99]},baseAngle=0){
 const delta=rotate([target[0]-shoulder[0],target[1]-shoulder[1]],-baseAngle);
 const radius=flex=>Math.sqrt(upper*upper+lower*lower+2*upper*lower*Math.cos(radians(flex)));
 const desired=Math.hypot(...delta),d=clamp(desired,radius(limits.flex[1]),radius(limits.flex[0]));
 const direction=Math.atan2(delta[1],delta[0]),offset=Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d),-1,1));
 let requested=degrees(direction+bend*offset);requested=wrapAngle(requested);
 const joint=clamp(requested,...limits.joint),flex=degrees(Math.acos(clamp((d*d-upper*upper-lower*lower)/(2*upper*lower),-1,1)));
 const elbow=add(shoulder,rotate([upper,0],joint+baseAngle));
 const foreAngle=joint-bend*flex+baseAngle,wrist=add(elbow,rotate([lower,0],foreAngle));
 const error=Math.hypot(wrist[0]-target[0],wrist[1]-target[1]);
 return {shoulder,elbow,wrist,error,joint,flex,foreAngle,limited:error>.01,limits};
}
export function weaponPoint(item,wrist,angle,point){
 const base=degrees(Math.atan2(item.tip[1]-item.grip[1],item.tip[0]-item.grip[0]));
 return add(wrist,rotate([(point[0]-item.grip[0])*item.scale,(point[1]-item.grip[1])*item.scale],angle-base));
}
// Monotone Hermite curves share tangents at reference keys. Unlike independent
// easing per segment, clearance keys do not introduce a stop/start jerk.
function interpolate(frames,index,t,value){
 const tangent=k=>{
  if(k===0||k===frames.length-1)return 0;
  const h0=frames[k].t-frames[k-1].t,h1=frames[k+1].t-frames[k].t;
  const d0=(value(frames[k])-value(frames[k-1]))/h0,d1=(value(frames[k+1])-value(frames[k]))/h1;
  if(d0*d1<=0)return 0;
  const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/d0+w1/d1);
 };
 const a=frames[index-1],b=frames[index],h=b.t-a.t,u=(t-a.t)/h;
 return (2*u**3-3*u*u+1)*value(a)+(u**3-2*u*u+u)*h*tangent(index-1)+(-2*u**3+3*u*u)*value(b)+(u**3-u*u)*h*tangent(index);
}
export function sampleMotion(family,action,t,classId='reaver'){
 const frames=referenceKeys(classId,family,action);t=clamp(t,0,1);let i=frames.findIndex((f,j)=>j>0&&f.t>=t);if(i<1)i=frames.length-1;
 const a=frames[i-1],b=frames[i],u=(t-a.t)/(b.t-a.t),s=u*u*u*(u*(u*6-15)+10);
 const curve=read=>interpolate(frames,i,t,read);
 const pair=key=>a[key].map((v,k)=>curve(f=>f[key][k]));
 const root=pair('root'),offset=pair('wrist'),spine=clamp(curve(f=>f.spine),...LIMITS.spine);
 const foot=(key)=>{const stepping=Math.abs(a[key]-b[key])>1,lift=stepping?12*Math.sin(Math.PI*u)**2:0;return {point:[lerp(a[key],b[key],s),520-lift],planted:lift<.001,lift}};
 return {wrist:add(root,offset),angle:wrapAngle(curve(f=>f.angle)),root,spine,lean:root[0]-300,phase:t,front:foot('front'),rear:foot('rear'),from:a,to:b,blend:s};
}
