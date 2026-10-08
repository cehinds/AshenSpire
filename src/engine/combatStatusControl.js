import * as Actions from './actions.js';
import { combatStatusRules } from '../content/combatStatusRules.js';

const finite = value => Number.isFinite(value) ? value : 0;
const whole = value => Math.max(0, Math.floor(finite(value)));
const stacks = (entity, id) => whole(entity?.statuses?.[id]?.stacks);
const enabled = ctx => ctx?.combatExpansionVersion === 2;
const rules = ctx => ctx?.combatStatusRules || ctx?.combatExpansionRules?.statuses || combatStatusRules;
const emit = (ctx, type, entity, payload = {}) => ctx.emit?.(type, { targetId: entity.id, ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {}), ...payload });
function state(entity) {
  return entity.statusControl ||= { version: 1, gauges: {}, sleepHpRestored: 0,
    sleepWardGranted: false, sleepWardContribution: 0, wardRestoreCarry: 0, wardDamageCarry: 0,
    wardAllowances: {}, resolveNextTurn: false, resolveActive: false, ownerCycle: 0,
    lastRecoveryCycle: -1, completedActions: {} };
}
function ruleForActive(ctx, id) {
  return Object.values(rules(ctx).statuses).find(row => row.activeStatus === id);
}
function clearActive(ctx, entity, id, count = Infinity, reason = 'recovered') {
  const inst = entity.statuses?.[id];
  if (!inst) return 0;
  const removed = Math.min(stacks(entity, id), count);
  if (!removed) return 0;
  inst.stacks -= removed;
  if (!inst.stacks) delete entity.statuses[id];
  emit(ctx, 'statusRemoved', entity, { status: id, amount: removed, reason });
  return removed;
}

/** Called once at combat creation; NEVER on restore, stance change or turns. */
export function initializePersistentWard(entity, maximum) {
  const max = whole(maximum);
  entity.persistentWard = { max, value: max };
  state(entity);
  return entity.persistentWard;
}

/** Fractional explicit pressure shares one carried budget, not one per hit. */
export function spendPersistentWard(ctx, entity, amount, meta = {}) {
  if (!enabled(ctx) || !entity?.persistentWard || amount <= 0) return { spent: 0, carry: 0 };
  const s = state(entity), ward = entity.persistentWard;
  if (ward.value <= 0) { s.wardDamageCarry = 0; return { spent: 0, carry: 0 }; }
  const exact = Math.max(0, finite(amount)) + s.wardDamageCarry;
  const spent = Math.min(ward.value, Math.floor(exact + 1e-9));
  ward.value -= spent;
  s.wardDamageCarry = ward.value > 0 ? exact - Math.floor(exact + 1e-9) : 0;
  emit(ctx, 'persistentWardChanged', entity, { spent, value: ward.value, max: ward.max, ...meta });
  return { spent, carry: s.wardDamageCarry };
}

/** One authority for additive modifiers, caps, once allowances and carry. */
export function restorePersistentWard(ctx, entity, nominal, options = {}) {
  if (!enabled(ctx) || !entity?.alive || !entity.persistentWard) return { restored: 0, credited: 0 };
  const s = state(entity), ward = entity.persistentWard;
  const source = options.source || 'effect';
  const sleep = source === 'sleep';
  const onceKey = options.onceKey;
  if ((sleep && s.sleepWardGranted) || (onceKey && s.wardAllowances[onceKey])) return { restored: 0, credited: 0 };
  if (!(nominal > 0)) return { restored: 0, credited: 0 };
  // Reactive restoration budgets count a positive attempted grant, including
  // a full pool. Sleep's distinct once allowance is committed only if missing.
  const percent = finite(options.modifierPercent ?? ctx.restorationModifierPercent?.(entity, 'ward', source));
  if (ward.value >= ward.max) { s.wardRestoreCarry = 0; return { restored: 0, credited: 0 }; }
  if (sleep) s.sleepWardGranted = true;
  if (onceKey) s.wardAllowances[onceKey] = true;
  let credit = Math.max(0, nominal * (1 + percent / 100));
  if (sleep) credit = Math.min(credit, Math.max(0, rules(ctx).sleep.wardCombatCap - s.sleepWardContribution));
  if (options.cap !== undefined) credit = Math.min(credit, Math.max(0, options.cap));
  if (sleep) s.sleepWardContribution += credit;
  const exact = Math.min(ward.max - ward.value, credit + s.wardRestoreCarry);
  const restored = Math.min(ward.max - ward.value, Math.floor(exact + 1e-9));
  ward.value += restored;
  s.wardRestoreCarry = ward.value < ward.max ? Math.max(0, exact - restored) : 0;
  emit(ctx, 'persistentWardChanged', entity, { restored, credited: credit, value: ward.value, max: ward.max, source });
  return { restored, credited: credit, carry: s.wardRestoreCarry };
}

