// Approved environment boards. Rectangles select only artwork, excluding labels
// and borders; the original paintings remain intact in each shipped atlas.
const region = (id, name, names, floorStarts) => Object.freeze({
  id, name, atlas: `assets/environments/${id}-combat.webp`,
  map: `assets/environments/${id}-map.webp`,
  scenes: Object.freeze(names.map((name, i) => Object.freeze({
    id: `${id}-${i + 1}`, name,
    box: Object.freeze([(i % 2) * 768, Math.floor(i / 2) * 512, 768, 512]),
    // Authored start of the clear, full-width ground in this painting.
    floorStart: floorStarts[i], fieldRatio: 0.6,
  }))),
});

export const ENVIRONMENTS = Object.freeze([
  region('ashen-crown', 'The Ashen Crown',
    ["King’s Causeway", 'Bell Court', 'Ashfall Gardens', 'Throne Undercroft'],
    [0.5, 0.5, 0.4, 0.44]),
  region('hollow-weald', 'The Hollow Weald',
    ['Lanternwood Crossing', 'Drowned Hamlet', 'Roots of the Elder', 'Hunter’s Moon Clearing'],
    [0.48, 0.5, 0.42, 0.44]),
  region('pale-marches', 'The Pale Marches',
    ['Frostgate Pass', 'Frozen Pilgrim Road', 'Monastery of Silence', 'The Glass Lake'],
    [0.47, 0.48, 0.39, 0.39]),
  region('cinder-reach', 'The Cinder Reach',
    ['Basalt Stair', 'The Dead Foundry', 'Caldera Rim', 'Ember Mine Mouth'],
    [0.56, 0.55, 0.41, 0.43]),
  region('drowned-coast', 'The Drowned Coast',
    ['Tidebound Chapel', 'The Salt Causeway', 'Starwatch Terrace', 'Grave of Ships'],
    [0.51, 0.47, 0.41, 0.36]),
]);

export const ENVIRONMENT_ATLAS_SIZE = Object.freeze([1536, 1024]);
// SVG-space distance, independent of text zoom and viewport pixels.
export const MAP_TERRAIN_REVEAL_RADIUS = 74;

// Each world painting contains all five biomes. These are visual layouts;
// biome junctions and enemy selection remain future gameplay work.
export const MEGA_MAPS = Object.freeze([
  ['the-fractured-realm', 'The Fractured Realm'],
  ['the-shattered-gulf', 'The Shattered Gulf'],
  ['the-fivefold-frontier', 'The Fivefold Frontier'],
].map(([id, name]) => Object.freeze({ id, name, map: `assets/environments/${id}-world.webp` })));
