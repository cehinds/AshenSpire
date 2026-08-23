import { componentModel } from './ComponentModel.js';
import { metadataFieldModel } from './HudPrimitiveModels.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

export function identityClusterModel(identity) {
  return componentModel(UI.identityCluster, {
    properties: { name: identity.name, classLabel: identity.classLabel },
    children: [
      componentModel(UI.portraitBadge, { properties: { glyph: identity.glyph, tint: identity.tint } }),
      componentModel(UI.characterTitle, { properties: { name: identity.name, classLabel: identity.classLabel } }),
    ],
  });
}

export function cindersCounterModel(cinders) {
  return componentModel(UI.cindersCounter, {
    properties: { value: cinders, accessibleLabel: `${cinders} cinders` },
    accessibility: { label: `${cinders} cinders`, live: 'polite' },
  });
}

export function buildMetadataTrailModel({ place, act, actTotal, floor, floorTotal, seed }) {
  return componentModel(UI.buildMetadataTrail, {
    properties: { place, seed },
    children: [
      metadataFieldModel('act', 'ACT', act, actTotal),
      metadataFieldModel('floor', 'FLOOR', floor, floorTotal),
      metadataFieldModel('build', 'BUILD', null),
      metadataFieldModel('seed', 'SEED', seed),
      metadataFieldModel('source', 'SOURCE', null),
    ],
  });
}

export function runHeaderModel(input) {
  return componentModel(UI.runHeaderStrip, {
    children: [
      identityClusterModel(input.identity),
      cindersCounterModel(input.cinders),
      buildMetadataTrailModel(input),
    ],
  });
}