/** Active grants are separate from explicit buildup; no implicit proc meter. */
export function applyExpansionActiveStatus(ctx, target, id, amount, source = null) {
  if (!enabled(ctx)) return false;
  const row = ruleForActive(ctx, id);
  if (!row) return false;
  if (!target?.alive || !(amount > 0)) return true;
  target.statuses ||= {};
  const before = stacks(target, id), add = Math.min(whole(amount), Math.max(0, row.cap - before));
  if (!add) return true;
  const inst = target.statuses[id] ||= { stacks: 0 };
  inst.stacks = before + add;
  delete inst.meter;
  const def = ctx.registries?.statuses?.get(id);
  if (def?.decay?.duration) inst.duration = def.decay.duration;
  emit(ctx, 'statusApplied', target, { sourceId: source?.id ?? null, sourceKind: source?.kind, targetKind: target.kind,
    status: id, stacks: add, total: inst.stacks, wasAbsent: before === 0 });
  return true;
}

function grant(ctx, target, id, amount, source) {
  if (applyExpansionActiveStatus(ctx, target, id, amount, source)) return;
  target.statuses ||= {};
  const def = ctx.registries?.statuses?.get(id), prior = stacks(target, id);
  const inst = target.statuses[id] ||= { stacks: 0 };
  inst.stacks = def?.stackMode === 'unique' ? 1 : def?.stackMode === 'refresh' ? Math.max(prior, amount) : prior + amount;
  if (def?.decay?.duration) inst.duration = def.decay.duration;
  emit(ctx, 'statusApplied', target, { sourceId: source?.id ?? null, status: id, stacks: amount, total: inst.stacks, wasAbsent: !prior });
}

