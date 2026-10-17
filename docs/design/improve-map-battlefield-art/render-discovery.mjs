import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {propDefinitions} from './props-examples/prop-definitions.mjs';
const sharp=createRequire(import.meta.url)('sharp');
const out=fileURLToPath(new URL('.',import.meta.url));
const ink='#29433f',green='#3f8068',muted='#677b71',gold='#ad7f36',paper='#f4f2e8';
const txt=(x,y,s,n=16,c=ink,attrs='')=>`<text x="${x}" y="${y}" font-size="${n}" fill="${c}" ${attrs}>${s}</text>`;
const box=(x,y,w,h,c,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${c}" stroke="${stroke}"/>`;
const line=(d,c=ink,w=2,fill='none',attrs='')=>`<path d="${d}" stroke="${c}" stroke-width="${w}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round" ${attrs}/>`;
const icons={
bridge:line('M-38 5Q0-25 38 5M-38 19Q0-11 38 19M-30 0v14M-15-7V7M0-10V4M15-7V7M30 0v14',ink,3)+line('M-40 31q10-7 20 0t20 0t20 0t20 0','#79a9af'),
path:line('M-35 34Q5 10-4-10T4-38M-4 0Q16-18 37-10',gold,7),
tunnel:line('M-40 30L-26-15-5-37 22-23 40 30Z',ink,2,'#b6c0b0')+line('M-19 30V2Q0-26 19 2V30',ink,3,'#526963'),
cave:line('M-38 30L-31-7-7-32 24-17 39 30Z',ink,2,'#b6c0b0')+line('M-22 30L-14 3 5-12 21 7 25 30Z',ink,2,'#526963'),
ferry:line('M-40 18H2M-30 15v22M-9 15v22M12 14h28l-7 12H18Z',ink,3,'#d4b878')+line('M20 14V-12l17 16H20M-42-2h81',green,2),
ford:line('M-40-20q10-7 20 0t20 0t20 0t20 0M-40 25q10-7 20 0t20 0t20 0t20 0','#79a9af',3)+[-28,-9,10,29].map((x,i)=>`<ellipse cx="${x}" cy="${i%2?5:-2}" rx="7" ry="5" fill="#a3afa2" stroke="${ink}"/>`).join(''),
portal:line('M-24 30V-7Q0-42 24-7V30',ink,8)+line('M-12 23V-4Q0-19 12-4V23',green,3)+line('M-36 31h72',gold,3),
boat:line('M-36 16H36L22 32H-23Z',ink,2,'#d4b878')+line('M0 16V-36L28 8H0M-5-26L-27 8H-5',ink,2,'#e9e5cd'),
city:line('M-36 30V-6h16v-18h15V3H9v-34h16v21h12v40Z',ink,2,'#d8d7be')+line('M-23 30V12h12v18M13 30V9h12v21'),
town:line('M-38 0l18-18L-2 0M-34-2v32h28V-2M-1-9l17-20L38-9M3-9v39h30V-9M-24 30V13h9v17',ink,2,'#dedcc5'),
village:line('M-34 8l16-18L0 8M-30 8v23h25V8M1 0l15-18L34 0M5 0v31h25V0',ink,2,'#dedcc5'),
ruins:line('M-35 30V-24h10v10h12v-8h11V0H10v-12h11v7h14v35M-20 30V5M0 30V14M20 30V8',ink,3,'#c9cfbb'),
dungeon:line('M-32 30V-12L0-35 32-12V30Z',ink,2,'#c9cfbb')+line('M-17 30V1Q0-17 17 1V30M-10-2v32M0-7v37M10-2v32',ink,3),
treasure:line('M-32 0Q-32-21-12-21H14Q32-21 32 0V28H-32ZM-32 1H32M-17-20V28M17-20V28',ink,2,'#d6b775')+box(-5,-3,10,13,gold,ink),
enemy:line('M-37 31L-13-13 11 31ZM-12-13V-36h31l-7 8 7 8h-31M5 31L24 0 43 31',ink,2,'#d5b6a2')+line('M-35-26L-22-13M-22-26L-35-13','#9d5544',3),
rest:line('M-40 28L-13-19 15 28ZM-13-19L-8 28M13 31l25-10M15 20l24 13',ink,2,'#dedcc5')+line('M22 18q-9-8 1-19 13 11 4 19Z',gold,2,'#d4a858'),
inn:line('M-34 0L0-29 34 0M-28 0v31h56V0M-8 31V10H8v21M29-12h14v25H29',ink,2,'#dedcc5')+line('M-18 8v7M18 8v7',gold,4),
trainer:line('M-30 28L25-27M-4 10L12 24M19-21l6-6 7 5-6 7M-20-28l48 58M-31-14L-14-31',ink,4)+line('M-37 34h74',green,2),
merchant:line('M-36-7L-26-27H26L36-7ZM-29-7v37M29-7v37M-29 13h58M-18-25v17M0-25v17M18-25v17',ink,2,'#d6b775')+box(-14,13,28,16,'#d8d7be',ink),
shrine:line('M-35 31H35M-25 31V19H25v12M-15 19V-7H15v26M0-7V-30M-11-20h22',ink,3)+line('M-31 6l-3-8M31 6l3-8',gold,3),
watchtower:line('M-24 31V-18h-5v-14h12v9h11v-9H6v9h11v-9h12v14h-5v49Z',ink,2,'#d8d7be')+line('M-7 31V12H7v19M-5-7h10',ink,3),
cartographer:line('M-37-25L-12-17 12-27 37-17V31L12 21-12 31-37 21ZM-12-17v48M12-27v48',ink,2,'#e5d9b8')+line('M-29 9Q-5-15 21 7M17 0l10 13M26 0L17 13',gold,3),
mine:line('M-35 30L-30-22H30L35 30M-30-12h60M-18 30V-11M18 30V-11',ink,4)+line('M-33 32L-8 2M33 32L8 2M-21 18h42',gold,2),
fishing:line('M-32 27L6-29Q30-35 28-5V15q0 14-10 5M-36 35q12-7 24 0t24 0t24 0',ink,3)+line('M-25 25h20M-19 25v-12',gold,3)
};
const items=[['bridge','Bridge','Water crossing'],['path','Road / junction','Connects routes'],['tunnel','Tunnel mouth','Paired exits'],['cave','Cave entrance','Hidden approach'],['ferry','Ferry dock','Shore access'],['ford','River ford','Shallow crossing'],['portal','Portal','Paired destinations'],['boat','Boat / landing','Coast or river'],['city','City','Major destination'],['town','Town','Services + quests'],['village','Village','Small settlement'],['ruins','Ruins','Lore + danger'],['dungeon','Dungeon gate','Major challenge'],['treasure','Treasure cache','Reward location'],['enemy','Enemy camp','Visible threat'],['rest','Rest camp','Recovery stop'],['inn','Inn','Shelter + recovery'],['trainer','Trainer','Learn a skill'],['merchant','Merchant','Traveling supplies'],['shrine','Shrine','Blessing or choice'],['watchtower','Watchtower','Survey nearby land'],['cartographer','Cartographer','Map-item rewards'],['mine','Mine entrance','Resource encounter'],['fishing','Fishing spot','Quiet discovery']];
function svg(body,h=1000){return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${h}" viewBox="0 0 1280 ${h}"><rect width="1280" height="${h}" fill="${paper}"/><g font-family="DejaVu Sans,sans-serif">${body}</g></svg>`;}
let a=txt(36,34,'ASHENSPIRE / MAP PROP IDEAS',13,green)+txt(36,80,'24 pieces for a world worth exploring',31)+txt(36,112,'Separate transparent PNG props • these are silhouette concepts, not finished game art',16,muted);
items.forEach(([id,title,sub],i)=>{let x=36+(i%6)*204,y=142+Math.floor(i/6)*192;a+=box(x,y,190,178,'#faf9f2','#c5cebf')+`<g transform="translate(${x+95} ${y+61})">${icons[id]}</g>`+txt(x+95,y+122,title,16,ink,'text-anchor="middle"')+txt(x+95,y+151,sub,12,muted,'text-anchor="middle"');});
a+=txt(36,947,'A prop marks a place. Its tags select matching combat, rest, and encounter art.',18,green)+txt(36,979,'Keep most tiles visually quiet. Reserve large silhouettes for major landmarks.',15,muted);
function hex(x,y,r=28){return Array.from({length:6},(_,i)=>{let t=(60*i-30)*Math.PI/180;return `${x+r*Math.cos(t)},${y+r*Math.sin(t)}`}).join(' ');}
function mini(x,y,mode){let z='';let selected=mode==='area'?['1,1','2,1','1,2','2,2','3,2']:mode==='route'?['0,2','1,2','2,2','3,2','4,1','5,1']:['4,1'];for(let r=0;r<4;r++)for(let c=0;c<6;c++){let xx=33+c*48.5+(r%2)*24.25,yy=38+r*42;z+=`<polygon points="${hex(xx,yy)}" fill="${mode==='area' && selected.includes(c+','+r)?'#b4d2b2':'#dce1d8'}"/>`;}
if(mode==='route')z+=line('M33 122Q85 110 130 122T179 122L251 80H300',gold,5,'none');
if(mode==='area')z+=`<g transform="translate(130 122) scale(.4)">${icons.ruins}</g><g transform="translate(106 80) scale(.4)">${icons.watchtower}</g>`;
if(mode==='treasure')z+=`<g transform="translate(251 80) scale(.55)">${icons.treasure}</g>`;
return `<g transform="translate(${x} ${y})">${z}</g>`;}
let b=txt(36,34,'ASHENSPIRE / DISCOVERY + MAP REWARDS',13,green)+txt(36,80,'Three maps. Three different kinds of knowledge.',29)+txt(36,112,'Revealing a place never visits it, clears an encounter, or collects its reward.',16,muted);
[['REGION FRAGMENT','area','Reveal a connected pocket','5–8 tiles of terrain and known landmarks.','Concealed local secrets stay hidden.'],['ROUTE CHART','route','Reveal one useful route','Trace a road to a city, rest spot, or gate.','Leave unrelated branches unexplored.'],['TREASURE SKETCH','treasure','Pin one existing treasure','Reveal the target marker or search area.','Travel there to discover and claim it.']].forEach(([title,mode,sub,l1,l2],i)=>{let x=36+i*410;b+=box(x,146,388,380,'#faf9f2','#c5cebf')+txt(x+20,180,title,18,green)+mini(x+22,198,mode)+txt(x+20,432,sub,20)+txt(x+20,469,l1,13,muted)+txt(x+20,496,l2,13,muted);});
b+=txt(36,574,'Discovery is a saved sequence',23)+box(36,596,1208,70,'#e0e8d9');
b+=txt(60,626,'Unknown → Map reveals terrain / route → Enter section → Local prop appears → Claim / clear',18,green)+txt(60,651,'A secret may need tile entry or a quest. Map items only reveal what their rules explicitly allow.',14,muted);
b+=txt(36,713,'Map layers · bottom to top',23);
const layers=[['01','Terrain'],['02','Water + roads'],['03','PNG props'],['04','Discovery / fog'],['05','Selection + UI']];
layers.forEach(([n,name],i)=>{let x=36+i*244;b+=box(x,736,232,60,i===2?'#b4d2b2':'#e0e8d9')+txt(x+14,774,n+'  '+name,17);});
b+=txt(36,830,'Grid and tile labels remain OFF until separately enabled. Diagram colors explain reveal states.',14,muted);
if (!process.argv.includes('--props-only')) {
  for(const [name,data] of [['04-map-prop-ideas',svg(a)],['05-map-reveal-ideas',svg(b,860)]]){writeFileSync(out+name+'.svg',data);await sharp(Buffer.from(data)).png().toFile(out+name+'.png');}
}

// Export the same original vector diagrams individually. No paper, labels,
// checkerboards, ground guides or other opaque background enters these assets.
const propsOut = out + 'props-examples/';
mkdirSync(propsOut, {recursive: true});
const manifest = {
  formatVersion: 1,
  status: 'wireframe-placeholder',
  description: 'Original technical diagram examples for design handoff. Unregistered; not painted production game assets.',
  source: '../render-discovery.mjs',
  metadataSource: 'prop-definitions.mjs',
  canvas: {width: 512, height: 512, background: 'transparent'},
  coordinates: {
    units: 'normalized-canvas',
    origin: 'top-left',
    xDirection: 'right',
    yDirection: 'down',
    anchorMeaning: 'Schematic ground/water contact used for placement and depth sorting; not an enforced collision boundary.',
    footprintMeaning: 'Illustrative ground-plane placement rectangle; not alpha bounds, a click target, tile occupancy or a validated collision shape.',
  },
  assets: [],
};
for (const definition of propDefinitions) {
  const {id, sourceIconId} = definition;
  const item = items.find(([iconId]) => iconId === sourceIconId);
  if (!icons[sourceIconId] || !item) throw new Error(`Missing source icon: ${sourceIconId}`);
  const name = item[1];
  const data = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-labelledby="title description"><title id="title">${name} wireframe placeholder</title><desc id="description">Original editable technical diagram. Transparent background; not production game art.</desc><g id="prop-${id}" transform="translate(256 286.4) scale(4.8)">${icons[sourceIconId]}</g></svg>\n`;
  writeFileSync(propsOut + id + '.svg', data);
  await sharp(Buffer.from(data)).png().toFile(propsOut + id + '.png');
  manifest.assets.push({
    ...definition,
    name,
    status: 'wireframe-placeholder',
    placeholder: true,
    pngAssetId: null,
    png: id + '.png',
    svg: id + '.svg',
    anchor: {x: 0.5, y: 0.85},
  });
}
writeFileSync(propsOut + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
