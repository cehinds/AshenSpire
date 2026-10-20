export function activeSettingsProfile(context) {
  return context?.active?.() || context?.read?.() || null;
}

// Legacy tuning rows are not inputs to the configured JSON providers. Keeping
// them editable would promise mechanics the active run never consumes.
const LEGACY_MECHANICS_GROUPS = new Set(['Opening', 'Progression', 'Combat', 'Stats', 'Recovery', 'Rewards', 'Shops', 'Deck', 'Equipment', 'World']);
export function settingsRowAvailable(row, profile, nextProfile = null) {
  if (row.nextRunOnly) profile = nextProfile || profile;
  if (!profile) return true;
  const configured = profile.foundation?.mode === 'configured';
  const modules = profile.modules || {};
  if (row.coreOnly) return configured && modules.effects?.fixCoreVersion === 1;
  // Ordered draw is consumed by createRunCombat in both foundations.
  if (row.key === 'playInDeckOrder') return !!modules.cards;
  if (configured && row.cat === 'Advanced' && (LEGACY_MECHANICS_GROUPS.has(row.advancedGroup)
    || (row.key.startsWith('gameConfig.') && !row.key.startsWith('gameConfig.presentation.')))) return false;
  if (row.key === 'askToUpcastAfterTarget') return !configured && !!modules.cards;
  if (row.key === 'mapMode' && modules.routes?.mode === 'configured') return false; // Authored visibility is pinned to this run.
  if (row.key === 'manaRing') return !configured || !!modules.resources?.include?.includes('mp');
  if (['armamentsPresentation', 'armamentsPhonePlacement'].includes(row.key)) return !!modules.equipment;
  if (['mapMode', 'mapZoom', 'shrinePathGlow', 'mapFreePan', 'mapHeaderDensity', 'mapHeaderRelics'].includes(row.key)) return !!modules.routes;
  return true;
}
