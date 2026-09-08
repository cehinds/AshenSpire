import {createRequire} from 'node:module';import {WEAPONS} from './catalog.mjs';
const sharp=createRequire(import.meta.url)('sharp');const tiles=[];
for(const [i,item]of WEAPONS.entries()){
 const label=Buffer.from(`<svg width="240" height="32"><text x="8" y="22" fill="#e5cb85" font-family="Arial" font-size="15">${item.id}</text></svg>`);
 tiles.push({input:await sharp(item.image).resize(240,240).png().toBuffer(),left:i%5*240,top:Math.floor(i/5)*272});
 tiles.push({input:label,left:i%5*240,top:Math.floor(i/5)*272+240});
}await sharp({create:{width:1200,height:1360,channels:4,background:'#201a15'}}).composite(tiles).png().toFile('art/attack-library/item-contact.png');
