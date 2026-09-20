import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEquipmentAnimations, ANIMATION_ROLES } from '../src/model/equipmentAnimation.js';
import { contentBundle } from '../src/content/index.js';

const selector = b => JSON.stringify([b.classId,b.armourId,b.rightGroup,b.leftGroup,b.grip || '*']);

/** Merge disjoint physical/magic ownership; callers may compose in either order.
 * Physical supplies complete safe fallbacks. Magic replaces only cast/buff.
 * No balance, weapon-group, other motion-profile, or user-speed writes.
 */
export function mergeUnarmedAnimationFragment(components, fragment) {
  const fail = message => { throw new Error('unarmed import: '+message); };
  if (fragment?.schemaVersion !== 1 || fragment.motionProfile !== 'unarmed') fail('unsupported schema/profile');
  if (!Array.isArray(fragment.ownedRoles) || !fragment.ownedRoles.length || fragment.ownedRoles.some(r => !ANIMATION_ROLES.includes(r))) fail('invalid owned roles');
  const magic = fragment.ownedRoles.includes('cast');
  const allowed = magic ? ['cast','buff'] : ANIMATION_ROLES.filter(r => !['cast','buff'].includes(r));
  if (fragment.ownedRoles.some(r => !allowed.includes(r))) fail('mixed physical/magic role ownership');
  if (Object.keys(fragment.references || {}).some(r => !fragment.ownedRoles.includes(r))) fail('reference outside owned roles');
  if (Object.keys(fragment.clips || {}).some(id => !id.startsWith(magic ? 'magic' : 'physical'))) fail('clip namespace collision');
  const next = structuredClone(components);
  next.motionProfiles ||= {}; next.sets ||= {}; next.bindings ||= [];
  const prior = next.motionProfiles.unarmed || {};
  const defaults = fragment.profileDefaults || {};
  const profile = next.motionProfiles.unarmed = { ...defaults, ...prior,
    poseRoles: { ...(defaults.poseRoles || {}), ...(prior.poseRoles || {}) },
    clips: { ...(prior.clips || {}), ...structuredClone(fragment.clips || {}) },
    references: { ...(prior.references || {}), ...structuredClone(fragment.references || {}) } };
  for (const [role, clip] of Object.entries(fragment.fallbackReferences || {})) {
    if (magic || !['cast','buff'].includes(role)) fail('invalid fallback ownership');
    if (!Object.hasOwn(profile.references, role)) profile.references[role] = clip;
  }
  for (const [id, set] of Object.entries(fragment.sets || {})) {
    if (!/^[a-zA-Z0-9-]+Unarmed$/.test(id)) fail('invalid set ID');
    if (Object.keys(set).some(k => k !== 'frames')) fail('set fragment may only supply frames');
    for (const [pose, frame] of Object.entries(set.frames || {})) {
      if (pose.startsWith('MAGIC-') !== magic) fail('frame namespace collision');
      const directory = magic ? 'unarmed-magic' : 'unarmed';
      if (!frame.file?.startsWith(`assets/animations/${directory}/`) || frame.file.includes('..')) fail('invalid runtime path');
    }
    const existing = next.sets[id] || {};
    if (existing.motionProfile && existing.motionProfile !== 'unarmed') fail('set belongs to another profile');
    next.sets[id] = { ...existing, motionProfile:'unarmed', authoredEquipment:{rightGroup:'empty',leftGroup:'empty'},
      frames:{...(existing.frames || {}),...structuredClone(set.frames)} };
  }
  for (const binding of fragment.bindings || []) {
    if (binding.rightGroup !== 'empty' || binding.leftGroup !== 'empty' || !Object.hasOwn(fragment.sets,binding.setId)) fail('invalid empty-hand binding');
    const existing = next.bindings.find(row => selector(row) === selector(binding));
    if (existing && existing.setId !== binding.setId) fail('selector already belongs to another set');
    if (!existing) next.bindings.push(structuredClone(binding));
  }
  return next;
}

export function validateUnarmedFragmentCoverage(fragment, root) {
  const expected = contentBundle.equipment.armour.map(row => JSON.stringify([row.classId,row.id])).sort();
  const supplied = fragment.bindings.map(row => JSON.stringify([row.classId,row.armourId])).sort();
  if (JSON.stringify(expected) !== JSON.stringify(supplied)) throw new Error('unarmed import: incomplete or duplicate catalog coverage');
  if (new Set(fragment.bindings.map(row=>row.setId)).size !== Object.keys(fragment.sets).length) throw new Error('unarmed import: unbound appearance');
  for (const set of Object.values(fragment.sets)) for (const frame of Object.values(set.frames)) {
    if (!existsSync(resolve(root,frame.file))) throw new Error('unarmed import: missing runtime asset '+frame.file);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../',import.meta.url));
  if (!process.argv[2]) throw new Error('Usage: node tools/unarmed-animation-import.mjs path/to/runtime-fragment.json');
  const fragment = JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
  validateUnarmedFragmentCoverage(fragment,root);
  const path = resolve(root,'content/config/ui/presentation/equipmentAnimations.json');
  const doc = JSON.parse(readFileSync(path,'utf8'));
  doc.components = mergeUnarmedAnimationFragment(doc.components,fragment);
  validateEquipmentAnimations(doc.components);
  const temp = path+'.unarmed-tmp'; writeFileSync(temp,JSON.stringify(doc,null,2)+'\n'); renameSync(temp,path);
  console.log(`Imported ${Object.keys(fragment.sets).length} unarmed appearances / ${fragment.bindings.length} armor entries. Compile config before building.`);
}
