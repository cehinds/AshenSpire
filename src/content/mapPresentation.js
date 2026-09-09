// Presentation policy only. Node IDs, routes and discovery remain engine-owned.
export const MAP_PRESENTATION = Object.freeze({
  tileSize: 512,
  levels: [512, 1024, 2048, 4096],
  pixelRatioCap: 1.5,
  concurrentLoads: 3,
  cacheTiles: 28,
  levelHysteresis: 0.15,
  atlasZoomMax: 40,
  routeWidth: 3,
  routeOutlineWidth: 6,
});

export const MAP_CLOSE_NODE_SCALE = 2;