/** Root action interpreter calls this opcode with authored source identity. */
export function applyStatusPressure(ctx, target, id, units, source = null, options = {}) {
  const receipt = { acceptedBuildup: 0, activeAdded: 0, resisted: 0, wardSpent: 0, poiseStrain: 0, fullyResisted: true };
  if (!enabled(ctx) || !target?.alive || !(units > 0)) return receipt;
  const cfg = rules(ctx), row = cfg.statuses[id];
  if (!row) throw new Error(`Unknown status buildup '${id}'`);
  const s = state(target);
  const camp = options.camp || row.camp;
  if (!['physical', 'spell'].includes(camp)) throw new Error(`Unknown status source camp '${camp}'`);
  const traits = options.traits || target.combatTraits || {};
  if (traits.immuneStatuses?.includes(id)) { receipt.resisted = units; return receipt; }
  const percent = Math.min(100, Math.max(0, finite(options.resistancePercent ?? traits.buildupResistance?.[id])));
  const accepted = Math.max(0, units * (1 - percent / 100));
  receipt.resisted = units - accepted;
  const gauge = s.gauges[id] ||= { value: 0, camp, recoveryProfile: options.recoveryProfile || row.profile };
  // A gauge may receive both camps: only the current application chooses the
  // defense for fills. It never converts a Spell merely because its type is Blunt.
  gauge.camp = camp; gauge.recoveryProfile = options.recoveryProfile || row.profile;
  gauge.value += accepted;
  let iterations = 0;
  while (gauge.value >= (stacks(target, row.activeStatus) ? row.activeThreshold : row.initialThreshold)) {
    if (++iterations > 10000) throw new Error(`Unbounded status buildup '${id}'`);
    if (stacks(target, row.activeStatus) >= row.cap) break;
    const threshold = stacks(target, row.activeStatus) ? row.activeThreshold : row.initialThreshold;
    gauge.value -= threshold;
    let admitted = true;
    if (camp === 'spell' && target.persistentWard?.value > 0) {
      const spent = spendPersistentWard(ctx, target, 1, { status: id, actionKey: options.actionKey });
      receipt.wardSpent += spent.spent;
      admitted = target.persistentWard.value === 0;
    } else if (camp === 'physical' && target.poiseMeter?.max > 0) {
      const meter = target.poiseMeter;
      meter.value += 1; receipt.poiseStrain += 1;
      admitted = meter.value >= meter.max;
      if (admitted) {
        meter.value %= meter.max;
        emit(ctx, 'statusPoiseBreak', target, { status: id, actionKey: options.actionKey });
        if (ctx.onStatusPoiseBreak) ctx.onStatusPoiseBreak(target, source, options);
        else if (target.kind === 'enemy') Actions.staggerEnemy(ctx, target);
        else Actions.staggerPlayer(ctx, target);
      }
    }
    if (admitted) {
      const before = stacks(target, row.activeStatus);
      grant(ctx, target, row.activeStatus, 1, source);
      receipt.activeAdded += stacks(target, row.activeStatus) - before;
      for (const [extra, amount] of Object.entries(row.grants || {})) grant(ctx, target, extra, amount, source);
    } else receipt.resisted += threshold;
    emit(ctx, 'statusGaugeFilled', target, { status: id, threshold, admitted, camp, actionKey: options.actionKey });
  }
  // Remaining gauge pressure is admitted even without a full stack. This is
  // exactly what prevents a status-only or mixed action from earning a Counter.
  receipt.acceptedBuildup = Math.min(accepted, gauge.value);
  receipt.resisted = Math.min(units, receipt.resisted);
  receipt.fullyResisted = receipt.activeAdded === 0 && receipt.acceptedBuildup === 0;
  emit(ctx, 'statusPressure', target, { status: id, sourceId: source?.id ?? null, camp, actionKey: options.actionKey, value: gauge.value, ...receipt });
  return receipt;
}

export function controlRestrictions(ctx, entity) {
  if (!enabled(ctx)) return { locked: false, locks: [], counterDisabled: false, evadeDisabled: false, resolveActive: false };
  const resolveActive = !!entity.statusControl?.resolveActive;
  const locks = Object.values(rules(ctx).statuses).filter(row => row.lock && stacks(entity, row.activeStatus)).map(row => row.activeStatus);
  return { locked: !resolveActive && locks.length > 0, locks, counterDisabled: !resolveActive && locks.length > 0,
    evadeDisabled: !resolveActive && locks.length > 0, resolveActive };
}

export function controlGate(ctx, entity, card = {}) {
  const gate = controlRestrictions(ctx, entity);
  if (!gate.locked || card.builtinRecovery) return { allowed: true, ...gate };
  const covers = card.usableWhile || card.recovery?.usableWhile || [];
  return { allowed: gate.locks.every(id => covers.includes(id)), ...gate };
}

