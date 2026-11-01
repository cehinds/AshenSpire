// Lightning at run time (owner, 2026-10-31; SPEC 4.7 "Lightning, Shocked, Damp and Bedrock"). Headless.
//   beginLightningHit  Bedrock absorbs the hit, else the Shocked contest rolls (advantage vs Damp, disadvantage in metal)
//   finishLightningHit applies the 1 Shocked after the hit lost HP
// plus the metal checks, the +1 Precision against metal, and the earth enemy's starting Bedrock.
import { d20Mode } from './d20Chance.js';
import { applyStatus } from './statuses.js';
import { attributesOf, levelOf } from './counterReturn.js';
import { currentPoise } from './contest.js';
import { carrierElement, isLightning, lightningRules, statusStacks, elementOf, wearsMetal, lightningPrecisionBonus, isMetalPiece, wornPieces } from './elementRules.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';

export { isLightning, wearsMetal, lightningPrecisionBonus, isMetalPiece, wornPieces };
const whole = value => (Number.isFinite(Number(value)) ? Number(value) : 0);

const rankOf = carrier => { const r = carrier?.rank ?? carrier?.cardRef?.rank ?? carrier?.combatProfile?.rank; return Number.isInteger(r) && r >= 1 ? r : 1; };
const sum = (attrs, ids) => ids.map(id => ({ id, value: whole(attrs?.[id]) }));

/** The numbers of the Shocked contest without rolling: bonus = target Shocked stacks x (caster INT + WIS + rank), DC = target Poise + STR + DEX + CON + level. */
export function shockContestPreview(ctx, caster, target, carrier) {
  const rules = lightningRules(), stacks = statusStacks(target, 'shocked'), rank = rankOf(carrier);
  const casterParts = sum(attributesOf(ctx, caster) || {}, rules.shockAttacker);
  const dcParts = [{ id: 'poise', value: currentPoise(target) }, ...sum(attributesOf(ctx, target) || {}, rules.shockDefender), { id: 'level', value: levelOf(ctx, target) }];
  const mix = casterParts.reduce((s, p) => s + p.value, 0) + rank;
  return { kind: 'shock', stacks, rank, parts: [{ id: `Shocked ${stacks} x (INT+WIS+rank ${mix})`, value: stacks * mix }], bonus: stacks * mix,
    dcParts, dc: dcParts.reduce((s, p) => s + p.value, 0), advantage: statusStacks(target, rules.advantageStatus) > 0, disadvantage: wearsMetal(ctx, caster) };
}

/**
 * beginLightningHit(ctx, source, target, carrier) -> { absorbed, backlash, contest } for a lightning hit that connects.
 *  absorbed: the target's Bedrock took the whole hit (one stack lost, no HP loss, no Shocked).
 *  backlash: a metal-clad caster rolled a natural 1: the spell's damage goes to the caster, not the target.
 *  contest:  the roll record (also emitted as contestPassed / contestFailed so the roll log shows total vs DC), or null.
 * Returns null when the hit is not a lightning hit in a Core combat.
 */
export function beginLightningHit(ctx, source, target, carrier) {
  if (!fixCoreEnabled(ctx) || !isLightning(carrier) || !source || !target || source === target) return null;
  const rules = lightningRules();
  if (statusStacks(target, rules.bedrockStatus) > 0) {
    target.statuses[rules.bedrockStatus].stacks -= 1;
    if (target.statuses[rules.bedrockStatus].stacks <= 0) delete target.statuses[rules.bedrockStatus];
    ctx.emit?.('statusRemoved', { targetId: target.id, status: rules.bedrockStatus, amount: 1, reason: 'consumed' });
    return { absorbed: true, backlash: false, contest: null };
  }
  const preview = shockContestPreview(ctx, source, target, carrier);
  const mode = d20Mode({ advantage: preview.advantage, disadvantage: preview.disadvantage });
  const dice = [ctx.rng.int('combatContest', 1, 20)];
  if (mode !== 'normal') dice.push(ctx.rng.int('combatContest', 1, 20));
  const roll = mode === 'advantage' ? Math.max(...dice) : mode === 'disadvantage' ? Math.min(...dice) : dice[0];
  const total = roll + preview.bonus;
  const passed = rules.tieSucceeds ? total >= preview.dc : total > preview.dc;
  const backlash = preview.disadvantage && roll === 1;
  const contest = { ...preview, roll, dice, mode, total, passed: passed && !backlash };
  ctx.emit?.(contest.passed ? 'contestPassed' : 'contestFailed', { sourceId: source.id, targetId: target.id, cardId: carrier?.cardId, contest, contestKind: 'shock', roll, total, dc: preview.dc, passed: contest.passed, mode, dice });
  return { absorbed: false, backlash, contest };
}

