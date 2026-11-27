// PLAN-ONLY audit. Reads game catalogs and immutable pinned rasters; writes only
// sibling evidence files. Run from any directory; requires Node and Python/Pillow.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, '../../../..');
const baseline = '49eca254d795d06266aa23941cb2b31fe77b27bf';
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const cache = resolve(arg('--cache') || 'C:/repos/AshenSpire/.art-cache/ashenspire-hd-assets-v30');
const python = arg('--python') || 'python';
const get = path => import(pathToFileURL(join(root, path)).href);
const { alternativeCardAnimationFamily } = await get('src/model/cardAnimationFamily.js');
const { combatWeaponProfilesFor, DEFAULT_COMBAT_WEAPONS } = await get('src/model/combatWeaponPresentation.js');
const { COMBAT_BODY_LANDMARKS: landmarks } = await get('src/content/combatBodyLandmarks.js');
const { bodyPlacement, bodyResize } = await get('src/ui/models/CombatBodyModel.js');
const { selectedWeaponSequence } = await get('src/model/selectedWeaponSequences.js');
const { playerHurtFrames } = await get('src/content/playerHurtFrames.js');
const { DEFEATED_ART } = await get('src/content/defeatedArt.js');
const { alternativeCardAnimations } = await get('src/content/alternativeCardAnimations.js');
const pin = JSON.parse(readFileSync(join(root, 'art-release.json'), 'utf8'));
if (pin.tag !== 'ashenspire-hd-assets-v30') throw Error('This snapshot is pinned to v30; choose a new evidence baseline before rerunning.');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const round = n => n == null ? null : Number(n.toFixed(9));
const coordinates = p => Object.fromEntries(['left','top','width','height'].map(k => [k, round(p[k])]));
const sourceFiles = [
  'art-release.json','src/ui/assets.js','src/ui/alternativeCardStage.js',
  'src/ui/models/CombatBodyModel.js','src/ui/models/CombatViewportSizeModel.js',
  'src/ui/components/combatSpriteGeometry.js','src/model/cardAnimationFamily.js',
  'src/model/combatAnimation.js','src/model/alternativeCardAnimation.js',
  'src/model/combatWeaponPresentation.js','src/model/selectedWeaponStances.js',
  'src/model/selectedWeaponSequences.js','src/model/classSmashAnimations.js',
  'src/content/alternativeCardAnimations.js','src/content/alternativeSelectedStances.js',
  'src/content/playerCounterSweepSprites.js','src/content/playerAttackSprites.js',
  'src/content/classSmashAnimations.js','src/content/playerHurtFrames.js',
  'src/content/combatBodyLandmarks.js','src/content/defeatedArt.js',
  'src/content/generated/defeatedArt.js','tools/player-hurt-registration.py',
];
const sourceHashes = sourceFiles.map(path => {
  const local = readFileSync(join(root, path));
  const blob = execFileSync('git', ['-c', `safe.directory=${root}`, 'show', `${baseline}:${path}`], { cwd: root });
  const lf = b => b.toString('utf8').replaceAll('\r\n','\n');
  if (lf(local) !== lf(blob)) throw Error(`Runtime/source drift since selected baseline: ${path}`);
  return {path,sha256:sha(local),baselineBlobSha256:sha(blob),lfNormalizedSha256:sha(lf(local)),baselineMatchIgnoringCrlf:true};
});
const rows = [], mappings = {}, references = {};
const sourcePaths = new Set();
for (const classId of ['reaver','rogue','starseer','herald']) {
  const profiles = combatWeaponProfilesFor({classId});
  const a = alternativeCardAnimationFamily(classId, profiles);
  const { frames, family, heldFrames, pilotFrames } = a;
  const ready = frames.ready, readyBody = landmarks[ready.path];
  const stageHeightReference = 464 - ready.bounds[1];
  const cssScale = 190 / stageHeightReference;
  const reference = (readyBody.feetY-readyBody.headY) * (ready.size?.[1] || 512) / readyBody.height;
  const topPadding = Math.max(0, -Math.min(...Object.values(frames).map(f => (f.stageBounds || f.bounds)[1])));
  const margin = pilotFrames?.['sweep-contact'] ? 16 : 0;
  const leftPadding = Math.max(0, margin - Math.min(...Object.values(frames).map(f => (f.stageBounds || f.bounds)[0])));
  const rightPadding = Math.max(0, Math.max(...Object.values(frames).map(f => (f.stageBounds || f.bounds)[2])) - (768-margin));
  references[classId] = {profiles,ready:ready.path,readyRasterBody:readyBody,referenceBodyStage:reference,
    cssPixelsPerStageUnit:cssScale,cssReadyBodyPx:reference*cssScale,
    requestedCanvas:[768+leftPadding+rightPadding,544+topPadding],
    canvas:[Math.trunc(768+leftPadding+rightPadding),Math.trunc(544+topPadding)],
    padding:{left:leftPadding,top:topPadding,right:rightPadding},normalFloor:480+topPadding};
  const uses = new Map();
  const use = (key, role) => { if (!uses.has(key)) uses.set(key, []); uses.get(key).push(role); };
  for (const [action, sequence] of Object.entries(family.sequences)) {
    for (const key of sequence.poses) if (key !== 'origin') use(key, `sequence:${action}`);
  }
  use('ready','rest:idle'); use('guard-brace','rest:defend/guard/evade-fallback');
  for (const stance of Object.keys(heldFrames)) use(`stance-${stance}`, `held:${stance}`);
  const seq = Object.fromEntries(Object.entries(family.sequences).map(([action,s]) => [action,{
    poses:s.poses.map(key => ({key,path:key === 'origin' ? null : frames[key]?.path || null,
      resolution:key === 'origin' ? 'current held/rest pose at sampling time' : frames[key] ? 'assembled catalog frame' : 'missing frame; painter falls back to ready'})),
    durations:s.durations,impact:s.impact,travel:s.travel,hold:s.hold ?? false,pilot:!!s.pilot,
  }]));
  const targetReactions = {};
  if (pilotFrames) for (const kind of ['evade','guard-break','fully-defended','defend']) {
    const s = selectedWeaponSequence(kind);
    if (!s.poses.every(key=>frames[key])) continue;
    targetReactions[kind] = s.poses.map(key=>({key,path:frames[key].path}));
    for(const key of s.poses) use(key,`target-reaction:${kind}`);
  }
  mappings[classId] = {profiles,sequences:seq,held:Object.fromEntries(Object.entries(heldFrames).map(([k,f])=>[k,f.path])),
    targetReactions,
    baseReady:ready.path,baseSweepOverridden:alternativeCardAnimations.classes[classId].sequences.sweep.poses,
    originPolicy:'current restPose(); idle->ready, current stance->stance-<stance>, counter->pilot-counter or selected counter stance, defend/guard/evade->guard-brace',
    hurt:playerHurtFrames[classId],defeated:DEFEATED_ART[classId]?.file || null};
  for (const [key, f] of Object.entries(frames)) {
    const dims = f.drawOffset ? f.size : [512,512], offset = f.drawOffset || [128,0];
    const authored = {left:leftPadding+offset[0],top:16+topPadding+offset[1],width:dims[0],height:dims[1],anchorX:leftPadding+384};
    const b = landmarks[f.path];
    const before = b ? (b.feetY-b.headY)*dims[1]/b.height : null;
    const held = b ? bodyPlacement(authored,b,reference,480+topPadding) : authored;
    const action = b ? bodyResize(authored,b,reference) : authored;
    const roles = uses.get(key) || [];
    rows.push({classId,key,path:f.path,lite:f.lite || null,roles:roles.join(';'),
      selection:roles.length?'available through active assembled family':'assembled but no selected sequence/held/rest role identified',
      rasterDeclared:f.rasterSize || null,mobileRasterDeclared:f.mobileRasterSize || null,
      drawSize:dims,drawOffset:offset,catalogBounds:f.bounds,stageBounds:f.stageBounds || null,
      bodyRaster:b || null,referenceBodyStage:reference,authoredSpanStage:before,
      normalizationFactor:before ? reference/before : 1,heldPlacement:coordinates(held),actionPlacement:coordinates(action),
      normalizedSpanStage:b?reference:null,cssPixelsPerStageUnit:cssScale,
      cssDrawSizeHeld:[round(held.width*cssScale),round(held.height*cssScale)],
      cssDrawSizeAction:[round(action.width*cssScale),round(action.height*cssScale)],
      declaredSha256:f.sha256 || null,declaredLiteSha256:f.liteSha256 || null,
      source:f.source || null,sourceCrop:f.sourceCrop || null,provenance:f.provenance || null});
    sourcePaths.add(f.path); if (f.lite) sourcePaths.add(f.lite);
  }
  const h = playerHurtFrames[classId];
  rows.push({classId,key:'$hurt',path:h.file,roles:'target:hit',selection:'separate hurt raster; ordinary motion only',
    drawSize:[512*h.scale,512*h.scale],drawOffset:[128+h.dx,16+h.dy],normalizationFactor:1,
    heldPlacement:null,actionPlacement:{left:leftPadding+128+h.dx,top:16+topPadding+h.dy,width:512*h.scale,height:512*h.scale},
    source:'src/content/playerHurtFrames.js',hurtScale:h.scale,hurtDx:h.dx,hurtDy:h.dy,
    referenceBodyStage:reference,cssPixelsPerStageUnit:cssScale});
  sourcePaths.add(h.file);
  if (DEFEATED_ART[classId]?.file) {
    const path=DEFEATED_ART[classId].file;
    sourcePaths.add(path);
    rows.push({classId,key:'$defeated',path,roles:'rest:defeated',selection:'separate defeated raster; fixed 512 square draw',
      drawSize:[512,512],drawOffset:[128,16],normalizationFactor:1,
      actionPlacement:{left:leftPadding+128,top:16+topPadding,width:512,height:512},
      source:'src/content/generated/defeatedArt.js',referenceBodyStage:reference,cssPixelsPerStageUnit:cssScale});
  }
}
// Read actual rasters using Pillow. Alpha >=128 is a silhouette measurement,
// NOT semantic anatomy; it may include weapons/effects. Never writes an image.
const pythonCode = String.raw`import sys,json,hashlib,os
from PIL import Image
cache=sys.argv[1]
result={}
for p in json.load(sys.stdin):
    if p.startswith('assets-display/'):
        candidates=[('common',p)]
    elif p.startswith('assets/'):
        candidates=[('high',p),('light',p.replace('assets/','assets-mobile/',1))]
    else:
        candidates=[('common',p)]
    entries=[]
    for pack,relative in candidates:
        file=os.path.join(cache,pack,relative)
        if not os.path.isfile(file):
            entries.append(dict(pack=pack,path=relative,exists=False));continue
        with open(file,'rb') as stream: data=stream.read()
        with Image.open(file) as im:
            alpha=im.convert('RGBA').getchannel('A').point(lambda a:255 if a>=128 else 0)
            entries.append(dict(pack=pack,path=relative,exists=True,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),raster=list(im.size),alphaBox128=alpha.getbbox()))
    result[p]=entries
print(json.dumps(result,separators=(',',':')))`;
const rasters = JSON.parse(execFileSync(python, ['-c',pythonCode,cache], {input:JSON.stringify([...sourcePaths].sort()),encoding:'utf8',maxBuffer:8*1024*1024}));
const csvColumns = ['classId','key','path','lite','roles','selection','rasterDeclared','mobileRasterDeclared','actualRasters',
  'drawSize','drawOffset','catalogBounds','stageBounds','bodyRaster','referenceBodyStage','authoredSpanStage','normalizationFactor',
  'heldPlacement','actionPlacement','normalizedSpanStage','cssPixelsPerStageUnit','cssDrawSizeHeld','cssDrawSizeAction',
  'declaredSha256','declaredLiteSha256','source','sourceCrop','provenance','hurtScale','hurtDx','hurtDy'];
