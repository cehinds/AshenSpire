import {cp,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'build','pose-studio-app');
await mkdir(out,{recursive:true});
for(const name of ['pose-studio','src','assets/combat-effects','assets/pose-effects','assets/painted-outfits','art/pose-studio','art/combat-effects-2026-09-07','AshenSpire.html'])await cp(path.join(root,name),path.join(out,name),{recursive:true,filter:src=>!src.endsWith('.zip')&&!src.includes(`${path.sep}inspection${path.sep}`)});
await writeFile(path.join(out,'README.txt'),'Pose & Effects Studio\nRequires Node.js 22 or newer.\nWindows: open pose-studio/Start Pose Studio.cmd\nOther systems: node pose-studio/server.mjs then open http://127.0.0.1:4318\nImport pose-studio/plugin.json in the broader editor Plugins view to integrate this workspace.\nProjects save as portable .pose.json files. The game override is local and optional.\n');
console.log(out);
