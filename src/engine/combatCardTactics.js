import { combatProfileFor } from '../model/combatCardProfile.js';
import { evaluate, isFormula } from '../model/formulas.js';
import { counterstrikeAmount, counterstrikePct, hasStanceAdvantage, stanceManeuverOf } from './combatCardTraitMath.js';
import { evalPredicate } from './triggers.js';
import { cardRatingBonus } from './combatRatings.js';
import { armCombatCounter, matchupRules, combatExpansionEnabled, setCombatStance, prepareCombatEvade } from './combatMatchups.js';
import { attackDescriptor, weaponDamageType, weaponDamageComponents, dominantDamageType } from '../model/attackTags.js';
import { combatRules } from '../content/combatRules.js';
import { canonicalDamageType, isPhysicalDamageType, techniqueNeedsWeaponType } from '../model/combatRatings.js';
import { equippedIn, slotHand } from '../model/loadout.js';
import { enemyMoveDamage } from '../model/state.js';
import { expansionCarrierTraits } from './combatExpansionEquipment.js';

export function tacticalCarrier(def, extra = {}, ctx = null, source = null) {
  const metadata = {};
  for (const key of ['range', 'targeting', 'traits', 'projectile', 'counterCoverage', 'counterPayload',
    'evade', 'upcast', 'stanceTrigger', 'stanceExpiry', 'schoolEffect', 'caster', 'breakPoiseBonus', 'pronePoiseBonus', 'comboHook', 'traitValues']) {
    if (def[key] !== undefined) metadata[key] = structuredClone(def[key]);
  }
  const carrier = { ...metadata, ...extra, tags: def.cardTags ?? def.tags ?? extra.tags, attack: extra.attack ?? def.attack,
    damageSchool: extra.damageSchool ?? def.damageSchool,
    ...(Number.isFinite(extra.magicShare ?? def.magicShare) ? { magicShare: extra.magicShare ?? def.magicShare } : {}),
    ...(typeof (extra.physicalDamageType ?? def.physicalDamageType) === 'string' ? { physicalDamageType: extra.physicalDamageType ?? def.physicalDamageType } : {}),
    appliedStatuses: (def.effects || []).filter(effect => effect.op === 'applyStatus').map(effect => effect.status),
    appliedStatusEffects: (def.effects || []).filter(effect => effect.op === 'applyStatus'),
    appliedBuildupStatuses: (def.effects || []).filter(effect => effect.op === 'buildup').map(effect => effect.status),
    combatRiderTargets: [] };
  if (combatExpansionEnabled(ctx) && extra.ratingId === undefined && def.ratingId !== undefined) carrier.ratingId = def.ratingId;
  carrier.combatProfile = { ...combatProfileFor(carrier), ...(def.combatProfile || {}), ...(extra.combatProfile || {}) };
  // A mixed card's weapon part is resolved like an untagged card's whole type.
  const weaponPart = !!(carrier.attack?.weaponDamage && carrier.attack.components);
  if ((!carrier.combatProfile.damageType || weaponPart) && carrier.combatProfile.camp && ctx?.registries && source?.kind !== 'enemy' && !source?.enemyId) {
    const attack = attackDescriptor(carrier);
    const kind = attack.source || (carrier.combatProfile.camp === 'spell' ? 'spell' : 'weapon');
    const piece = wieldedArmament(ctx, carrier, source, kind);
    // No piece of that kind in hand: a physical weapon card is thrown with bare hands
    // and deals the unarmed profile's type (owner #19), as foundationSource does.
    const rules = ctx.foundation?.rules || combatRules;
    const unarmed = (ctx.registries.equipment?.basicCardProfiles || []).find(row => row.id === 'unarmedAttack');
    // A magical face (a staff's Strike, lent with a magic school) is never a bare-handed blow.
    const magical = carrier.combatProfile.camp === 'spell' || (carrier.damageSchool && carrier.damageSchool !== 'physical');
    const bare = piece || !['weapon', 'unarmed'].includes(kind) || magical ? null
      : (unarmed && attackDescriptor(unarmed).damageType) || rules.fallbackSource.damageType;
    const family = piece ? rules.equipmentSources?.itemFamilies?.[piece.id] || rules.equipmentSources?.profileFamilies?.[piece.attackProfile]
      : rules.fallbackSource.family;
    const pieceType = (piece && attackDescriptor(piece).damageType) || bare;
    if (weaponPart) {
      // The resolved parts travel on the carrier, so every effect and the
      // rules foundation read the same split as this profile.
      const components = weaponDamageComponents(attack, family, pieceType);
      carrier.attack = { ...carrier.attack, components };
      carrier.combatProfile.damageComponents = components.map(({ type, weight }) => ({ type, weight }));
      carrier.combatProfile.damageType = dominantDamageType(components);
    } else carrier.combatProfile.damageType = weaponDamageType(attack, family, pieceType) || null;
  }
  // A technique's physical part (Poison, fire or another magic type on a physical maneuver) is the
  // wielded weapon's blow (owner, 2026-10-13): its physical type, else bare-handed Blunt downstream.
  if (ctx?.registries && source?.kind !== 'enemy' && !source?.enemyId && techniqueNeedsWeaponType(carrier)) {
    const piece = wieldedArmament(ctx, carrier, source, 'weapon');
    const type = canonicalDamageType(piece && attackDescriptor(piece).damageType);
    if (isPhysicalDamageType(type)) carrier.physicalDamageType = type;
  }
  return combatExpansionEnabled(ctx) ? expansionCarrierTraits(carrier, source) : carrier;
}

