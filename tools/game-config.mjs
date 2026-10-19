#!/usr/bin/env node
// Compile source JSON to importable JS for the repository's import-only bundler.
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, existsSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileBaseCards, BASE_CARD_OUTPUT } from './base-cards.mjs';
import { resolveGameAuthor, canonicalGameJSON, gameDigest, dataClone } from '../engine/kernel/gameConfig.js';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED = 'src/content/generated/gameProfiles.js';
const LOCK = 'games/ashenspire/game.lock.json';
const inside = (path,root=ROOT) => { const full = realpathSync(resolve(root,path)); if (!full.startsWith(root+sep)) throw new Error(`Source reference escapes repository: ${path}`); return full; };
const json = path => { try { return JSON.parse(readFileSync(inside(path),'utf8')); } catch(error) { throw new Error(`${path}: ${error.message}`); } };
function artifact(path,id,version,root=ROOT) { const text=readFileSync(inside(path,root),'utf8'); return {path,id,version,hash:gameDigest(path.endsWith('.json') ? canonicalGameJSON(JSON.parse(text)) : text)}; }
function referenced(base,path) { if (typeof path !== 'string') throw new Error(`${base}: expected file reference`); return relative(ROOT,resolve(ROOT,dirname(base),path)).split(sep).join('/'); }
// These source modules execute the authored mechanic definitions in the live
// browser. The generated data mirrors are derived from the canonical JSON.
const MECHANIC_RUNTIME_SOURCES = Object.freeze([
  'content/source/fixCoreMechanics.json',
  'src/model/mechanicsKernel.js',
  'src/model/formulas.js',
  'src/model/fixCoreMechanics.js',
]);
export const MECHANIC_RUNTIME_PATH = 'engine/mechanics/index.json + registered mechanic manifest/model/interface/service JSON + content/source/fixCoreMechanics.json + src/model/{mechanicsKernel,formulas,fixCoreMechanics}.js';

