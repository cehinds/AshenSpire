/** Presentation only: null remains the model's existing unequipped state. */
export const EMPTY_HAND_PRESENTATION = Object.freeze({
  id: 'empty-hand', name: 'Empty Hand', cardKind: 'hand choice',
  type: 'Unarmed', typeExplanation: 'Leave this hand unequipped. Available combat cards depend on both hands.',
  art: null, glyph: '✋︎', accent: '#d0ac5d',
  facts: [], tags: [], effectsLabel: 'Hand choice',
  bonuses: [{ label: 'Leave this hand unequipped.', explanation: 'Leave this hand unequipped.' }],
  flavor: 'Nothing held. Nothing to weigh you down.',
  requirement: 'No requirements', requirementExplanation: 'An empty hand requires no equipment or attributes.', rarity: '',
});
