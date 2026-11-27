// Read-only evidence input collection. Run from any cwd; no game/art outputs.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const BASELINE = '49eca254d795d06266aa23941cb2b31fe77b27bf';
const ART = 'ashenspire-hd-assets-v30';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const index = JSON.parse(readFileSync(new URL('../measurements/source-hashes.json', import.meta.url), 'utf8'));
const normalizedHash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
if (index.baseline !== BASELINE || index.files.length !== 23) throw new Error('Unexpected retained source-hash baseline/index.');
// Check the immutable Git blobs as well as the retained receipt. No imported
// source is evaluated and no evidence is overwritten until all checks pass.
for (const file of index.files) {
  const baselineText = execFileSync('git', ['-c', `safe.directory=${root.replace(/\\/g, '/')}`, '-C', root, 'show', `${BASELINE}:${file.path}`], {encoding:'utf8', maxBuffer:8*1024*1024});
  const expected = normalizedHash(baselineText);
  if (expected !== file.lfNormalizedSha256 || expected !== normalizedHash(readFileSync(join(root, file.path),'utf8'))) {
    throw new Error(`Baseline source mismatch: ${file.path}; refusing to overwrite visual evidence.`);
  }
}
const [{combatWeaponProfilesFor}, {alternativeCardAnimationFamily}, {playerHurtFrames}, {COMBAT_BODY_LANDMARKS}] = await Promise.all([
  import('../../../../src/model/combatWeaponPresentation.js'),
  import('../../../../src/model/cardAnimationFamily.js'),
  import('../../../../src/content/playerHurtFrames.js'),
  import('../../../../src/content/combatBodyLandmarks.js'),
]);
const classes = {};
for (const classId of ['reaver','rogue','starseer','herald']) {
  const profiles = combatWeaponProfilesFor({classId});
  const a = alternativeCardAnimationFamily(classId, profiles);
  const poses = {ready:a.frames.ready, ...a.heldFrames};
  for (const name of a.family.sequences.sweep.poses) if (a.frames[name]) poses[name]=a.frames[name];
  classes[classId]={profiles, poses, hurt:playerHurtFrames[classId], sweep:a.family.sequences.sweep};
}
const paths = new Set(Object.values(classes).flatMap(x=>Object.values(x.poses).map(x=>x.path)));
const landmarks=Object.fromEntries([...paths].filter(x=>COMBAT_BODY_LANDMARKS[x]).map(x=>[x,COMBAT_BODY_LANDMARKS[x]]));
writeFileSync(fileURLToPath(new URL('visual-inputs.json',import.meta.url)),JSON.stringify({source:BASELINE,art:ART,classes,landmarks},null,2)+'\n');
console.log(`Verified ${index.files.length} owning source files against ${BASELINE}; collected ${paths.size} unique selected images and ${Object.keys(landmarks).length} landmark records.`);
