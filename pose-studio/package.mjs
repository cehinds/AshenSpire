import {cp,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'build','pose-studio-app');
await mkdir(out,{recursive:true});
// The art left this repository at docs/EXTERNAL-ASSETS-PLAN.md step 13: the
// assets/ folders come from the fetched high pack (tools/art-source.mjs; node
// tools/fetch-art.mjs --pack high), and the art/ studio pages from a checkout
// of cehinds/AshenSpire-art named by ASHEN_ART_CHECKOUT (skipped, and said so,
// without one).
const {artPath}=await import('../tools/art-source.mjs');
const artCheckout=process.env.ASHEN_ART_CHECKOUT?path.resolve(process.env.ASHEN_ART_CHECKOUT):null;
for(const name of ['pose-studio','src','assets/combat-effects','assets/pose-effects','assets/painted-outfits','assets/readiness-poses','art/pose-studio','art/combat-effects-2026-09-07','art/card-effect-refresh-2026-09-09','AshenSpire.html']){
  let from=path.join(root,name);
  if(name.startsWith('assets/'))from=artPath(name);
  else if(name.startsWith('art/')){if(!artCheckout){console.warn(`pose-studio/package: ${name} skipped — set ASHEN_ART_CHECKOUT to a cehinds/AshenSpire-art checkout to include it`);continue;}from=path.join(artCheckout,name);}
  await cp(from,path.join(out,name),{recursive:true,filter:src=>!src.endsWith('.zip')&&!src.includes(`${path.sep}inspection${path.sep}`)});
}
await writeFile(path.join(out,'README.txt'),'Pose & Effects Studio\nRequires Node.js 22 or newer.\nWindows: open pose-studio/Start Pose Studio.cmd\nOther systems: node pose-studio/server.mjs then open http://127.0.0.1:4318\nImport pose-studio/plugin.json in the broader editor Plugins view to integrate this workspace.\nProjects save as portable .pose.json files. The game override is local and optional.\n');
console.log(out);
