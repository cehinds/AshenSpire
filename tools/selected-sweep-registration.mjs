// Register the selected SW09 production exports; generation remains on the art side.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const provenancePath='pose-studio/stances/update-stances/selected-sweep-sw09/production.json';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function registerSelectedSweep(catalog,{root:directory=root}={}) {
  if(!existsSync(resolve(directory,provenancePath)))return catalog;
  const production=JSON.parse(readFileSync(resolve(directory,provenancePath)));
  const profile=catalog.weaponProfiles['reaver-greatsword-pilot'];
  const expected=['sweep','sweep-windup','sweep-contact','sweep-finish'];
  if(JSON.stringify(production.frames.map(frame=>frame.key))!==JSON.stringify(expected))throw new Error('SW09 production must contain the held stance and exactly three ordered action frames');
  for(const frame of production.frames) {
    for(const tier of [frame.full,frame.mobile])if(hash(readFileSync(resolve(directory,tier.path)))!==tier.sha256)throw new Error('SW09 production asset changed: '+tier.path);
    const registered={path:frame.full.path,lite:frame.mobile.path,size:frame.logicalDrawSize,
      rasterSize:frame.full.dimensions,mobileRasterSize:frame.mobile.dimensions,
      bounds:frame.sourceAlphaBounds,drawOffset:frame.drawOffset,stageBounds:frame.stageAlphaBounds,stageAnchor:[384,464],
      sha256:frame.full.sha256,liteSha256:frame.mobile.sha256,sourceOption:'SW09',
      source:{path:frame.sourcePath,width:frame.sourceDimensions[0],height:frame.sourceDimensions[1],sha256:frame.sourceSha256},
      provenance:provenancePath};
    profile.frames[frame.key]=registered;
    for(const tier of [frame.full,frame.mobile]) {
      const name=tier.path.replace('assets-display/alternative/','');catalog.hashes[name]=tier.sha256;catalog.filePaths[name]=tier.path;
    }
  }
  profile.selectedSweep={option:'SW09',provenance:provenancePath,slots:['origin',...expected.slice(1),'origin']};
  return catalog;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const path=resolve(root,'src/content/alternativeSelectedStances.js'),before=readFileSync(path,'utf8');
  const match=before.match(/^export const alternativeSelectedStances = (.+);\r?$/m);
  if(!match)throw new Error('Missing selected stances catalog');
  const catalog=JSON.parse(match[1]);registerSelectedSweep(catalog);
  const after='// Owner-selected held poses and weapon-specific pose profiles, exported from unchanged comparison artwork.\nexport const alternativeSelectedStances = '+JSON.stringify(catalog)+';\n';
  if(process.argv.includes('--check')) {
    if(before!==after)throw new Error('Selected SW09 registration drifted; run node tools/selected-smash-registration.mjs');
    console.log('SW09 registration matches production exports.');
  } else {writeFileSync(path,after);console.log('Registered selected SW09 stance and action frames; Attack, Counter and Smash preserved.');}
}
