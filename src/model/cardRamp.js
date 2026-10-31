// Ramp (SPEC §4.3, "Zero-cost cards and ramp"): a card's damage or Block that grows with its uses.
// `ramp = { scope: 'combat' | 'run', stat: 'damage' | 'block', per: 1..3 }`.
// Pure and shared by both ways a card face is built: the legacy resolver (model/registries.js) and the
// game-profile projector (model/gameProfile.js projectGameCard).

export const RAMP_TAGS = Object.freeze({ combat: 'ramp.momentum', run: 'ramp.honed' });

/** The whole plays-ever count a card instance carries, or 0. */
export const playsEverOf = (instance) => (Number.isInteger(instance?.playsEver) && instance.playsEver > 0 ? instance.playsEver : 0);

/** True when the base card or its upgrade can carry a ramp. */
export const mayRamp = (definition) => !!(definition && (definition.ramp || definition.upgrade?.ramp));

/** True when the run-wide count can change the face (so a cache key must include it). */
export const rampsByRun = (definition) => definition?.ramp?.scope === 'run' || definition?.upgrade?.ramp?.scope === 'run';

/**
 * applyRamp(card, playsEver, ownTags) -> the card with its ramped amount, or `card` when it has no ramp.
 * The first effect whose op is `ramp.stat` becomes `base (+ playsEver x per for 'run')` plus `per` for each earlier
 * play of this card this combat (the `sameCardPlays` metric). The matching tag joins `cardTags`, so an upgrade that
 * adds a ramp also adds the tag. Does not freeze; callers do.
 */
export function applyRamp(card, playsEver = 0, ownTags = []) {
  const ramp = card?.ramp;
  if (!ramp) return card;
  const index = card.effects.findIndex(effect => effect.op === ramp.stat && Number.isFinite(effect.amount));
  if (index < 0) return card;
  const run = ramp.scope === 'run';
  const effects = card.effects.map((effect, i) => i !== index ? effect : {
    ...effect,
    amount: { f: 'add', args: [effect.amount + (run ? playsEver * ramp.per : 0), { f: 'metric', metric: 'sameCardPlays', of: 'self', per: ramp.per }] },
  });
  const tag = RAMP_TAGS[ramp.scope];
  const own = card.cardTags ?? ownTags;
  return { ...card, effects, cardTags: own.includes(tag) ? [...own] : [...own, tag] };
}
