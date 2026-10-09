import {cardTagRailHtml} from './cardTagSymbols.js';
import {CARD_COMPONENTS} from '../../content/cardComponents.generated.js';
import {assetUrl} from '../assetmap.js';
import {esc} from './tooltip.js';
import {playingCardArt} from '../cardArtwork.js';
import {cardSigilsHtml} from './combatSigilView.js';
import {fitIllustratedCards} from './illustratedCardFitter.js';
import {rankAnchor} from './cardLayout.js';

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
export const CARD_LAYERS=Object.freeze({background:1,art:2,backdrops:3,footerTrim:4,fills:5,trim:6,icons:7,text:8,rank:9});
// Complementary clips split the existing painted components without replacing
// their texture. Both pieces retain exactly the same authored image geometry.
const interiors={base:'6% 10%,12% 5%,88% 5%,94% 10%,94% 90%,88% 96%,12% 96%,6% 90%',panel:'5% 12%,95% 12%,95% 88%,5% 88%',flag:'12% 5%,88% 5%,88% 84%,50% 77%,12% 84%'};
function componentPlane(l,position,body,clip,layer,id=l.id,cut=null){
  const mask=cut?`clip-path:polygon(${cut});`:'';
  return `<div class="ic-plane" data-card-layer="${layer}" style="z-index:${layer};${l.clip?`clip-path:${clip};`:''}"><div class="ic-layer" data-component="${esc(id)}" style="${position}${mask}">${body}</div></div>`;
}
// These braces belong to the base frame, leaving its original stone and metal
// visible beneath the action. The text layer adds no separate plaque.
const actionBaseFrame = `<svg class="card-base-action-frame" viewBox="0 0 360 540" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M16 460H344M16 458V483L48 525H312L344 483V458" fill="none" stroke="#17110b" stroke-width="5"/><path d="M17 460H343M17 458V483L49 525H311L343 483V458" fill="none" stroke="#a37b43" stroke-width="2.4"/><path d="M19 460H341M19 462V482L50 523H310L341 482V462" fill="none" stroke="#e0bc7c" stroke-width=".7"/><path d="M20 467 39 482 20 501M340 467 321 482 340 501" fill="none" stroke="#21180e" stroke-width="4"/><path d="M20 467 39 482 20 501M340 467 321 482 340 501" fill="none" stroke="#a98247" stroke-width="1.4"/></svg>`;
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
    if(model.sigils){
      // Raise the parchment as one piece, preserving its effect-text capacity.
      // The newly exposed stone is the action band's background.
      const lift=doc.height*.061;
      if(l.id==='panel'||l.bind==='rules')l={...l,y:l.y-lift};
      if(l.bind==='artwork')l={...l,h:l.h-lift};
      if(l.bind==='tags')l={...l,x:doc.width*.1,y:doc.height*.858,w:doc.width*.8,h:doc.height*.116};
    }
    const footer=l.bind==='tags'&&model.sigils;
    const position=`left:${l.x/doc.width*100}%;top:${l.y/doc.height*100}%;width:${l.w/doc.width*100}%;height:${l.h/doc.height*100}%;opacity:${l.opacity};filter:${footer?'none':`hue-rotate(${Number.isFinite(l.hue)?l.hue:0}deg)`};transform:${footer?'none':`rotate(${l.rotation}deg)`};`;
    let body='';
    if(l.bind==='tags'&&model.sigils){
      body=cardSigilsHtml(model.sigils);
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
    if(footer)return `<div class="ic-plane"><div class="ic-layer" data-component="${esc(l.id)}" style="${position}">${body}</div></div>`;
    if(interiors[l.id]){
      const inside=interiors[l.id],outside=`evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${inside},${inside.split(',')[0]}`;
      return componentPlane(l,position,body,clip,l.id==='base'?CARD_LAYERS.background:CARD_LAYERS.fills,l.id,inside)
        +componentPlane(l,position,body,clip,CARD_LAYERS.trim,l.id==='base'?'card-trim':`${l.id}-trim`,outside);
    }
    return componentPlane(l,position,body,clip,l.bind==='artwork'?CARD_LAYERS.art:l.type==='text'?CARD_LAYERS.text:CARD_LAYERS.icons);
  }).join('');
  const panel=doc.layers.find(l=>l.id==='panel');
  const panelTop=panel?panel.y-(model.sigils?doc.height*.061:0):doc.height*.58;
  const anchor=rankAnchor(doc,{...panel,y:panelTop});
  const r=anchor?.box,text=anchor?.text;
  const rank=model.rankBadge?`<span class="card-rank" data-card-layer="9" data-panel-inset="${r?(r.y-panelTop)/doc.height*100:0}" title="${esc(model.rankHelp)}" style="${r?`left:${r.x/doc.width*100}%;top:${r.y/doc.height*100}%;width:${r.w/doc.width*100}%;height:${r.h/doc.width*100}cqw;transform:none;`:''}"><span class="card-rank-bar" data-component="rank-bar" aria-hidden="true"></span><span class="card-rank-text" data-component="rank-text"${text?` style="position:absolute;left:${text.x}%;top:${text.y}%;width:${text.w}%;height:${text.h}%;display:grid;place-items:center;font-size:clamp(8px,${r.h*text.h/100/1.15/doc.width*100}cqw,20px);"`:''}>${esc(model.rankBadge)}</span></span>`:'';
  const backdrops=model.sigils?'<div class="card-title-fade" data-card-layer="3" aria-hidden="true"></div><div class="card-footer-backdrop" data-card-layer="3" aria-hidden="true"></div>':'';
  const footerTrim=model.sigils?`<div class="ic-plane" data-card-layer="4" style="z-index:4">${actionBaseFrame}</div>`:'';
  return `<div class="illustrated-card-face" data-card-layout-id="${esc(model.id)}" data-cost-layout="${costLayout}" aria-label="${esc(model.name)}" data-design-width="${doc.width}" style="--illustrated-ratio:${doc.width}/${doc.height}">${layers}${backdrops}${footerTrim}${cardTagRailHtml(model.sideTags)}${rank}</div>`;
}

export { fitIllustratedCards };
