import {assetUrl} from '../assetmap.js';
import {cardLayoutDocument,cardPartNodes} from './cardLayout.js';

function imageNode(href,fit){const img=document.createElement('img');img.src=assetUrl(href);img.alt='';img.setAttribute('aria-hidden','true');Object.assign(img.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:fit||'contain'});return img;}
function paint(node,visual){
  if(!node||!visual)return;
  node.querySelectorAll(':scope > [data-card-decoration]').forEach(n=>n.remove());
  const isSvg=node.tagName.toLowerCase()==='svg';
  if(visual.href){
    if(isSvg){const r=visual.imageRect||{x:0,y:0,w:360,h:540},img=document.createElementNS('http://www.w3.org/2000/svg','image');for(const [k,v] of Object.entries({href:assetUrl(visual.href),x:r.x,y:r.y,width:r.w,height:r.h,preserveAspectRatio:visual.fit==='fill'?'none':'xMidYMid meet'}))img.setAttribute(k,String(v));node.replaceChildren(img);}
    else{if(getComputedStyle(node).position==='static')node.style.position='relative';node.replaceChildren(imageNode(visual.href,visual.fit));node.style.background='none';node.style.clipPath='none';}
    node.dataset.customImage='true';
  }else if(visual.svg){
    const svg=isSvg?node:document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',visual.svg.viewBox);svg.setAttribute('aria-hidden','true');svg.setAttribute('fill',visual.svg.fill||'currentColor');svg.setAttribute('fill-rule','evenodd');for(const key of ['stroke','stroke-width','stroke-linecap','stroke-linejoin'])if(visual.svg[key])svg.setAttribute(key,visual.svg[key]);svg.innerHTML=visual.svg.body;
    if(!isSvg){Object.assign(svg.style,{width:'100%',height:'100%',display:'block'});node.replaceChildren(svg);}
  }
  Object.assign(node.style,visual.style||{});
  if(visual.visible===false)node.style.visibility='hidden';
  if(!visual.href)for(const d of visual.decorations||[]){const child=document.createElement('span');child.setAttribute('aria-hidden','true');child.dataset.cardDecoration='true';Object.assign(child.style,d.style);node.append(child);}
}
export function applyCardAppearance(face,doc=cardLayoutDocument(face.dataset.cardLayoutId)){
  const nodes=cardPartNodes(face);
  const action=face.querySelector('[data-primary-sigil]')?.dataset.primarySigil;
  paint(face.querySelector('.combat-sigil-action'),doc.symbols?.actions?.[action]);
  face.querySelectorAll('[data-tag-id]').forEach(n=>{paint(n,doc.symbols?.tags?.[n.dataset.tagId]||doc.symbols?.tags?.[n.dataset.tagId.split(':').at(-1)]);});
  for(const [id,node] of nodes){
    const component=doc.components?.[id];
    if(id==='action-icon'&&component?.href){paint(node.querySelector('.combat-sigil-action'),component);Object.assign(node.style,component.style||{});}
    else paint(node,component);
    const text=node.matches('.ic-text')?node:node.querySelector('.ic-text');
    if(text&&component){Object.assign(text.style,component.style||{});if(component.text){const t=component.text;text.dataset.minFont=t.minFontSize??t.fontSize??text.dataset.minFont;text.dataset.maxFont=t.maxFontSize??t.fontSize??text.dataset.maxFont;if(t.fontSize)text.style.fontSize=t.fontSize/3.6+'cqw';}}
  }
  if(doc.components?.['tag-rail'])paint(face.querySelector('.card-tag-rail'),doc.components['tag-rail']);
  if(doc.components?.['rank-group'])paint(face.querySelector('.card-rank'),doc.components['rank-group']);
  if(doc.components?.['footer-band'])paint(face.querySelector('.card-sigil-band'),doc.components['footer-band']);
}
