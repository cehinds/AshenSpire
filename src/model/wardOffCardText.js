// Core 2 with Ward switched off (content/source/fixCoreMechanics.json ward.enabled:false): a wardDamage effect
// drains Poise (engine/actions.js), so card text reads it as Poise damage. This is a display projection only:
// the effects, previews and engine are untouched, and any profile that keeps Ward (Current, v2) reads as authored.
import { fixCoreWardDisabled } from './fixCoreMechanics.js';
import { computeTokenBindings, cardTokenEffects } from './validate.js';

/** True when the run's profile has Core rules with Ward off; the same predicate the engine uses. */
export const wardReadsAsPoise = registries => fixCoreWardDisabled({ combatExpansionVersion: 2, gameProfile: registries?.gameProfile });

/**
 * For the face and summary: effect index -> { leader, indices } for every Poise/Ward damage effect that shares a
 * target, condition and once-per-turn flag with a Ward damage effect. The leader prints the combined Poise figure;
 * the rest print nothing. A card with no Ward damage effect gets an empty map.
 */
export function poiseMergeGroups(effects) {
  const groups = new Map();
  (effects || []).forEach((effect, index) => {
    if (effect?.op !== 'poiseDamage' && effect?.op !== 'wardDamage') return;
    const key = `${effect.target}|${JSON.stringify(effect.if ?? null)}|${Boolean(effect.oncePerTurn)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });
  const out = new Map();
  for (const indices of groups.values()) {
    if (!indices.some(index => effects[index].op === 'wardDamage')) continue;
    indices.forEach((index, i) => out.set(index, { leader: i === 0, indices }));
  }
  return out;
}

/**
 * For a card that authors a `wardOffTextTemplate`: that template, with `{poiseDamage}` standing for every Poise the
 * card drains (its Poise and Ward damage effects together). Ward damage has no template token of its own, so its
 * amount is the live preview value, else the authored number. Null when the card has no such template, no Ward
 * damage, or a figure that is not a plain number (the authored text stays then).
 */
export function wardOffCardText(def, tokens, baseTokens, preview = null) {
  if (typeof def?.wardOffTextTemplate !== 'string') return null;
  const effects = cardTokenEffects(def), bindings = computeTokenBindings(effects);
  const parts = effects.map((effect, index) => ({ effect, index })).filter(({ effect }) => effect?.op === 'poiseDamage' || effect?.op === 'wardDamage');
  if (!parts.some(({ effect }) => effect.op === 'wardDamage')) return null;
  const figure = (source, { effect, index }, live) => {
    if (effect.op === 'wardDamage') {
      const value = live && preview?.values?.[index]?.op === 'wardDamage' ? preview.values[index].value : effect.amount;
      return typeof value === 'number' ? value : undefined;
    }
    const token = bindings.find(row => row.index === index && row.field === 'amount')?.token;
    const value = token === undefined ? undefined : source?.[token];
    return typeof value === 'number' ? value : undefined;
  };
  const total = (source, live) => {
    let sum = 0;
    for (const part of parts) { const value = figure(source, part, live); if (value === undefined) return undefined; sum += value; }
    return sum;
  };
  const poiseTokens = new Set(bindings.filter(row => row.op === 'poiseDamage').map(row => row.token));
  const without = source => Object.fromEntries(Object.entries(source || {}).filter(([token]) => !poiseTokens.has(token)));
  const live = total(tokens, true);
  if (live === undefined) return null;
  const base = baseTokens ? total(baseTokens, false) : undefined;
  return { template: def.wardOffTextTemplate, tokens: { ...without(tokens), poiseDamage: live },
    baseTokens: baseTokens ? { ...without(baseTokens), ...(base === undefined ? {} : { poiseDamage: base }) } : baseTokens };
}
