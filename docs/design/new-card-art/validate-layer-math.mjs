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
