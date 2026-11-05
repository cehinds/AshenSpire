// Owner 2026-11-05: each Core weapon has one default art (granted while worn) and two learnable arts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { WeaponCardPackageModel } from '../src/model/loadout.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
export const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const packages = () => (reg.equipment.armaments || []).filter(piece => piece.weaponCardPackage).map(piece => WeaponCardPackageModel.fromPiece(reg, piece));

test('every Core weapon has one default art and two distinct learnable arts', () => {
  const rows = packages();
  assert.equal(rows.length, 28);
  for (const pkg of rows) {
    assert.equal(pkg.weaponArtDefaults.length, 1, `${pkg.weaponId} default`);
    assert.equal(pkg.learnableArts.length, 2, `${pkg.weaponId} learnable`);
    const all = [...pkg.weaponArtDefaults, ...pkg.learnableArts];
    assert.equal(new Set(all).size, 3, `${pkg.weaponId} has three distinct arts`);
    for (const id of all) assert.ok(reg.cards.has(id), `${pkg.weaponId}: ${id} is a card`);
  }
});

test('no art card is listed on more than three weapons', () => {
  const uses = new Map();
  for (const pkg of packages()) for (const id of [...pkg.weaponArtDefaults, ...pkg.learnableArts]) uses.set(id, (uses.get(id) || 0) + 1);
  for (const [id, n] of uses) assert.ok(n <= 3, `${id} is on ${n} weapons`);
});

test('a package with a learnable art equal to a default or a repeat is refused', () => {
  const piece = (reg.equipment.armaments || []).find(row => row.id === 'katana');
  const bad = pkg => ({ ...piece, weaponCardPackage: { ...piece.weaponCardPackage, ...pkg } });
  assert.throws(() => WeaponCardPackageModel.fromPiece(reg, bad({ learnableArts: ['katanaDrawCut'] })), /already a default/);
  assert.throws(() => WeaponCardPackageModel.fromPiece(reg, bad({ learnableArts: ['quickCut', 'quickCut'] })), /duplicate learnable/);
  assert.throws(() => WeaponCardPackageModel.fromPiece(reg, bad({ learnableArts: ['noSuchCard'] })), /unknown/);
});
