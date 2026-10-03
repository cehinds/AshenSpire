// Preferences only suppress existing HUD parts; they never enable a layer the
// current screen does not provide. The menu is deliberately not configurable.
export const HUD_VISIBILITY_SETTINGS = Object.freeze([
  { key: 'hudShowVitality', label: 'HUD health and resources', note: 'Show health, Mana and Stamina in the top HUD.' },
  { key: 'hudShowRelics', label: 'HUD relics', note: 'Show the equipped relic rail.' },
  { key: 'hudShowCurrency', label: 'HUD Cinders', note: 'Show your Cinder balance in the HUD.' },
  { key: 'hudShowPosition', label: 'HUD journey position', note: 'Show the current act, seat and floor.' },
  { key: 'hudShowPotions', label: 'HUD potions', note: 'Show potion and flask shortcuts where the current layout provides them.' },
].map(row => Object.freeze({ ...row, cat: 'Display', def: true })));

export function resolveHudVisibility(settings = {}) {
  return Object.fromEntries(HUD_VISIBILITY_SETTINGS.map(({ key }) => [key, settings?.[key] !== false]));
}

export function applyHudVisibility(root, settings = {}) {
  const visibility = resolveHudVisibility(settings);
  for (const [key, visible] of Object.entries(visibility)) root.dataset[key] = String(visible);
  return visibility;
}