/** Synthetic controls never have a deck instance, copy/upcast or play event. */
export function recoveryControls(ctx, entity) {
  if (!enabled(ctx)) return [];
  const rows = Object.values(rules(ctx).statuses).filter(row => row.lock && stacks(entity, row.activeStatus)).map(row => ({
    id: `recover:${row.activeStatus}`, status: row.activeStatus, stacks: stacks(entity, row.activeStatus),
    costPerStack: row.recoveryCost, builtinRecovery: true, upcastable: false,
  }));
  const prone = rules(ctx).prone;
  if (stacks(entity, prone.status)) rows.push({ id: 'recover:stand', status: prone.status, stacks: 1,
    costPerStack: prone.standCost, builtinRecovery: true, upcastable: false, disabled: controlRestrictions(ctx, entity).locked });
  return rows;
}

export function manualRecovery(ctx, entity, selections, options = {}) {
  if (!enabled(ctx) || !entity?.alive || !Array.isArray(selections) || !selections.length) return { ok: false, reason: 'No active recovery selected' };
  const available = new Map(recoveryControls(ctx, entity).map(row => [row.status, row]));
  const seen = new Set(); let cost = 0;
  for (const item of selections) {
    const row = available.get(item.status);
    if (!row || row.disabled || seen.has(item.status) || !Number.isInteger(item.stacks) || item.stacks < 1 || item.stacks > row.stacks) return { ok: false, reason: 'Invalid recovery selection' };
    seen.add(item.status); cost += item.stacks * row.costPerStack;
  }
  const pool = options.pool || (ctx.sharedActionStamina !== false && Number.isFinite(entity.energy) ? 'energy' : 'stamina');
  if (!Number.isFinite(entity[pool]) || entity[pool] < cost) return { ok: false, reason: 'Insufficient Stamina', cost, pool };
  entity[pool] -= cost;
  emit(ctx, 'staminaSpent', entity, { sourceId: entity.id, amount: cost, recovery: true });
  for (const item of selections) clearActive(ctx, entity, item.status, item.stacks);
  emit(ctx, 'controlRecovered', entity, { selections: structuredClone(selections), cost, pool, manual: true });
  return { ok: true, cost, pool, restrictions: controlRestrictions(ctx, entity) };
}

export function recoveryChance(ctx, entity, id, options = {}) {
  const cfg = rules(ctx), row = cfg.statuses[id] || ruleForActive(ctx, id);
  if (!row) return 0;
  const profile = options.profile || entity.statusControl?.gauges[id]?.recoveryProfile || row.profile;
  const weights = options.weights || cfg.profiles[profile];
  const attrs = options.attributes || entity.attributes || (entity === ctx.player ? ctx.attributes : null) || {};
  const weighted = Object.entries(weights || {}).reduce((sum, [key, weight]) => sum + finite(attrs[key]) * weight, 0);
  const count = stacks(entity, row.activeStatus);
  const bonus = finite(options.bonus ?? entity.combatTraits?.recoveryBonus?.[profile]);
  return Math.min(cfg.recovery.maximum, Math.max(cfg.recovery.minimum, cfg.recovery.base + Math.floor(weighted) + bonus - cfg.recovery.stackPenalty * Math.max(0, count - 1)));
}

export function effectiveChance(chance, { advantage = false, disadvantage = false } = {}) {
  const p = chance / 100;
  return advantage === disadvantage ? chance : 100 * (advantage ? 1 - (1 - p) ** 2 : p ** 2);
}

export function rollStatusChance(ctx, chance, { advantage = false, disadvantage = false, stream = 'statusRecovery' } = {}) {
  const first = ctx.rng.int(stream, 1, 100);
  const rolls = [first];
  if (advantage !== disadvantage) rolls.push(ctx.rng.int(stream, 1, 100));
  const roll = advantage === disadvantage ? first : advantage ? Math.min(...rolls) : Math.max(...rolls);
  return { rolls, roll, chance, effectiveChance: effectiveChance(chance, { advantage, disadvantage }), success: roll <= chance };
}

