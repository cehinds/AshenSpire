import { componentModel } from './ComponentModel.js';
import { metadataFieldModel } from './HudPrimitiveModels.js';
import { UI_COMPONENTS as UI } from './UiComponentId.js';

// THE CLUSTER PROJECTS NOTHING (owner, 2026-09-05: "it should just be vitals,
// relics, cinders, armory, menu and hp and mp potions in the Hud", and before
// that "remove across floor and character name sigil and class from combat
// hud"). It carried the name, the class, the chosen sigil and the screen's
// context, and the band draws none of them now.
//
// The properties and the two child models go with the view rather than being
// left projected: a presentation model that still computes a name nobody
// renders is how the name comes back — some later reader finds the field and
// assumes the band is meant to show it. `UI.portraitBadge` and
// `UI.characterTitle` stay declared in UiComponentId, because the ids are the
// registry's vocabulary and a surface that wants a portrait badge should use
// the same word; nothing instantiates them today.
//
// The cluster itself stays: `.hud-info-row` is a three-track grid whose middle
// track is what centres the Cinders receipt, and this is the first track.
export function identityClusterModel() {
  return componentModel(UI.identityCluster, {});
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
      identityClusterModel(),
      cindersCounterModel(input.cinders),
      buildMetadataTrailModel(input),
    ],
  });
}
