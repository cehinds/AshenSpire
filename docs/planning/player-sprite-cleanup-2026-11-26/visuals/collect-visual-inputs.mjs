// Read-only evidence input collection. Run from any cwd; no game/art outputs.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { combatWeaponProfilesFor } from '../../../../src/model/combatWeaponPresentation.js';
import { alternativeCardAnimationFamily } from '../../../../src/model/cardAnimationFamily.js';
import { playerHurtFrames } from '../../../../src/content/playerHurtFrames.js';
import { COMBAT_BODY_LANDMARKS } from '../../../../src/content/combatBodyLandmarks.js';
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
writeFileSync(fileURLToPath(new URL('visual-inputs.json',import.meta.url)),JSON.stringify({source:'49eca254d795d06266aa23941cb2b31fe77b27bf',art:'ashenspire-hd-assets-v30',classes,landmarks},null,2)+'\n');
console.log(`Collected ${paths.size} unique selected images and ${Object.keys(landmarks).length} landmark records.`);
