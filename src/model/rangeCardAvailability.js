// Range-off runs keep mixed defensive cards, but cannot acquire or add a card
// whose only effect is movement. Existing owned instances remain removable.
export const pureEngagementMovement = def => Boolean(def?.effects?.length)
  && def.effects.every(effect => effect.op === 'moveEngagement');
export const rangeCardAvailable = (run, def) => run?.rangePolicy?.enabled !== false || !pureEngagementMovement(def);
