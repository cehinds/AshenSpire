import { componentModel } from './ComponentModel.js';
import { metadataFieldModel } from './HudPrimitiveModels.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';
import { t, tFull } from '../strings.js';

// WGH7 / WGS3 run header. The compact header exposes only the class identity.
// Character name, portrait, sigil and screen-context copy remain on their
// dedicated surfaces. Labels are uiStrings rows (`hud.*`), values are the
// snapshot's semantic fields; nothing here is parsed back out of text.
export function identityClusterModel(identity = {}) {
  return componentModel(UI.identityCluster, {
    properties: { className: identity.className || '', label: t('hud.class') },
  });
}

export function cindersCounterModel(cinders) {
  const accessibleLabel = tFull('hud.cinders', { amount: cinders });
  return componentModel(UI.cindersCounter, {
    properties: { value: cinders, label: t('hud.cinders'), accessibleLabel },
    accessibility: { label: accessibleLabel, live: 'polite' },
  });
}

export function buildMetadataTrailModel({ place, act, actTotal, seat = null, floor, floorTotal, seed }) {
  return componentModel(UI.buildMetadataTrail, {
    properties: { place, seed, label: t('hud.position') },
    children: [
      metadataFieldModel('act', t('hud.act'), act, actTotal, seat),
      metadataFieldModel('floor', t('hud.floor'), floor, floorTotal),
      metadataFieldModel('build', 'BUILD', null),
      metadataFieldModel('seed', 'SEED', seed),
      metadataFieldModel('source', 'SOURCE', null),
    ],
  });
}

// `layers` (models/RunHudLayerModel.js) drops a track before layout; the
// default keeps all three.
export function runHeaderModel(input, layers = { class: true, cinders: true, position: true }) {
  return componentModel(UI.runHeaderStrip, {
    children: [
      ...(layers.class ? [identityClusterModel(input.identity)] : []),
      ...(layers.cinders ? [cindersCounterModel(input.cinders)] : []),
      ...(layers.position ? [buildMetadataTrailModel(input)] : []),
    ],
  });
}
