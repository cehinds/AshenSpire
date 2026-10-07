import { combatProfileFor } from '../model/combatCardProfile.js';
import { evaluate } from '../model/formulas.js';
import { evalPredicate } from './triggers.js';
import { cardRatingBonus } from './combatRatings.js';
import { armCombatCounter, matchupRules } from './combatMatchups.js';
import { attackDescriptor } from '../model/attackTags.js';
import { equippedIn, slotHand } from '../model/loadout.js';
import { enemyMoveDamage } from '../model/state.js';

export function tacticalCarrier(def, extra = {}, ctx = null, source = null) {
  const carrier = { ...extra, tags: def.cardTags ?? def.tags ?? extra.tags, attack: extra.attack ?? def.attack,
    damageSchool: extra.damageSchool ?? def.damageSchool,
    appliedStatuses: (def.effects || []).filter(effect => effect.op === 'applyStatus').map(effect => effect.status),
    appliedStatusEffects: (def.effects || []).filter(effect => effect.op === 'applyStatus'),
    combatRiderTargets: [] };
  carrier.combatProfile = combatProfileFor(carrier);
  if (!carrier.combatProfile.damageType && carrier.combatProfile.camp && ctx && source?.kind !== 'enemy') {
    const attack = attackDescriptor(carrier);
    const kind = attack.source || (carrier.combatProfile.camp === 'spell' ? 'spell' : 'weapon');
    const pieces = ctx.registries.equipment?.armaments || [];
    let piece = carrier.sourceArmamentId && pieces.find(row => row.id === carrier.sourceArmamentId);
    if (!piece && ctx.loadout) {
      const hand = { right: 'mainHand', left: 'offHand' }[carrier.sourceHand] || carrier.sourceHand || 'mainHand';
      for (const slot of ctx.registries.equipment?.slots || []) {
        if (slotHand(slot) !== (hand === 'offHand' ? 'left' : 'right')) continue;
        const equipped = equippedIn(ctx.registries, ctx.loadout, source?.classId, slot.id);
        if (equipped && attackDescriptor(equipped).source === kind) { piece = equipped; break; }
      }
    }
    const identity = piece && attackDescriptor(piece);
    carrier.combatProfile.damageType = identity?.damageType || (kind === 'unarmed' ? 'blunt' : null);
  }
  return carrier;
}

function counterNumbers(ctx, source, target, carrier, effects, meta) {
  const action = { source, owner: source, target, card: carrier, meta };
  const formulas = { entities: { self: source, owner: source, player: ctx.player, target, enemy: target,
    allEnemies: (ctx.enemies || []).filter(enemy => enemy.alive) },
    energySpent: meta.energySpent || 0, cardsPlayedThisTurn: source.counters?.cardsPlayedThisTurn || 0 };
  let damage = 0, poiseDamage = 0, hasListedPoiseEffect = false;
  for (const effect of effects) {
    if (!['damage', 'poiseDamage'].includes(effect.op) || (effect.if && !evalPredicate(ctx, effect.if, action))) continue;
    const base = Math.max(0, Math.floor(evaluate(effect.amount ?? 0, formulas)));
    const count = Math.max(0, Math.floor(evaluate(effect.hits ?? 1, formulas))) * Math.max(0, Math.floor(evaluate(effect.repeat ?? 1, formulas)));
    if (effect.op === 'damage') damage += (base + cardRatingBonus(ctx, source, carrier, 'damage', base)) * count;
    else { hasListedPoiseEffect = true; poiseDamage += base * count; }
  }
  // Projected cards print impact in their rating badge instead of an opcode.
  // An explicit eligible opcode wins; no weapon/unarmed fallback is invented.
  const impactKey = carrier.combatProfile?.camp === 'spell' ? 'ward' : 'poise';
  const listedImpact = carrier.cardRatingValues?.[impactKey];
  if (!hasListedPoiseEffect && listedImpact !== undefined) {
    poiseDamage = Math.max(0, Math.floor(evaluate(listedImpact, formulas)));
  }
  return { damage, poiseDamage };
}

/** Counter keeps support actions, postponing its printed damage to retaliation. */
export function prepareTacticalCard(ctx, source, target, carrier, effects, meta = {}, { arm = true, damageBonus = 0, poiseBonus = 0 } = {}) {
  // Feats may inject an application after the printed face was snapshotted.
  // The final action list owns duplicate-rider suppression, including charges.
  carrier.appliedStatusEffects = effects.filter(effect => effect.op === 'applyStatus');
  carrier.appliedStatuses = carrier.appliedStatusEffects.map(effect => effect.status);
  if (carrier.combatProfile?.maneuver !== 'counter') return effects;
  const rules = matchupRules(ctx).counter;
  if (arm) {
    const numbers = counterNumbers(ctx, source, target, carrier, effects, meta);
    if (!effects.some(effect => effect.op === 'damage')) numbers.damage = rules.defaultDamage;
    numbers.damage += Math.max(0, Number(damageBonus) || 0);
    numbers.poiseDamage += Math.max(0, Number(poiseBonus) || 0);
    armCombatCounter(ctx, source, carrier, numbers);
    // Enemy stances are armed before player phase and expire on enemy turn start.
    if (source.kind === 'enemy') delete source.combatCounter.expiresOnTurn;
  }
  const support = effects.filter(effect => !['damage', 'poiseDamage'].includes(effect.op));
  if (!support.some(effect => effect.op === 'block')) support.unshift({ op: 'block', target: 'self', amount: rules.guard });
  return support;
}

/** Ward is provenance within Block; buildup protection remains gainWard. */
export function enqueueCounterWard(ctx, source, carrier, meta = {}) {
  if (carrier.combatProfile?.maneuver !== 'counter') return;
  const wardCarrier = { ...carrier, cardId: undefined, damageSchool: 'magic', tags: ['source:spell'], skipRatingBonus: true };
  ctx.enqueue({ effect: { op: 'block', target: 'self', amount: matchupRules(ctx).counter.ward }, source, owner: source,
    target: source, card: wardCarrier, meta });
}

export function enemyMoveCarrier(enemy, move, moveId) {
  return tacticalCarrier(move, { enemyId: enemy.enemyId, moveId, type: 'attack' });
}

/** The selected intent remembers preparation even after its reaction is spent. */
export function enemyCounterDefensePrimed(enemy, moveId) {
  return enemy.intent?.moveId === moveId && enemy.intent.counterDefensePrimed === true;
}

export function primeEnemyCounter(ctx, enemy, move, moveId) {
  const carrier = enemyMoveCarrier(enemy, move, moveId);
  if (carrier.combatProfile.maneuver !== 'counter') return;
  const damage = enemyMoveDamage(enemy, { ...move,
    damage: move.counterDamage ?? move.damage ?? matchupRules(ctx).counter.defaultDamage });
  armCombatCounter(ctx, enemy, carrier, { damage, poiseDamage: move.counterPoiseDamage || 0 });
  delete enemy.combatCounter.expiresOnTurn;
  ctx.enqueue({ effect: { op: 'block', target: 'self', amount: move.block ?? matchupRules(ctx).counter.guard }, source: enemy, owner: enemy, target: enemy, card: carrier, meta: { moveId } });
  enqueueCounterWard(ctx, enemy, carrier, { moveId });
  if (enemy.intent?.moveId === moveId) enemy.intent.counterDefensePrimed = true;
}
