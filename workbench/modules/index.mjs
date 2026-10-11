// workbench/modules/index.mjs — the native modules the Workbench hosts, in rail
// order. Each entry loads its module lazily; the module's default export is
// { mount(el, ctx) } (see README.md). Ids are also the deep-link names: #mod=<id>.
export const MODULES = [
  { id: 'data', label: 'Data Studio', icon: 'table', group: 'Studios', blurb: 'Tables, relations, tags and validation.', load: () => import('./data/index.mjs') },
  { id: 'layout', label: 'Layout Studio', icon: 'layout', group: 'Studios', blurb: 'UI config, sketches, battlefield, deck row, SP orb and book recipes.', load: () => import('./layout/index.mjs') },
  { id: 'motion', label: 'Motion Studio', icon: 'figure', group: 'Studios', blurb: 'Poses, effects, timeline, bindings and sequences.', load: () => import('./motion/index.mjs') },
  { id: 'entities', label: 'Entity Browser', icon: 'file', group: 'Studios', blurb: 'Weapon cards, items, armament kits and tooltip previews.', load: () => import('./entities/index.mjs') },
  { id: 'assets', label: 'Asset Gallery', icon: 'brush', group: 'Studios', blurb: 'The design galleries in one place.', load: () => import('./assets/index.mjs') },
  { id: 'review', label: 'Visual Review', icon: 'pane', group: 'Studios', blurb: 'The game screens captured at three sizes, compared with their accepted baselines.', load: () => import('./review/index.mjs') },
];