for (const r of rows) r.actualRasters = {path:rasters[r.path],lite:r.lite?rasters[r.lite]:null};
const cell = x => '"' + (x == null?'':typeof x==='object'?JSON.stringify(x):String(x)).replaceAll('"','""') + '"';
writeFileSync(join(out,'inventory.csv'),[csvColumns.join(','),...rows.map(r=>csvColumns.map(k=>cell(r[k])).join(','))].join('\n')+'\n');
const uniqueFrames = [...new Map(rows.filter(r=>!r.key.startsWith('$')).map(r=>[r.classId+'|'+r.path,r])).values()];
const available = uniqueFrames.filter(r=>rows.some(a=>a.classId===r.classId&&a.path===r.path&&a.roles));
const missing = Object.values(rasters).flat().filter(r=>!r.exists);
const hashMismatches = rows.flatMap(r=>[
  r.declaredSha256&&rasters[r.path]?.[0]?.exists&&r.declaredSha256!==rasters[r.path][0].sha256?{classId:r.classId,key:r.key,path:r.path}:null,
  r.declaredLiteSha256&&rasters[r.lite]?.[0]?.exists&&r.declaredLiteSha256!==rasters[r.lite][0].sha256?{classId:r.classId,key:r.key,path:r.lite}:null,
]).filter(Boolean);
const summaries = Object.fromEntries(Object.keys(references).map(classId=>{
  const r=uniqueFrames.filter(r=>r.classId===classId), a=available.filter(r=>r.classId===classId);
  return [classId,{catalogPoseRows:rows.filter(r=>r.classId===classId&&!r.key.startsWith('$')).length,
    uniqueFramePaths:r.length,uniqueAvailablePaths:a.length,landmarkedUniqueFrames:r.filter(r=>r.bodyRaster).length,
    landmarkedAvailableFrames:a.filter(r=>r.bodyRaster).length,
    missingLandmarkPaths:a.filter(r=>!r.bodyRaster).map(r=>r.path)}];
}));
const json = (name,value) => {const bytes=JSON.stringify(value,null,2)+'\n';if(Buffer.byteLength(bytes)>256*1024)throw Error(name+' exceeds evidence limit');writeFileSync(join(out,name),bytes);};
json('summary.json',{baseline,artRelease:pin.repo+'/'+pin.tag,cache,defaultCombatWeapons:DEFAULT_COMBAT_WEAPONS,
  measurementScope:'Static baseline reconstruction at zero action travel/recoil; no browser/viewport assertion and no anatomical inference from vertical spans.',
  references,counts:{rows:rows.length,uniqueFramePaths:uniqueFrames.length,uniqueAvailableFramePaths:available.length,
    assetIdentifiers:sourcePaths.size,rasterFiles:Object.values(rasters).flat().filter(r=>r.exists).length,
    missingRasterFiles:missing.length,catalogHashMismatches:hashMismatches.length},classes:summaries,
  missingRasters:missing,hashMismatches});
json('action-mappings.json',{baseline,classes:mappings});
json('source-hashes.json',{baseline,files:sourceHashes});
// Dedupe physical rasters for compact provenance evidence; CSV retains per-role details.
json('raster-hashes.json',{baseline,release:pin.tag,assets:rasters});
console.log(JSON.stringify({counts:{rows:rows.length,uniqueFramePaths:uniqueFrames.length,available:available.length,
  rasters:Object.values(rasters).flat().filter(r=>r.exists).length,missing:missing.length,hashMismatches:hashMismatches.length},
  classes:summaries,outputs:['inventory.csv','summary.json','action-mappings.json','source-hashes.json','raster-hashes.json']},null,2));
for(const name of ['summary.json','action-mappings.json','source-hashes.json','raster-hashes.json'])
  console.log(`${name}: ${statSync(join(out,name)).size} bytes`);
