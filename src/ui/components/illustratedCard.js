import {CARD_COMPONENTS} from '../../content/cardComponents.generated.js';
import {assetUrl} from '../assetmap.js';
import {esc} from './tooltip.js';
import {playingCardArt} from '../cardArtwork.js';
import {cardSigilsHtml} from './combatSigilView.js';
import {fitIllustratedCards} from './illustratedCardFitter.js';

export function illustratedArtwork(ref, id, {large=false,equipmentArt=null,extended}={}) {
  const override=CARD_COMPONENTS.cards[id]?.layers.find(l=>l.bind==='artwork')?.href;
  const existing=playingCardArt(ref,{large,extended});
  if(existing?.extended)return {...existing,equipment:false};
  if(override)return {path:override,kind:'illustrated',equipment:false};
  if(existing?.kind==='official')return {...existing,equipment:false};
  if(equipmentArt)return {path:equipmentArt,kind:'equipment',equipment:true};
  return existing?{...existing,equipment:false}:null;
}


const polygon='polygon(12% 4%,88% 4%,95% 11%,95% 90%,88% 96.6%,12% 96.6%,5.2% 90%,5.2% 11%)';
export function illustratedCardHtml(model,{rules,painting,equipmentArtwork=false,artworkKind='illustrated',artworkPosition=null,glyph}){
  const doc=CARD_COMPONENTS.cards[model.id]||CARD_COMPONENTS.template;
  const clip=doc.clipPolygon?'polygon('+doc.clipPolygon.map(([x,y])=>`${x*100}% ${y*100}%`).join(',')+')':polygon;
  const values={name:esc(model.name),rules,tags:esc(model.faceType||model.tags.map(t=>t.label).join(' · ')),action:esc(model.costs.variable?'X':model.costs.action),mana:esc(model.costs.mana??0),stamina:esc(model.costs.variable?'X':model.costs.stamina??0)};
  const costLayout=Number(model.costs.mana)>0?'staminaMana':'staminaOnly';
  const costLayers=doc.costLayouts?.[costLayout]?.layers||{};
  const portraitArt=painting?.startsWith('assets/cards/extended/');
  const layers=doc.layers.map(l=>({...l,...costLayers[l.id],...(portraitArt&&l.bind==='artwork'?{visible:true,fit:'cover',trim:null}: {})})).filter(l=>l.visible!==false).map(source=>{
    let l=equipmentArtwork&&source.bind==='artwork'?{...source,...doc.equipmentArtwork}:source;
    if(model.sigils&&l.bind==='rules')l={...l,autoFit:true,minFontSize:22,maxLines:null};
    else if(model.faceType&&l.bind==='rules')l={...l,autoFit:true,minFontSize:14,maxLines:12};
    if(model.faceType&&l.bind==='tags')l={...l,fontSize:30,minFontSize:24,maxFontSize:30,fontWeight:'bold',maxLines:1,autoFit:true};
    const position=`left:${l.x/doc.width*100}%;top:${l.y/doc.height*100}%;width:${l.w/doc.width*100}%;height:${l.h/doc.height*100}%;opacity:${l.opacity};filter:hue-rotate(${Number.isFinite(l.hue)?l.hue:0}deg);transform:rotate(${l.rotation}deg);`;
    let body='';
    if(l.bind==='tags'&&model.sigils){
      body=cardSigilsHtml(model.sigils,model.tags.filter(tag=>tag.id.startsWith('damage:')).map(tag=>tag.label));
    }else if(l.type==='image'){
      const href=l.bind==='artwork'?(painting||l.href):l.href;
      if(href){
        const [x,y,w,h]=l.trim||[0,0,l.imageWidth||1,l.imageHeight||1];
        const crop=l.trim?`width:${l.imageWidth/w*100}%;height:${l.imageHeight/h*100}%;left:${-x/w*100}%;top:${-y/h*100}%;`:'width:100%;height:100%;left:0;top:0;';
        body=`<span class="ic-image"><img${l.bind==='artwork'?` class="playing-card-art" data-card-art="${esc(artworkKind)}"`:''} alt="" aria-hidden="true" src="${esc(assetUrl(href))}" style="${crop}${l.bind==='artwork'&&artworkPosition?`object-position:${esc(artworkPosition)};`:''}object-fit:${l.fit==='cover'?'cover':l.fit==='contain'||l.bind==='artwork'?'contain':'fill'}" /></span>`;
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

export { fitIllustratedCards };
