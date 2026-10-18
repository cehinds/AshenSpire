// Apply after revision 10. Scale only physical scepters and preserve spectral world poses.
import fs from 'node:fs';
import './layer-math.js';
const root=new URL('./',import.meta.url),file=new URL('cutout-manifest.json',root);
const data=JSON.parse(fs.readFileSync(file));
if(data.revision!==10)throw new Error('Expected revision 10; do not shrink an already revised set.');
const changed=[];
const rotate=(p,r)=>{r*=Math.PI/180;return {x:Math.cos(r)*p.x-Math.sin(r)*p.y,y:Math.sin(r)*p.x+Math.cos(r)*p.y};};
for(const c of Object.values(data.compositions)){
 if(c.category!=='Y'||![2,7].includes(c.effectDigit))continue;
 const parent=c.layers.find(l=>l.id==='object'),child=c.layers.find(l=>l.id==='foreground'),old=CardLayerMath.resolve(data,c,child);
 const t=parent.overrides,base=data.assets[parent.assetId];
 // The shaft centerline runs from the scythe collar to the lower cap in the PNG.
 const collar={x:.52,y:.182},pommel={x:.898,y:.859};
 const vector=CardLayerMath.point(old.affine,{x:(pommel.x-collar.x)*old.transform.width,y:(pommel.y-collar.y)*old.transform.height});
 const angle=Math.atan2(vector.y,vector.x)*180/Math.PI;
 const end=CardLayerMath.point(old.affine,{x:(pommel.x-.5)*old.transform.width,y:(pommel.y-.5)*old.transform.height});
 const target={x:old.transform.x+end.x,y:old.transform.y+end.y};
 const size=t.width*.5,rotation=angle-135,localEnd=rotate({x:(.15-.5)*size,y:(.86-.5)*size},rotation);
 t.width=size;t.height=size;t.rotationDeg=rotation;t.x=target.x-localEnd.x;t.y=target.y-localEnd.y;
 const stone=rotate(CardLayerMath.anchorVector(base,{...base.defaultTransform,...t},'stoneHead'),rotation);
 const offset=rotate({x:old.attachmentPoint.x-t.x-stone.x,y:old.attachmentPoint.y-t.y-stone.y},-rotation);
 child.overrides.rotationDeg=-rotation;
 child.attachment.referenceParentSize=size;child.attachment.offset=offset;
 c.designRevision=11;changed.push(c.code);
}
data.revision=11;data.references.meleeRevision='revision-v11.json';
for(const c of data.categories)if(c.letter==='Y')c.revision=11;
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(new URL('cutouts-data.js',root),'window.CARD_CUTOUT_DATA = '+JSON.stringify(data)+';\n');
fs.writeFileSync(new URL('revision-v11.json',root),JSON.stringify({revision:11,request:'Scale the physical scepter down by 50% and align it with the spectral staff. Keep the scythe the same size.',changedCompositions:changed,scepterSizeBefore:305.9,scepterSizeAfter:152.95,scepterScaleFactor:.5,changedPngs:[],unchangedPngCount:362,placement:'Place the physical pommel at the spectral shaft endpoint and rotate its grip onto the transformed staff centerline. Compensate the attachment offset, relative rotation and reference size to preserve the scythe world pose.',resetSavedPlacement:true},null,2)+'\n');
console.log('Halved and aligned physical scepters in '+changed.length+' scythe compositions.');
