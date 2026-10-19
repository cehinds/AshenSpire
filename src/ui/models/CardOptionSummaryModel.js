// src/ui/models/CardOptionSummaryModel.js — what one card choice says in a picker tile.
//
// Reaction, discard and card-choice pickers show their options as uniform tiles: the card's
// name and a one-line effect, "Def 7 · Return 4". The numbers are the live ones a card face
// prints (cardSummaryContext reads the same preview the engine executes, SPEC §3.13), never a
// second formula. `dir` says whether the live number moved off its authored base: 'up' for an
// advantage or stance bonus, 'down' for a disadvantage, null when unchanged or when there is
// no preview to compare with. Pure and frozen: no DOM, no engine import. The caller reads the
// card definition and preview from its own state (the engine in solo, the seat snapshot in
// co-op) and hands them in through `readers`.

import { cardSummaryContext } from '../../model/playingCard.js';
import { isSpellCard } from '../../model/combatCardProfile.js';
import { spellDefenseSplit } from '../../model/spellDefense.js';
import { t } from '../strings.js';

const freeze = Object.freeze;
const MARK = '\u0000';
const direction = (value, base) => (Number.isFinite(value) && Number.isFinite(base) ? value > base ? 'up' : value < base ? 'down' : null : null);

/** The effect line of a resolved card: `[{ label, value, base, dir }]`, empty when nothing is phrased. */
export function cardEffectLine(def, preview = null, registries = null) {
  if (!def) return freeze([]);
  const { value, defenseValue, bindings, tokens, profile, poiseMerge } = cardSummaryContext(def, preview, registries);
  const live = Boolean(preview);
  const counter = profile?.maneuver === 'counter';
  const baseOf = (effect, index) => {
    const token = bindings.find(row => row.index === index && row.field === 'amount')?.token;
    return typeof tokens[token] === 'number' ? tokens[token] : typeof effect.amount === 'number' ? effect.amount : undefined;
  };
  const found = new Map();
  const add = (key, effect, row) => {
    const prior = found.get(key);
    // An unconditional effect outranks a conditional branch; otherwise the first one stands.
    if (!prior || (prior.conditional && !effect.if)) found.set(key, { ...row, conditional: Boolean(effect.if) });
  };
  (def.effects || []).forEach((effect, index) => {
    const amount = value(effect, index), base = baseOf(effect, index);
    if (typeof amount !== 'number') return;
    switch (effect.op) {
      case 'damage': {
        // A multi-hit card keeps its hit count ("Dmg 3 ×3"), read from the live preview first.
        const hits = preview?.values?.[index]?.hits ?? effect.hits ?? 1;
        add(counter ? 'return' : 'dmg', effect, { labelId: counter ? 'cardOption.label.return' : 'cardOption.label.dmg', amount, base,
          hits: typeof hits === 'number' && hits > 1 ? hits : 0 });
        break;
      }
      case 'block': case 'gainBarrier': {
        const split = defenseValue(effect, index) || (def.defenseRulesVersion === 2 || def.minCombatExpansionVersion === 2 ? spellDefenseSplit({ ...def, combatProfile: profile }, amount) : null);
        if (split) {
          if (split.block > 0) add('def', effect, { labelId: 'cardOption.label.def', amount: split.block, base: undefined, ref: { amount, base } });
          if (split.ward > 0) add('ward', effect, { labelId: 'cardOption.label.ward', amount: split.ward, base: undefined, ref: { amount, base } });
        } else {
          const barrier = effect.op === 'gainBarrier';
          const ward = barrier && isSpellCard({ combatProfile: profile, tags: def.tags });
          const key = ward ? 'ward' : barrier ? 'barrier' : 'def';
          add(key, effect, { labelId: `cardOption.label.${key}`, amount, base });
        }
        break;
      }
      case 'gainWard': add('ward', effect, { labelId: 'cardOption.label.ward', amount, base }); break;
      case 'poiseDamage': case 'wardDamage': {
        const ward = effect.op === 'wardDamage', merged = poiseMerge?.get(index);
        if (merged) {
          // Core with Ward off: a Ward hit drains Poise, so the group's leader reads one combined Poise figure.
          if (!merged.leader) break;
          const figures = merged.indices.map(i => [value(def.effects[i], i), baseOf(def.effects[i], i)]);
          if (figures.some(([live]) => typeof live !== 'number')) break;
          const key = counter ? 'returnPoise' : 'poise';
          add(key, effect, { labelId: `cardOption.label.${key}`, amount: figures.reduce((sum, [live]) => sum + live, 0),
            base: figures.every(([, authored]) => typeof authored === 'number') ? figures.reduce((sum, [, authored]) => sum + authored, 0) : undefined });
          break;
        }
        const key = counter ? (ward ? 'returnWard' : 'returnPoise') : ward ? 'wardDamage' : 'poise';
        add(key, effect, { labelId: `cardOption.label.${key}`, amount, base });
        break;
      }
      case 'gainPoise': add('poise', effect, { labelId: 'cardOption.label.poise', amount, base }); break;
      case 'heal': add('heal', effect, { labelId: 'cardOption.label.heal', amount, base }); break;
      default: break;
    }
  });
  // A counter whose reply is a payload (no matching effect) reads it from the live preview.
  // The payload can return HP damage, Poise and Ward: each shows as its own "Return" part.
  if (counter) for (const [field, op, key] of [['hp', 'damage', 'return'], ['poise', 'poiseDamage', 'returnPoise'], ['ward', 'wardDamage', 'returnWard']]) {
    const authored = def.counterPayload?.[field];
    if (found.has(key) || typeof authored !== 'number' || authored <= 0) continue;
    const liveValue = preview?.values?.find(row => row.op === op)?.value;
    const amountOf = typeof liveValue === 'number' ? liveValue : authored;
    if (poiseMerge && field === 'ward') {
      // Ward off: the payload's Ward drains Poise, so it joins the Poise return.
      const poise = found.get('returnPoise');
      if (poise) found.set('returnPoise', { ...poise, amount: poise.amount + amountOf, base: (poise.base ?? poise.amount) + authored });
      else found.set('returnPoise', { labelId: 'cardOption.label.returnPoise', amount: amountOf, base: authored });
      continue;
    }
    found.set(key, { labelId: `cardOption.label.${key}`, amount: typeof liveValue === 'number' ? liveValue : authored, base: authored });
  }
  const order = ['def', 'barrier', 'ward', 'dmg', 'return', 'returnPoise', 'returnWard', 'poise', 'wardDamage', 'heal'];
  return freeze(order.filter(key => found.has(key)).map(key => {
    const row = found.get(key), ref = row.ref || row;
    // A split defense shows its own share but moves with the whole gain it came from.
    // The row places the number ("Def {amount}"); before/after carry that placement to the view.
    const [before, after] = t(row.labelId, { amount: MARK }).split(MARK);
    return freeze({ label: `${before}${after}`.replace(/[^\p{L}\s]/gu, '').trim(), before, after: row.hits ? `${after} \u00d7${row.hits}` : after, hits: row.hits || 1, value: row.amount, base: row.base ?? ref.base,
      dir: live ? direction(ref.amount, ref.base) : null });
  }));
}

