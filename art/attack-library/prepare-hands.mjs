import {createRequire} from 'node:module';import {mkdir} from 'node:fs/promises';
const sharp=createRequire(import.meta.url)('sharp');await mkdir('art/attack-library/hands',{recursive:true});
for(const [name,region]of Object.entries({closed:{left:58,top:174,width:133,height:112},open:{left:58,top:143,width:143,height:169}})){
 const source=name==='closed'?'nearClosed':'nearOpen';
 const {data,info}=await sharp(`art/equipment-rig/parts/reaver/${source}.png`).extract(region).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=0;i<info.width*info.height;i++){const k=i*4;if(Math.min(data[k],data[k+1],data[k+2])>185&&Math.max(data[k],data[k+1],data[k+2])-Math.min(data[k],data[k+1],data[k+2])<25)data[k+3]=0;}
 await sharp(data,{raw:info}).trim().png().toFile(`art/attack-library/hands/reaver-${name}.png`);
}