// The armament a card is dealt with: its lending piece, else the first piece of that kind in its hand.
function wieldedArmament(ctx, carrier, source, kind) {
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
  return piece || null;
}

function counterFormulaContext(ctx, source, target, meta) {
  return { entities: { self: source, owner: source, player: ctx.player, target, enemy: target,
    allEnemies: (ctx.enemies || []).filter(enemy => enemy.alive) },
    energySpent: meta.energySpent || 0, cardsPlayedThisTurn: source.counters?.cardsPlayedThisTurn || 0 };
}

/** Per-effect preparation value used by both the card face and armed reply. */
export function counterEffectPreview(ctx, source, target, carrier, effect, meta = {}, { ignoreCondition = false } = {}) {
  const action = { source, owner: source, target, card: carrier, meta };
  const formulas = counterFormulaContext(ctx, source, target, meta);
  const payloadOps = combatExpansionEnabled(ctx) ? ['damage', 'poiseDamage', 'wardDamage'] : ['damage', 'poiseDamage'];
  if (!payloadOps.includes(effect.op) || (!ignoreCondition && effect.if && !evalPredicate(ctx, effect.if, action))) return null;
  const base = Math.max(0, Math.floor(evaluate(effect.amount ?? 0, formulas)));
  const hits = Math.max(0, Math.floor(evaluate(effect.hits ?? 1, formulas)))
    * Math.max(0, Math.floor(evaluate(effect.repeat ?? 1, formulas)));
  const value = effect.op === 'damage' ? base + cardRatingBonus(ctx, source, carrier, 'damage', base) : base;
  return { value, hits, total: value * hits };
}

function counterNumbers(ctx, source, target, carrier, effects, meta) {
  let damage = 0, poiseDamage = 0, wardDamage = 0, hasListedPoiseEffect = false, hasListedWardEffect = false;
  for (const effect of effects) {
    const preview = counterEffectPreview(ctx, source, target, carrier, effect, meta);
    if (!preview) continue;
    if (effect.op === 'damage') damage += preview.total;
    else if (effect.op === 'wardDamage') { hasListedWardEffect = true; wardDamage += preview.total; }
    else { hasListedPoiseEffect = true; poiseDamage += preview.total; }
  }
  // Projected cards print impact in their rating badge instead of an opcode.
  // An explicit eligible opcode wins; no weapon/unarmed fallback is invented.
  const impactKey = carrier.combatProfile?.camp === 'spell' ? 'ward' : 'poise';
  const listedImpact = carrier.cardRatingValues?.[impactKey];
  if (listedImpact !== undefined) {
    const impact = Math.max(0, Math.floor(evaluate(listedImpact, counterFormulaContext(ctx, source, target, meta))));
    if (combatExpansionEnabled(ctx) && impactKey === 'ward') { if (!hasListedWardEffect) wardDamage = impact; }
    else if (!hasListedPoiseEffect) poiseDamage = impact;
  }
  return combatExpansionEnabled(ctx) ? { damage, poiseDamage, wardDamage } : { damage, poiseDamage };
}

// Effect ops whose `amount` Counterstrike scales (docs/combat-card-traits-contract.md).
const COUNTERSTRIKE_AMOUNT_OPS = ['damage', 'block', 'gainBarrier', 'poiseDamage', 'wardDamage', 'gainPoise', 'gainWard', 'heal', 'buildup'];