/** The cost chips of a reaction option: SP, MP, upcast tier and the choice it names. */
function costsOf(option) {
  const chips = [];
  if (option.play?.upcastTier) chips.push(t('combat.reaction.upcast', { tier: option.play.upcastTier }));
  if (option.choiceName) chips.push(String(option.choiceName));
  if (Number.isFinite(option.staminaCost)) chips.push(t('combat.reaction.sp', { amount: option.staminaCost }));
  if (option.manaCost) chips.push(t('combat.reaction.mp', { amount: option.manaCost }));
  return freeze(chips);
}

/**
 * summarizeCardOption(registries, combat, option, readers) → { id, name, line, costs }
 * `option` is a reaction option (`play.cardInstanceId`, `play.targetId`, costs) or a plain card
 * `{ instanceId, name }`. `readers.defOf(option, combat)` returns the resolved card definition and
 * `readers.previewOf(option, combat)` its live preview for the option's target; either may be
 * absent, giving a name-only tile.
 */
export function summarizeCardOption(registries, combat, option, readers = {}) {
  let def = null, preview = null;
  try { def = readers.defOf?.(option, combat) ?? null; } catch { def = null; }
  try { preview = def ? readers.previewOf?.(option, combat) ?? null : null; } catch { preview = null; }
  return freeze({
    id: option.id ?? option.instanceId ?? null,
    name: option.name ?? def?.name ?? '',
    line: cardEffectLine(def, preview, registries),
    costs: option.play ? costsOf(option) : freeze([]),
  });
}
