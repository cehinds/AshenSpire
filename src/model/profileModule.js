// Leaf: the configured game-profile module lookup. Imports only model/gameProfile.js so model code
// (smash text) can read it without reaching engine/gameProfileCombat.js and its stanceRules cycle.
import { gameModule } from './gameProfile.js';

export function configuredModule(subject, id) {
  const rule = gameModule(subject, id);
  return rule?.mode === 'configured' ? rule : null;
}

export function ConfiguredCombat(subject) {
  const profile = subject?.gameProfile;
  return !!profile && (profile.foundation?.mode === 'configured'
    || Object.values(profile.modules || {}).some(rule => rule?.mode === 'configured'));
}
