import { wireframeUi } from '../../content/wireframeUi.js';
import { relicPropertyRules } from '../../model/registries.js';
import { resources as resourceTable } from '../../content/resources.js';
import { statuses as statusTable } from '../../content/statuses.js';
import { t, tFull, has } from '../strings.js';

// WC2a1–WC2c3 possession sub-variants. One poker canvas draws every possession
// card; this model decides which wireframe rows each of its regions carries,
// from the item's OWN data — the hand an armament is held in, its card
// package, its modifiers, a relic's passive keys and triggers, a potion's
// effect opcodes. It never switches on an item id, and a row the data cannot
// state is left off and noted in `omitted`, never filled with a guess.
//
// Families compose rather than exclude (CARD-CONSTRUCTION-CONTRACT): a relic
// with both passive modifiers and triggers is WC2b1 AND WC2b2; a potion whose
// effects heal and restore mana would be WC2c1 AND WC2c2.

const KINDS = Object.freeze(['equipment', 'relic', 'potion']);
const PURPOSE_FAMILY = Object.freeze({ healing: 'WC2c1', resource: 'WC2c2', utility: 'WC2c3' });

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
const unique = (list) => [...new Set(list)];
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
const line = (id, text, explanation, extra = {}) => ({ id, text, explanation: explanation || text, ...extra });
const copy = (id, tokens) => t(id, tokens);
const fullCopy = (id, tokens) => (has(id, 'full') ? tFull(id, tokens) : null);

function faceCount(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`possession: ${name} must be a positive whole number`);
  return value;
}

const resourceRow = (registries, id) => (registries?.resources?.all?.() || resourceTable)
  .find((row) => row.id === id || row.source === id) || null;
const statusName = (registries, id) => (registries?.statuses?.get?.(id) || statusTable.find((row) => row.id === id))?.name || null;
const restoredResource = (op) => {
  const match = /^restore([A-Z]\w*)$/.exec(op || '');
  return match ? match[1][0].toLowerCase() + match[1].slice(1) : null;
};

/** WC2a: armour and hand-held armaments are told apart by their own fields. */
export function equipmentKind(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.kind === 'armor' || (item.itemTypeTags || []).includes('item:armor')) return 'armor';
  // Every armament row authors the hand it is held in; armour has none.
  if (typeof item.hand === 'string' && item.hand) return 'weapon';
  return null;
}

/**
 * WC2b: passive, triggered, both — or neither, when nothing is authored.
 *
 * TWO HOMES, ONE QUESTION (plan phase 2). A relic's passives are its own; its
 * triggers are its property rules'. `registries` is what reaches the second,
 * and a caller without them sees only the passive half — which for a
 * triggers-only relic is "neither", so every caller inside the app passes them.
 */
export function relicEffectModes(relic, registries = null) {
  const passives = relic?.passives || {};
  const passive = (passives.modifiers || []).length > 0
    || Object.entries(passives).some(([key, value]) => key !== 'modifiers' && value != null && value !== false && value !== 0);
  const triggered = relicTriggers(relic, registries).length > 0;
  return Object.freeze([...(passive ? ['passive'] : []), ...(triggered ? ['triggered'] : [])]);
}

/** The triggers a relic fires, read from its property rules (and its own, pre-phase-2). */
export function relicTriggers(relic, registries = null) {
  const own = Array.isArray(relic?.triggers) ? relic.triggers : [];
  if (!registries || !relic) return own;
  const fromRules = relicPropertyRules(registries, relic)
    .flatMap((rule) => (Array.isArray(rule.triggers) ? rule.triggers : []));
  return [...own, ...fromRules];
}

function effectPurpose(effect, registries) {
  if (!effect?.op) return null; // a script is opaque: it states no purpose
  if (effect.op === 'heal') return 'healing';
  const resource = restoredResource(effect.op);
  if (resource && resourceRow(registries, resource)) return 'resource';
  return 'utility';
}

/** WC2c: each authored effect names its purpose by opcode, in authored order. */
export function consumablePurposes(flask, registries = null) {
  return Object.freeze(unique((flask?.effects || []).map((effect) => effectPurpose(effect, registries)).filter(Boolean)));
}

