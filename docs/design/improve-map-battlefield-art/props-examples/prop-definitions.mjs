// Editable metadata for the original diagrams in ../render-discovery.mjs.
// IDs match map-discovery.example.json where that proposal defines a type.
const definitions = [
  ['bridge', 'bridge', 'crossing', ['bridge', 'water-crossing', 'stone'], [0.12, 0.78, 0.76, 0.14]],
  ['path', 'path', 'route', ['road', 'junction', 'route'], [0.14, 0.17, 0.72, 0.76]],
  ['tunnel', 'tunnel', 'transport', ['tunnel', 'entrance', 'rock', 'paired-connection'], [0.12, 0.78, 0.76, 0.14]],
  ['cave', 'cave', 'adventure', ['cave', 'entrance', 'rock'], [0.14, 0.78, 0.72, 0.14]],
  ['ferry', 'ferry', 'transport', ['ferry', 'dock', 'water', 'shore'], [0.12, 0.75, 0.76, 0.2]],
  ['ford', 'ford', 'crossing', ['ford', 'river', 'water-crossing'], [0.12, 0.36, 0.76, 0.5]],
  ['portal', 'portal', 'transport', ['portal', 'magic', 'paired-connection'], [0.16, 0.79, 0.68, 0.12]],
  ['boat', 'boat', 'transport', ['boat', 'landing', 'water'], [0.16, 0.72, 0.68, 0.18]],
  ['city', 'city', 'settlement', ['city', 'settlement', 'stone'], [0.15, 0.77, 0.7, 0.16]],
  ['town', 'town', 'settlement', ['town', 'settlement', 'services'], [0.14, 0.77, 0.72, 0.16]],
  ['village', 'village', 'settlement', ['village', 'settlement'], [0.18, 0.78, 0.64, 0.14]],
  ['ruins', 'ruins', 'landmark', ['ruins', 'stone', 'danger'], [0.16, 0.78, 0.68, 0.14]],
  ['dungeon', 'dungeon', 'adventure', ['dungeon', 'gate', 'stone', 'danger'], [0.18, 0.78, 0.64, 0.14]],
  ['treasure', 'treasure', 'accessory', ['treasure', 'chest', 'reward'], [0.19, 0.77, 0.62, 0.14]],
  ['enemy-camp', 'enemy', 'encounter', ['enemy', 'camp', 'danger'], [0.13, 0.78, 0.78, 0.14]],
  ['rest-camp', 'rest', 'service', ['rest', 'camp', 'campfire', 'shelter'], [0.12, 0.78, 0.76, 0.14]],
  ['inn', 'inn', 'service', ['inn', 'settlement', 'rest', 'shelter'], [0.22, 0.78, 0.56, 0.14]],
  ['trainer', 'trainer', 'service', ['trainer', 'skills', 'weapons'], [0.15, 0.79, 0.7, 0.14]],
  ['merchant', 'merchant', 'service', ['merchant', 'market', 'supplies'], [0.22, 0.78, 0.56, 0.14]],
  ['shrine', 'shrine', 'landmark', ['shrine', 'blessing', 'stone'], [0.16, 0.79, 0.68, 0.12]],
  ['watchtower', 'watchtower', 'landmark', ['watchtower', 'scouting', 'stone'], [0.26, 0.78, 0.48, 0.14]],
  ['cartographer', 'cartographer', 'service', ['cartographer', 'map', 'reward'], [0.15, 0.76, 0.7, 0.17]],
  ['mine', 'mine', 'adventure', ['mine', 'entrance', 'resource', 'rock'], [0.16, 0.78, 0.68, 0.14]],
  ['fishing', 'fishing', 'service', ['fishing', 'water', 'shore'], [0.14, 0.79, 0.72, 0.14]],
];

export const propDefinitions = definitions.map(([id, sourceIconId, category, tags, rect]) => ({
  id,
  sourceIconId,
  category,
  tags,
  footprint: {shape: 'rectangle', x: rect[0], y: rect[1], width: rect[2], height: rect[3]},
}));
