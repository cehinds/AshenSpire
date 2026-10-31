import {reviewedCardArtCatalog as catalog} from '../../content/reviewedCardArt.generated.js';
import {contentBundle} from '../../content/index.js';
import {createRegistries} from '../../model/registries.js';
import {renderCard} from '../components/card.js';
import {cardArtLayersHtml} from '../cardArtLayers.js';
import {cardCutoutUrl} from '../layeredCardArt.js';
import {gameRootURL} from './cardArtReviewUrl.js';
const reg=createRegistries(contentBundle), original=structuredClone(catalog.records), checked=new Set();
const $=id=>document.getElementById(id), records=Object.values(catalog.records);
let selected=Object.keys(catalog.records)[0];
// Asset IDs are rooted at the game (this module is src/ui/tools/), keeping any deployment prefix.
const rootURL=gameRootURL(import.meta.url);
const imageURL=path=>new URL(cardCutoutUrl(path),rootURL).href;
function element(tag,text){const node=document.createElement(tag);if(text)node.textContent=text;return node;}
function download(blob,name){const url=URL.createObjectURL(blob),a=element('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function queue(){
  const query=$('search').value.toLowerCase();$('queue').replaceChildren();
  for(const [id,art] of Object.entries(catalog.records)){
    if(!`${art.label} ${id} ${art.tags.join(' ')}`.toLowerCase().includes(query))continue;
    const li=element('li'),check=element('input'),button=element('button',`${art.code} · ${art.label}`);
    check.type='checkbox';check.checked=checked.has(id);check.setAttribute('aria-label',`Reviewed ${art.label}`);
    check.onchange=()=>{check.checked?checked.add(id):checked.delete(id);summary();};
    button.setAttribute('aria-current',String(selected===id));button.onclick=()=>{selected=id;queue();show();};li.append(check,button);$('queue').append(li);
  }
}
function summary(){$('summary').textContent=`${records.length} cards · ${checked.size} checked · backgrounds, objects and effects remain separate`;}
function preview(){
  const art=catalog.records[selected],base=element('img');base.src=imageURL(art.path);base.alt='';
  $('art').replaceChildren(base);$('art').insertAdjacentHTML('beforeend',cardArtLayersHtml({kind:'simple',componentArt:art,layers:[]}));
  $('native').replaceChildren(renderCard(reg,{cardId:selected},{inspection:false}));
  for(const img of document.querySelectorAll('#art img,#native img')){
    const raw=img.getAttribute('src');if(raw&&!/^(data:|https?:|blob:)/.test(raw))img.src=new URL(raw,rootURL).href;
  }
}
function show(){
  const art=catalog.records[selected];$('name').textContent=`${art.code} · ${art.label}`;$('cues').textContent=art.visualCues.join(' · ');preview();$('components').replaceChildren();
  for(const [index,sprite] of art.sprites.entries()){
    const box=element('section'),title=element('h4',sprite.label),img=element('img'),link=element('a',`${sprite.assetId} · PNG`);box.className='component';img.src=imageURL(sprite.path);img.alt=sprite.label;link.href=img.src;link.target='_blank';link.rel='noopener';box.append(title,img,link);
    for(const key of ['x','y','width','height','rotation','opacity']){
      const label=element('label',key),input=element('input');input.type='number';input.step=key==='opacity'?'.05':'1';input.value=sprite.transform[key];input.setAttribute('aria-label',`${sprite.assetId} ${key}`);if(key==='opacity'){input.min=0;input.max=1;}else if(key==='width'||key==='height')input.min=1;
      input.oninput=()=>{const value=input.valueAsNumber;if(!Number.isFinite(value)||!input.validity.valid)return; sprite.transform[key]=value;const t=sprite.transform;
        sprite.css.left=`${t.x/512*100}%`;sprite.css.top=`${t.y/640*100}%`;sprite.css.width=`${t.width/512*100}%`;sprite.css.height=`${t.height/640*100}%`;sprite.css.opacity=String(t.opacity);
        const initial=original[selected].sprites[index],r=(t.rotation-initial.transform.rotation)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),[a,b,d,e]=initial.affine;
        sprite.affine=[c*a-s*b,s*a+c*b,c*d-s*e,s*d+c*e];sprite.css.transform=`translate(-50%, -50%) matrix(${sprite.affine.join(',')},0,0)`;preview();};label.append(input);box.append(label);
    }
    $('components').append(box);
  }
}
$('search').oninput=queue;
$('reset').onclick=()=>{catalog.records[selected]=structuredClone(original[selected]);show();};
$('export').onclick=()=>download(new Blob([JSON.stringify({schema:1,checked:[...checked],catalog},null,2)],{type:'application/json'}),'reviewed-card-art-edits.json');
$('png').onclick=async()=>{
  try{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=640;const ctx=canvas.getContext('2d');
    for(const sprite of catalog.records[selected].sprites){const img=new Image();img.src=imageURL(sprite.path);await img.decode();const t=sprite.transform;ctx.save();ctx.translate(t.x,t.y);ctx.transform(...sprite.affine,0,0);ctx.globalAlpha=t.opacity;ctx.globalCompositeOperation=t.blendMode==='normal'?'source-over':t.blendMode;ctx.drawImage(img,-t.width/2,-t.height/2,t.width,t.height);ctx.restore();}
    canvas.toBlob(blob=>{if(blob)download(blob,`${selected}-art.png`);},'image/png');
  }catch(error){$('status').textContent=`Could not export art: ${error.message}`;}
};
summary();queue();show();
