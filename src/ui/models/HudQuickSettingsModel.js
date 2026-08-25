import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';
import { resolveMusicEnabled } from '../audio.js';

export const HUD_MODES = Object.freeze(['expanded', 'compact']);

export function resolveHudMode(settings = {}) {
  return HUD_MODES.includes(settings.runHudMode) ? settings.runHudMode : 'expanded';
}

export function musicQuickSettingsPlan(settings = {}) {
  const audioMuted = settings.muteAudio === true;
  const active = resolveMusicEnabled(settings);
  return Object.freeze({
    active,
    stateLabel: active ? (audioMuted ? 'On · Audio muted' : 'On') : 'Off',
    label: active ? 'Turn music off' : 'Turn music on',
    change: Object.freeze({ musicEnabled: !active }),
  });
}

export function hudQuickSettingsModel({ place, presentation = {}, settings = {} } = {}) {
  const places = Array.isArray(presentation.places) ? presentation.places : [];
  const enabled = places.includes(place);
  const music = musicQuickSettingsPlan(settings);
  return componentModel(UI.hudQuickSettings, {
    variant: place,
    properties: {
      enabled,
      place,
      edgeGapPx: Number.isFinite(presentation.edgeGapPx) ? presentation.edgeGapPx : 4,
      stackGapPx: Number.isFinite(presentation.stackGapPx) ? presentation.stackGapPx : 0,
      cardSizePx: Number.isFinite(presentation.cardSizePx) ? presentation.cardSizePx : 40,
      glyphSizePx: Number.isFinite(presentation.glyphSizePx) ? presentation.glyphSizePx : 28,
      stateDotPx: Number.isFinite(presentation.stateDotPx) ? presentation.stateDotPx : 6,
      activeTintPct: Number.isFinite(presentation.activeTintPct) ? presentation.activeTintPct : 14,
      showCardBackground: presentation.showCardBackground === true,
      showLabels: presentation.showLabels !== false,
    },
    children: [
      componentModel(UI.fullscreenControl, {
        variant: place,
        accessibility: { label: 'Enter fullscreen' },
      }),
      componentModel(UI.musicControl, {
        variant: place,
        properties: { active: music.active, stateLabel: music.stateLabel },
        accessibility: { label: music.label },
      }),
    ],
  });
}
