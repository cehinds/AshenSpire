import { cardSummaryContext } from './playingCard.js';
import { withChargedEffects } from './cardFaceText.js';
import { stanceEntryBonuses } from './stanceRules.js';
import { fixCoreEnabled, fixCoreRules, fixCoreStatusDefinition } from './fixCoreMechanics.js';

// Quantified self benefits belong to the shared tag rail. Keep separate grants
// separate in their explanation: a stance-change grant is not added to an
// every-play effect, and an unresolved formula is never a guessed stack count.
export function cardBonusTags(def, preview = null, registries = null, rules = null) {
  if (!registries?.statuses?.has) return [];
  def = withChargedEffects(def, preview);
  const ctx = { registries, combatExpansionVersion: 2, stanceRules: registries?.balance?.stanceRules,
    gameProfile: rules?.gameProfile ?? registries?.gameProfile };
  const core = fixCoreEnabled(ctx), facts = new Map();
  const add = (status, fact) => {
    if (!registries?.statuses?.has(status)) return;
    if (!facts.has(status)) facts.set(status, []);
    facts.get(status).push(fact);
  };
  let summary;
  for (const [index, effect] of (def.effects || []).entries()) {
    if (effect.op !== 'applyStatus' || !['precision', 'evade'].includes(effect.status) || effect.target !== 'self') continue;
    if (!registries.statuses.has(effect.status)) continue;
    const live = preview?.values?.[index];
    const amount = live?.op === 'applyStatus' && live.status && live.status !== effect.status
      ? cardSummaryContext(def, null, registries, rules).value(effect, index, 'stacks')
      : (summary ||= cardSummaryContext(def, preview, registries, rules)).value(effect, index, 'stacks');
    // A tag cannot turn an unknown condition, duration, chance or timing into
    // an unconditional promise. Those applications retain their body copy.
    const simple = Object.keys(effect).every(key => ['op', 'target', 'status', 'stacks'].includes(key));
    let count = Number.isInteger(amount) && amount >= 0 ? amount : undefined, formula = null;
    const metric = effect.stacks;
    if (count === undefined && core && effect.status === 'evade' && metric?.f === 'metric'
        && metric.metric === 'evadeStackGain' && metric.of === 'self'
        && Object.keys(metric).every(key => ['f', 'metric', 'of'].includes(key))) {
      const accuracy = fixCoreRules(ctx, { id: 'card-face' }, def).accuracy;
      count = accuracy.evadeStackBase;
      formula = accuracy.evadeStackDex ? `${accuracy.evadeStackDex === 1 ? '' : accuracy.evadeStackDex + '× '}DEX` : null;
    }
    if (!simple || count === undefined) continue;
    add(effect.status, { count, formula,
      text: `Gain ${count}${formula ? ' + ' + formula : ''} ${registries.statuses.get(effect.status).name} when this effect resolves.`, index,
      ...(core && effect.status === 'evade' && count > 0 ? { entry: 'evade' } : {}) });
  }
  if (def.type !== 'power' && (core || def.defenseRulesVersion === 2 || def.minCombatExpansionVersion === 2)) {
    const entry = stanceEntryBonuses(def, ctx);
    for (const status of ['precision', 'evade']) {
      const base = entry[status];
      if (!(base > 0)) continue;
      // Configured Core suppresses the automatic Evade grant if this card
      // already applied Evade (setProfileStance). Do not print a second grant.
      const selfEvade = core && status === 'evade' && (def.effects || []).some(effect =>
        effect.op === 'applyStatus' && effect.status === 'evade' && effect.target === 'self');
      if (selfEvade) {
        if (!facts.get('evade')?.some(fact => fact.entry === 'evade')) add(status, { entry: status,
          text: `On changing stance, gain ${base} Evade only if this card has not already applied Evade.` });
        continue;
      }
      const live = status === 'precision' && core && Number.isInteger(preview?.entryPrecision) ? preview.entryPrecision : null;
      const formula = status === 'precision' && core && live === null ? 'stat mix' : null;
      const count = live ?? base, name = registries?.statuses?.get(status)?.name || status;
      add(status, { count, formula, entry: status,
        text: `On changing stance, gain ${count}${formula ? ' + ' + formula : ''} ${name}. Repeating the same stance grants none.` });
    }
  }
  return [...facts].map(([status, grants]) => {
    const base = registries.statuses.get(status), definition = fixCoreStatusDefinition(ctx, status, base);
    const single = grants.length === 1 ? grants[0] : null;
    return { id: `status:${status}`, label: definition.name,
      blurb: [...grants.map(grant => grant.text), definition.tooltip || definition.name].join(' '),
      ...(single ? { count: single.count, ...(single.formula ? { countFormula: single.formula } : {}) } : {}),
      // Only a visible, unambiguous amount badge can replace an authored effect.
      representedEffects: single && single.index !== undefined ? [single.index] : [],
      representedEntry: grants.flatMap(grant => grant.entry ? [grant.entry] : []),
    };
  });
}
