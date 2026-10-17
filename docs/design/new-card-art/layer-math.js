/* Shared by the editor and gallery. All geometry uses the 512 x 640 art crop. */
(() => {
 'use strict';
 const linear=t=>{const r=t.rotationDeg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [c*t.scaleX,s*t.scaleX,-s*t.scaleY,c*t.scaleY];};
 const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y,y:m[1]*p.x+m[3]*p.y});
 const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3]];
 function anchorVector(a,t,name){const p=a.anchors[name],s=Math.min(t.width/a.width,t.height/a.height);return {x:(p.x-.5)*a.width*s,y:(p.y-.5)*a.height*s};}
 function css(t,m=linear(t)){return {position:'absolute',left:`${t.x/512*100}%`,top:`${t.y/640*100}%`,width:`${t.width/512*100}%`,height:`${t.height/640*100}%`,objectFit:'contain',transformOrigin:'50% 50%',transform:`translate(-50%, -50%) matrix(${m.join(',')},0,0)`,opacity:String(t.opacity),mixBlendMode:t.blendMode,pointerEvents:'none'};}
 function resolve(data,composition,layer){
  const a=data.assets[layer.assetId],t={...a.defaultTransform,...layer.overrides};let m=layer.detachedAffine||linear(t),attachmentPoint=null;
  const link=layer.attachment,parent=link?.enabled&&composition.layers.find(l=>l.id===link.parentLayer);
  const pa=parent&&data.assets[parent.assetId];
  if(parent&&pa.anchors?.[link.parentAnchor]&&a.anchors?.[link.selfAnchor]){
   const pt={...pa.defaultTransform,...parent.overrides},pm=linear(pt),v=point(pm,anchorVector(pa,pt,link.parentAnchor));
   const scale=Math.min(pt.width,pt.height)/link.referenceParentSize;
   const offset=point(pm,{x:(link.offset?.x||0)*scale,y:(link.offset?.y||0)*scale});
   attachmentPoint={x:pt.x+v.x+offset.x,y:pt.y+v.y+offset.y};
   m=multiply(pm,linear({...t,scaleX:t.scaleX*scale,scaleY:t.scaleY*scale}));
   const root=point(m,anchorVector(a,t,link.selfAnchor));t.x=attachmentPoint.x-root.x;t.y=attachmentPoint.y-root.y;
  }
  const styles=css(t,m);
  // Keep the longstanding readable CSS for ordinary independent layers.
  if(!attachmentPoint&&!layer.detachedAffine)styles.transform=`translate(-50%, -50%) rotate(${t.rotationDeg}deg) scale(${t.scaleX}, ${t.scaleY})`;
  return {...layer,src:a.src,references:a.references,transform:t,affine:m,attachmentPoint,css:{...styles,zIndex:String(layer.zIndex),display:layer.visible?'block':'none'}};
 }
 globalThis.CardLayerMath={resolve,point,anchorVector};
})();