export function possessionVariant(registries, item, { kind, bonuses = [], attributeRequirement = null, charges = null } = {}, config = wireframeUi.possession) {
  if (!KINDS.includes(kind)) throw new Error(`possession: unknown kind '${kind}'`);
  const face = { lines: faceCount(config?.faceLines, 'faceLines'), effects: faceCount(config?.faceEffects, 'faceEffects') };
  const omitted = [];
  const omit = (id, reason, part = null) => omitted.push({ id, part, reason });
  const rows = kind === 'equipment' ? equipmentRows(registries, item, { bonuses, attributeRequirement }, omit)
    : kind === 'relic' ? relicRows(registries, item, omit)
      : consumableRows(registries, item, { charges }, omit);
  return deepFreeze({ usage: null, requirement: null, lines: null, entries: null, empty: null, ...rows, omitted, face });
}

function equipmentRows(registries, item, { bonuses, attributeRequirement }, omit) {
  const variant = equipmentKind(item);
  omit('WC2a.body.detail2', 'Equipped comparison needs the live loadout; the card face has none (the Armoury compares beside the card).');
  const mods = bonuses.map((bonus) => ({ label: bonus.label, explanation: bonus.explanation }));
  if (variant === 'weapon') {
    const handId = `possession.hand.${item.hand}`;
    const hand = has(handId) ? copy(handId) : null;
    if (!hand) omit('WC2a1.body.detail2', `No label is authored for hand '${item.hand}'.`, 'hand');
    // Row one holds one of the two at a 280 px card: the authored attribute
    // requirement when there is one, otherwise the hand.
    else if (attributeRequirement) omit('WC2a1.body.detail2', `The hand (${hand}) gives way to the authored attribute requirement on row one.`, 'hand');
    omit('WC2a1.body.detail1', 'No per-weapon attribute scaling is authored; the row shows intrinsic Attack, Defense and Weight.', 'scaling');
    const art = [];
    const artIds = item.weaponCardPackage?.weaponArtDefaults || [];
    if (!item.weaponCardPackage) omit('WC2a1.body.detail3', 'No card package is authored for this armament.', 'weapon art');
    for (const cardId of artIds) {
      const name = registries?.cards?.get?.(cardId)?.name;
      if (!name) { omit('WC2a1.body.detail3', `Weapon art card '${cardId}' has no registered name.`, 'weapon art'); continue; }
      art.push({ label: copy('possession.package.art', { name }), explanation: fullCopy('possession.package.art', { name }) });
    }
    return {
      families: ['WC2', 'WC2a', 'WC2a1'],
      requirement: attributeRequirement || hand || null,
      heading: copy('possession.effects.package'), entries: [...art, ...mods], empty: copy('possession.package.none'),
      regions: { type: ['WC2a.body.detail1', 'WC2a1.body.detail2'], facts: ['WC2a1.body.detail1'], effects: ['WC2a1.body.detail3'] },
    };
  }
  if (variant === 'armor') {
    omit('WC2a2.body.detail1', 'No armour defense or resistance values are authored; the row shows the authored Poise threshold.', 'resistance');
    omit('WC2a2.body.detail2', 'No armour weight is authored; the row shows the class-outfit requirement.', 'weight');
    return {
      families: ['WC2', 'WC2a', 'WC2a2'],
      heading: copy('possession.effects.modifiers'), entries: mods, empty: copy('possession.modifiers.none'),
      regions: { type: ['WC2a.body.detail1', 'WC2a2.body.detail2'], facts: ['WC2a2.body.detail1'], effects: ['WC2a2.body.detail3'] },
    };
  }
  omit('WC2a', 'Neither an armour kind nor an authored hand: no sub-variant attaches.');
  return { families: ['WC2', 'WC2a'], heading: null, entries: mods, regions: { type: ['WC2a.body.detail1'], facts: [], effects: [] } };
}

