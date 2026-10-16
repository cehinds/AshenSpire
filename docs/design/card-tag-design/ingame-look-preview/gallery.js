import {illustratedCardHtml,illustratedArtwork,fitIllustratedCards} from '/src/ui/components/illustratedCard.js';
import {contentBundle} from '/src/content/index.js';
import {createRegistries} from '/src/model/registries.js';
import {CARD_ART_SIMPLE} from '/src/ui/cardArtStyle.js';
const registries=createRegistries(contentBundle);
import {esc} from '/src/ui/components/tooltip.js';
const data=await(await fetch('/proposals.json')).json();
const maps={'Ward Armor':'crystalBarrier','Grease':'progression-gravitic-knot','Smite':'sacredHarvest','Poison':'viperStrike','Mirrors':'progression-nightglass-reading','Foresight':'astralInsight'};
const picks=Object.keys(maps).map(name=>data.cards.find(c=>c.name===name));
function card(c){const artId=maps[c.name]||'starstonePebble';const a=illustratedArtwork({cardId:artId},artId,{large:true,style:CARD_ART_SIMPLE,definition:registries.cards.get(artId),registries});if(a?.kind!=='simple')throw Error('Simple artwork required: '+artId);const model={id:c.id,name:c.name,type:{label:'Unassigned'},costs:{action:'?',mana:1,stamina:'?'},rankBadge:'?',rankHelp:'Rank unassigned in proposal',sideTags:[],range:null};const rules=c.face.lines.map(l=>`<span class="face-line">${esc(l)}</span>`).join(' ');const el=document.createElement('div');el.className='card illustrated-card';el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',`Inspect ${c.name}`);el.innerHTML=illustratedCardHtml(model,{rules,painting:a.path,artworkKind:a.kind,artworkPosition:a.position,artworkComposition:a,effectMode:'summary'});el.querySelectorAll('[data-card-binding="mana"]').forEach(x=>x.textContent='?');configurePreviewPresentation(el);configureEffectBox(el);el.onclick=()=>inspect(c);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(c)}};return el;}
function configurePreviewPresentation(card){
  const face=card.querySelector('.illustrated-card-face');
  // Production couples its visual title backdrop to sigils. Proposal identity is
  // unassigned, so restore only that existing visual component, not its mechanics.
  if(!face.querySelector('.card-title-fade'))face.insertAdjacentHTML('beforeend','<div class="card-title-fade" data-card-layer="3" aria-hidden="true"></div>');
}
function configureEffectBox(card){
  const text=card.querySelector('[data-card-binding="rules"]'),layer=text.parentElement;
  // Inset the authored rules rectangle around its center; other card layers stay authored.
  const old={x:parseFloat(layer.style.left),y:parseFloat(layer.style.top),w:parseFloat(layer.style.width),h:parseFloat(layer.style.height)};
  const w=old.w*.82,h=old.h*(84/110);
  Object.assign(layer.style,{left:(old.x+(old.w-w)/2)+'%',top:(old.y+(old.h-h)/2)+'%',width:w+'%',height:h+'%',alignItems:'center',justifyContent:'center'});
  text.style.textAlign='center';text.dataset.minFont='22';text.dataset.maxFont='31';text.dataset.effectLineBudget='3';
  layer.dataset.previewEffectBox='centered-inset';card.dataset.proposalText=text.textContent.replace(/\s+/g,' ').trim();
}
function tile(c){const el=document.createElement('article');el.className='tile';el.append(card(c));const cap=document.createElement('div');cap.className='caption';cap.innerHTML=`Art reference: <span>${esc(maps[c.name]||'starstonePebble')}</span>`;el.append(cap);return el;}
const hero=document.querySelector('.hero');picks.forEach(c=>hero.append(tile(c)));
function fit(){fitIllustratedCards(document.querySelectorAll('.card'));}
async function ready(){await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));fit();window.previewReady=true;}
function inspect(c){const modal=document.querySelector('.inspection');modal.querySelector('.inspect-card').replaceChildren(card(c));modal.querySelector('.inspect-copy').innerHTML=`<div class="eyebrow">Proposed effect · Full inspection</div><h2>${esc(c.name)}</h2><p>${esc(c.inspection.fullRules)}</p><p style="font:13px/1.6 Arial;color:#aa9a80">Costs, rank, school and stance: unassigned.<br>Reused art: ${esc(maps[c.name]||'starstonePebble')}. Art does not assign mechanics.</p>`;modal.classList.add('open');ready();}
document.querySelector('.close').onclick=()=>document.querySelector('.inspection').classList.remove('open');document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.close').click()});document.querySelector('.more').onclick=()=>{const all=document.querySelector('#all');if(!all.children.length)data.cards.filter(c=>['combatCard','statusCard'].includes(c.entityKind)).forEach(c=>all.append(tile(c)));all.style.display=all.style.display==='grid'?'none':'grid';ready();};window.addEventListener('resize',fit);await ready();
