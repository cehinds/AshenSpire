import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {integrateMotion} from './motion.mjs';
const actorId=process.argv[2];if(!/^[a-zA-Z0-9_-]+$/.test(actorId||''))throw Error('Provide an audited actor ID');
const path='pose-studio/enemy-back-proposals/manifest.json',prefix='art/enemy-back-motion/'+actorId+'/v01/';
const report=JSON.parse(await readFile(prefix+'normalized/normalized.json','utf8'));
for(const file of [...Object.values(report.masters||{}),...(report.frames||[])]){
 if(!file.path.startsWith(prefix)||file.path.split('/').includes('..'))throw Error('Unsafe report path');
 const actual=createHash('sha256').update(await readFile(file.path)).digest('hex');
 if(actual!==file.sha256)throw Error('Motion source/output hash mismatch: '+file.path);
}
const provenance=JSON.parse(await readFile(prefix+'provenance.json','utf8'));
const manifest=JSON.parse(await readFile(path,'utf8')),next=integrateMotion(manifest,actorId,report,provenance);
await writeFile(path,JSON.stringify(next,null,2)+'\n');
console.log(actorId+': nine actual held poses, two four-frame clips and two static reactions; other clips unbuilt.');
