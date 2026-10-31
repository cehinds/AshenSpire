import { pinGameProfileInPlace, shareableGameProfile } from './ownedGameProfile.js';

// Where else a run holds a whole game profile: the combat checkpoints, each a
// combat snapshot that carries the fight's profile.
const SNAPSHOT_HOLDERS = ['combatEntered', 'combatPendingOutcome'];

/** structuredClone(run) that does not copy the run's pinned game profiles.
 *
 * A run carries its game profile snapshot (about 700 KB, 8,000 nodes), and its
 * combat checkpoint snapshot carries one more. The combat checkpoint, the reward
 * transaction and every explicit save cloned the whole run, profiles included,
 * on the input path: 10 to 25 ms on a desktop, four times that on a throttled
 * phone, each time. A profile is an immutable, hash-pinned snapshot, so it is
 * pinned (deep-frozen, once) and the copy shares it by reference, under the same
 * guard a combat candidate uses: only if no other field of the run aliases one
 * of its nodes. Anything that fails the guard, or is not a pinnable profile,
 * gets the plain structuredClone, and a run without a profile is cloned as is.
 *
 * Key order is kept (placeholders are replaced in place), so serialised bytes
 * are the same as a plain clone's.
 */
export function cloneRun(run) {
  if (!run || typeof run !== 'object') return structuredClone(run);
  const shell = { ...run };
  const shared = []; // [holder key or null, profile]
  const consider = (key, holder) => {
    const profile = holder?.gameProfile;
    if (!profile || typeof profile !== 'object' || !pinGameProfileInPlace(profile)) return false;
    shared.push([key, profile]);
    return true;
  };
  if (consider(null, run)) shell.gameProfile = null;
  for (const key of SNAPSHOT_HOLDERS) {
    const snapshot = run[key]?.snapshot;
    if (snapshot && typeof snapshot === 'object' && consider(key, snapshot)) shell[key] = { ...run[key], snapshot: { ...snapshot, gameProfile: null } };
  }
  if (!shared.length) return structuredClone(run);
  // Each shared profile must be unaliased by everything that is still cloned.
  for (const [, profile] of shared) {
    if (shareableGameProfile({ ...shell, gameProfile: profile }) !== profile) return structuredClone(run);
  }
  const copy = structuredClone(shell);
  for (const [key, profile] of shared) {
    if (key === null) copy.gameProfile = profile;
    else copy[key].snapshot.gameProfile = profile;
  }
  return copy;
}
