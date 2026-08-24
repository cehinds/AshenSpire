import { componentModel } from './ComponentModel.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export function musicQuickSettingsPlan(settings = {}) {
  const audioMuted = settings.muteAudio === true;
  const musicMuted = settings.muteMusic === true;
  const active = !audioMuted && !musicMuted;
  return Object.freeze({
    active,
    stateLabel: active ? 'On' : audioMuted ? 'Audio off' : 'Off',
    label: active ? 'Turn music off' : audioMuted ? 'Turn audio and music on' : 'Turn music on',
    change: Object.freeze(active
      ? { muteMusic: true }
      : { muteAudio: false, muteMusic: false }),
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
      edgeGapPx: Number.isFinite(presentation.edgeGapPx) ? presentation.edgeGapPx : 8,
      stackGapPx: Number.isFinite(presentation.stackGapPx) ? presentation.stackGapPx : 4,
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