/** Call after mandatory turn-start ticks. Owner cycle is entity-relative. */
export function recoverStatusesAtOwnerStart(ctx, entity, options = {}) {
  if (!enabled(ctx) || !entity?.alive) return [];
  const s = state(entity), cycle = options.cycle ?? entity.ownerTurnCount ?? ctx.turn ?? 0;
  if (s.lastRecoveryCycle === cycle) return [];
  s.ownerCycle = cycle; s.lastRecoveryCycle = cycle;
  s.resolveActive = !!s.resolveNextTurn; s.resolveNextTurn = false;
  s.completedActions = {};
  const cfg = rules(ctx), result = [];
  for (const [id, row] of Object.entries(cfg.statuses)) {
    const gauge = s.gauges[id];
    if (!row.chanceRecovery || (!stacks(entity, row.activeStatus) && !(gauge?.value > 0))) continue;
    const traits = entity.combatTraits || {};
    const profile = gauge?.recoveryProfile || row.profile;
    const advantage = !!(options.advantage || traits.recoveryAdvantage?.includes(profile) || (id === cfg.interactions.paralysis && stacks(entity, cfg.interactions.grounded)));
    const disadvantage = !!(options.disadvantage || traits.recoveryDisadvantage?.includes(profile) || (profile === 'bodily' && stacks(entity, cfg.interactions.offBalance)));
    const receipt = rollStatusChance(ctx, recoveryChance(ctx, entity, id, { ...options, profile }), { advantage, disadvantage });
    let removed = 0;
    if (receipt.success) {
      if (stacks(entity, row.activeStatus)) removed = clearActive(ctx, entity, row.activeStatus, 1);
      else { removed = gauge.value * cfg.recovery.pendingRemoval; gauge.value -= removed; }
    }
    const event = { status: id, ...receipt, removed, cycle };
    emit(ctx, 'statusRecoveryRolled', entity, event); result.push(event);
  }
  return result;
}

export function sleepRestoration(ctx, entity, options = {}) {
  if (!enabled(ctx) || !entity?.alive || entity.statusControl?.resolveActive) return { hp: 0, ward: 0 };
  const cfg = rules(ctx).sleep, count = stacks(entity, cfg.status);
  if (!count) return { hp: 0, ward: 0 };
  const s = state(entity);
  // A second caller in the same owner cycle cannot spend the budget again.
  if (s.lastSleepCycle === s.ownerCycle) return { hp: 0, ward: 0 };
  s.lastSleepCycle = s.ownerCycle;
  const percent = finite(options.modifierPercent ?? ctx.restorationModifierPercent?.(entity, 'hp', 'sleep'));
  const hp = Math.min(Math.max(0, entity.maxHp - entity.hp), Math.max(0, cfg.hpCombatCap - s.sleepHpRestored), Math.max(0, Math.floor(cfg.hpPerStack * count * (1 + percent / 100))));
  entity.hp += hp; s.sleepHpRestored += hp;
  if (hp) emit(ctx, 'healed', entity, { sourceId: entity.id, amount: hp, source: 'sleep' });
  const ward = restorePersistentWard(ctx, entity, 1, { source: 'sleep', ...(options.wardModifierPercent !== undefined ? { modifierPercent: options.wardModifierPercent } : {}) }).restored;
  return { hp, ward };
}

export function endControlTurn(ctx, entity, selectedId = null) {
  if (!enabled(ctx)) return { removed: 0, resolveNextTurn: false };
  const s = state(entity), gate = controlRestrictions(ctx, entity);
  let removed = 0;
  if (gate.locked) {
    const id = gate.locks.includes(selectedId) ? selectedId : gate.locks[0];
    removed = clearActive(ctx, entity, id, 1, 'wait');
    s.resolveNextTurn = true;
    emit(ctx, 'controlResolveScheduled', entity, { status: id });
  }
  s.resolveActive = false;
  return { removed, resolveNextTurn: s.resolveNextTurn };
}

