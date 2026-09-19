// src/engine/locations.js — the location visit: a place's rules mounted from
// arrival to departure (plan phase 7, proposal §7.4)
//
// The classic shrine used to be two helpers and a screen that knew the
// numbers: `shrineHealAmount` (35% × a relic multiplier), `applyGraceRefill`
// called on arrival, and `run.mana = run.maxMana` written by the Rest button.
// A town, a chapel or a camp would each have been another helper. Now a
// location is a CARRIER (model/locations.js): its tags' rules mount on the
// run-level context, `arrived` is emitted when the run reaches it and
// `rested` when the player takes its Rest, and the pools move through the
// same opcode bodies a fight uses (heal, restoreMana, refillFlasks). What a
// place restores is the sum of its tags — content, not code.
//
// THE VISIT IS THE WINDOW. createLocationVisit mounts; leaveLocation
// unmounts. Between them the run may pass through other doors (a level
// point assigned, a flask charge moved), so every emission re-reads the run
// into the facade first (syncRunContext) and writes back after the queue
// drains. previewRest runs the same rules on a clone, so the screen's
// "Heal N HP" line and the button that heals read one answer.
//
// Headless: no document/window/localStorage/timers.

import { createRunContext, syncRunContext, drainRunContext } from './actions.js';
import { emitEvent } from './triggers.js';
import { mountProperties, unmountProperties } from './properties.js';
import { passiveMult } from '../model/registries.js';
import { createRng } from './rng.js';
import { locationTags, locationRestTags, locationServices, restDeniedBy } from '../model/locations.js';

const OWNER_KEY = 'player';

/**
 * locationCarrier(registries, locationId) → the carrier a location presents:
 * its tagging rows with `restMana` resolved to the configured mode's tag.
 * Throws, by name, for an id tagging.csv does not name.
 */
export function locationCarrier(registries, locationId) {
  const authored = locationTags(registries, locationId);
  if (!authored.length) throw new Error(`Location '${locationId}' carries no tags — add its rows to content/source/tagging.csv (family location)`);
  const tagIds = locationRestTags(registries, authored);
  return { kind: 'location', id: locationId, instanceId: locationId, ownerKey: OWNER_KEY, tagIds };
}

/**
 * createLocationVisit({ run, registries, rng }, locationId, opts) → visit.
 *   opts.healMult      the custom mod's heal scale (1 when none)
 *   opts.refillCounts  the grace-refill counts the settings resolved, if any
 * The visit's rules are mounted on creation; nothing is emitted until
 * arriveAt. `restDenied` names the relic forbidding the Rest here, or null.
 */
export function createLocationVisit({ run, registries, rng }, locationId, { healMult = 1, refillCounts = null } = {}) {
  const carrier = locationCarrier(registries, locationId);
  const mult = healMult * passiveMult(registries, run.relics || [], 'restHealMult');
  const ctx = createRunContext({ run, registries, rng }, {
    healMult: mult,
    refillOpts: refillCounts ? { counts: refillCounts } : {},
  });
  mountProperties(ctx, carrier);
  return {
    locationId,
    carrier,
    tags: [...carrier.tagIds],
    services: locationServices(registries, carrier.tagIds),
    restDenied: restDeniedBy(registries, run, carrier.tagIds),
    opts: { healMult, refillCounts },
    ctx,
    arrived: false,
    rested: false,
    refill: null,
  };
}

function emitAndDrain(visit, type) {
  const { ctx } = visit;
  syncRunContext(ctx);
  const from = ctx.eventLog.length;
  emitEvent(ctx, type, { locationId: visit.locationId });
  drainRunContext(ctx);
  return ctx.eventLog.slice(from);
}

/**
 * arriveAt(visit) → { events, refill }. Emits `arrived` ONCE per visit — a
 * second call answers with the first arrival's receipt and fires nothing,
 * so a screen that re-mounts cannot fire an arrival rule twice. The
 * `restFlasks` rule's refill receipt (engine/encounters.js applyGraceRefill's
 * plan) rides back for the screen's refill line, null when the place refills
 * nothing; it is kept on `visit.refill`.
 */
export function arriveAt(visit) {
  if (visit.arrived) return { events: [], refill: visit.refill };
  delete visit.ctx.receipts.refill;
  const events = emitAndDrain(visit, 'arrived');
  visit.arrived = true;
  visit.refill = visit.ctx.receipts.refill || null;
  return { events, refill: visit.refill };
}

/**
 * restAt(visit) → { heal, mana, hp, maxHp, manaAfter, events }. Emits
 * `rested`; refuses, by relic name, a Rest the run's relics deny.
 */
export function restAt(visit) {
  if (visit.restDenied) throw new Error(`Rest at '${visit.locationId}' is denied by relic '${visit.restDenied}'`);
  const { run } = visit.ctx;
  const before = { hp: run.hp, mana: run.mana };
  const events = emitAndDrain(visit, 'rested');
  visit.rested = true;
  return { heal: run.hp - before.hp, mana: run.mana - before.mana, hp: run.hp, maxHp: run.maxHp, manaAfter: run.mana, events };
}

/**
 * previewRest(visit) → what restAt would do, on a clone of the run: the same
 * rules, the same multipliers, no write. The screen's line and the button
 * that heals read this one answer.
 */
export function previewRest(visit) {
  const { registries, rng } = visit.ctx;
  const clone = structuredClone(visit.ctx.run);
  // The dry run rolls on a COPY of the streams (same seed, same counters), so
  // a preview — or a screen re-mounting — advances nothing the real rest
  // will read, and the two agree when a rule happens to roll.
  const dryRng = rng && typeof rng.getCounters === 'function' ? createRng(rng.seed, rng.getCounters()) : rng;
  const dry = createLocationVisit({ run: clone, registries, rng: dryRng }, visit.locationId, visit.opts);
  dry.restDenied = null;
  const receipt = restAt(dry);
  leaveLocation(dry);
  return receipt;
}

/** leaveLocation(visit) → true if the mount was removed. The window closes. */
export function leaveLocation(visit) {
  return unmountProperties(visit.ctx, visit.carrier);
}
