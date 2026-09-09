import {readdir,writeFile} from 'node:fs/promises';
import {SEQUENCES,PHASES} from '../combined-reference/transitions/sequences.mjs';
const poses=[];
for(const [key,s] of Object.entries(SEQUENCES))for(let i=0;i<7;i++)poses.push({id:`reference:${key}:pose-${String(i+1).padStart(2,'0')}`,label:`${s.title} · ${i+1} ${PHASES[i]}`,classId:key.split('-')[0],outfit:key,kind:'reference',src:`art/combined-reference/transitions/frames/${key}/${i}.png`,width:600,height:560,pivot:{x:330,y:490},scale:1});
for(const outfit of (await readdir('assets/painted-outfits')).sort())for(const file of (await readdir(`assets/painted-outfits/${outfit}`)).sort())if(file.endsWith('.webp')){const pose=file.slice(0,-5);poses.push({id:`painted:${outfit}:${pose}`,label:`${outfit} · ${pose}`,classId:outfit.split('-')[0],outfit,kind:['portrait','menu','detail'].includes(pose)?'menu':'painted',src:`assets/painted-outfits/${outfit}/${file}`})}
await writeFile('art/pose-editor/catalog.json',JSON.stringify({version:1,poses},null,2)+'\n');console.log(`${poses.length} poses indexed.`);
