// SPEC §13.4q class feats. The profile/run integration selects these only for
// mastery-scoped runs; older runs retain the existing skill-feat catalogue.
export const classSkillFeats = Object.freeze([
  { id: 'reaverIronFooting', skillId: 'class:reaver', minLevel: 0, name: 'Iron Footing', description: 'Your Guard cards gain +2 Block.', passive: { tags: ['guard'], block: 2 } },
  { id: 'reaverKeenBlade', skillId: 'class:reaver', minLevel: 0, name: 'Keen Blade', description: 'Blade attacks have an 8% chance to deal 1.5× damage.', crit: { tags: ['blade'], base: 0.08, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'reaverBloodDiscipline', skillId: 'class:reaver', minLevel: 0, name: 'Blood Discipline', description: 'Blood attacks have a 12% chance to deal 1.5× damage.', crit: { tags: ['blood'], base: 0.12, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'reaverMasteryFocus', skillId: 'class:reaver', minLevel: 0, name: 'Weight of War', description: 'Heavy attacks have a 15% chance to deal 1.5× damage.', crit: { tags: ['heavy'], base: 0.15, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'reaverMasteryResolve', skillId: 'class:reaver', minLevel: 0, name: 'Unbroken Line', description: 'Your Guard cards gain +3 Block.', passive: { tags: ['guard'], block: 3 } },
  { id: 'starseerAshShelter', skillId: 'class:starseer', minLevel: 0, name: 'Ash Shelter', description: 'Your Ritual cards gain +2 Block.', passive: { tags: ['ritual'], block: 2 } },
  { id: 'starseerClearSky', skillId: 'class:starseer', minLevel: 0, name: 'Clear Sky', description: 'Starstone attacks have a 10% chance to deal 1.5× damage.', crit: { tags: ['starstone'], base: 0.1, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'starseerRitualPrecision', skillId: 'class:starseer', minLevel: 0, name: 'Ritual Precision', description: 'Ritual attacks have an 8% chance to deal 1.5× damage.', crit: { tags: ['ritual'], base: 0.08, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'starseerMasteryFocus', skillId: 'class:starseer', minLevel: 0, name: 'Comet Sight', description: 'Starstone attacks have a 15% chance to deal 1.5× damage.', crit: { tags: ['starstone'], base: 0.15, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'starseerMasteryResolve', skillId: 'class:starseer', minLevel: 0, name: 'Astral Shelter', description: 'Your Starstone cards gain +3 Block.', passive: { tags: ['starstone'], block: 3 } },
  { id: 'rogueQuietGuard', skillId: 'class:rogue', minLevel: 0, name: 'Quiet Guard', description: 'Your Guard cards gain +2 Block.', passive: { tags: ['guard'], block: 2 } },
  { id: 'rogueMeasuredPoint', skillId: 'class:rogue', minLevel: 0, name: 'Measured Point', description: 'Pierce attacks have a 10% chance to deal 1.5× damage.', crit: { tags: ['pierce'], base: 0.1, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'rogueKnifeWork', skillId: 'class:rogue', minLevel: 0, name: 'Knife Work', description: 'Blade attacks have an 8% chance to deal 1.5× damage.', crit: { tags: ['blade'], base: 0.08, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'rogueMasteryFocus', skillId: 'class:rogue', minLevel: 0, name: 'Perfect Opening', description: 'Flourish attacks have a 15% chance to deal 1.5× damage.', crit: { tags: ['flourish'], base: 0.15, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'rogueMasteryResolve', skillId: 'class:rogue', minLevel: 0, name: 'Hidden Parry', description: 'Your Flourish cards gain +3 Block.', passive: { tags: ['flourish'], block: 3 } },
  { id: 'heraldRiteShelter', skillId: 'class:herald', minLevel: 0, name: 'Rite Shelter', description: 'Your Ritual cards gain +2 Block.', passive: { tags: ['ritual'], block: 2 } },
  { id: 'heraldBlightPrecision', skillId: 'class:herald', minLevel: 0, name: 'Blight Precision', description: 'Blight attacks have a 10% chance to deal 1.5× damage.', crit: { tags: ['blight'], base: 0.1, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'heraldOathEdge', skillId: 'class:herald', minLevel: 0, name: 'Oath Edge', description: 'Oath attacks have a 12% chance to deal 1.5× damage.', crit: { tags: ['oath'], base: 0.12, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'heraldMasteryFocus', skillId: 'class:herald', minLevel: 0, name: 'Flame Witness', description: 'Ritual attacks have a 15% chance to deal 1.5× damage.', crit: { tags: ['ritual'], base: 0.15, weights: {}, divisor: 100, cap: 0.5, multiplier: 1.5 } },
  { id: 'heraldMasteryResolve', skillId: 'class:herald', minLevel: 0, name: 'Unspent Oath', description: 'Your Oath cards gain +3 Block.', passive: { tags: ['oath'], block: 3 } },
]);
