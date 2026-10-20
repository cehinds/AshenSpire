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

import { cardSummaryContext, combatCardSummary } from '../../model/playingCard.js';
import { cardFaceLines, withChargedEffects } from '../../model/cardFaceText.js';
import { isSpellCard } from '../../model/combatCardProfile.js';
import { spellDefenseSplit } from '../../model/spellDefense.js';
import { t } from '../strings.js';
import { combatRangeActionPlan } from './CombatRangeActionModel.js';

const freeze = Object.freeze;
const MARK = '\u0000';
const direction = (value, base) => (Number.isFinite(value) && Number.isFinite(base) ? value > base ? 'up' : value < base ? 'down' : null : null);

/**
 * analyzeCardEffects(def, preview, registries) -> { line, complete }. `line` is the numeric parts
 * `[{ label, value, base, dir }]`. `complete` is false when some effect has no numeric part (a status, a
 * draw, a cleanse, a formula): the tile then reads the card's own compact text instead.
 */
export function analyzeCardEffects(def, preview = null, registries = null, holds = null) {
  if (!def) return { line: freeze([]), complete: false };
  let complete = true;
  const { value, defenseValue, bindings, tokens, profile, poiseMerge } = cardSummaryContext(def, preview, registries);
  const live = Boolean(preview);
  const counter = profile?.maneuver === 'counter';
  const baseOf = (effect, index) => {
    const token = bindings.find(row => row.index === index && row.field === 'amount')?.token;
    return typeof tokens[token] === 'number' ? tokens[token] : typeof effect.amount === 'number' ? effect.amount : undefined;
  };
  const groups = new Map();
  const add = (key, effect, row) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  };
  (def.effects || []).forEach((effect, index) => {
    // A conditional effect: when the caller can evaluate the condition for the card's owner, only the branches
    // that hold are summarized ("Def 9" in Bulwark). Without that answer one number would mislead, so the tile
    // uses the card's own text, which states every branch.
    if (effect.if) {
      const holding = holds ? holds(effect) : undefined;
      if (holding === false) return;
      if (holding !== true) complete = false;
    }
    const amount = value(effect, index), base = baseOf(effect, index);
    if (typeof amount !== 'number') { complete = false; return; }
    switch (effect.op) {
      case 'damage': {
        // A multi-hit card keeps its hit count ("Dmg 3 ×3"), read from the live preview first.
        const liveRow = preview?.values?.[index], hits = liveRow?.hits ?? effect.hits ?? 1, sequence = liveRow?.hitDamages;
        const labelId = counter ? 'cardOption.label.return' : 'cardOption.label.dmg';
        // Hits that differ (a first hit weaker than the rest) read as the total with each hit, not "N x hits".
        if (Array.isArray(sequence) && sequence.length > 1 && sequence.every(Number.isFinite) && sequence.some(each => each !== sequence[0])) {
          const total = Number.isFinite(liveRow.totalDamage) ? liveRow.totalDamage : sequence.reduce((sum, each) => sum + each, 0);
          add(counter ? 'return' : 'dmg', effect, { labelId, amount: total, base: typeof base === 'number' ? base * sequence.length : undefined, hits: 0, detail: `(${sequence.join('+')})` });
        } else add(counter ? 'return' : 'dmg', effect, { labelId, amount, base, hits: typeof hits === 'number' && hits > 1 ? hits : 0 });
        break;
      }
      case 'block': case 'gainBarrier': {
        const split = defenseValue(effect, index) || (def.defenseRulesVersion === 2 || def.minCombatExpansionVersion === 2 ? spellDefenseSplit({ ...def, combatProfile: profile }, amount) : null);
        if (split) {
          // Each share compares with the same split of the authored base, as the card face does, so only a share
          // whose own number changed is marked.
          const baseSplit = typeof base === 'number' ? spellDefenseSplit({ ...def, combatProfile: profile }, base) : null;
          if (split.block > 0) add('def', effect, { labelId: 'cardOption.label.def', amount: split.block, base: baseSplit?.block });
          if (split.ward > 0) add('ward', effect, { labelId: 'cardOption.label.ward', amount: split.ward, base: baseSplit?.ward });
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
      case 'gainPoise': add('poiseGuard', effect, { labelId: 'cardOption.label.poiseGuard', amount, base }); break;
      case 'heal': add('heal', effect, { labelId: 'cardOption.label.heal', amount, base }); break;
      default: complete = false; break;
    }
  });
  // Repeated parts of one kind add up ("Dmg 10" for a weapon hit and a rider).
  const found = new Map();
  for (const [key, use] of groups) {
    const sum = pick => use.reduce((total, part) => total + pick(part), 0);
    const numeric = pick => use.every(part => Number.isFinite(pick(part)));
    found.set(key, { labelId: use[0].labelId, amount: sum(part => part.amount), base: numeric(part => part.base) ? sum(part => part.base) : undefined,
      hits: use.length === 1 ? use[0].hits : 0, detail: use.length === 1 ? use[0].detail : undefined });
  }
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
  const order = ['def', 'barrier', 'ward', 'dmg', 'return', 'returnPoise', 'returnWard', 'poise', 'poiseGuard', 'wardDamage', 'heal'];
  const line = freeze(order.filter(key => found.has(key)).map(key => {
    const row = found.get(key);
    // The row places the number ("Def {amount}"); before/after carry that placement to the view.
    const [before, after] = t(row.labelId, { amount: MARK }).split(MARK);
    return freeze({ label: `${before}${after}`.replace(/[^\p{L}\s]/gu, '').trim(), before, after: `${after}${row.hits ? ` \u00d7${row.hits}` : ''}${row.detail ? ` ${row.detail}` : ''}`, hits: row.hits || 1, value: row.amount, base: row.base,
      dir: live ? direction(row.amount, row.base) : null });
  }));
  return { line, complete: complete && line.length > 0 };
}

/** The numeric effect line of a resolved card: `[{ label, value, base, dir }]`, empty when nothing is phrased. */
export const cardEffectLine = (def, preview = null, registries = null, holds = null) => analyzeCardEffects(def, preview, registries, holds).line;

const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// The card face's changed numbers are `<span class="val up">`; give them the tile's arrow and spoken words.
const withDirections = html => html.replace(/<span class="val (up|down)">(.*?)<\/span>/g, (span, dir) =>
  `${span}<span class="co-arrow" aria-hidden="true">${dir === 'up' ? '\u25b2' : '\u25bc'}</span><span class="co-sr"> ${t(`cardOption.dir.${dir}`)}</span>`);

/**
 * cardEffectHtml(def, preview, registries) -> escaped HTML of the card's own compact effect text, from the same
 * source as the card face (cardFaceText), else the plain effect summary, else the authored text; '' only for a card
 * with no text at all. A tile never shows an empty effect row.
 */
export function cardEffectHtml(def, preview = null, registries = null) {
  if (!def) return '';
  let lines = null;
  try { lines = cardFaceLines(def, preview, registries, null, { stanceEntry: false }); } catch { lines = null; }
  if (lines?.length) return withDirections(lines.map(row => row.html).join(' \u00b7 '));
  let summary = null;
  try { summary = combatCardSummary(def, preview, registries); } catch { summary = null; }
  const text = typeof summary === 'string' ? summary : Array.isArray(summary) ? summary.join(' ') : summary?.text;
  if (text) return esc(text);
  // The authored sentence with its tokens filled from the live preview, else the card's static tokens (the card
  // face's own token source); only a token that cannot resolve to a number is dropped.
  const { tokens } = cardSummaryContext(def, preview, registries);
  const fill = token => { const figure = preview?.tokens?.[token] ?? tokens[token]; return Number.isFinite(figure) ? String(figure) : ''; };
  const authored = String(def.textTemplate || def.text || def.description || '').replace(/\{([^}]*)\}/g, (match, token) => fill(token)).replace(/\s+/g, ' ').trim();
  return esc(authored || def.name || '');
}

