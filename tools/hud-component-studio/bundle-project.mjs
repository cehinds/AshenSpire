#!/usr/bin/env node
// Single-file distribution of the existing studio, with its original editable scene model.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const toolDir=path.dirname(fileURLToPath(import.meta.url));
const {projectPath,assetSource}=createRequire(import.meta.url)('./project.js');
const MIME={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf'};
async function embedFile(file,root){const real=await fs.realpath(file),allowed=await fs.realpath(root);if(!real.startsWith(allowed+path.sep))throw Error('Embedded file escapes its asset directory');const mime=MIME[path.extname(real).toLowerCase()];if(!mime)throw Error('Unsupported embedded file: '+file);return `data:${mime};base64,${(await fs.readFile(real)).toString('base64')}`;}
export async function bundleProject({scenePath,outPath,id}){
 const input=await fs.realpath(path.isAbsolute(scenePath)?scenePath:path.join(toolDir,projectPath(scenePath)));
 const source=await fs.readFile(input,'utf8'),scene=JSON.parse(source),sceneDir=path.dirname(input);
 if(scene.version!==1||!scene.assets||!Array.isArray(scene.nodes)||!Array.isArray(scene.states))throw Error('Expected a v1 component studio scene');
 const projectRoot=path.join(toolDir,'projects'),relative=path.relative(projectRoot,input);let canonical;if(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))canonical=relative.split(path.sep).join('/');else{const normalized=input.split(path.sep).join('/'),marker='/projects/';const index=normalized.lastIndexOf(marker);canonical=index>=0?normalized.slice(index+marker.length):normalized;}const identity=id||`${path.basename(sceneDir).slice(0,40)}-${createHash('sha256').update(canonical).digest('hex').slice(0,16)}`;if(!/^[a-zA-Z0-9_-]{1,100}$/.test(identity))throw Error('Project id must contain letters, numbers, underscores or hyphens');
 for(const asset of Object.values(scene.assets)){assetSource(asset.src,'projects/bundle/scene.json');if(/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(asset.src))continue;if(!/^assets\//.test(asset.src)||!/^\.(png|jpg|jpeg|webp|gif)$/i.test(path.extname(asset.src)))throw Error('Project assets must be raster images');asset.src=await embedFile(path.join(sceneDir,asset.src),path.join(sceneDir,'assets'));}
 // References are review aids. Excluding them keeps the handoff small and hides its Reference control.
 if(scene.metadata)delete scene.metadata.references;
 let css=await fs.readFile(path.join(toolDir,'studio.css'),'utf8');
 const urls=[...css.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)];for(const match of urls){if(match[2].startsWith('data:'))continue;if(/^[a-z]+:|^\/|\.\./i.test(match[2]))throw Error('Stylesheet dependency must be local');const embedded=await embedFile(path.join(toolDir,match[2]),toolDir);css=css.replace(match[0],()=>`url("${embedded}")`);}
 let html=await fs.readFile(path.join(toolDir,'index.html'),'utf8');
 html=html.replace('<link rel="stylesheet" href="studio.css">',()=>`<style>${css.replace(/<\/style/gi,'<\\/style')}</style>`);
 const payload=JSON.stringify({id:identity,scene}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 html=html.replace('<script src="css-export.js"></script>',()=>`<script type="application/json" id="studio-project-data">${payload}</script>\n<script src="css-export.js"></script>`);
 for(const name of ['css-export.js','project.js','studio.js']){const code=await fs.readFile(path.join(toolDir,name),'utf8');html=html.replace(new RegExp(`<script src="${name.replace('.','\\.')}"(?: defer)?><\\/script>`),()=>`<script>${code.replace(/<\/script/gi,'<\\/script')}</script>`);}
 await fs.mkdir(path.dirname(path.resolve(outPath)),{recursive:true});await fs.writeFile(outPath,html);return {outPath:path.resolve(outPath),bytes:Buffer.byteLength(html),id:identity,nodes:scene.nodes.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){if(!['--scene','--out','--id'].includes(args[i])||!args[i+1])throw Error('Usage: node bundle-project.mjs --scene projects/<name>/scene.json --out <file.html> [--id <name>]');options[args[i].slice(2)+'Path']=args[i+1];}if(!options.scenePath||!options.outPath)throw Error('--scene and --out are required');console.log(JSON.stringify(await bundleProject({...options,id:options.idPath})));}catch(e){console.error(e.message);process.exitCode=1;}}