// The enemy a Counterstrike card answers: the chosen enemy target, else the
// incoming attacker of the reaction in progress, else none.
function counterstrikeTarget(ctx, target) {
  if (target?.kind === 'enemy') return target;
  const id = ctx._reactionSourceId;
  return id == null ? null : (ctx.enemies || []).find(enemy => enemy.id === id) || null;
}

/**
 * Reaction rules v2: a played card carrying traitValues.counterstrike scales its
 * effect amounts on a per-play copy. Counter cards are left to their return payload.
 */
function counterstrikeEffects(ctx, source, target, carrier, effects, arm) {
  if (ctx.reactionRulesVersion !== 2 || carrier.traitValues?.counterstrike !== true) return effects;
  const cardManeuver = carrier.combatProfile?.maneuver || null;
  const setStance = arm && cardManeuver && carrier.combatProfile.stanceTrigger !== false;
  const playerManeuver = setStance ? cardManeuver : stanceManeuverOf(source);
  const enemy = counterstrikeTarget(ctx, target);
  const targetManeuver = enemy ? stanceManeuverOf(enemy) : null;
  const pct = counterstrikePct(ctx, playerManeuver, targetManeuver);
  const advantaged = hasStanceAdvantage(ctx, playerManeuver, targetManeuver);
  carrier.counterstrikePct = pct;
  ctx.emit?.('combatCounterstrikeApplied', { cardId: carrier.cardId, pct, advantaged });
  const scaled = effects.map(effect => {
    if (!COUNTERSTRIKE_AMOUNT_OPS.includes(effect.op) || effect.amount === undefined) return effect;
    const amount = isFormula(effect.amount)
      ? { f: 'traitBonus', base: effect.amount, pct }
      : counterstrikeAmount(effect.amount, pct);
    return { ...effect, amount };
  });
  return scaled;
}

/** Counter keeps support actions, postponing its printed damage to retaliation. */
export function prepareTacticalCard(ctx, source, target, carrier, effects, meta = {}, { arm = true, damageBonus = 0, poiseBonus = 0 } = {}) {
  // Feats may inject an application after the printed face was snapshotted.
  // The final action list owns duplicate-rider suppression, including charges.
  carrier.appliedStatusEffects = effects.filter(effect => effect.op === 'applyStatus');
  carrier.appliedStatuses = carrier.appliedStatusEffects.map(effect => effect.status);
  carrier.appliedBuildupStatuses = effects.filter(effect => effect.op === 'buildup').map(effect => effect.status);
  if (combatExpansionEnabled(ctx) && arm) {
    setCombatStance(ctx, source, carrier);
    if (carrier.combatProfile?.evade) prepareCombatEvade(ctx, source, carrier.combatProfile.evade);
  }
  if (carrier.combatProfile?.maneuver !== 'counter') return counterstrikeEffects(ctx, source, target, carrier, effects, arm);
  const rules = matchupRules(ctx).counter;
  if (arm) {
    const numbers = counterNumbers(ctx, source, target, carrier, effects, meta);
    if (!combatExpansionEnabled(ctx) && !effects.some(effect => effect.op === 'damage')) numbers.damage = rules.defaultDamage;
    numbers.damage += Math.max(0, Number(damageBonus) || 0);
    numbers.poiseDamage += Math.max(0, Number(poiseBonus) || 0);
    if (combatExpansionEnabled(ctx)) {
      const authored = carrier.combatProfile.counterPayload;
      const payload = { hp: numbers.damage, poise: numbers.poiseDamage, ward: numbers.wardDamage || 0 };
      if (authored) {
        const formulas = counterFormulaContext(ctx, source, target, meta);
        for (const key of ['hp', 'poise', 'ward', 'smashPoiseBonus']) if (authored[key] !== undefined) {
          const base = Math.max(0, evaluate(authored[key], formulas));
          const rating = key === 'hp' && base > 0 && authored.hpRating !== false
            ? cardRatingBonus(ctx, source, { ...carrier, ratingId: undefined }, 'damage', base) : 0;
          payload[key] = base + rating;
          // Counterstrike scales the authored base, then re-derives the rating bonus from it (contract).
          if (key === 'hp' && ctx.reactionRulesVersion === 2 && carrier.traitValues?.counterstrike) Object.assign(payload, { hpBase: base, hpRating: rating });
          // Counterstrike scales only the authored Poise; charge and conditional Poise ride on top unscaled.
          if (key === 'poise' && ctx.reactionRulesVersion === 2 && carrier.traitValues?.counterstrike) payload.poiseBase = base;
        }
        if (authored.hp !== undefined) payload.hp += Math.max(0, Number(damageBonus) || 0);
        if (authored.poise !== undefined) payload.poise += Math.max(0, Number(poiseBonus) || 0);
        // Authored base reply lanes coexist with conditional permanent-grade
        // bonuses. Evaluate their original gate at preparation, never on return.
        if (authored.poise !== undefined) for (const effect of effects) {
          if (effect.op !== 'poiseDamage' || (!effect.if && !effect.oncePerTurn)) continue;
          payload.poise += counterEffectPreview(ctx, source, target, carrier, effect, meta)?.total || 0;
        }
        if (authored.hpAgainstNonCaster !== undefined) payload.hpAgainstNonCaster = authored.hpAgainstNonCaster;
      } else if (ctx.reactionRulesVersion === 2 && carrier.traitValues?.counterstrike) {
        // A reply derived from the card's own damage effect: record its base and rating so
        // Counterstrike scales the base and re-derives the rating (one single-hit damage effect).
        const damaging = effects.map(effect => ({ effect, preview: effect.op === 'damage' ? counterEffectPreview(ctx, source, target, carrier, effect, meta) : null }))
          .filter(row => row.preview);
        if (damaging.length === 1 && damaging[0].preview.hits === 1) {
          const base = Math.max(0, Math.floor(evaluate(damaging[0].effect.amount ?? 0, counterFormulaContext(ctx, source, target, meta))));
          Object.assign(payload, { hpBase: base, hpRating: damaging[0].preview.value - base });
        }
        payload.poiseBase = Math.max(0, numbers.poiseDamage - Math.max(0, Number(poiseBonus) || 0));
      }
      armCombatCounter(ctx, source, carrier, { ...numbers, payload });
    } else armCombatCounter(ctx, source, carrier, numbers);
    // Enemy stances are armed before player phase and expire on enemy turn start.
    if (source.kind === 'enemy') delete source.combatCounter.expiresOnTurn;
  }
  const payloadOps = combatExpansionEnabled(ctx) ? ['damage', 'poiseDamage', 'wardDamage'] : ['damage', 'poiseDamage'];
  const support = effects.filter(effect => !payloadOps.includes(effect.op));
  if (!combatExpansionEnabled(ctx) && !support.some(effect => effect.op === 'block')) support.unshift({ op: 'block', target: 'self', amount: rules.guard });
  return counterstrikeEffects(ctx, source, target, carrier, support, arm);
}