export function consumeControlActionLoss(ctx, entity) {
  if (!enabled(ctx) || entity.statusControl?.resolveActive) return 0;
  const row = rules(ctx).frozen;
  return clearActive(ctx, entity, row.status, 1, 'actionDenied') ? row.actionLoss : 0;
}

export function statusIncomingModifier(ctx, entity, profile = {}) {
  if (!enabled(ctx)) return { percent: 0, evadeBonus: 0 };
  const cfg = rules(ctx); let percent = 0, evadeBonus = 0;
  if (!entity.statusControl?.resolveActive) percent += stacks(entity, cfg.sleep.status) * cfg.sleep.damagePercentPerStack;
  if (stacks(entity, cfg.prone.status)) {
    if (profile.reach === 'contact') percent += cfg.prone.contactPercent;
    else if (profile.targeting !== 'area' || profile.projectile) {
      percent += cfg.prone.rangedSinglePercent;
      if (profile.camp === 'physical' && ['near', 'far'].includes(profile.reach)) evadeBonus += profile.reach === 'far' ? cfg.prone.farEvade : cfg.prone.nearEvade;
    }
  }
  if (profile.damageType === 'blunt' && stacks(entity, cfg.interactions.chilled)) percent += cfg.interactions.chilledBluntPercent;
  return { percent, evadeBonus };
}

/** Must follow avoidance decision but precede received-damage modifiers. */
export function beforeStatusAction(ctx, target, profile = {}, { connected = true } = {}) {
  if (!enabled(ctx) || !connected) return;
  const cfg = rules(ctx).interactions;
  if (profile.containsFire || profile.school === 'fire' || profile.damageType === 'fire') {
    if (target.statusControl?.gauges[cfg.frostGauge]) target.statusControl.gauges[cfg.frostGauge].value = 0;
    for (const id of [cfg.frozen, cfg.chilled, cfg.frostGauge]) clearActive(ctx, target, id, Infinity, 'thawed');
  }
}

/** Root snapshots Counter restrictions before calling this final action hook. */
export function completeStatusAction(ctx, target, profile = {}, { connected = true, actionKey, damaging = true } = {}) {
  if (!enabled(ctx) || !connected || !damaging) return;
  if (actionKey === undefined || actionKey === null) throw new Error('Status action finalization requires actionKey');
  const s = state(target), key = String(actionKey);
  if (s.completedActions[key]) return;
  s.completedActions[key] = true;
  const cfg = rules(ctx);
  if (!s.resolveActive) clearActive(ctx, target, cfg.sleep.status, 1, 'woken');
  if (profile.containsBlunt || profile.damageType === 'blunt') {
    clearActive(ctx, target, cfg.interactions.frozen, 1, 'shattered');
    clearActive(ctx, target, cfg.interactions.chilled, 1, 'shattered');
  }
  if (profile.containsReveal || profile.maneuver === 'sweep' || profile.damageType === 'sacred' || profile.damageType === 'holy') {
    for (const id of [cfg.interactions.decoy, cfg.interactions.concealment]) clearActive(ctx, target, id, Infinity, 'revealed');
  }
}

export function groundStatusPressure(ctx, entity, { clearActiveStacks = false } = {}) {
  if (!enabled(ctx)) return;
  const id = rules(ctx).interactions.paralysis;
  if (entity.statusControl?.gauges[id]) entity.statusControl.gauges[id].value = 0;
  if (clearActiveStacks) clearActive(ctx, entity, id, Infinity, 'grounded');
}

export function electricalTraits(ctx, entity) {
  const grounded = enabled(ctx) && (stacks(entity, rules(ctx).interactions.grounded) > 0 || entity.combatTraits?.grounded === true);
  return { grounded, conductive: !grounded && entity.combatTraits?.conductive === true, insulated: entity.combatTraits?.insulated === true };
}

export function afterStatusGrant(ctx, entity, id) {
  if (enabled(ctx) && id === rules(ctx).interactions.grounded) groundStatusPressure(ctx, entity);
}
