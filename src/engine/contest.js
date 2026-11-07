// Insight contests (owner, 2026-10-31; SPEC §17 Contests). A card with `contest: 'mental' | 'physical'`
// never rolls Accuracy and never cares about range. It resolves one seeded contest per target:
//   d20 + caster attributes (by school) + card rank  vs  DC = target's CURRENT Poise + target attributes + target level.
// A tie succeeds. The constants are data (content/framework/mechanics.json `contest`).
import { mechanics } from '../framework/data/mechanics.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
// Pure on purpose: callers pass `read` ({ attributesOf, levelOf } from counterReturn.js) so this module adds no import cycle.

export const CONTEST_KINDS = Object.freeze(['mental', 'physical']);
export const contestRules = () => mechanics.contest;
// Core 2 (FixCore) only: Current / legacy v2 combats ignore `contest` and keep the Accuracy roll (FIXCORE-DECISIONS D1).
export const contestKindOf = (carrier, ctx) => {
  if (!fixCoreEnabled(ctx)) return null;
  const kind = carrier?.contest ?? carrier?.combatProfile?.contest;
  return CONTEST_KINDS.includes(kind) ? kind : null;
};
const whole = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const currentPoise = entity => Math.max(0, whole(entity?.persistentPoise?.value));
const cardRankOf = carrier => {
  const rank = carrier?.rank ?? carrier?.cardRef?.rank ?? carrier?.combatProfile?.rank;
  return Number.isInteger(rank) && rank >= 1 ? rank : 1;
};
const parts = (attrs, ids) => ids.map(id => ({ id, value: whole(attrs?.[id]) }));

/** The numbers of a contest without rolling: the caster's bonus and the target's DC. Used by the hit badge and the roll. */
export function contestPreview({ caster, target, kind, rank = 1, ctx = null, read }) {
  const rules = contestRules();
  const sides = rules[kind];
  if (!sides) throw Error(`Unknown contest kind '${kind}'`);
  const casterParts = parts(read.attributesOf(ctx, caster) || {}, sides.attacker);
  const rankBonus = rules.rankBonus ? Math.max(1, rank) : 0;
  const dcParts = [{ id: 'poise', value: currentPoise(target) },
    ...parts(read.attributesOf(ctx, target) || {}, sides.defender), { id: 'level', value: read.levelOf(ctx, target) }];
  return { kind, parts: casterParts, rank: rankBonus, bonus: casterParts.reduce((sum, part) => sum + part.value, 0) + rankBonus,
    dcParts, dc: dcParts.reduce((sum, part) => sum + part.value, 0) };
}

/** Rolls one contest on the `combatContest` stream. */
export function rollContest({ rng, caster, target, kind, rank = 1, ctx = null, read }) {
  const preview = contestPreview({ caster, target, kind, rank, ctx, read });
  const roll = typeof rng.int === 'function' ? rng.int('combatContest', 1, 20) : 1 + Math.floor(rng.float('combatContest') * 20);
  const total = roll + preview.bonus;
  return { ...preview, roll, total, passed: contestRules().tieSucceeds ? total >= preview.dc : total > preview.dc };
}

/** Rolls the contest for a carrier on the combat's rng; null when the card is not a contest card. */
export function rollCarrierContest(ctx, source, target, carrier, read) {
  const kind = contestKindOf(carrier, ctx);
  if (!kind || !source || !target) return null;
  return rollContest({ rng: ctx.rng, caster: source, target, kind, rank: cardRankOf(carrier), ctx, read });
}
export const previewCarrierContest = (ctx, source, target, carrier, read) => {
  const kind = contestKindOf(carrier, ctx);
  return kind && source && target ? contestPreview({ caster: source, target, kind, rank: cardRankOf(carrier), ctx, read }) : null;
};
