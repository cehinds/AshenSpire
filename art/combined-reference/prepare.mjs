import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const sharp=createRequire(import.meta.url)('sharp');
const poses=['guard','attack1','attack2','attack3','attack4','hit','idle'];
await mkdir('art/combined-reference/source-frames',{recursive:true});
for(const cls of ['reaver','rogue','starseer','herald']){
 const layers=[];
 for(const [i,pose]of poses.entries()){
  const left=i%4*400,top=Math.floor(i/4)*460;
  layers.push({input:await sharp(`assets/painted-outfits/${cls}/${pose}.webp`).trim().resize(380,408,{fit:'contain',background:'#303033'}).png().toBuffer(),left:left+10,top:top+12});
  layers.push({input:Buffer.from(`<svg width="400" height="40"><text x="200" y="27" text-anchor="middle" font-family="Arial" font-size="20" fill="#ffffff">${i+1}. ${pose}</text></svg>`),left,top:top+420});
 }
 await sharp({create:{width:1600,height:920,channels:4,background:'#303033'}}).composite(layers).png().toFile(`art/combined-reference/source-frames/${cls}.png`);
}
