import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const sharp=createRequire(import.meta.url)('sharp');
export const outfits={reaver:['reaver','reaver-vigil','reaver-oathsworn','reaver-warden'],rogue:['rogue','rogue-nightveil','rogue-duelist','rogue-shadow'],starseer:['starseer','starseer-eclipse','starseer-starlit','starseer-astral'],herald:['herald','herald-ossuary','herald-emberhabit','herald-pilgrim']};
await mkdir('art/attack-library/seeds',{recursive:true});
for(const [cls,ids]of Object.entries(outfits)){
 const tiles=await Promise.all(ids.map(async(id,i)=>({input:await sharp(`assets/painted-outfits/${id}/menu.webp`).trim().resize(320,480,{fit:'contain',background:'#edf0f2'}).png().toBuffer(),left:i*320,top:0})));
 await sharp({create:{width:1280,height:480,channels:4,background:'#edf0f2'}}).composite(tiles).png().toFile(`art/attack-library/seeds/${cls}.png`);
}
