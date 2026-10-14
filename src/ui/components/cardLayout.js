import {CARD_COMPONENTS} from '../../content/cardComponents.generated.js';

const references=new WeakMap();
export const cardLayoutDocument=(id)=>CARD_COMPONENTS.cards[id]||CARD_COMPONENTS.template;
export function rankAnchor(doc,panel){
  const layout=doc.layouts?.[doc.defaultLayout||'shared']||{},reference=doc.referenceRects?.panel||panel,parent=layout.panel||reference;
  const bar=layout['rank-bar'];
  if(!bar)return null;
  // Height borrowed for long rules does not stretch the rank gem. Undo only
  // authored group scaling, then anchor by the panel's current width/top edge.
  const sx=panel.w/parent.w,sy=reference.h/parent.h*panel.w/reference.w;
  const box={x:panel.x+(bar.x-parent.x)*sx,y:panel.y+(bar.y-parent.y)*sy,w:bar.w*sx,h:bar.h*sy};
  const text=layout['rank-text'];
  return {box,text:text?{x:(text.x-bar.x)/bar.w*100,y:(text.y-bar.y)/bar.h*100,w:text.w/bar.w*100,h:text.h/bar.h*100}:null};
}
export function cardPartNodes(face){
  const nodes=new Map([...face.querySelectorAll('[data-component]')].filter(n=>n.dataset.component!=='tags').map(n=>[n.dataset.component,n]));
  for(const [id,selector] of Object.entries({'heading-fill':'.card-title-fade','footer-fill':'.card-footer-backdrop','footer-trim':'.card-base-action-frame','action-icon':'.card-action-icon','action-text':'.card-type-name'})){const n=face.querySelector(selector);if(n)nodes.set(id,n);}
  face.querySelectorAll('.card-tag-symbol').forEach((n,i)=>nodes.set('tag-'+i,n));return nodes;
}
export function resetCardLayout(face){for(const n of face.querySelectorAll('[data-layout-transform]')){n.style.translate='';n.style.scale='';n.style.transformOrigin='';delete n.dataset.layoutTransform;}}
function localRect(node,face){
  let x=0,y=0,n=node;while(n&&n!==face){x+=n.offsetLeft||0;y+=n.offsetTop||0;n=n.offsetParent;}
  const scale=face.clientWidth/360;
  if(node.classList.contains('card-base-action-frame')){const b=node.getBBox();return {x:b.x,y:b.y,w:b.width,h:b.height};}
  return {x:x/scale,y:y/scale,w:(node.offsetWidth||node.clientWidth)/scale,h:(node.offsetHeight||node.clientHeight)/scale};
}
export function cardLayoutReferences(face){return references.get(face)||{};}
function prepareCardLayout(face){
  const width=face.clientWidth;if(!width)return null;
  const doc=cardLayoutDocument(face.dataset.cardLayoutId),layout=doc.layouts?.[doc.defaultLayout||'shared']||{},refs=doc.referenceRects||{},order=doc.order||[9,8,7,6,5,4,3,2,1];
  const transformed=Object.keys(layout).some(id=>refs[id]&&['x','y','w','h'].some(k=>Math.abs(layout[id][k]-refs[id][k])>.001));
  const nodes=transformed||face.dataset.layoutMeasure==='true'?cardPartNodes(face):new Map();
  const raw=Object.fromEntries([...nodes].map(([id,n])=>[id,localRect(n,face)]));
  const rank=face.querySelector('.card-rank'),rankRect=transformed&&rank?localRect(rank,face):null;
  return {doc,layout,refs,order,nodes,raw,rank,rankRect,unit:width/360};
}
function applyPreparedLayout(face,prepared){
  if(!prepared)return;
  const {doc,layout,refs,order,nodes,raw,rank,rankRect,unit}=prepared;
  for(const n of face.querySelectorAll('[data-card-layer]'))n.style.zIndex=String(order.length-order.indexOf(Number(n.dataset.cardLayer)));
  references.set(face,raw);
  const set=(node,r,dx,dy,sx,sy)=>{node.dataset.layoutTransform='true';node.style.translate=`${dx*unit}px ${dy*unit}px`;node.style.scale=`${sx} ${sy}`;node.style.transformOrigin=node.classList.contains('card-base-action-frame')?`${r.x*unit}px ${r.y*unit}px`:'0 0';};
  const group=doc.groups?.textBox,members=new Set(group?.members||[]),parent=group?.parent,p=raw[parent],from=refs[parent],to=layout[parent];
  if(p&&from&&to){
    const sx=to.w/from.w,sy=to.h/from.h,dx=to.x-from.x,dy=to.y-from.y;
    for(const id of members){if(id==='rank-bar'||id==='rank-text')continue;const n=nodes.get(id),r=raw[id];if(n&&r)set(n,r,dx+(r.x-p.x)*(sx-1),dy+(r.y-p.y)*(sy-1),sx,sy);}
    if(rank&&rankRect){const r=rankRect;set(rank,r,dx+(r.x-p.x)*(sx-1),dy+(r.y-p.y)*(sy-1),sx,sy);}
  }
  for(const [id,to] of Object.entries(layout)){
    if(members.has(id))continue;const n=nodes.get(id),from=refs[id],r=raw[id];if(n&&from&&r)set(n,r,to.x-from.x,to.y-from.y,to.w/from.w,to.h/from.h);
  }
}
// Measure the batch before changing paint/transform styles. Large collections
// must not alternate a page layout read and a style invalidation per card.
export function applyCardLayouts(faces){const prepared=faces.map(prepareCardLayout);faces.forEach((face,i)=>applyPreparedLayout(face,prepared[i]));}
