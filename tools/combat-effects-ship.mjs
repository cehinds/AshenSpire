import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {applyCardEffectRefresh,writeCombatEffectManifest} from './card-effect-art-build.mjs';
const require=createRequire(import.meta.url);let sharp;
try{sharp=require('sharp')}catch{sharp=require('../build/animation-tools/node_modules/sharp')}
const jobs=[
 ['projectiles',['starbolt','emberbolt','shadowbolt','sacredbolt']],
 ['effects',['ward','gorefire','heal','impact']],
 ['melee',['slash','thrust','heavyImpact','bloodSlash']],
 ['styles',['venom','blight','ash','ritual']],
 ['martial',['shieldBash','parry','crossSlash','whirlwind']],
 ['mystic',['lifeDrain','cleanse','arcaneBurst','bind']],
 ['subtle',['steelGlint','dustStep','focusMotes','guardPulse']],
 ['defenses',['physicalGuard','arcaneWard','magicGuard','barrier']],
 ['stances',['bulwarkStance','duelistStance','channelStance','berserkStance']],
 ['auras',['bloodAura','frostAura','poisonAura','sacredAura']],
 ['afflictions',['bloodLoss','frostbite','poisoned','staggerBreak']],
 ['debuffs',['insanity','crimsonBlight','weak','vulnerable']],
 ['reactions',['frail','dodge','riposte','resist']],
 ['protection',['barrierHit','barrierBreak','strength','dexterity']],
];
const manifest={},audit={};mkdirSync('assets/combat-effects',{recursive:true});
// Find the quietest gutter near each expected grid boundary. Generated sheets
// have unequal gutters; snapping crops to those gutters preserves the trails.
function gutters(data,width,height,axis,count,radius){
 const dim=axis==='x'?width:height,other=axis==='x'?height:width,cuts=[0];
 for(let i=1;i<count;i++){
  let best=Math.round(dim*i/count),score=Infinity;
  for(let c=Math.round(dim*(i/count-radius));c<=Math.round(dim*(i/count+radius));c++){
   let sum=0;for(let n=0;n<other;n++)sum+=data[((axis==='x'?n:c)*width+(axis==='x'?c:n))*4+3];
   if(sum<score||(sum===score&&Math.abs(c-dim*i/count)<Math.abs(best-dim*i/count))){score=sum;best=c;}
  }
  cuts.push(best);
 }
 return [...cuts,dim];
}
for(const [sheet,kinds]of jobs){
 const input=`art/combat-effects-2026-09-07/${sheet}-six.png`,meta=await sharp(input).metadata();
 if(!meta.hasAlpha)throw Error(`${sheet}: expected generated alpha`);
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const cuts=gutters(data,info.width,info.height,'x',6,.055),rows=gutters(data,info.width,info.height,'y',4,.04);
 const maxWidth=Math.max(...cuts.slice(1).map((v,i)=>v-cuts[i])),maxHeight=Math.max(...rows.slice(1).map((v,i)=>v-rows[i])),scale=240/Math.max(maxWidth,maxHeight);
 audit[sheet]={cuts,rows,scale,frames:24};
 for(let row=0;row<4;row++){
  manifest[kinds[row]]=[];
  for(let col=0;col<6;col++){
   const width=cuts[col+1]-cuts[col],height=rows[row+1]-rows[row],w=Math.round(width*scale),h=Math.round(height*scale);
   const cell=await sharp(input).extract({left:cuts[col],top:rows[row],width,height}).resize(w,h).png().toBuffer();
   const file=`assets/combat-effects/${kinds[row]}${col+1}.webp`;
   await sharp({create:{width:256,height:256,channels:4,background:'#00000000'}}).composite([{input:cell,left:Math.floor((256-w)/2),top:Math.floor((256-h)/2)}]).webp({quality:90,alphaQuality:100}).toFile(file);
   manifest[kinds[row]].push(file);
  }
 }
 console.log(`${sheet}: 24 transparent frames`);
}
writeCombatEffectManifest(await applyCardEffectRefresh(manifest));
writeFileSync('art/combat-effects-2026-09-07/inspection/six-frame-export.json',JSON.stringify(audit,null,2)+'\n');
