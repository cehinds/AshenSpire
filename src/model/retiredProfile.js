// Core 2 is the only supported game (owner, 2026-11-04). A run pinned to anything else (the legacy
// `current` profile, Core 1, or no profile at all) is refused on load and its saved bytes are kept.
export const SUPPORTED_CORE = 'ashen.core@2.0.0';
export const SUPPORTED_FIX_CORE_VERSION = 1;

// null for a supported profile, else a short reason code.
export function retiredProfileReason(profile) {
  if (!profile || typeof profile !== 'object') return 'missing-profile';
  if (profile.foundation?.mode !== 'configured') return 'legacy-foundation';
  if (profile.lock?.core !== SUPPORTED_CORE) return 'retired-core';
  if (profile.modules?.effects?.fixCoreVersion !== SUPPORTED_FIX_CORE_VERSION) return 'retired-effects';
  return null;
}
