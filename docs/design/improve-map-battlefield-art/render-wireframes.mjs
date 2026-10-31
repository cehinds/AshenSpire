// Proposal diagrams only. Run with Node and the repository's sharp dependency.
import {createRequire} from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('.',import.meta.url));
const C={paper:'#f3f1e9',ink:'#263a3c',muted:'#687877',line:'#b9c4bd',green:'#427b68',gold:'#b98437',sky:'#dce7e7',ground:'#ccd5bd'};
const text=(x,y,s,size=18,color=C.ink,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${s}</text>`;
const rect=(x,y,w,h,fill,stroke='none',extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const path=(d,stroke=C.ink,width=2,fill='none',extra='')=>`<path d="${d}" stroke="${stroke}" stroke-width="${width}" fill="${fill}" ${extra}/>`;
function base(n,title,sub,body){return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800"><defs><pattern id="checks" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#eef0eb"/><path d="M0 0h10v10H0z M10 10h10v10H10z" fill="#e0e5df"/></pattern></defs><rect width="1280" height="800" fill="${C.paper}"/><g font-family="DejaVu Sans, sans-serif">${text(36,34,'ASHENSPIRE  /  MAP + BATTLEFIELD ART',13,C.green)}${text(36,82,title,31)}${text(36,113,sub,16,C.muted)}${body}${path('M36 748H1244',C.line,1)}${text(36,777,`${n} / 03   •   DESIGN WIREFRAME — proposed behavior; illustrative geography`,13,C.muted)}${text(1240,777,'feature/ImproveMapBattleFieldArt',13,C.muted,'text-anchor="end"')}</g></svg>`;}
function icon(x,y,type,color=C.ink){let p='';if(type==='castle'||type==='ruins')p=path('M-21 17V-14h8v7h9v-7h8v7h9v-7h8v31z M-5 17V4h10v13',color,2,'#e5e3d7');else if(type==='village')p=path('M-25 3l12-13L0 3M-22 1v17h19V1 M0-4l12-13L26-4M3-5v23h20V-5',color,2,'#e5e3d7');else if(type==='bridge')p=path('M-30 5Q0-12 30 5M-30 17Q0 0 30 17 M-24 3v12 M-12-1v12 M0-3v12 M12-1v12 M24 3v12',color,3);else if(type==='forest')p=path('M-20 12l10-24L0 12z M-2 12L10-21l13 33z M-10 12v8M10 12v8',color,2,'#aebfa7');else if(type==='camp')p=path('M-23 18L0-16l24 34z M0-16L5 18M-8 18L0 3l5 15',color,2,'#e5e3d7');else if(type==='snow')p=path('M-25 17L-6-15 15 17M0 17L15-7 30 17M-12-5l6 5 6-5',color,2);else p=path('M-20 9q6-9 12 0m6 7q6-9 12 0m0-13q6-9 12 0',color,2);return `<g transform="translate(${x} ${y})">${p}</g>`;}
function scene(x,y,w,h,{weather='clear',kind='ruins',layer='all',actors=true}={}){let s=rect(0,0,400,220,'url(#checks)',C.line);let sky=weather==='night'?'#586477':weather==='misty'?'#d7dfd9':'#dce7e7';if(layer==='all'||layer==='sky'){s+=rect(0,0,400,220,sky);s+=path('M0 120L60 78l60 37 70-65 67 64 60-33 83 39V220H0z','#9cadaa',1,'#b1c0b9');s+=weather==='night'?'<circle cx="335" cy="39" r="13" fill="#edf0d7"/>':path('M28 42h80m-60 10h45M260 53h93', '#fbfcf7',5);}
if(layer==='all'||layer==='props'){s+=icon(80,126,kind);s+=icon(330,118,kind==='ruins'?'forest':kind);}
if(layer==='all'||layer==='ground'){s+=path('M0 144Q90 134 170 147T400 140V220H0z',C.green,1,kind==='snow'?'#e5e8df':C.ground);s+=path('M0 198Q200 151 400 198',C.muted,1);}
if(layer==='all' && actors){s+=`<ellipse cx="160" cy="177" rx="16" ry="5" fill="#7b8d80"/><ellipse cx="260" cy="162" rx="16" ry="5" fill="#7b8d80"/>`;s+=path('M160 174v-30m-12 12h24M260 159v-30m-12 12h24',C.ink,3);s+='<circle cx="160" cy="137" r="7" fill="#f4f0df" stroke="#263a3c"/><circle cx="260" cy="122" r="7" fill="#f4f0df" stroke="#263a3c"/>';}
if(layer==='all' && weather==='misty')s+=path('M0 104h400M0 118h400','#f4f5ed',12,'none','opacity=".5"');
if(weather==='night' && layer==='all')s+=rect(0,0,400,220,'#233753','none','opacity=".24"');
return `<g transform="translate(${x} ${y}) scale(${w/400} ${h/220})">${s}</g>`;}
let a=rect(36,143,818,576,'#e6e9dd',C.line)+rect(878,143,366,576,'#faf9f3',C.line);
// Default player view: no grid edges, coordinate axes, or tile labels.
a+=path('M330 220Q470 165 570 230T830 220V650Q640 690 500 620T330 650Z','none',0,'#d3dfc8');
a+=path('M520 230Q700 185 830 260V640Q670 680 550 610T520 230Z','none',0,'#b8cdb5');
a+=rect(60,165,110,32,'#faf9f3',C.line)+text(73,186,'Grid   OFF',13,C.muted);
a+=rect(180,165,126,32,'#faf9f3',C.line)+text(193,186,'Labels   OFF',13,C.muted);
a+=path('M115 360C175 325 215 378 255 360S335 330 395 360S485 390 535 360S650 320 735 360',C.gold,8,'none','stroke-linecap="round"');
a+=path('M395 360C450 390 485 390 535 360S650 320 735 360','#8d8b58',6,'none','stroke-linecap="round"');
a+=path('M255 360C285 411 250 477 300 535',C.gold,4,'none','stroke-linecap="round"');
a+=path('M395 360C420 415 480 445 465 535','#8d8b58',4,'none','stroke-linecap="round"');
for(const [x,y] of [[360,270],[430,255],[580,270],[660,255],[740,270],[560,470],[650,500],[750,560],[570,600]])a+=icon(x,y,'forest');
a+='<ellipse cx="465" cy="530" rx="56" ry="44" fill="#e5e8d5" stroke="#427b68" stroke-width="2"/>';
a+=icon(115,350,'village')+icon(255,350,'grass')+icon(395,345,'forest')+icon(535,345,'forest')+icon(735,350,'castle')+icon(300,525,'ruins')+icon(465,525,'camp');
a+=text(60,671,'Roads branch into ruins and sheltered clearings.',15,C.muted);
a+=text(60,695,'Tile labels stay hidden until Labels is turned on.',14,C.muted);
a+=text(900,179,'LANTERN CLEARING',18,C.green)+text(900,208,'Selected rest location',14,C.muted);
a+=scene(900,228,322,177,{kind:'camp',weather:'misty',actors:false});
a+=text(900,438,'Terrain',14,C.muted)+text(1010,438,'jungle / clearing',15);
a+=text(900,469,'Rest spot',14,C.muted)+text(1010,469,'sheltered camp',15);
a+=text(900,500,'Trainer',14,C.muted)+text(1010,500,'herbalist, if present',15);
a+=text(900,540,'Rest art follows this tile’s tags.',15,C.green)+text(900,565,'Ground + camp props + sky / mist.',14,C.muted);
a+=rect(900,593,322,48,C.green)+text(1061,623,'Preview rest scene →',16,'#ffffff','text-anchor="middle"');
a+=text(900,679,'Grid and labels are separate toggles.',14,C.muted);
let b=rect(36,143,740,576,'#faf9f3',C.line)+rect(800,143,444,576,'#faf9f3',C.line);
b+=text(60,181,'OVERSIZED REGISTERED PNG CANVASES',17,C.green);
b+=scene(62,211,688,378,{kind:'ruins'});
b+=rect(195,283,422,235,'none',C.green,'stroke-width="3" stroke-dasharray="9 6"');
b+=text(210,310,'VISIBLE BATTLEFIELD',14,C.green);
b+=path('M150 470H660',C.gold,2,'none','stroke-dasharray="5 5"')+text(225,495,'Shared floor anchor / actor foot line',14);
b+=text(62,624,'Example: 2048 × 1152 layers → 1280 × 720 view',17);
b+=text(62,654,'384 px horizontal + 216 px vertical bleed per side.',15,C.muted);
b+=text(62,681,'Camera offsets clamp before the art edges enter the view.',15,C.muted);
b+=text(824,181,'ART STACK · FRONT → BACK',17,C.green);
for(const [i,layer,label] of [[0,'ground','01  Ground — transparent above floor'],[1,'props','02  Rear props — transparent cutouts'],[2,'sky','03  Sky / distance']]){let y=213+i*151;b+=scene(824,y,185,102,{layer,kind:'ruins'});b+=text(1026,y+25,label.split(' — ')[0],15);b+=text(1026,y+52,i===0?'Alpha above floor':i===1?'Aligned to floor':'Opaque backdrop',13,C.muted);b+=text(1026,y+76,i===0?'Drawn last*':i===1?'Drawn second':'Drawn first',13,C.muted);}
b+=text(824,692,'*Actors + HUD stay above these art planes.',14,C.muted);
let c='';
const variants=[['A / CLEAR RUINS','clear','ruins'],['B / MISTY RUINS','misty','ruins'],['C / NIGHT RUINS','night','ruins']];
variants.forEach(([title,weather,kind],i)=>{let x=36+i*410;c+=rect(x,148,388,398,'#faf9f3',C.line)+text(x+18,182,title,19,C.green)+scene(x+18,201,352,194,{weather,kind});c+=text(x+18,426,'Ground: stone courtyard / 01',15)+text(x+18,454,'Props: broken arch + trees / 02',15)+text(x+18,482,`Sky: ${weather} / compatible lighting`,15)+text(x+18,520,i===0?'Same geometry + landmark identity':'Reuse ground + props; adjust atmosphere',13,C.muted);});
c+=rect(36,571,1208,148,'#e5e9df',C.line)+text(58,604,'STARTER LIBRARY → EXPAND BY COMPATIBLE FAMILIES',18,C.green);
c+=text(58,636,'GROUND    meadow · stone · cobble · mud · snow · basalt',16);
c+=text(58,665,'PROPS        camp · ruins · dungeon · castle · village / town / city · road / bridge',16);
c+=text(58,694,'SKY / FX     clear · cloudy · night · smoky · misty      DISTANCE     forest · clearing · volcanic',16);
for(const [name,svg] of [['01-hex-map',base('01','Connected places, hidden grid','512 px tile art • optional grid and labels • branching roads • layered rest scenes',a)],['02-layer-composition',base('02','A movable stage, built from reusable layers','Shared registration • generous overscan • clear actor lanes • controlled camera movement',b)],['03-art-combinations',base('03','Reuse the place; change the atmosphere','A small coherent library produces many scenes without losing the location’s identity',c)]]){writeFileSync(out+name+'.svg',svg);await sharp(Buffer.from(svg)).png().toFile(out+name+'.png');}