/** finishLightningHit(ctx, source, target, hit, hpLoss): the 1 Shocked lands when the contest passed and the hit lost HP. Returns the stacks added. */
export function finishLightningHit(ctx, source, target, hit, hpLoss) {
  if (!hit?.contest?.passed || hit.absorbed || hit.backlash || !(hpLoss > 0) || !target?.alive) return 0;
  const stacks = lightningRules().shockStacks;
  applyStatus(ctx, target, 'shocked', stacks, source);
  return stacks;
}

/** Any Fire damage that dealt HP loss dries the target: all Damp is removed. */
export function fireDriesDamp(ctx, target, hpLoss) {
  if (!(hpLoss > 0) || statusStacks(target, 'damp') <= 0) return false;
  delete target.statuses.damp;
  ctx.emit?.('statusRemoved', { targetId: target.id, status: 'damp', amount: 0, reason: 'fire' });
  return true;
}

/** An enemy opens the fight with its element's and its authored starting statuses (SPEC 4.7): an earth enemy gets Bedrock; `startStatuses` rows seed as written. */
export function seedElementStatuses(ctx, enemy, def) {
  if (!fixCoreEnabled(ctx)) return 0;
  const rules = lightningRules();
  let seeded = 0;
  if (enemy && enemy.element === undefined && def?.element) enemy.element = def.element; // own-element moves read it
  if (elementOf(enemy, def) === 'earth' && statusStacks(enemy, rules.bedrockStatus) <= 0) {
    const start = def?.bedrockStacks ?? rules.bedrockStartStacks;
    if (start > 0) { applyStatus(ctx, enemy, rules.bedrockStatus, start, null); seeded += start; }
  }
  for (const row of def?.startStatuses || []) {
    if (statusStacks(enemy, row.status) > 0 || !(row.stacks > 0)) continue;
    applyStatus(ctx, enemy, row.status, row.stacks, null); seeded += row.stacks;
  }
  return seeded;
}

/** A Fire hit: fire school or damage type, or a card that applies Burn. */
export const isFireHit = carrier => carrierElement(carrier) === 'fire' || (carrier?.appliedStatuses || []).includes('burn');
/**
 * dealElementalHit(ctx, source, target, amount, carrier, deal) -> the one door a damage effect's hit goes through (SPEC 4.7).
 * `deal(from, to, amount)` applies the ordinary damage; `loseHp(entity, amount)` takes the backlash straight from the caster's HP.
 * The lightning step runs only when the hit lands (carrier.onLandedContact, called by the damage path after the hit roll). A lightning hit is absorbed by Bedrock (no damage), backlashes onto a
 * metal-clad caster on a natural 1 (the same damage to the caster, none to the target), or lands and then tries for 1 Shocked.
 * A Fire hit that costs HP dries a Damp target. Anything else is exactly `deal(source, target, amount)`.
 */
export function dealElementalHit(ctx, source, target, amount, carrier, deal, loseHp = null) {
  // The lightning step waits for a landed contact: the damage path calls carrier.onLandedContact() after the hit roll
  // (a miss never calls it), so a miss spends no Bedrock and rolls no contest or backlash.
  let hit = null;
  const lightning = fixCoreEnabled(ctx) && isLightning(carrier) && source && target && source !== target;
  if (lightning && carrier) {
    carrier.onLandedContact = () => {
      hit = beginLightningHit(ctx, source, target, carrier);
      if (hit?.absorbed) return false;
      if (hit?.backlash) { (loseHp || ((to, n) => deal(to, to, n)))(source, amount); return false; }
      return true;
    };
  }
  const before = target.hp;
  try { deal(source, target, amount); } finally { if (carrier && lightning) delete carrier.onLandedContact; }
  const hpLoss = Math.max(0, before - target.hp);
  if (hit) finishLightningHit(ctx, source, target, hit, hpLoss);
  else if (isFireHit(carrier) && fixCoreEnabled(ctx)) fireDriesDamp(ctx, target, hpLoss);
}
