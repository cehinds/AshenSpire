// SPEC §4.9. These authored values are copied into each new run.
const NOTE = Symbol.for('ashenspire.balance.note');
export const enemyKnowledge = {
  version: 1,
  reads: {
    baseExact: .30, wisdomExact: .01, intelligenceExact: .01, levelExact: .005,
    perceptionExact: .03, minimumExact: 0, maximumExact: .90,
    baseClue: .50, wisdomClue: .005, intelligenceClue: .005, levelClue: .0025,
    perceptionClue: .02, minimumClue: 0, maximumClue: .90,
    [NOTE]: {
      baseExact: 'Base chance to identify the actual enemy action.',
      wisdomExact: 'Exact identification chance added per Wisdom point.',
      intelligenceExact: 'Exact identification chance added per Intelligence point.',
      levelExact: 'Exact identification chance added per character level above one.',
      perceptionExact: 'Exact identification chance added per run Perception level.',
      minimumExact: 'Minimum exact identification probability.',
      maximumExact: 'Maximum exact identification probability.',
      baseClue: 'Chance to read a broad clue after exact identification fails.',
      wisdomClue: 'Conditional clue chance added per Wisdom point.',
      intelligenceClue: 'Conditional clue chance added per Intelligence point.',
      levelClue: 'Conditional clue chance added per character level above one.',
      perceptionClue: 'Conditional clue chance added per run Perception level.',
      minimumClue: 'Minimum conditional broad clue probability.',
      maximumClue: 'Maximum conditional broad clue probability.',
    },
  },
  perception: {
    base: 3, growth: 1.5, roundTo: 1, maxLevel: 10, correctPredictionXp: 1,
    [NOTE]: {
      base: 'XP required for the first run Perception level.',
      growth: 'Multiplier for successive Perception level costs.',
      roundTo: 'Unit used to round Perception level costs.',
      maxLevel: 'Highest run Perception level.',
      correctPredictionXp: 'XP for a resolved correct prediction or tactical response to a wholly unknown action.',
    },
  },
  bestiary: {
    encountersToMaster: 30,
    perEnemy: {},
    [NOTE]: { encountersToMaster: 'Lifetime enemy mastery points, from 20 through 50; a real encounter earns one and a successful tactical response adds one.' },
  },
  [NOTE]: { version: 'Saved enemy knowledge contract version; one opts new runs into broad clues and Perception.' },
};
// Version is contract metadata, so Advanced exposes only tuning values.
export const enemyKnowledgeTuning = { reads: enemyKnowledge.reads, perception: enemyKnowledge.perception, bestiary: enemyKnowledge.bestiary };