// Cases and guides are authoring/test evidence, not executable rules. Hash the
// registered definitions explicitly so a JSON-only tuning or attachment-policy
// change cannot reinterpret a saved run under the same compatibility pin.
export function collectMechanicsRuntimeArtifacts(root = ROOT) {
  root=realpathSync(resolve(root));
  const paths=['engine/mechanics/index.json',...MECHANIC_RUNTIME_SOURCES];
  const index=JSON.parse(readFileSync(inside(paths[0],root),'utf8'));
  const seen=new Set();
  for(const entry of [...index.mechanics].sort((a,b)=>a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    if(seen.has(entry.id))throw new Error(`engine/mechanics/index.json: duplicate mechanic ${entry.id}`);
    seen.add(entry.id);
    const manifestPath=`engine/mechanics/${entry.id}/mechanic.json`;
    const manifest=JSON.parse(readFileSync(inside(manifestPath,root),'utf8'));
    if(manifest.id!==entry.id)throw new Error(`${manifestPath}: registry identity mismatch`);
    paths.push(manifestPath);
    for(const kind of ['model','interface','service']) {
      const file=manifest.files?.[kind];
      if(typeof file!=='string'||!file)throw new Error(`${manifestPath}: missing ${kind} reference`);
      paths.push(relative(root,resolve(root,dirname(manifestPath),file)).split(sep).join('/'));
    }
  }
  return [...new Set(paths)].sort().map(path=>artifact(path,'ashen.mechanics-runtime','1.0.0',root));
}

export function loadGameProfileCatalog() {
  compileBaseCards(); // validate authored effect/opcode/reference contracts before locking source packs
  const contracts = json('engine/contracts/game-profile.json'), foundation = json('engine/foundation/foundation.json');
  const catalog = {contracts,foundation,modules:{},bundles:{},packs:{},runtimeArtifacts:[]};
  for(const path of ['engine/kernel/kernel.json','engine/kernel/gameConfig.js','engine/contracts/game-profile.json','engine/foundation/foundation.json']) catalog.runtimeArtifacts.push(artifact(path,'ashen.runtime','1.0.0'));
  for(const id of readdirSync(resolve(ROOT,'engine/modules')).sort()) {
    const path=`engine/modules/${id}/module.json`; if(!existsSync(resolve(ROOT,path))) continue;
    const manifest=json(path); if(manifest.id!==id || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error(`${path}: invalid module identity/version`);
    const defaultsPath=referenced(path,manifest.defaults), schemaPath=referenced(path,manifest.settingsSchema);
    catalog.modules[id]={manifest,defaults:json(defaultsPath),schema:json(schemaPath),artifacts:[path,defaultsPath,schemaPath].map(file=>artifact(file,id,manifest.version))};
  }
  // The save-compatibility hash covers what a saved profile is interpreted by: the engine kernel, the
  // runtime ops/formulas/interpreter and the game-profile contract. Docs (*.md), the UI/map/asset/build
  // contracts and unrelated app/UI code do not interpret saved mechanics and are not hashed.
  // The shared browser evaluator and canonical mechanics are pinned separately below.
  const kernelRuntime=[];
  const visitRuntime = dir => {
    for (const entry of readdirSync(resolve(ROOT,dir),{withFileTypes:true}).sort((a,b)=>a.name < b.name ? -1 : 1)) {
      const path=dir+'/'+entry.name;
      if(entry.isDirectory())visitRuntime(path);
      else if(!path.endsWith('.md'))kernelRuntime.push(artifact(path,'ashen.kernel-runtime','1.0.0'));
    }
  };
  for(const dir of ['engine/kernel','engine/runtime'])visitRuntime(dir);
  kernelRuntime.push(artifact('engine/contracts/game-profile.json','ashen.kernel-runtime','1.0.0'));
  catalog.runtimeArtifacts.push({id:'ashen.kernel-runtime',version:'1.0.0',path:'engine/{kernel,runtime}/** (no *.md) + engine/contracts/game-profile.json',hash:gameDigest(kernelRuntime)});
  catalog.runtimeArtifacts.push({id:'ashen.mechanics-runtime',version:'1.0.0',path:MECHANIC_RUNTIME_PATH,hash:gameDigest(collectMechanicsRuntimeArtifacts())});
  catalog.runtimeHash=gameDigest(catalog.runtimeArtifacts);
  for(const name of ['core-v1','core','current']) {
    const path=`games/ashenspire/bundles/${name}/bundle.json`,manifest=json(path);
    if (catalog.bundles[`${manifest.id}@${manifest.version}`]) throw new Error(`${path}: duplicate bundle pin`);
    catalog.bundles[`${manifest.id}@${manifest.version}`]={manifest,artifacts:[artifact(path,manifest.id,manifest.version)]};
    for(const ref of manifest.packs) {
      const packPath=referenced(path,ref.path), pack=json(packPath),key=`${ref.id}@${ref.version}`;
      if(pack.id!==ref.id || pack.version!==ref.version) throw new Error(`${packPath}: exact pack identity/version mismatch`);
      const content={},artifacts=[artifact(packPath,pack.id,pack.version)];
      for(const [kind,file] of Object.entries(pack.content)) { const source=referenced(packPath,file);content[kind]=json(source);artifacts.push(artifact(source,pack.id,pack.version)); }
      catalog.packs[key]={manifest:pack,content,artifacts};
    }
  }
  return catalog;
}
// Compact generated JS data keeps the standalone pack small; authored sources stay readable.
export function compileGameProfiles() {
  const catalog=loadGameProfileCatalog();
  const authors={default:json('games/ashenspire/game.json'),core:json('games/ashenspire/presets/core.json'),current:json('games/ashenspire/presets/current.json')};
  const profiles=Object.fromEntries(Object.entries(authors).map(([id,author])=>[id,resolveGameAuthor(author,catalog)]));
  const generated=`// Generated by tools/game-config.mjs build; edit source JSON, never this file.\nexport const gameProfileCatalog = ${JSON.stringify(catalog)};\nexport const gameProfileAuthors = ${JSON.stringify(authors)};\n// Full SHA-256 of each resolved author profile; game-config check recomputes and compares them, so runtime need not.\nexport const gameProfileHashes = ${JSON.stringify(Object.fromEntries(Object.entries(profiles).map(([id,p])=>[id,p.hash])))};\n`;
  const lock=JSON.stringify({formatVersion:1,profiles:Object.fromEntries(Object.entries(profiles).map(([id,p])=>[id,{hash:p.hash,...p.lock}]))},null,2)+'\n';
  return {catalog,authors,profiles,outputs:{[GENERATED]:generated,[LOCK]:lock}};
}
function atomicWrite(path, text) {
  const full=resolve(ROOT,path);mkdirSync(dirname(full),{recursive:true});const temporary=`${full}.${process.pid}.tmp`;
  try {writeFileSync(temporary,text,{flag:'wx'});renameSync(temporary,full);} finally {if(existsSync(temporary))unlinkSync(temporary);}
}
function main(args) {
  const command=args.shift()||'validate',options={};
  while(args.length) { const arg=args.shift();if(arg==='--portable')options.portable=true;else if(['--input','--out'].includes(arg)){if(!args.length||args[0].startsWith('--'))throw new Error(`${arg} requires a path`);options[arg.slice(2)]=args.shift();}else throw new Error(`Unknown argument ${arg}`); }
  if(!['validate','build','check','export','apply'].includes(command))throw new Error('Usage: game-config.mjs validate|build|check|export|apply [--input PATH] [--out PATH] [--portable]');
  if (command === 'build') atomicWrite(BASE_CARD_OUTPUT, compileBaseCards());
  const inputText=options.input?readFileSync(resolve(options.input),'utf8'):null;
  const author=inputText !== null ? JSON.parse(inputText) : json('games/ashenspire/game.json');
  const catalog=loadGameProfileCatalog();
  const profile=resolveGameAuthor(author,catalog);
  if(options.portable&&!profile.portability.portable)throw new Error(`Unsupported required capability: ${profile.portability.requiredCapabilities.join(', ')}`);
  if(command==='build'||command==='check') {
    const compiled=compileGameProfiles();
    for(const [path,value]of Object.entries(compiled.outputs)) {
      if(command==='build')atomicWrite(path,value);
      else if(!existsSync(resolve(ROOT,path))||readFileSync(resolve(ROOT,path),'utf8')!==value)throw new Error(`Stale generated game configuration: ${path}; run node tools/game-config.mjs build`);
    }
  }
  if(command==='apply') {if(!options.input)throw new Error('apply requires --input');atomicWrite(options.out||'games/ashenspire/game.json',JSON.stringify(JSON.parse(inputText),null,2)+'\n');}
  if(command==='export')atomicWrite(options.out||'build/game-config/ashenspire/resolved.json',JSON.stringify(profile,null,2)+'\n');
  return {valid:true,command,id:profile.id,hash:profile.hash,modules:Object.keys(profile.modules).filter(id=>profile.modules[id]),portability:profile.portability};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.stdout.write(JSON.stringify(main(process.argv.slice(2)),null,2)+'\n');}catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=1;}}
