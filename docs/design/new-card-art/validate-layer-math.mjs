import fs from 'node:fs';
import assert from 'node:assert/strict';
import './layer-math.js';
const data=JSON.parse(fs.readFileSync(new URL('./cutout-manifest.json',import.meta.url)));
const {resolve,point,anchorVector}=globalThis.CardLayerMath;
for(const letter of 'YZ')for(let i=0;i<10;i++)for(let j=0;j<10;j++){
 const c=structuredClone(data.compositions[`${letter}${i}${j}`]);
 const parent=c.layers.find(l=>l.id==='object'),child=c.layers.find(l=>l.id==='foreground');
 for(const change of [{},{rotationDeg:37,x:190,y:410},{rotationDeg:-71,scaleX:1.4,scaleY:.7,width:270,height:360}]){
  Object.assign(parent.overrides,change);child.overrides.rotationDeg=19;
  const p=resolve(data,c,parent),r=resolve(data,c,child),pa=data.assets[parent.assetId],a=data.assets[child.assetId];
  const local=anchorVector(a,r.transform,'emissionRoot'),root=point(r.affine,local);
  assert.ok(Math.abs(r.transform.x+root.x-r.attachmentPoint.x)<1e-8);
  assert.ok(Math.abs(r.transform.y+root.y-r.attachmentPoint.y)<1e-8);
  const stone=point(p.affine,anchorVector(pa,p.transform,'stoneHead'));
  const f=Math.min(p.transform.width,p.transform.height)/child.attachment.referenceParentSize,offset=point(p.affine,{x:child.attachment.offset.x*f,y:child.attachment.offset.y*f});
  assert.ok(Math.abs(p.transform.x+stone.x+offset.x-r.attachmentPoint.x)<1e-8);
  assert.ok(Math.abs(p.transform.y+stone.y+offset.y-r.attachmentPoint.y)<1e-8);
 }
}
const old=data.compositions.A34,l=old.layers.find(l=>l.id==='object'),r=resolve(data,old,l);
assert.equal(r.attachmentPoint,null);assert.match(r.css.transform,/rotate\(0deg\)/);
console.log('Verified 600 transformed magic attachments, independent projectile offsets and legacy independent transforms.');
if(data.revision>=13){
 const spec=JSON.parse(fs.readFileSync(new URL('./revision-v13.json',import.meta.url)));
 for(const c of Object.values(data.compositions).filter(c=>c.category==='Y')){
  const parent=c.layers.find(l=>l.id==='object'),child=c.layers.find(l=>l.id==='foreground');
  const p=resolve(data,c,parent),r=resolve(data,c,child),axis=spec.axisLandmarks[c.effectDigit%5];
  assert.equal(parent.assetId,spec.sharedScepterId);assert.equal(p.transform.width,spec.sharedScepterSize);assert.equal(p.transform.height,spec.sharedScepterSize);
  const shaft=point(r.affine,{x:(axis.neck[0]-axis.end[0])*r.transform.width,y:(axis.neck[1]-axis.end[1])*r.transform.height});
  const grip=point(p.affine,{x:.59*p.transform.width,y:-.59*p.transform.height});
  assert.ok(Math.abs(shaft.x*grip.y-shaft.y*grip.x)<1e-6,'Scepter grip must follow weapon shaft axis');
  const end=point(r.affine,{x:(axis.end[0]-.5)*r.transform.width,y:(axis.end[1]-.5)*r.transform.height});
  const pommel=point(p.affine,{x:(.15-.5)*p.transform.width,y:(.86-.5)*p.transform.height});
  assert.ok(Math.abs(r.transform.x+end.x-p.transform.x-pommel.x)<1e-8);
  assert.ok(Math.abs(r.transform.y+end.y-p.transform.y-pommel.y)<1e-8);
 }
 console.log('Verified shared scepter sprite, identical size, shaft-axis alignment and pommel placement across 100 Y codes.');
}
