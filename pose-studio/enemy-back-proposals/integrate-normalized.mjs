// Run after merging a normalizer output into the feature: node pose-studio/enemy-back-proposals/integrate-normalized.mjs <actorId>
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {integrateNormalized} from './normalized.mjs';
const actorId=process.argv[2];if(!/^[a-zA-Z0-9_-]+$/.test(actorId||''))throw Error('Provide an audited actor ID');
const dir='art/enemy-back-proposals/'+actorId,manifestPath='pose-studio/enemy-back-proposals/manifest.json';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const [manifest,report,provenance]=await Promise.all([json(manifestPath),json(dir+'/normalized.json'),json(dir+'/provenance.json')]);
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
provenance.master??='proposal-sheet.png';
let footReview=null;try{footReview=await json(dir+'/foot-anchors.json');}catch(error){if(error.code!=='ENOENT')throw error;}
if(!/^[a-zA-Z0-9_.-]+$/.test(provenance.master||''))throw Error('Invalid source master path');
if(await hash(dir+'/'+provenance.master)!==report.source.sha256)throw Error('Source hash mismatch');
for(const v of report.variants||[]){if(!/^v(?:0[1-9]|10)$/.test(v.id)||await hash(dir+'/'+v.id+'.png')!==v.sha256)throw Error('Output hash mismatch: '+v.id);}
const next=integrateNormalized(manifest,actorId,report,provenance,footReview);
await writeFile(manifestPath,JSON.stringify(next,null,2)+'\n');
console.log(actorId+': ten verified neutral draft designs; nine-slot animation coverage remains pending.');
