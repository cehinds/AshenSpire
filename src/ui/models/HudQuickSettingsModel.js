import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';
import { resolveMusicEnabled } from '../audio.js';

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
      wideControlHeightPx: Number.isFinite(presentation.wideControlHeightPx) ? presentation.wideControlHeightPx : 24,
      labelFontPx: Number.isFinite(presentation.labelFontPx) ? presentation.labelFontPx : 10,
      glyphSizePx: Number.isFinite(presentation.glyphSizePx) ? presentation.glyphSizePx : 14,
      stateDotPx: Number.isFinite(presentation.stateDotPx) ? presentation.stateDotPx : 5,
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
