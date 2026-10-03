// src/model/sigils.js — the run's sigil inventory (SPEC §14.3), headless.
//
// Two fields, both added at §14.6 step 5 (schema 15):
//
//   run.sigils      string[]                         owned sigils not installed
//   run.sigilSlots  { [itemRef]: (sigilId|null)[] }  slots cut into items, keyed
//                                                    like itemMounts
//
// The market sells into `sigils` (model/marketAdditions.js); the blacksmith
// cuts slots and installs sigils into them (§14.4, step 6), and a sigil works
// only while installed in a slot of an equipped armament. Selling or
// unequipping the piece keeps its slot record, as §12.2 keeps mounts.
// Legendary sigils (§15.4) stay in `sigils` and are attuned, never slotted;
// `run.attunedSigils` (schema 19) names the attuned ones, below.

import { uiStrings } from '../content/generated/uiStrings.js';
import { resolveVariable } from './tree.js';

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// A refusal's sentence is its uiStrings row (the rule model/consumables.js keeps).
function say(id, tokens = {}) {
  const text = uiStrings.find((row) => row.id === id)?.short;
  if (!text) throw new Error(`uiStrings: '${id}' has no short form`);
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    if (!Object.hasOwn(tokens, key)) throw new Error(`uiStrings: '${id}.short' wants {${key}}`);
    return String(tokens[key]);
  });
}

/**
 * sigilInventoryProblems(run) → the shape of both fields, refused by name
 * (validateRunShape). Registry-free: that a saved id names a sigil this build
 * knows is the load door's question (engine/save.js).
 */
export function sigilInventoryProblems(run) {
  const problems = [];
  if (run.sigils !== undefined && run.sigils !== null) {
    if (!Array.isArray(run.sigils)) problems.push('sigils must be a list of sigil ids');
    else run.sigils.forEach((id, index) => { if (typeof id !== 'string' || !id) problems.push(`sigils[${index}] must be a non-empty sigil id`); });
  }
  if (run.sigilSlots !== undefined && run.sigilSlots !== null) {
    if (!object(run.sigilSlots)) problems.push('sigilSlots must be an object { [itemRef]: (sigilId|null)[] }');
    else {
      for (const [itemRef, slots] of Object.entries(run.sigilSlots)) {
        if (!Array.isArray(slots)) { problems.push(`sigilSlots['${itemRef}'] must be a list of slots (a sigil id or null)`); continue; }
        slots.forEach((slot, index) => {
          if (slot !== null && (typeof slot !== 'string' || !slot)) problems.push(`sigilSlots['${itemRef}'][${index}] must be a sigil id or null`);
        });
      }
    }
  }
  return problems;
}

/** Every sigil id the run holds: carried, or sitting in a slot. */
export function ownedSigilIds(run) {
  const slotted = Object.values(object(run.sigilSlots) ? run.sigilSlots : {}).flatMap((slots) => (Array.isArray(slots) ? slots : []));
  return [...(Array.isArray(run.sigils) ? run.sigils : []), ...slotted.filter((id) => typeof id === 'string' && id)];
}

/** The first saved sigil id the registries do not know, or null (the load door archives on one). */
export function unknownSigilId(registries, run) {
  return ownedSigilIds(run).find((id) => !registries.sigils.has(id)) || null;
}

// ---------------------------------------------------------------------------
// Legendary sigils (SPEC §15.4, the shapes of #1439)
// ---------------------------------------------------------------------------
//
// `run.attunedSigils: string[]` names the legendaries the run holds ATTUNED, a
// subset of `run.sigils`. An attuned legendary works in every fight (it
// mounts as a `sigil` carrier, engine/properties.js syncSigilProperties); it
// needs no slot and no equipped armament. At most `balance.sigils.attuneMax`
// are attuned at once, chosen in the Armoury's Sigils panel out of combat.

const ATTUNE_KEY = 'gameConfig.balance.sigils.attuneMax';
const isLegendary = (registries, id) => typeof id === 'string' && registries.sigils.has(id) && registries.sigils.get(id).rarity === 'legendary';
const nameOf = (registries, id) => (registries.sigils.has(id) ? registries.sigils.get(id).name : id);

/** The run's attuned ids (an absent field reads as none). */
export function attunedSigilIds(run) {
  return Array.isArray(run && run.attunedSigils) ? run.attunedSigils : [];
}

/** Every legendary sigil the registries hold, in authored order. */
export function legendarySigilIds(registries) {
  return registries.sigils.all().filter((def) => def.rarity === 'legendary').map((def) => def.id);
}

