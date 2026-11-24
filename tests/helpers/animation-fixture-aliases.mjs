import assert from 'node:assert/strict';
import { contentBundle } from '../../src/content/index.js';
import { armourArtKey, armourArtClass } from '../../src/model/paintedOutfitArt.js';

// Historical exports keep their original paintings. Compose current declared
// same-class borrowers as selectors only; never manufacture sets or frames.
export function withDeclaredOutfitAliases(fragment, outfits = contentBundle.equipment.armour) {
  const key = (classId, armourId) => `${classId}/${armourId}`;
  const exported = new Map(fragment.bindings.map(row => [key(row.classId, row.armourId), row]));
  assert.equal(exported.size, fragment.bindings.length, 'historical export has no duplicate outfit bindings');
  const composed = structuredClone(fragment);
  for (const outfit of outfits) {
    if (exported.has(key(outfit.classId, outfit.id))) continue;
    assert.ok(outfit.artKey && outfit.artKey !== outfit.id, `${key(outfit.classId, outfit.id)} needs a declared borrowed appearance`);
    assert.equal(armourArtKey(outfit.classId, outfit.id), outfit.artKey, 'the declared borrower must resolve through production painted-outfit routing');
    assert.equal(armourArtClass(outfit.classId, outfit.id), outfit.classId, 'the borrowed painting must belong to the same class');
    const binding = exported.get(key(outfit.classId, outfit.artKey));
    assert.ok(binding && Object.hasOwn(fragment.sets, binding.setId), `${outfit.id} needs an existing same-class exported appearance`);
    composed.bindings.push({ ...binding, armourId: outfit.id });
  }
  return composed;
}