/** The cost chips of a reaction option: SP, MP, upcast tier and the choice it names. */
function costsOf(option, preview, registries, combat) {
  const chips = [];
  if (option.play?.upcastTier) chips.push(t('combat.reaction.upcast', { tier: option.play.upcastTier }));
  if (option.choiceName) chips.push(String(option.choiceName));
  const plan = combatRangeActionPlan({ range: option.range ?? preview?.range }, {
    targetName: id => {
      const enemy = combat?.enemies?.find(entry => entry.id === id);
      return enemy ? registries?.enemies?.get(enemy.enemyId)?.name || id : id;
    },
  });
  const route = plan?.routes.find(entry => entry.id === (option.play?.rangeRoute ?? plan.selectedRoute));
  if (route) {
    chips.push(route.label, route.total, ...route.odds.map(target => target.text));
    if (route.reason) chips.push(route.reason);
    return freeze(chips.filter(Boolean));
  }
  if (option.play?.rangeRoute === 'throw') chips.push(t('combat.range.throw'));
  if (Number.isFinite(option.staminaCost)) chips.push(t('combat.reaction.sp', { amount: option.staminaCost }));
  if (option.manaCost) chips.push(t('combat.reaction.mp', { amount: option.manaCost }));
  return freeze(chips);
}

/**
 * summarizeCardOption(registries, combat, option, readers) → { id, name, line, costs }
 * `option` is a reaction option (`play.cardInstanceId`, `play.targetId`, costs) or a plain card
 * `{ instanceId, name }`. `readers.defOf(option, combat)` returns the resolved card definition and
 * `readers.previewOf(option, combat)` its live preview for the option's target; either may be
 * absent, giving a name-only tile. `readers.conditionHolds(effect, option, combat)` is optional.
 */
export function summarizeCardOption(registries, combat, option, readers = {}) {
  let def = null, preview = null;
  try { def = readers.defOf?.(option, combat) ?? null; } catch { def = null; }
  try { preview = def ? readers.previewOf?.(option, combat) ?? null : null; } catch { preview = null; }
  // The preview resolved the card (its live effect variant, charges); summarize that definition so the
  // effect indexes and numbers agree with it.
  if (preview?.resolvedDefinition) def = preview.resolvedDefinition;
  // An active charge expands the effect list the preview's values follow; the card face reads the same list.
  if (def) def = withChargedEffects(def, preview);
  // `readers.conditionHolds(effect, option, combat)` answers true or false for the card owner right now; a throw
  // or any other answer means "unknown".
  const holds = readers.conditionHolds ? effect => { try { return readers.conditionHolds(effect, option, combat); } catch { return undefined; } } : null;
  let { line, complete } = analyzeCardEffects(def, preview, registries, holds);
  // A card with effect variants but no preview (an old save, a snapshot without one) would show the authored
  // variant's numbers, which may be the wrong branch: use its text, which states them.
  if (def?.effectVariants?.length && !preview?.resolvedDefinition) complete = false;
  // The host marked this card's numbers as state-dependent but unpriced (a co-op pile past its preview budget).
  if (preview?.textOnly) complete = false;
  return freeze({
    id: option.id ?? option.instanceId ?? null,
    name: option.name ?? def?.name ?? '',
    // Numbers when every effect has one; otherwise the card's own compact text, so no tile has an empty effect row.
    line: complete ? line : freeze([]),
    ...(!complete && def ? { html: cardEffectHtml(def, preview, registries) } : {}),
    costs: option.play ? costsOf(option, preview, registries, combat) : freeze([]),
  });
}
