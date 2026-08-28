// src/content/keepsakes.js — starting boons chosen at character creation
//
// A keepsake is a one-time bundle of RUN-LEVEL effects (the same DSL as
// events) applied when the run begins — no new engine primitives, no new
// registry type. Exported directly (like LOCKED_CLASSES), not part of the
// validated bundle; tests/engine.test.js validates each effect list anyway.

export const KEEPSAKES = [
  {
    id: 'none',
    name: 'Nothing',
    icon: '🕳',
    desc: 'Walk alone. The climb is enough.',
    effects: [],
  },
  {
    id: 'oldCinder',
    name: 'Old Cinder',
    icon: '🪙',
    desc: 'Begin the climb with 50 cinders.',
    effects: [{ op: 'addCinders', amount: 50 }],
  },
  {
    id: 'travelersFlask',
    name: "Traveler's Flask",
    icon: '🧪',
    desc: 'Begin with a Crimson Flask in your belt.',
    effects: [{ op: 'addFlask', id: 'crimsonFlask' }],
  },
  {
    id: 'whetstoneMemory',
    name: 'Whetstone Memory',
    icon: '🪨',
    desc: 'Begin with one Strike already upgraded.',
    effects: [{ op: 'upgradeCard', card: 'strike' }],
  },
];
