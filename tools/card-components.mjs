import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {contentBundle} from '../src/content/index.js';
import {validateCardAppearance} from '../src/model/cardAppearance.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function compileCardComponents(template,cards,base=root){
  validateCardAppearance(template);
  if(template.schemaVersion!==1||!Array.isArray(template.layers)||!template.layers.length)throw Error('Invalid card layout schema');
  if(template.version!==undefined){
    if(template.version!==1||template.coordinateSpace?.width!==template.width||template.coordinateSpace?.height!==template.height)throw Error('Invalid card preview coordinate space');
    if(!Array.isArray(template.order)||template.order.length!==9||new Set(template.order).size!==9||template.order.some(n=>!Number.isInteger(n)||n<1||n>9))throw Error('Invalid card paint order');
    if(!template.layouts?.[template.defaultLayout])throw Error('Missing shared card layout');
    for(const rects of [template.referenceRects,...Object.values(template.layouts)])for(const r of Object.values(rects||{}))if(!r||['x','y','w','h'].some(k=>!Number.isFinite(r[k]))||r.w<=0||r.h<=0)throw Error('Invalid card component rectangle');
    for(const group of Object.values(template.groups||{}))if(!Array.isArray(group.members)||!group.members.includes(group.parent))throw Error('Invalid card component group');
  }
  for(const key of ['width','height'])if(!Number.isFinite(template[key])||template[key]<10||template[key]>4000)throw Error('Invalid card layout size');
  const manifestPath=resolve(base,'art-manifest.json');
  const manifest=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):null;
  const hasAsset=href=>!!manifest?.assets?.[href] || existsSync(resolve(base,href));
  for(const visual of [...Object.values(template.components||{}),...Object.values(template.symbols||{}).flatMap(c=>Object.values(c))])if(visual.href&&!hasAsset(visual.href))throw Error('Missing card component image: '+visual.href);
  const ids=new Set();
  for(const layer of template.layers){
    if(ids.has(layer.id)||!['image','text'].includes(layer.type))throw Error('Invalid or duplicate card layer');ids.add(layer.id);
    for(const key of ['x','y','w','h','rotation','opacity'])if(!Number.isFinite(layer[key]))throw Error('Invalid geometry: '+layer.id);
    if(layer.w<=0||layer.h<=0)throw Error('Invalid layer size');
    if(layer.href&&(!/^assets\/[\w/.-]+\.(png|webp|svg)$/.test(layer.href)||layer.href.includes('..')||!hasAsset(layer.href)))throw Error('Missing or unsafe card component: '+layer.href);
  }
  const {artworkByCard={},overrides={},...shared}=template;
  for(const href of Object.values(artworkByCard))if(!/^assets\/[\w/.-]+\.(png|webp|svg)$/.test(href)||href.includes('..')||!hasAsset(href))throw Error('Missing card artwork: '+href);
  for(const override of [...Object.values(overrides),...Object.values(template.costLayouts||{})])for(const layer of Object.values(override.layers||{})){
    if('href' in layer)throw Error('Set card artwork through artworkByCard');
    for(const key of ['x','y','w','h','rotation','opacity','hue'])if(key in layer&&!Number.isFinite(layer[key]))throw Error('Invalid card override');
  }
  const objects=Object.fromEntries(cards.map(card=>{
    const layers=shared.layers.map(layer=>({...layer,...(overrides[card.id]?.layers?.[layer.id]||{}),...(layer.bind==='artwork'?{href:artworkByCard[card.id]||null}:{} )}));
    return [card.id,{...shared,id:card.id,name:card.name,rulesTemplate:card.textTemplate,layers}];
  }));
  return {schemaVersion:1,template:shared,cards:objects};
}
export function importStudioLayout(file,base=root){
  const previous=JSON.parse(readFileSync(resolve(base,'src/content/card-layout.json'),'utf8'));
  const document=JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const bindings={art:'artwork',title:'name',rules:'rules',tags:'tags','energy-value':'action','mana-value':'mana','stamina-value':'stamina'};
  const images=new Map();
  const layers=document.layers.map(source=>{
    const layer={...source};
    if(layer.src?.startsWith('data:image/png;base64,')){
      const bytes=Buffer.from(layer.src.split(',')[1],'base64');
      if(bytes.length>12*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Import needs PNG images smaller than 12 MB');
      const name=createHash('sha256').update(bytes).digest('hex').slice(0,20)+'.png';
      layer.href='assets/card-components/'+name;images.set(layer.href,bytes);
      layer.imageWidth=bytes.readUInt32BE(16);layer.imageHeight=bytes.readUInt32BE(20);
    }else if(layer.type==='image')throw Error('Export portable JSON from Card Studio so the PNGs are included.');
    delete layer.src;
    if(bindings[layer.id]){layer.bind=bindings[layer.id];delete layer.text;}
    if(layer.bind==='artwork')layer.fit??='contain';
    if(layer.type==='text'){layer.autoFit??=true;layer.minFontSize??=Math.round(layer.fontSize*.73);layer.maxFontSize??=layer.fontSize;layer.maxLines??=layer.bind==='rules'?2:1;layer.verticalAlign??='middle';}
    return layer;
  });
  const next={...previous,width:document.width,height:document.height,layers};
  const artwork=layers.find(l=>l.bind==='artwork');if(artwork)next.artworkByCard={...previous.artworkByCard,gorefireSlash:artwork.href};
  mkdirSync(resolve(base,'assets/card-components'),{recursive:true});
  for(const [href,bytes] of images)writeFileSync(resolve(base,href),bytes);
  compileCardComponents(next,contentBundle.cards,base);
  writeFileSync(resolve(base,'src/content/card-layout.json'),JSON.stringify(next,null,2)+'\n');
}
export function generateCardComponents(base=root){
  const template=JSON.parse(readFileSync(resolve(base,'src/content/card-layout.json'),'utf8'));
  const data=compileCardComponents(template,contentBundle.cards,base);
  const path=resolve(base,'src/content/cardComponents.generated.js');
  const source='// Generated from src/content/card-layout.json by tools/card-components.mjs.\nexport const CARD_COMPONENTS = '+JSON.stringify(data)+';\n';
  if(!existsSync(path)||readFileSync(path,'utf8')!==source)writeFileSync(path,source);
  return data;
}
export function writeCardObjects(data,out){
  const dir=resolve(out,'cards');mkdirSync(dir,{recursive:true});
  for(const [id,card] of Object.entries(data.cards)){
    if(!/^[\w-]+$/.test(id))throw Error('Unsafe card id');
    writeFileSync(resolve(dir,id+'.json'),JSON.stringify(card,null,2)+'\n');
  }
  writeFileSync(resolve(dir,'index.json'),JSON.stringify({schemaVersion:1,cards:Object.keys(data.cards)},null,2)+'\n');
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){const flag=process.argv.indexOf('--import');if(flag>=0)importStudioLayout(process.argv[flag+1]);const data=generateCardComponents();console.log('Compiled '+Object.keys(data.cards).length+' illustrated card objects');}