/** How many legendaries the run may hold attuned at once (the configured registries'). */
export function attuneMaxOf(registries) {
  const value = registries.balance && registries.balance.sigils ? registries.balance.sigils.attuneMax : 0;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * The run's OWN frozen attuneMax: its `advancedConfigSnapshot` override when
 * it carries one, else the registries'. The load door reads this, because its
 * first pass runs on the authored registries and must not refuse a run whose
 * Settings row was raised (SPEC §15.4, the field).
 */
export function runAttuneMax(registries, run) {
  const override = run && run.advancedConfigSnapshot && run.advancedConfigSnapshot.overrides
    ? run.advancedConfigSnapshot.overrides[ATTUNE_KEY] : undefined;
  return Number.isSafeInteger(override) && override >= 0 ? override : attuneMaxOf(registries);
}

/** `run.attunedSigils`'s shape, registry-free (validateRunShape). */
export function attunedSigilProblems(run) {
  const problems = [];
  if (run.attunedSigils === undefined || run.attunedSigils === null) return problems;
  if (!Array.isArray(run.attunedSigils)) return ['attunedSigils must be a list of sigil ids'];
  const carried = new Set(Array.isArray(run.sigils) ? run.sigils : []);
  const seen = new Set();
  run.attunedSigils.forEach((id, index) => {
    if (typeof id !== 'string' || !id) { problems.push(`attunedSigils[${index}] must be a non-empty sigil id`); return; }
    if (seen.has(id)) problems.push(`attunedSigils names '${id}' twice`);
    seen.add(id);
    if (!carried.has(id)) problems.push(`attunedSigils names '${id}', which is not in sigils (an attuned sigil stays carried)`);
  });
  return problems;
}

/**
 * sigilRarityProblems(registries, run) → SPEC §15.4's "rarity at every door".
 * Every persisted sigil-id position is in one class:
 *   legendary only  run.attunedSigils, combatEntered.snapshot.attunedSigils,
 *                   pendingReward.rewards.sigilId
 *   never legendary run.sigilSlots, combatEntered.snapshot.sigilSlots,
 *                   shopStock.sigils, journey.serviceStates[*].stock.sigils
 *   either          run.sigils (the inventory)
 * and the attuned list fits the run's own attuneMax and is what a fight in
 * progress carries. A position added later is assigned a class here. Both
 * restore doors read it: engine/save.js loadRun and tools/session.mjs's
 * member restore.
 */
export function sigilRarityProblems(registries, run) {
  const problems = [];
  const attuned = attunedSigilIds(run);
  for (const id of attuned) {
    if (registries.sigils.has(id) && !isLegendary(registries, id)) problems.push(`attunedSigils names '${id}', which is not a legendary sigil`);
  }
  const max = runAttuneMax(registries, run);
  if (attuned.length > max) problems.push(`attunedSigils holds ${attuned.length}, more than the run's attuneMax of ${max}`);
  // NEVER LEGENDARY: every slot list (the run's and a fight's) and every
  // market sigil shelf (the open visit's and each atlas point's saved stock).
  const snapshot = run.combatEntered && run.combatEntered.snapshot;
  const slotLists = [['sigilSlots', run.sigilSlots], ['combatEntered.snapshot.sigilSlots', snapshot && snapshot.sigilSlots]];
  for (const [path, record] of slotLists) {
    for (const [itemRef, slots] of Object.entries(object(record) ? record : {})) {
      for (const id of Array.isArray(slots) ? slots : []) {
        if (isLegendary(registries, id)) problems.push(`${path}['${itemRef}'] holds '${id}', a legendary sigil, which is attuned and never slotted`);
      }
    }
  }
  const shelves = [['shopStock.sigils', run.shopStock],
    ...Object.entries((run.journey && object(run.journey.serviceStates)) ? run.journey.serviceStates : {}).map(([pointId, state]) => [`journey.serviceStates.${pointId}.stock.sigils`, state && state.stock])];
  for (const [path, stock] of shelves) {
    for (const offer of stock && Array.isArray(stock.sigils) ? stock.sigils : []) {
      if (offer && isLegendary(registries, offer.id)) problems.push(`${path} offers '${offer.id}', a legendary sigil, which is never shop stock`);
    }
  }
  // LEGENDARY ONLY: a fight in progress's attuned list, which must also be
  // the run's own (attunement cannot change mid-fight).
  if (snapshot && typeof snapshot === 'object') {
    const fought = Array.isArray(snapshot.attunedSigils) ? snapshot.attunedSigils : [];
    for (const id of fought) {
      if (!isLegendary(registries, id)) problems.push(`combatEntered.snapshot.attunedSigils names '${id}', which is not a known legendary sigil`);
    }
    if (fought.length !== attuned.length || fought.some((id, i) => id !== attuned[i])) {
      problems.push(`combatEntered.snapshot.attunedSigils (${JSON.stringify(fought)}) is not the run's attunedSigils (${JSON.stringify(attuned)}): attunement cannot change mid-fight`);
    }
  }
  const reward = run.pendingReward && run.pendingReward.rewards;
  if (reward && reward.sigilId !== undefined && reward.sigilId !== null && !isLegendary(registries, reward.sigilId)) {
    problems.push(`pendingReward.rewards.sigilId '${reward.sigilId}' is not a known legendary sigil`);
  }
  return problems;
}

const refusal = (reason) => ({ ok: false, reason });
const granted = () => ({ ok: true, reason: '' });

/**
 * attuneSigil(registries, run, id) → { ok, reason }. Attunes one owned
 * legendary, refusing by name an unknown or uncarried id, a non-legendary, one
 * already attuned, and one past attuneMax. Changes the run only when ok.
 */
export function attuneSigil(registries, run, id) {
  if (!registries.sigils.has(id)) return refusal(say('sigils.refuse.unknown', { id: String(id) }));
  const name = nameOf(registries, id);
  if (!(Array.isArray(run.sigils) && run.sigils.includes(id))) return refusal(say('sigils.refuse.notCarried', { name }));
  if (!isLegendary(registries, id)) return refusal(say('sigils.refuse.notLegendary', { name }));
  const attuned = attunedSigilIds(run);
  if (attuned.includes(id)) return refusal(say('sigils.refuse.already', { name }));
  const max = attuneMaxOf(registries);
  if (attuned.length >= max) return refusal(say('sigils.refuse.full', { name, max }));
  run.attunedSigils = [...attuned, id];
  return granted();
}

/** unattuneSigil(run, id) → { ok, reason }. Refuses an id that is not attuned. */
export function unattuneSigil(run, id) {
  const attuned = attunedSigilIds(run);
  if (!attuned.includes(id)) return refusal(say('sigils.refuse.notAttuned', { id: String(id) }));
  run.attunedSigils = attuned.filter((other) => other !== id);
  return granted();
}

// ---- the drop ---------------------------------------------------------------

/** The legendaries a drop may give: those the run does not own, in authored order. */
export function sigilDropPool(registries, run) {
  const owned = new Set([...ownedSigilIds(run), ...attunedSigilIds(run)]);
  return legendarySigilIds(registries).filter((id) => !owned.has(id));
}

/**
 * rollSigilDrop(registries, rng, run, pool) → a legendary id, or null.
 * `pool` is 'normal' | 'elite' | 'boss' | 'treasure'. A chance of 0, or an
 * empty pool, returns null and draws nothing; 100 makes no chance draw;
 * between them one `rng.chance('sigils', pct)`. Then one `rng.pick('sigils')`.
 */
export function rollSigilDrop(registries, rng, run, pool) {
  const chances = registries.balance && registries.balance.sigils ? registries.balance.sigils.dropChancePct : null;
  const pct = chances && Number.isFinite(chances[pool]) ? Math.max(0, Math.min(100, chances[pool])) : 0;
  if (pct <= 0) return null;
  const ids = sigilDropPool(registries, run);
  if (!ids.length) return null;
  if (pct < 100 && !rng.chance('sigils', pct)) return null;
  return rng.pick('sigils', ids);
}

/**
 * sigilRuleText(registries, id) → the sentence a sigil's property says
 * (nodeTerms.csv), its numbers read from the configured balance, or ''.
 */
export function sigilRuleText(registries, id) {
  const def = registries.sigils.has(id) ? registries.sigils.get(id) : null;
  const tag = def && Array.isArray(def.propertyTags) ? def.propertyTags[0] : null;
  const row = tag ? (registries.nodeTerms || []).find((term) => term.nodeId === tag) : null;
  if (!row || !row.template) return '';
  return row.template.replace(/\{(\w+)\}/g, (match, variable) => {
    const value = resolveVariable(registries, tag, variable);
    return Number.isFinite(value) ? String(value) : match;
  });
}