/** Ward is provenance within Block; buildup protection remains gainWard. */
export function enqueueCounterWard(ctx, source, carrier, meta = {}) {
  if (combatExpansionEnabled(ctx)) return;
  if (carrier.combatProfile?.maneuver !== 'counter') return;
  const wardCarrier = { ...carrier, cardId: undefined, damageSchool: 'magic', tags: ['source:spell'], skipRatingBonus: true };
  ctx.enqueue({ effect: { op: 'block', target: 'self', amount: matchupRules(ctx).counter.ward }, source, owner: source,
    target: source, card: wardCarrier, meta });
}

const ENEMY_PRESSURE = {
  frail: { status: 'vulnerable', recoveryProfile: 'bodily' },
  weak: { status: 'weak', recoveryProfile: 'bodily' },
  bleed: { status: 'bleed', recoveryProfile: 'bodily' },
  crimsonBlight: { status: 'crimsonBlight', recoveryProfile: 'curse' },
  frost: { status: 'frost', recoveryProfile: 'elemental' },
  insanity: { status: 'dazed', recoveryProfile: 'mental' },
};

/** Canonical move tags own identity; the v2 projection is immutable. */
export function expandedEnemyMove(enemy, move, moveId, ctx = null) {
  if (!combatExpansionEnabled(ctx)) return move;
  const profile = combatProfileFor({ ...move, enemyId: enemy.enemyId, moveId });
  const range = profile.range || (profile.maneuver === 'ranged' || profile.camp === 'spell' ? 'reach' : 'melee');
  const targeting = profile.targeting || (profile.maneuver === 'sweep' ? 'area' : 'single');
  const result = { ...move, range, targeting,
    ...(profile.maneuver === 'smash' ? { breakPoiseBonus: move.breakPoiseBonus ?? 3 } : {}),
    ...(!profile.maneuver ? { stanceTrigger: false } : {}),
    effects: (move.effects || []).map(effect => {
      const pressure = ENEMY_PRESSURE[effect.status];
      if (effect.op === 'applyStatus' && pressure && effect.target !== 'self' && effect.target !== 'owner') {
        const { stacks, status, ...rest } = effect;
        return { ...rest, ...pressure, op: 'buildup', camp: profile.camp || 'physical',
          amount: typeof stacks === 'number' ? stacks * 4 : { f: 'mul', args: [stacks ?? 1, 4] } };
      }
      if (effect.op === 'block' && profile.camp === 'spell') return { ...effect, op: 'gainBarrier' };
      return structuredClone(effect);
    }) };
  if (profile.camp === 'spell' && move.block != null) {
    delete result.block;
    result.barrier = (move.barrier || 0) + move.block;
  }
  if (profile.maneuver === 'ranged') result.projectile = true;
  if (move.delay?.whileCharging) result.delay = { ...move.delay,
    whileCharging: expandedEnemyMove(enemy, { ...move.delay.whileCharging, tags: move.tags, cardTags: move.cardTags }, moveId, ctx) };
  if (profile.maneuver === 'counter' && !result.counterCoverage) {
    const ranged = profile.counterMode === 'ranged', spell = profile.camp === 'spell';
    result.counterCoverage = { camps: [spell ? 'spell' : 'physical'], ranges: spell ? ['melee', 'reach', 'ranged'] : ranged ? ['reach', 'ranged'] : ['melee'],
      targeting: ['single'], effects: spell ? ['damage', 'status'] : ['damage'], ...(!ranged && !spell ? { maneuvers: ['attack', 'smash'] } : {}) };
  }
  return result;
}

