import {CARD_COMPONENTS} from '../../content/cardComponents.generated.js';
import {assetUrl} from '../assetmap.js';
import {esc} from './tooltip.js';
import {playingCardArt} from '../cardArtwork.js';

export function illustratedArtwork(ref, id, {large=false,equipmentArt=null}={}) {
  const override=CARD_COMPONENTS.cards[id]?.layers.find(l=>l.bind==='artwork')?.href;
  const existing=playingCardArt(ref,{large});
  if(override)return {path:override,kind:'illustrated',equipment:false};
  if(existing?.kind==='official')return {...existing,equipment:false};
  if(equipmentArt)return {path:equipmentArt,kind:'equipment',equipment:true};
  return existing?{...existing,equipment:false}:null;
}


const polygon='polygon(12% 4%,88% 4%,95% 11%,95% 90%,88% 96.6%,12% 96.6%,5.2% 90%,5.2% 11%)';
export function illustratedCardHtml(model,{rules,painting,equipmentArtwork=false,artworkKind='illustrated',glyph}){
  const doc=CARD_COMPONENTS.cards[model.id]||CARD_COMPONENTS.template;
  const clip=doc.clipPolygon?'polygon('+doc.clipPolygon.map(([x,y])=>`${x*100}% ${y*100}%`).join(',')+')':polygon;
  const values={name:esc(model.name),rules,tags:esc(model.tags.map(t=>t.label).join(' · ')),action:esc(model.costs.variable?'X':model.costs.action),mana:esc(model.costs.mana??0),stamina:esc(model.costs.variable?'X':model.costs.stamina??0)};
  const costLayout=Number(model.costs.mana)>0?'staminaMana':'staminaOnly';
  const costLayers=doc.costLayouts?.[costLayout]?.layers||{};
  const layers=doc.layers.map(l=>({...l,...costLayers[l.id]})).filter(l=>l.visible!==false).map(source=>{
    const l=equipmentArtwork&&source.bind==='artwork'?{...source,...doc.equipmentArtwork}:source;
    const position=`left:${l.x/doc.width*100}%;top:${l.y/doc.height*100}%;width:${l.w/doc.width*100}%;height:${l.h/doc.height*100}%;opacity:${l.opacity};filter:hue-rotate(${Number.isFinite(l.hue)?l.hue:0}deg);transform:rotate(${l.rotation}deg);`;
    let body='';
    if(l.type==='image'){
      const href=l.bind==='artwork'?(painting||l.href):l.href;
      if(href){
        const [x,y,w,h]=l.trim||[0,0,l.imageWidth||1,l.imageHeight||1];
        const crop=l.trim?`width:${l.imageWidth/w*100}%;height:${l.imageHeight/h*100}%;left:${-x/w*100}%;top:${-y/h*100}%;`:'width:100%;height:100%;left:0;top:0;';
        body=`<span class="ic-image"><img${l.bind==='artwork'?` class="playing-card-art" data-card-art="${esc(artworkKind)}"`:''} alt="" aria-hidden="true" src="${esc(assetUrl(href))}" style="${crop}object-fit:${l.fit==='cover'?'cover':l.fit==='contain'||l.bind==='artwork'?'contain':'fill'}" /></span>`;
      }else body=`<span class="ic-glyph">${glyph}</span>`;
    }else{
      const text=values[l.bind]??esc(l.text||'');
      const font=`font-family:${esc(l.font||'Georgia')};font-size:${(l.fontSize||20)/doc.width*100}cqw;font-weight:${esc(l.fontWeight||'normal')};text-align:${esc(l.align||'center')};color:${esc(l.color||'#eee')};`;
      body=`<div class="ic-text" data-card-binding="${esc(l.bind||l.id)}" data-min-font="${l.minFontSize||l.fontSize||20}" data-max-font="${l.maxFontSize||l.fontSize||20}" data-auto-fit="${l.autoFit===true}" data-max-lines="${l.maxLines||1}" style="${font}${l.maxLines?`display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${Math.max(1,Math.floor(l.maxLines))};height:auto;`: ''}${l.outline?`text-shadow:1px 1px 0 ${esc(l.outline)},-1px -1px 0 ${esc(l.outline)};`:''}">${text}</div>`;
    }
    return `<div class="ic-plane"${l.clip?` style="clip-path:${clip}"`:''}><div class="ic-layer" data-component="${esc(l.id)}" style="${position}">${body}</div></div>`;
  }).join('');
  return `<div class="illustrated-card-face" data-cost-layout="${costLayout}" aria-label="${esc(model.name)}" data-design-width="${doc.width}" style="--illustrated-ratio:${doc.width}/${doc.height}">${layers}</div>`;
}

// Keep type within authored bounds. Measure unclamped text, then restore the
// visible line budget so long descriptions stop shrinking at the readable floor.
// THE WHOLE HAND IN STEP. Each probe writes a font size and reads the text's
// box, and a read after a write is a synchronous layout. One text at a time
// that was up to eight layouts per text, per card: about ninety on the first
// frame of a fight. Every text now takes the same probe of its own search in
// the same pass (write all sizes, then read all boxes), so a batch costs the
// search's nine passes however many cards it holds. Each text's search, and so
// its result, is unchanged: probes of different texts never share a box.
export function fitIllustratedCards(cards){
  const faces=[];
  for(const card of cards){const face=card?.querySelector('.illustrated-card-face');if(face)faces.push(face);}
  const widths=faces.map(face=>face.clientWidth);
  const texts=[];
  faces.forEach((face,i)=>{
    if(!widths[i])return;
    const scale=widths[i]/Number(face.dataset.designWidth);
    for(const text of face.querySelectorAll('.ic-text[data-auto-fit="true"]')){
      const lines=Number(text.dataset.maxLines)||1;
      const low=Number(text.dataset.minFont)*scale;
      texts.push({text,scale,lines,low,high:Math.max(low,Number(text.dataset.maxFont)*scale),boxHeight:0});
    }
  });
  if(!texts.length)return;
  for(const t of texts)t.boxHeight=t.text.parentElement.clientHeight;
  // One probe for every text still searching: all writes, then all reads.
  const probe=(list,sizeOf)=>{
    for(const t of list){t.text.style.webkitLineClamp='unset';t.text.style.fontSize=sizeOf(t)+'px';}
    return list.map(t=>{const size=sizeOf(t);return t.text.scrollHeight<=Math.min(t.boxHeight,size*1.25*t.lines)+1 && t.text.scrollWidth<=t.text.clientWidth+1;});
  };
  const atHigh=probe(texts,t=>t.high);
  const searching=[];
  texts.forEach((t,i)=>{if(atHigh[i])t.result=t.high;else{t.lo=t.low;t.hi=t.high;searching.push(t);}});
  for(let i=0;i<7&&searching.length;i++){
    const mid=t=>(t.lo+t.hi)/2;
    const ok=probe(searching,mid);
    searching.forEach((t,j)=>{const m=mid(t);if(ok[j])t.lo=m;else t.hi=m;});
  }
  for(const t of searching)t.result=t.lo;
  for(const t of texts){
    t.text.style.fontSize=t.result+'px';
    t.text.style.webkitLineClamp=String(t.lines);
    t.text.dataset.fittedFont=String(t.result/t.scale);
  }
}
