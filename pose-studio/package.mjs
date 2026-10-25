import {cp,mkdir,writeFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'build','pose-studio-app');
await mkdir(out,{recursive:true});
// The art left this repository at docs/EXTERNAL-ASSETS-PLAN.md step 13: the
// assets/ folders come from the fetched high pack (tools/art-source.mjs; node
// tools/fetch-art.mjs --pack high), and the art/ studio pages from a checkout
// of cehinds/AI-Art (branch ashenspire) named by ASHEN_ART_CHECKOUT (required for the portable editor's source projects).
const {artPath,copyDisplayArt}=await import('../tools/art-source.mjs');
const {authoringRoot,authoringPath,isAuthoringFile}=await import('../tools/art-authoring.mjs');
const args=process.argv.slice(2),i=args.indexOf('--asset-root');
const artCheckout=authoringRoot({root,assetRoot:i>=0?args[i+1]:undefined,required:true});
for(const name of ['pose-studio','src','engine','tools/art-authoring.mjs','assets/combat-effects','assets/pose-effects','assets/painted-outfits','assets/readiness-poses','art/pose-studio','art/combat-effects-2026-09-07','art/card-effect-refresh-2026-09-09','AshenSpire.html']){
  let from=path.join(root,name);
  if(name.startsWith('assets/'))from=artPath(name);
  else if(name.startsWith('art/'))from=authoringPath(name,{root,assetRoot:artCheckout});
  await cp(from,path.join(out,name),{recursive:true,filter:src=>!src.endsWith('.zip')&&!src.includes(`${path.sep}inspection${path.sep}`)});
}
// Merge moved authoring projects into the portable composite editor. Game JS
// remains present so gallery imports such as ../../src/* keep working.
for(const name of ['pose-studio/renewal','pose-studio/stances'])await cp(authoringPath(name,{root,assetRoot:artCheckout}),path.join(out,name),{recursive:true,filter:async src=>!src.endsWith('.zip')&&((await stat(src)).isDirectory()||isAuthoringFile(path.relative(artCheckout,src).split(path.sep).join('/')))});
copyDisplayArt(out,{root});
await writeFile(path.join(out,'README.txt'),'Pose & Effects Studio\nRequires Node.js 22 or newer.\nWindows: open pose-studio/Start Pose Studio.cmd\nOther systems: node pose-studio/server.mjs then open http://127.0.0.1:4318\nImport pose-studio/plugin.json in the broader editor Plugins view to integrate this workspace.\nProjects save as portable .pose.json files. The game override is local and optional.\n');
console.log(out);
