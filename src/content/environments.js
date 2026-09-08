// Approved environment boards. Rectangles select only artwork, excluding labels
// and borders; the original paintings remain intact in each shipped atlas.
const region = (id, name, names, boxes) => Object.freeze({
  id, name, atlas: `assets/environments/${id}-combat.webp`,
  map: `assets/environments/${id}-map.webp`,
  scenes: Object.freeze(names.map((name, i) => Object.freeze({
    id: `${id}-${i + 1}`, name, box: Object.freeze(boxes[i]),
  }))),
});

export const ENVIRONMENTS = Object.freeze([
  region('ashen-crown', 'The Ashen Crown',
    ["King’s Causeway", 'Bell Court', 'Ashfall Gardens', 'Throne Undercroft'],
    [[512, 84, 500, 399], [1030, 84, 494, 399], [512, 530, 500, 420], [1030, 530, 494, 420]]),
  region('hollow-weald', 'The Hollow Weald',
    ['Lanternwood Crossing', 'Drowned Hamlet', 'Roots of the Elder', 'Hunter’s Moon Clearing'],
    [[457, 69, 539, 393], [1013, 69, 509, 393], [457, 507, 539, 398], [1013, 507, 509, 398]]),
  region('pale-marches', 'The Pale Marches',
    ['Frostgate Pass', 'Frozen Pilgrim Road', 'Monastery of Silence', 'The Glass Lake'],
    [[505, 110, 487, 410], [1006, 110, 516, 410], [505, 571, 487, 423], [1006, 571, 516, 423]]),
  region('cinder-reach', 'The Cinder Reach',
    ['Basalt Stair', 'The Dead Foundry', 'Caldera Rim', 'Ember Mine Mouth'],
    [[468, 58, 514, 447], [1003, 58, 519, 447], [468, 520, 514, 440], [1003, 520, 519, 440]]),
  region('drowned-coast', 'The Drowned Coast',
    ['Tidebound Chapel', 'The Salt Causeway', 'Starwatch Terrace', 'Grave of Ships'],
    [[467, 63, 499, 420], [983, 63, 539, 420], [467, 527, 499, 454], [983, 527, 539, 454]]),
]);

export const ENVIRONMENT_ATLAS_SIZE = Object.freeze([1536, 1024]);
// SVG-space distance, independent of text zoom and viewport pixels.
export const MAP_TERRAIN_REVEAL_RADIUS = 74;