function passiveSummary(registries, passives, omit) {
  const values = [];
  const stats = [];
  // Every declared relic-modifier tag (schemas.js RELIC_MODIFIER_TAGS) is named
  // here; an unknown one is noted, never silently dropped.
  for (const mod of passives.modifiers || []) {
    if (mod?.tag === 'resource.attributeTier') {
      const resource = resourceRow(registries, mod.resource);
      if (!resource) { omit('WC2b1.body.detail1', `Unknown resource '${mod.resource}'.`, mod.tag); continue; }
      stats.push(resource.name);
      const attribute = registries?.attributes?.get?.(mod.sourceStat)?.shortLabel;
      // An unstated tier size inherits the host rule; the card does not guess it.
      if (Number.isFinite(mod.amountPerTier) && Number.isFinite(mod.pointsPerTier) && attribute) {
        values.push(copy('possession.relic.resourceTier', { resource: resource.name, amount: signed(mod.amountPerTier), points: mod.pointsPerTier, attribute }));
      } else {
        omit('WC2b1.body.detail1', `The ${resource.name} tier grant states no tier size or attribute label the card can show.`, mod.tag);
      }
      continue;
    }
    if (!Number.isFinite(mod?.amount)) { omit('WC2b1.body.detail1', `Modifier '${mod?.tag}' has no numeric amount.`, mod?.tag || null); continue; }
    if (mod.tag === 'resource.flat') {
      const resource = resourceRow(registries, mod.resource);
      if (!resource) { omit('WC2b1.body.detail1', `Unknown resource '${mod.resource}'.`, mod.tag); continue; }
      values.push(copy('possession.relic.maxResource', { resource: resource.name, amount: signed(mod.amount) }));
      stats.push(resource.name);
    } else if (mod.tag === 'damage.school.flat' && has(`possession.school.${mod.school}`)) {
      const school = copy(`possession.school.${mod.school}`);
      values.push(copy('possession.relic.schoolDamage', { school, amount: signed(mod.amount) }));
      stats.push(copy('possession.relic.schoolStat', { school }));
    } else {
      omit('WC2b1.body.detail1', `No label is authored for modifier '${mod.tag}'${mod.school ? ` (${mod.school})` : ''}.`, mod.tag);
    }
  }
  for (const [key, value] of Object.entries(passives)) {
    if (key === 'modifiers' || value == null || value === false || value === 0) continue;
    const id = `possession.stat.${key}`;
    if (!has(id)) { omit('WC2b1.body.detail2', `No label is authored for passive key '${key}'.`, key); continue; }
    const stat = copy(id);
    stats.push(stat);
    // A number is stated as authored; a flag is a statement the effect row makes.
    if (typeof value === 'number') values.push(`${stat} ${/Mult$/.test(key) ? `×${value}` : /Reduction$/.test(key) ? `−${value}` : signed(value)}`);
  }
  return { values: unique(values), stats: unique(stats) };
}

function triggerGate(trigger) {
  const gates = [];
  if (trigger.once) gates.push(copy('possession.limit.once'));
  if (Number.isInteger(trigger.limitPerTurn)) gates.push(copy('possession.limit.perTurn', { count: trigger.limitPerTurn }));
  return gates.length ? gates.join(' · ') : copy('possession.limit.none');
}

function relicRows(registries, relic, omit) {
  const modes = relicEffectModes(relic, registries);
  const families = ['WC2', 'WC2b'];
  const first = [];
  const second = [];
  if (modes.includes('passive')) {
    families.push('WC2b1');
    const { values, stats } = passiveSummary(registries, relic.passives || {}, omit);
    if (values.length) first.push(line('WC2b1.body.detail1', copy('possession.relic.passive', { list: values.join(' · ') }), fullCopy('possession.relic.passive', {})));
    else omit('WC2b1.body.detail1', 'The passive keys carry no number to state; the relic effect row states them.');
    if (stats.length) second.push(line('WC2b1.body.detail2', copy('possession.relic.affects', { list: stats.join(' · ') }), fullCopy('possession.relic.affects', {})));
  }
  if (modes.includes('triggered')) {
    families.push('WC2b2');
    const triggers = relicTriggers(relic, registries);
    const label = (on) => (has(`possession.trigger.${on}`) ? copy(`possession.trigger.${on}`) : null);
    for (const on of unique(triggers.map((trigger) => trigger.on)).filter((on) => !label(on))) {
      omit('WC2b2.body.detail1', `No label is authored for trigger event '${on}'.`, on);
    }
    const events = unique(triggers.map((trigger) => label(trigger.on)).filter(Boolean));
    if (events.length) first.push(line('WC2b2.body.detail1', copy('possession.relic.trigger', { list: events.join(' · ') }), fullCopy('possession.relic.trigger', {})));
    // One gate for every trigger reads once; differing gates are paired with their events.
    const gates = triggers.map(triggerGate);
    const limit = unique(gates).length === 1 ? gates[0]
      : unique(triggers.map((trigger, index) => `${label(trigger.on) || trigger.on}: ${gates[index]}`)).join(' · ');
    second.push(line('WC2b2.body.detail2', copy('possession.relic.limit', { list: limit }), fullCopy('possession.relic.limit', {})));
    omit('WC2b2.body.detail2', 'The trigger DSL authors no cooldown; the effect itself is the relic effect row.', 'cooldown');
  }
  if (!modes.length) omit('WC2b', 'Neither passive modifiers nor triggers are authored: no sub-variant attaches.');
  const lines = [...first, ...second];
  return {
    families,
    usage: modes.length ? modes.map((mode) => copy(`possession.mode.${mode}`)).join(' · ') : null,
    lines, heading: copy('possession.effects.relic'),
    regions: { type: ['WC2b.body.detail2'], facts: lines.map((row) => row.id), effects: ['WC2b.body.detail1'] },
  };
}

