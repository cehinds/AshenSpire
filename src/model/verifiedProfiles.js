// Profiles resolved or digest-verified in this process. They are deep-frozen, so
// their digest cannot have changed; re-validating the same object is a no-op.
// Lives outside engine/kernel on purpose: kernel files are hashed into the save
// compatibility runtimeHash, and a perf-only change must not invalidate saves.
import { validateResolvedGameProfile } from '../../engine/kernel/gameConfig.js';
const verified = new WeakSet();
export function markVerifiedProfile(profile) { if (profile && typeof profile === 'object') verified.add(profile); return profile; }
export function isVerifiedProfile(profile) { return !!profile && typeof profile === 'object' && verified.has(profile); }
export function validateVerifiedProfile(snapshot, supportedRuntimeHash) {
  if (verified.has(snapshot) && (!supportedRuntimeHash || snapshot.lock?.runtimeHash === supportedRuntimeHash)) return snapshot;
  return markVerifiedProfile(validateResolvedGameProfile(snapshot, supportedRuntimeHash));
}