export function enemyMoveCarrier(enemy, move, moveId, ctx = null) {
  const projected = expandedEnemyMove(enemy, move, moveId, ctx);
  const carrier = tacticalCarrier(projected, { enemyId: enemy.enemyId, moveId, type: 'attack' }, ctx, enemy);
  return combatExpansionEnabled(ctx) ? expansionCarrierTraits(carrier, enemy) : carrier;
}

/** The selected intent remembers preparation even after its reaction is spent. */
export function enemyCounterDefensePrimed(enemy, moveId) {
  return enemy.intent?.moveId === moveId && enemy.intent.counterDefensePrimed === true;
}

export function primeEnemyCounter(ctx, enemy, move, moveId) {
  move = expandedEnemyMove(enemy, move, moveId, ctx);
  const carrier = enemyMoveCarrier(enemy, move, moveId, ctx);
  if (combatExpansionEnabled(ctx)) setCombatStance(ctx, enemy, carrier);
  if (carrier.combatProfile.maneuver !== 'counter') return;
  if (combatExpansionEnabled(ctx)) {
    const payload = carrier.combatProfile.counterPayload;
    const damage = move.counterDamage ?? move.damage;
    armCombatCounter(ctx, enemy, carrier, { damage: damage === undefined ? 0 : enemyMoveDamage(enemy, { ...move, damage }),
      poiseDamage: move.counterPoiseDamage || 0, wardDamage: move.counterWardDamage || 0,
      ...(payload ? { payload } : {}) });
    if (move.block > 0) ctx.enqueue({ effect: { op: 'block', target: 'self', amount: move.block }, source: enemy, owner: enemy, target: enemy, card: carrier, meta: { moveId } });
    if (move.barrier > 0) ctx.enqueue({ effect: { op: 'gainBarrier', target: 'self', amount: move.barrier }, source: enemy, owner: enemy, target: enemy, card: carrier, meta: { moveId } });
    if (enemy.intent?.moveId === moveId) enemy.intent.counterDefensePrimed = true;
    return;
  }
  const damage = enemyMoveDamage(enemy, { ...move,
    damage: move.counterDamage ?? move.damage ?? matchupRules(ctx).counter.defaultDamage });
  armCombatCounter(ctx, enemy, carrier, { damage, poiseDamage: move.counterPoiseDamage || 0 });
  delete enemy.combatCounter.expiresOnTurn;
  ctx.enqueue({ effect: { op: 'block', target: 'self', amount: move.block ?? matchupRules(ctx).counter.guard }, source: enemy, owner: enemy, target: enemy, card: carrier, meta: { moveId } });
  enqueueCounterWard(ctx, enemy, carrier, { moveId });
  if (enemy.intent?.moveId === moveId) enemy.intent.counterDefensePrimed = true;
}