function healingLine(effect) {
  const amount = effect.amount;
  if (Number.isFinite(amount)) return { text: copy('possession.heal.flat', { amount }), explanation: fullCopy('possession.heal.flat', { amount }) };
  if (amount?.f === 'percentMaxHp' && Number.isFinite(amount.pct)) {
    return { text: copy('possession.heal.percent', { pct: amount.pct }), explanation: fullCopy('possession.heal.percent', { pct: amount.pct }) };
  }
  return null;
}

function resourceLine(registries, effect) {
  const resource = resourceRow(registries, restoredResource(effect.op));
  if (!resource || !Number.isFinite(effect.amount)) return null;
  const tokens = { amount: effect.amount, resource: resource.name };
  // WC2c2: the resource's registered tint, never a generic success colour.
  return { text: copy('possession.resource.restore', tokens), explanation: fullCopy('possession.resource.restore', tokens), extra: { tint: resource.tint, resource: resource.id } };
}

function utilityLine(registries, flask, effect) {
  let what = null;
  if (effect.op === 'applyStatus') {
    const name = statusName(registries, effect.status);
    if (name) what = Number.isFinite(effect.stacks) ? copy('possession.utility.status', { status: name, stacks: effect.stacks }) : name;
  } else if (effect.op === 'block' && Number.isFinite(effect.amount)) {
    what = copy('possession.utility.block', { amount: effect.amount });
  }
  if (!what) return null;
  const targetId = `possession.target.${effect.target || (flask.targeted ? 'enemy' : '')}`;
  const target = has(targetId) ? copy(targetId) : null;
  const text = target ? copy('possession.utility.line', { effect: what, target }) : what;
  return { text, explanation: fullCopy('possession.utility.line', {}) || text };
}

function consumableRows(registries, flask, { charges }, omit) {
  const families = ['WC2', 'WC2c'];
  const first = [];
  for (const effect of flask?.effects || []) {
    const purpose = effectPurpose(effect, registries);
    if (!purpose) { omit('WC2c', 'A scripted effect states no purpose; only its use-effect text shows.'); continue; }
    const family = PURPOSE_FAMILY[purpose];
    if (!families.includes(family)) families.push(family);
    const row = purpose === 'healing' ? healingLine(effect) : purpose === 'resource' ? resourceLine(registries, effect) : utilityLine(registries, flask, effect);
    if (row) first.push(line(`${family}.body.detail1`, row.text, row.explanation, row.extra));
    else omit(`${family}.body.detail1`, `Effect '${effect.op}' has no amount or name the card can state.`);
  }
  const specific = families.slice(2);
  if (specific.includes('WC2c1')) omit('WC2c1.body.detail1', 'A live, capped heal preview needs the holder\'s HP; no card host supplies it, so the authored base amount shows.', 'cap');
  const chargeRow = specific.length ? `${specific[0]}.body.detail2` : 'WC2c.body.detail1';
  const second = [];
  if (Number.isInteger(charges) && charges >= 0) {
    second.push(line(chargeRow, copy('possession.charges', { count: charges }), fullCopy('possession.charges', { count: charges })));
  } else {
    omit(chargeRow, 'The host supplied no charge count; the footer states the owned count when it knows it.');
  }
  const lines = [...first, ...second];
  return {
    families,
    usage: specific.length ? specific.map((family) => copy(`possession.purpose.${Object.keys(PURPOSE_FAMILY).find((key) => PURPOSE_FAMILY[key] === family)}`)).join(' · ') : null,
    lines, heading: copy('possession.effects.use'),
    regions: { type: ['WC2c.body.detail2'], facts: lines.map((row) => row.id), effects: ['WC2c.body.detail2'] },
  };
}
