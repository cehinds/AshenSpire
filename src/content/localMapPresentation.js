// Shared defaults; optional map-ID overrides contain presentation only.
// Content relationships remain in the normalized worldAtlas source tables.
export const LOCAL_MAP_PRESENTATION = Object.freeze({
  defaultZoom: 1.5, minZoom: 1, maxZoom: 5, zoomStep: 1.25,
  inspectionFactor: 1.3, dragThreshold: 7, panFraction: .18,
  focusDuration: 200, wheelSensitivity: .002,
});
export const LOCAL_MAP_OVERRIDES = Object.freeze({});
export const localMapPolicy = mapId => ({ ...LOCAL_MAP_PRESENTATION, ...LOCAL_MAP_OVERRIDES[mapId] });
