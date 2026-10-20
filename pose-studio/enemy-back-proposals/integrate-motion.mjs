import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {integrateMotion} from './motion.mjs';
const actorId=process.argv[2];if(!/^[a-zA-Z0-9_-]+$/.test(actorId||''))throw Error('Provide an audited actor ID');
const path='pose-studio/enemy-back-proposals/manifest.json',prefix='art/enemy-back-motion/'+actorId+'/v01/';
const reportBytes=await readFile(prefix+'normalized/normalized.json'),report=JSON.parse(reportBytes);
const review=JSON.parse(await readFile(prefix+'motion-review.json','utf8'));
const blobHash=createHash('sha1').update(Buffer.from('blob '+reportBytes.length+'\0')).update(reportBytes).digest('hex');
if(blobHash!==review.report?.gitBlobSha)throw Error('Motion review report blob mismatch');
const seed=report.seedReference;
if(seed?.path!=='art/enemy-back-proposals/'+actorId+'/v01.png'||createHash('sha256').update(await readFile(seed.path)).digest('hex')!==seed.sha256)throw Error('Motion seed bytes mismatch');
for(const file of [...Object.values(report.masters||{}),...(report.frames||[])]){
 if(!file.path.startsWith(prefix)||file.path.split('/').includes('..'))throw Error('Unsafe report path');
 const actual=createHash('sha256').update(await readFile(file.path)).digest('hex');
 if(actual!==file.sha256)throw Error('Motion source/output hash mismatch: '+file.path);
}
const provenance=JSON.parse(await readFile(prefix+'provenance.json','utf8'));
const manifest=JSON.parse(await readFile(path,'utf8')),next=integrateMotion(manifest,actorId,report,provenance,review);
await writeFile(path,JSON.stringify(next,null,2)+'\n');
console.log(actorId+': nine actual held poses, two four-frame clips and two static reactions; other clips unbuilt.');
