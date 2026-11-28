// Preferences only suppress existing HUD parts; they never enable a layer the
// current screen does not provide. The menu is deliberately not configurable.
import { t, UiFullText } from '../strings.js';

export const HUD_VISIBILITY_SETTINGS = Object.freeze([
  { key: 'hudShowVitality', label: t('settings.row.hudShowVitality'), note: UiFullText('settings.row.hudShowVitality') },
  { key: 'hudShowRelics', label: t('settings.row.hudShowRelics'), note: UiFullText('settings.row.hudShowRelics') },
  { key: 'hudShowCurrency', label: t('settings.row.hudShowCurrency'), note: UiFullText('settings.row.hudShowCurrency') },
  { key: 'hudShowPosition', label: t('settings.row.hudShowPosition'), note: UiFullText('settings.row.hudShowPosition') },
  { key: 'hudShowPotions', label: t('settings.row.hudShowPotions'), note: UiFullText('settings.row.hudShowPotions') },
].map(row => Object.freeze({ ...row, cat: 'Display', topic: 'hud', def: true })));

export function resolveHudVisibility(settings = {}) {
  return Object.fromEntries(HUD_VISIBILITY_SETTINGS.map(({ key }) => [key, settings?.[key] !== false]));
}

export function applyHudVisibility(root, settings = {}) {
  const visibility = resolveHudVisibility(settings);
  for (const [key, visible] of Object.entries(visibility)) root.dataset[key] = String(visible);
  return visibility;
}
