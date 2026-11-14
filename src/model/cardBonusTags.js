import { statusPresentationDefinition } from './statusPresentation.js';
import { cardSummaryContext } from './playingCard.js';
import { withChargedEffects } from './cardFaceText.js';
import { stanceEntryBonuses } from './stanceRules.js';
import { fixCoreEnabled, evadeGrantOnlyCard } from './fixCoreMechanics.js';
import { fixCoreRules } from './fixCoreRulesCache.js';

// Quantified self benefits belong to the shared tag rail. Keep separate grants
// separate in their explanation: a stance-change grant is not added to an
// every-play effect, and an unresolved formula is never a guessed stack count.
export function cardBonusTags(def, preview = null, registries = null, rules = null) {
  if (!registries?.statuses?.has) return [];
  def = withChargedEffects(def, preview);
  const ctx = { registries, combatExpansionVersion: 2, stanceRules: registries?.balance?.stanceRules,
    gameProfile: rules?.gameProfile ?? registries?.gameProfile, fixCoreRules: rules?.fixCoreRules };
  const core = fixCoreEnabled(ctx), facts = new Map();
  const protection = { block: { name: 'Block' }, barrier: { name: 'Barrier' } };
  const definition = status => registries.statuses.has(status) ? registries.statuses.get(status) : protection[status];
  const add = (status, fact) => {
    if (!definition(status)) return;
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
    for (const status of core ? ['precision', 'evade'] : ['precision', 'evade', 'block', 'barrier']) {
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
      const formula = null; // the entry grant is exactly the authored stacks (owner, 2026-10-31); the stat mix is Precision, not a stack count
      const count = live ?? base, name = definition(status)?.name || status;
      add(status, { count, formula, entry: status,
        text: `On changing stance, gain ${count}${formula ? ' + ' + formula : ''} ${name}. Repeating the same stance grants none.` });
    }
  }
  return [...facts].map(([status, grants]) => {
    const base = definition(status), resolved = statusPresentationDefinition(ctx, status, base);
    // A pure Evade card prints its short grant in the body; its keyword tag
    // keeps the explanation without repeating the quantity.
    const bodyGrant = core && evadeGrantOnlyCard(def);
    const single = !bodyGrant && grants.length === 1 ? grants[0] : null;
    return { id: `${protection[status] ? 'effect' : 'status'}:${status}`, label: resolved.name,
      blurb: [...grants.map(grant => grant.text), resolved.tooltip || resolved.name].join(' '),
      ...(single ? { count: single.count, ...(single.formula ? { countFormula: single.formula } : {}) } : {}),
      // Only a visible, unambiguous amount badge can replace an authored effect.
      representedEffects: single && single.index !== undefined ? [single.index] : [],
      representedEntry: grants.flatMap(grant => grant.entry ? [grant.entry] : []),
    };
  });
}
