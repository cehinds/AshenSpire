import {createRequire} from 'node:module';import {mkdir} from 'node:fs/promises';
const sharp=createRequire(import.meta.url)('sharp');
await mkdir('art/combined-reference/transitions/keys',{recursive:true});
for(const id of ['reaver','rogue','starseer','herald','reaver-shield','herald-staff']){
 const source=`art/combined-reference/masters/${id}.png`,m=await sharp(source).metadata(),w=Math.floor(m.width/4),h=Math.floor(m.height/2),keys=[0,id.startsWith('reaver')?2:1,3,4];
 const layers=await Promise.all(keys.map(async(k,i)=>({input:await sharp(source).extract({left:k%4*w,top:Math.floor(k/4)*h,width:w,height:h}).png().toBuffer(),left:i*w,top:0})));
 await sharp({create:{width:w*4,height:h,channels:4,background:'#303030'}}).composite(layers).png().toFile(`art/combined-reference/transitions/keys/${id}.png`);
}
