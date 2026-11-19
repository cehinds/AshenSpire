// Arithmetic and digest fixtures explicitly pin a saved profile from before the equipment type pass.
// Current-gear integration suites keep their normal opted-in profile.
import { gameDigest } from '../../engine/kernel/gameConfig.js';
import { bindGameProfileRegistries } from '../../src/model/gameProfile.js';

export function legacyGearProfile(profile) {
  const saved = structuredClone(profile);
  delete saved.modules.gear.typeEffectsVersion;
  delete saved.hash;
  saved.hash = gameDigest(saved);
  return saved;
}
export function legacyGearRegistries(registries) {
  return bindGameProfileRegistries(registries, legacyGearProfile(registries.gameProfile));
}
