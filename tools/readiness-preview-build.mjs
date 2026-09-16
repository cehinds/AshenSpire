// An offline review page using the same renderer as the game, with embedded art.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAINTED_OUTFITS } from '../src/content/paintedOutfits.js';
import { READINESS_POSE_ART } from '../src/content/readinessPoseArt.js';
import { DEFEATED_ART } from '../src/content/defeatedArt.js';
const out=resolve(process.argv[2] || 'build/readiness-preview');mkdirSync(out,{recursive:true});
const paths=new Set();
for(const [id,art] of Object.entries(PAINTED_OUTFITS)){
  for(const f of Object.values(art.frames))paths.add(f.file);
  for(const f of Object.values(art.menu))paths.add(f);
  if(DEFEATED_ART[id])paths.add(DEFEATED_ART[id].file);
}
for(const art of Object.values(READINESS_POSE_ART))for(const f of Object.values(art))paths.add(f.file);
const assetMap=Object.fromEntries([...paths].map(p=>[p,`data:image/${p.endsWith('.webp')?'webp':'png'};base64,${readFileSync(p).toString('base64')}`]));
const modules=['src/content/defeatedArt.js','src/content/paintedOutfits.js','src/content/readinessPoseArt.js','src/content/combatPoseStates.js','src/model/paintedOutfitArt.js','src/model/combatPose.js','src/model/combatAnimation.js','src/ui/combatAura.js','src/ui/motion.js','src/ui/paintedOutfits.js','art/readiness-poses/preview.mjs'];
const code=`const embeddedAssets=${JSON.stringify(assetMap)};const assetUrl=p=>embeddedAssets[p]||p;\n`+modules.map(p=>readFileSync(p,'utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
let html=readFileSync('art/readiness-poses/preview.html','utf8').replace('<base href="../../">','');
html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,p)=>`<style>${readFileSync(p,'utf8')}</style>`);
html=html.replace(/<script type="module" src="[^"]+"><\/script>/,()=>`<script type="module">${code.replace(/<\/script/gi,'<\\/script')}</script>`);
writeFileSync(resolve(out,'Combat-pose-preview.html'),html);
copyFileSync('AshenSpire.html',resolve(out,'AshenSpire.html'));
console.log(`Offline gallery and standalone game written to ${out}`);
