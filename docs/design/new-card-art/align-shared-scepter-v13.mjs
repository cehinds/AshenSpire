import fs from 'node:fs';import './layer-math.js';
const root=new URL('./',import.meta.url),file=new URL('cutout-manifest.json',root),data=JSON.parse(fs.readFileSync(file));
if(data.revision!==12)throw new Error('Apply this placement migration only after revision 12.');
const original=structuredClone(data),rotate=(p,r)=>{r*=Math.PI/180;return {x:Math.cos(r)*p.x-Math.sin(r)*p.y,y:Math.sin(r)*p.x+Math.cos(r)*p.y};};
const axes=[{end:[.221,.857],neck:[.355,.668]},{end:[.775,.145],neck:[.557,.51]},{end:[.898,.859],neck:[.52,.182]},{end:[.15,.14],neck:[.27,.287]},{end:[.5,.86],neck:[.5,.465]}];
for(const c of Object.values(data.compositions)){
 if(c.category!=='Y')continue;
 const p=c.layers.find(l=>l.id==='object'),child=c.layers.find(l=>l.id==='foreground'),old=CardLayerMath.resolve(original,original.compositions[c.code],original.compositions[c.code].layers.find(l=>l.id==='foreground'));
 const axis=axes[c.effectDigit%5],size=152.95;
 const dir=CardLayerMath.point(old.affine,{x:(axis.neck[0]-axis.end[0])*old.transform.width,y:(axis.neck[1]-axis.end[1])*old.transform.height});
 const rotation=Math.atan2(dir.y,dir.x)*180/Math.PI+45;
 const tip=CardLayerMath.point(old.affine,{x:(axis.end[0]-.5)*old.transform.width,y:(axis.end[1]-.5)*old.transform.height});
 const localEnd=rotate({x:(.15-.5)*size,y:(.86-.5)*size},rotation);
 p.assetId='V.object.0';p.overrides={...p.overrides,x:old.transform.x+tip.x-localEnd.x,y:old.transform.y+tip.y-localEnd.y,width:size,height:size,rotationDeg:rotation};
 const base=data.assets[p.assetId],t={...base.defaultTransform,...p.overrides},stone=rotate(CardLayerMath.anchorVector(base,t,'stoneHead'),rotation);
 const offset=rotate({x:old.attachmentPoint.x-t.x-stone.x,y:old.attachmentPoint.y-t.y-stone.y},-rotation);
 child.overrides.rotationDeg=Math.atan2(old.affine[1],old.affine[0])*180/Math.PI-rotation;child.overrides.opacity=c.effectDigit<5?.4:.2;
 child.attachment.referenceParentSize=size;child.attachment.offset=offset;
 c.objectDigit=0;c.canonicalCode=`Y0${c.effectDigit}`;c.designRevision=13;
 const fx=data.assets[child.assetId];c.displayName=`${fx.name} / ${base.name}`;c.displayLabel=`${c.code} · ${c.displayName}`;
}
const cat=data.categories.find(c=>c.letter==='Y');cat.objectIds=['V.object.0'];cat.sharedObjectId='V.object.0';cat.exampleCodes=Array.from({length:10},(_,i)=>`Y0${i}`);cat.revision=13;
data.revision=13;data.references.meleeRevision='revision-v13.json';data.scope.latestBatchRevisedEffectCount=5;data.scope.sharedScepter={assetId:'V.object.0',size:152.95,category:'Y',legacyCodes:'Y10–Y99 remain compatibility aliases for Y00–Y09.'};
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');fs.writeFileSync(new URL('cutouts-data.js',root),'window.CARD_CUTOUT_DATA = '+JSON.stringify(data)+';\n');fs.writeFileSync(new URL('cutouts/Y/assets.json',root),JSON.stringify(Object.fromEntries(Object.entries(data.assets).filter(([,a])=>a.category==='Y')),null,2)+'\n');
fs.writeFileSync(new URL('revision-v13.json',root),JSON.stringify({revision:13,request:'One shared small scepter, aligned with each weapon axis; unchanged ethereal weapon geometry; blue and softer transparent green.',sharedScepterId:'V.object.0',sharedScepterSize:152.95,blueOpacity:.4,greenOpacity:.2,greenFilter:'saturate(0.45)',changedPngs:[5,6,7,8,9].map(i=>`Y.effect.${i}`),unchangedPngCount:357,canonicalCodes:cat.exampleCodes,legacyAliasCount:90,axisLandmarks:axes,greenSources:[5,6,7,8,9].map(i=>data.assets[`Y.effect.${i}`].references.sourceFile)},null,2)+'\n');
