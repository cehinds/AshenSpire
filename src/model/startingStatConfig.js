import { presetGearProblems } from './attributes.js';
import { ratingIds } from './ratingFormula.js';
import { deriveStat, resolveDerivedStatRules } from './derivedStats.js';
import { ownKey } from './settingOverrides.js';

const PREFIX = 'gameConfig.startingStats.';
// A pool that shares a rating's name is labelled as a pool so the two rows
// cannot read alike.
const RATING_NAMES = ratingIds;
const REQUIREMENT_PREFIX = 'gameConfig.equipmentRequirements.';
const TOTAL_MAX = 495;

// ---- ONE DRIVER FOR STARTING STATS (owner, 2026-09-20) ---------------------
//
// He had four dials for one idea: a "starting stat pool" per creation mode
// (three near-identical rows, two of them for modes no player can pick), a
// per-class attribute table in a separate tab, "Stat points per tier" filed
// under Assign points, and "Level-up value" under Progression. In his words:
// "changing class defaults and starting stats seem to be in multiple menus
// instead of having just one driver."
//
// So the pool is now A HANDFUL OF NUMBERS IN HIS WORDS, on the mode creation
// actually offers. The keys are unchanged (`…<modeId>.total`), but the row's
// FLOOR is not: it moved from the attribute count to the kit floor, so an older
// export carrying a smaller total is clamped to that floor with a named notice
// — see `raisedFloor` below and `parseAdvancedConfigFile`. The rest of the file
// still imports; before that, one stale total refused every other setting in it.
//
// ---- THE REFRAME (owner, 2026-09-20, second pass) --------------------------
//
// "I'd like the default stats to be low, with everyone having a total pool of
// points starting off. the default stat for each stat is 1 and assign allows a
// user to assign 3 points … Also, I'd like to have more stat customization
// options in general to be able to make this change in the settings."
//
// The shipped default is now the `lean` mode (content/attributes.js) and the
// topic is stated the way he states it — THE BASELINE IS THE FIRST NUMBER,
// because it is the one he named first and the one he wanted to type:
//
//   Starting value for every attribute   `…<modeId>.baseline`       (new)
//   Points available to assign           `…<modeId>.bonusPool`
//   Total points on a character          `…<modeId>.total`
//   Lowest a stat may be set to          `…<modeId>.minimum`        (new)
//   Highest a stat may be set to         `…<modeId>.maximum`        (new)
//   Points may be taken back off a stat  `…<modeId>.belowBaseline`  (new)
//
// BASELINE AND TOTAL ARE THE SAME FACT SAID TWO WAYS, so one of them has to
// win or the pair is a coin toss. The baseline wins WHEN IT IS SET: total is
// then `baseline × attributes + points available`, which is the arithmetic in
// his sentence. With no baseline typed, the total drives and the baseline is
// derived from it exactly as it always was — every configuration exported
// before this reframe therefore resolves to the same numbers it always did.
//
// EQUIPMENT REQUIREMENTS BELONG TO THIS TOPIC TOO, and that is why they are in
// this file rather than a new one. They are already the FLOOR under every dial
// here (`kitAttributeMinimums`): the total cannot go below what the starting
// kits ask for, so a stat scale and the numbers gating equipment are one
// question. `equipmentRequirementRows` puts each authored minimum on screen
// beside the scale that has to clear it, plus one multiplier for the whole
// table — his "across the board".

/**
 * kitAttributeMinimums(bundle) → { [classId]: { [attributeId]: {minimum, itemId, kit} } }
 *
 * THE FLOOR THAT WAS NEVER READ, and the root cause of "the new game assign
 * and standard loadout don't seem to change on a new game despite having the
 * values change in the settings". `validateContent` refuses a preset that
 * cannot hold the kit its class starts in (validate.js, "the preset cannot
 * hold the kit it starts in"), but the pool row's domain knew nothing about
 * equipment: setting the pool to 8 scaled every preset down to 1–2, the whole
 * configured bundle failed validation, and `rebuildRegistries` fell back to
 * AUTHORED DEFAULTS — silently dropping every other value he had tuned.
 *
 * Reading the same table the validator reads is what lets the dial be bounded
 * at entry and the redistribution keep each class wearing its own kit.
 */
export function kitAttributeMinimums(bundle) {
  const kits = bundle?.equipment?.startingKits || [];
  const requirements = bundle?.equipment?.equipmentRequirements || [];
  const byClass = {};
  for (const kit of kits) {
    if (!kit?.baseline || !kit.classId) continue;
    const need = byClass[kit.classId] ||= {};
    for (const itemId of [kit.rightHand, kit.leftHand].filter(Boolean)) {
      for (const row of requirements) {
        if (row?.itemId !== itemId || !Number.isInteger(row.minimum) || row.minimum <= 0) continue;
        if (!need[row.attributeId] || need[row.attributeId].minimum < row.minimum) {
          need[row.attributeId] = { minimum: row.minimum, itemId, kit: kit.label || kit.id };
        }
      }
    }
  }
  return byClass;
}

/** The kit minimum for one class/attribute, as a plain number (0 when free). */
export function kitMinimum(needs, classId, attributeId) {
  return needs?.[classId]?.[attributeId]?.minimum || 0;
}

// ---- EQUIPMENT REQUIREMENTS AS DIALS ---------------------------------------

/** Every piece that can carry a requirement, by id, for labelling a row. */
function equipmentPieceNames(bundle) {
  const names = {};
  for (const piece of [...(bundle?.equipment?.armaments || []), ...(bundle?.equipment?.armour || [])]) {
    if (piece?.id && !names[piece.id]) names[piece.id] = piece.name || piece.id;
  }
  return names;
}

/**
 * equipmentRequirementRows(bundle) → one row per authored item/attribute
 * minimum, plus the across-the-board multiplier.
 *
 * THE MULTIPLIER IS NOT A SECOND HOME FOR THE SAME NUMBER. It multiplies the
 * AUTHORED value and an explicit row overrides the product, so the two compose
 * in one direction only: scale the table, then correct the rows you disagree
 * with. `resolveEquipmentRequirements` is the single reader of both.
 */
export function equipmentRequirementRows(bundle) {
  const rows = [];
  const names = equipmentPieceNames(bundle);
  const labels = Object.fromEntries((bundle?.attributes || []).map((row) => [row.id, row.label || row.id]));
  rows.push({
    cat: 'Advanced', advancedGroup: 'Progression', statTopic: 'Equipment requirements',
    type: 'number', integer: false, step: 0.05, min: 0, max: 10, def: 1,
    key: `${REQUIREMENT_PREFIX}scale`,
    label: 'Equipment requirement multiplier',
    searchPath: 'equipment requirements multiplier scale across the board',
    note: 'Multiply every authored attribute minimum below at once, rounded to whole points. 1 keeps the authored table. Set a row below to override the product for that one item. Lowering this lowers the least a character can carry, because a class must still be able to hold the kit it starts in. Applies to a new run.',
  });
  for (const row of bundle?.equipment?.equipmentRequirements || []) {
    if (!row?.itemId || !row.attributeId || !Number.isInteger(row.minimum)) continue;
    const key = `${REQUIREMENT_PREFIX}${row.itemId}.${row.attributeId}`;
    const piece = names[row.itemId] || row.itemId;
    // An item's own requirement wins over the multiplier only while its switch
    // is on; off, the row shows (and the game uses) authored × multiplier.
    // Off by default, and on for any item a profile already pinned.
    const own = { member: key, defaultOn: false };
    rows.push({
      cat: 'Advanced', advancedGroup: 'Progression', statTopic: 'Equipment requirements',
      key: ownKey(key), def: false, own,
      label: `${piece} — own ${labels[row.attributeId] || row.attributeId} requirement`,
      searchPath: `equipment requirement ${row.itemId} ${row.attributeId} override`,
      note: `On: the number below is ${piece}'s requirement, whatever the multiplier says. Off: it is the authored ${row.minimum} × the multiplier. Applies to a new run.`,
    });
    rows.push({
      cat: 'Advanced', advancedGroup: 'Progression', statTopic: 'Equipment requirements',
      type: 'number', integer: true, step: 1, min: 0, max: TOTAL_MAX, def: row.minimum,
      key,
      // The value shown while the switch is off is the one a new run uses: the
      // scaled table when it is admitted, the authored one when the multiplier
      // asks for more than a character can carry and is refused (Codex, #1260).
      gate: { key: ownKey(key), own, inherited: (settings) => admittedRequirement(bundle, row, settings) },
      label: `${names[row.itemId] || row.itemId} — ${labels[row.attributeId] || row.attributeId} required`,
      searchPath: `equipment requirement ${row.itemId} ${row.attributeId}`,
      note: `The least ${labels[row.attributeId] || row.attributeId} a character needs to hold ${names[row.itemId] || row.itemId}. 0 means anyone may hold it. Used only while the switch above is on. A class that starts holding this item cannot be given fewer points than this asks for. Applies to a new run.`,
    });
  }
  return rows;
}

/**
 * resolveEquipmentRequirements(bundle, settings) → the requirement table a new
 * run is born under, or null when nothing was changed.
 *
 * Returning null rather than a copy is what lets `configuredContentBundle`
 * leave `bundle.equipment` shared by reference in the ordinary case — the
 * table is large and every run pays for a clone of it.
 */
function requirementScale(settings = {}) {
  const rawScale = settings[`${REQUIREMENT_PREFIX}scale`];
  return Number.isFinite(Number(rawScale)) && Number(rawScale) >= 0 && Number(rawScale) <= 10
    ? Number(rawScale) : 1;
}

function scaledRequirement(minimum, settings) {
  return Math.max(0, Math.min(TOTAL_MAX, Math.round(minimum * requirementScale(settings))));
}

function admittedRequirement(bundle, row, settings) {
  const table = bundleWithConfiguredEquipment(bundle, settings).equipment?.equipmentRequirements || [];
  return table.find((entry) => entry.itemId === row.itemId && entry.attributeId === row.attributeId)?.minimum ?? row.minimum;
}

export function resolveEquipmentRequirements(bundle, settings = {}) {
  const authored = bundle?.equipment?.equipmentRequirements || [];
  let changed = false;
  const next = authored.map((row) => {
    if (!row?.itemId || !row.attributeId || !Number.isInteger(row.minimum)) return row;
    const key = `${REQUIREMENT_PREFIX}${row.itemId}.${row.attributeId}`;
    const raw = settings[key];
    // A pinned value whose switch was turned off is kept in the profile but
    // not used: the multiplier decides again.
    // Switched ON with nothing typed yet: the item's own requirement is its
    // authored one, which is what the enabled row shows (review and Codex, on
    // #1260 — the multiplier used to keep applying until the field was edited).
    const pinned = Number.isInteger(raw) && raw >= 0 && raw <= TOTAL_MAX ? raw : null;
    const explicit = settings[ownKey(key)] === false ? null
      : pinned ?? (settings[ownKey(key)] === true ? row.minimum : null);
    const minimum = explicit ?? scaledRequirement(row.minimum, settings);
    if (minimum === row.minimum) return row;
    changed = true;
    return { ...row, minimum };
  });
  return changed ? next : null;
}

/**
 * defaultModeHoldsItsKits(bundle, settings) → can the mode creation offers
 * still dress every class — its kit and the outfits creation offers it —
 * with THIS requirement table in force?
 *
 * THE DIAL THAT COULD THROW AWAY EVERY OTHER DIAL. `validateContent` refuses a
 * preset that cannot hold the kit its class starts in, and `rebuildRegistries`
 * answers a failed validation by falling back to AUTHORED DEFAULTS — dropping
 * every value the owner has tuned. Lowering a requirement can never do that;
 * RAISING one can, and the requirement rows admit 0–495 and a multiplier up to
 * 10. So a raise is admitted only when the mode can still be fitted around it,
 * and refused whole otherwise — the cost of a bad number is that number.
 */
function defaultModeHoldsItsKits(bundle, settings) {
  const modeId = bundle.attributeRules?.defaultMode;
  const mode = (bundle.creationModes || []).find((row) => row.id === modeId);
  const authoredPresets = bundle.attributeRules?.presets?.[modeId];
  if (!mode || !authoredPresets) return true;
  const ids = (bundle.attributes || []).map((attribute) => attribute.id);
  const needs = kitAttributeMinimums(bundle);
  const resolved = resolveStartingStatMode(bundle, mode, settings);
  if (resolved.refusals.some((refusal) => refusal.classId)) return false;
  const ceiling = resolved.mode ? resolved.mode.maximum : mode.maximum;
  for (const [classId, authored] of Object.entries(authoredPresets)) {
    // `resolved.presets` are already fitted to the needs; when nothing else
    // moved there are none, and the AUTHORED table is what a run would be born
    // with — which is exactly the case a raised floor breaks.
    const values = resolved.presets?.[classId] || authored;
    for (const id of ids) {
      const value = values[id];
      if (!Number.isInteger(value) || value < kitMinimum(needs, classId, id) || value > ceiling) return false;
    }
    // The OUTFITS creation offers the class are held to the same door: a raise
    // the preset cannot wear fails validateContent just as a kit raise does
    // (Codex, #1255). The class survives it either way it can be born: in the
    // preset it falls back to, or in the per-cell edit made alongside the
    // raise, when that edit is itself a whole allocation that holds its kit —
    // raising Vigil and giving the Reaver the Strength to wear it is one
    // change, not two (Codex, #1255).
    const wearsOutfits = (preset) => !presetGearProblems({
      presets: { [modeId]: { [classId]: preset } },
      defaultMode: modeId,
      startingKits: [],
      equipmentRequirements: bundle.equipment?.equipmentRequirements || [],
      creationClasses: bundle.characterCreation?.classes || {},
    }).length;
    if (!wearsOutfits(values)) {
      const edited = Object.fromEntries(ids.map((id) => [id,
        Number(settings[`gameConfig.attributeRules.presets.${modeId}.${classId}.${id}`] ?? values[id])]));
      const inForce = resolved.mode || mode;
      const expected = inForce.baseline * ids.length + inForce.bonusPool;
      const floor = inForce.belowBaseline === 'forbid' ? Math.max(inForce.minimum, inForce.baseline) : inForce.minimum;
      const whole = ids.every((id) => Number.isInteger(edited[id]) && edited[id] >= Math.max(floor, kitMinimum(needs, classId, id))
        && edited[id] <= ceiling)
        && ids.reduce((sum, id) => sum + edited[id], 0) === expected;
      if (!whole || !wearsOutfits(edited)) return false;
    }
  }
  return true;
}

/**
 * bundleWithConfiguredEquipment(bundle, settings) → the bundle whose kit floors
 * the dials above must be measured against.
 *
 * EVERY FLOOR IN THIS FILE READS `bundle.equipment.equipmentRequirements`, and
 * the owner can now move those numbers. Measuring a total against the AUTHORED
 * table after he has halved it would refuse a total his own settings make
 * legal — the same class of defect as the floor that was never read at all.
 *
 * A table the default mode cannot be dressed in is refused whole and the
 * authored one stands; `equipmentRequirementProblems` says so by name.
 */
export function bundleWithConfiguredEquipment(bundle, settings = {}) {
  const equipmentRequirements = resolveEquipmentRequirements(bundle, settings);
  if (!equipmentRequirements) return bundle;
  const candidate = { ...bundle, equipment: { ...bundle.equipment, equipmentRequirements } };
  return defaultModeHoldsItsKits(candidate, settings) ? candidate : bundle;
}

/**
 * equipmentRequirementProblems(bundle, settings) → [{ keys, message }]
 *
 * One sentence per refused requirement change, naming the class that cannot be
 * dressed in it. A refusal that fell back in silence is the defect this whole
 * driver exists to answer.
 */
export function equipmentRequirementProblems(bundle, settings = {}) {
  const candidateRows = resolveEquipmentRequirements(bundle, settings);
  if (!candidateRows) return [];
  const candidate = { ...bundle, equipment: { ...bundle.equipment, equipmentRequirements: candidateRows } };
  if (defaultModeHoldsItsKits(candidate, settings)) return [];
  const authoredBy = new Map((bundle.equipment?.equipmentRequirements || [])
    .map((row) => [`${row.itemId}:${row.attributeId}`, row.minimum]));
  const names = equipmentPieceNames(bundle);
  const labels = Object.fromEntries((bundle.attributes || []).map((row) => [row.id, row.label || row.id]));
  const raised = candidateRows.filter((row) => row.minimum > (authoredBy.get(`${row.itemId}:${row.attributeId}`) ?? 0));
  const keys = [`${REQUIREMENT_PREFIX}scale`,
    ...raised.map((row) => `${REQUIREMENT_PREFIX}${row.itemId}.${row.attributeId}`)];
  const asks = raised.map((row) => `${names[row.itemId] || row.itemId} ${row.minimum} ${labels[row.attributeId] || row.attributeId}`).join(', ');
  return [{
    keys,
    message: `Equipment requirements: the raised table (${asks || 'the multiplier above'}) asks for more than a character can carry, `
      + 'so no class could be dressed in the kit it starts in and the whole change was refused. '
      + 'Raise Total points on a character first, or lower the requirement; the authored minimums are in use, '
      + 'and every other setting you changed is still applied.',
  }];
}

/**
 * applyEquipmentRequirementConfig(configured, authored, settings)
 *
 * The table AND the copy of it each piece carries. `content/equipment.js`
 * folds the rows onto every armament and outfit as `requirements.attributes`,
 * and that copy is what the equip door, the item card and smithing read — a
 * configured table that left it behind would show one number and enforce
 * another.
 */
export function applyEquipmentRequirementConfig(configured, authored, settings = {}) {
  // ONE DECISION, ONE READER: whatever `bundleWithConfiguredEquipment` admits
  // is what a run is born under. Resolving the rows a second time here would
  // let the bundle carry a table the floors were never measured against.
  const source = bundleWithConfiguredEquipment(authored, settings);
  if (source === authored) return;
  const equipmentRequirements = source.equipment.equipmentRequirements;
  const byItem = {};
  for (const row of equipmentRequirements) {
    // ZERO IS "ANYONE MAY HOLD IT", AND THE CARD HAS TO SAY SO BY SAYING
    // NOTHING. The row stays in the table (validate.js admits 0 and the dial
    // has to be able to come back up), but stamping it onto the piece made the
    // item card print "Requires STR 0" for an item the note calls free.
    if (!row?.itemId || !row.attributeId || !Number.isInteger(row.minimum) || row.minimum <= 0) continue;
    (byItem[row.itemId] ||= {})[row.attributeId] = row.minimum;
  }
  const restate = (piece) => {
    const attributes = byItem[piece?.id];
    if (!attributes && !piece?.requirements) return piece;
    const next = { ...piece };
    if (attributes) next.requirements = { ...piece.requirements, attributes: { ...attributes } };
    else delete next.requirements;
    return next;
  };
  configured.equipment = {
    ...authored.equipment,
    equipmentRequirements,
    armaments: (authored.equipment?.armaments || []).map(restate),
    armour: (authored.equipment?.armour || []).map(restate),
  };
}

/**
 * startingStatBounds(bundle, modeId) → { min, max }
 *
 * The lowest total a character can carry and still put on the kit its class
 * starts in. validate.js applies the kit rule to the DEFAULT mode only, so the
 * retired modes keep the bare "one point per attribute" floor they always had.
 */
export function startingStatBounds(bundle, modeId) {
  const ids = (bundle.attributes || []).map((attribute) => attribute.id);
  let min = ids.length;
  let because = null;
  if (modeId === bundle.attributeRules?.defaultMode) {
    for (const [classId, need] of Object.entries(kitAttributeMinimums(bundle))) {
      const floor = ids.reduce((sum, id) => sum + Math.max(1, need[id]?.minimum || 0), 0);
      if (floor <= min) continue;
      min = floor;
      because = { classId, need };
    }
  }
  return { min, max: TOTAL_MAX, because };
}

/** One sentence naming the class and kit that set the floor, or ''. */
function floorSentence(bundle, bounds) {
  if (!bounds.because) return '';
  const className = (bundle.classes || []).find((row) => row.id === bounds.because.classId)?.name || bounds.because.classId;
  const labels = Object.fromEntries((bundle.attributes || []).map((row) => [row.id, row.label || row.id]));
  const asks = Object.entries(bounds.because.need).map(([id, entry]) => `${entry.minimum} ${labels[id]}`).join(' and ');
  const kit = Object.values(bounds.because.need)[0]?.kit || 'starting kit';
  return ` ${bounds.min} is the least a character can carry: the ${className}'s ${kit} kit asks ${asks}, and every other attribute needs at least 1.`;
}

/**
 * visibleCreationModes(bundle) → the modes a player can actually pick.
 *
 * `characterCreation.visibleModeIds` is what the creation screen offers, and
 * the screen resolves its one editable mode from `attributeRules.defaultMode`
 * (customize.js, #1217). A pool row for a mode nobody can choose is a dial
 * whose only reachable effect is to invalidate an old save.
 */
export function visibleCreationModes(bundle) {
  const visible = bundle.characterCreation?.visibleModeIds;
  const ids = new Set(Array.isArray(visible) && visible.length ? visible : [bundle.attributeRules?.defaultMode]);
  ids.add(bundle.attributeRules?.defaultMode);
  return (bundle.creationModes || []).filter((mode) => ids.has(mode.id));
}

// The row label for each dial, in one place: the refusal sentences address a
// row by the words on it, and a second copy of these strings is a caption that
// can disagree with the screen.
const DIAL_LABELS = Object.freeze({
  baseline: 'Starting value for every attribute',
  bonusPool: 'Points available to assign',
  total: 'Total points on a character',
  minimum: 'Lowest a stat may be set to',
  maximum: 'Highest a stat may be set to',
  belowBaseline: 'Points may be taken back off a stat',
});

function dialLabel(key) {
  return DIAL_LABELS[key.slice(key.lastIndexOf('.') + 1)] || key;
}

/**
 * derivedStatFloorProblems(bundle) → [{ path, keys, message }]
 *
 * THE ONE POOL A RUN CANNOT HOLD AT ZERO. `validateRunShape` refuses a run with
 * `maxMana <= 0`, and since ruleset 6 every input to Mana is a dial: a base and
 * a weight per attribute. Set them all to zero and a new run is born invalid —
 * it cannot be saved or restored (Codex, #1253). So Mana is priced here for the
 * weakest character creation allows, at level 1, and refused by name if that
 * is below one. HP is clamped to 1 at the run door and Stamina, Actions and
 * draw may be 0, so Mana is the only row.
 *
 * THE WEAKEST LEGAL CHARACTER, NOT EVERY ATTRIBUTE AT ITS FLOOR. A fixedTotal
 * mode spends its whole pool, so "every attribute at the floor" is a character
 * no one can make: under lean, weights of 0.5 price that {1,1,1,1,1} at 0 Mana
 * while every legal eight-point character has at least 2 (Codex, #1253). Each
 * attribute's term is floored on its own, so Mana is a sum of one
 * non-decreasing term per attribute, and the minimum over allocations that
 * spend exactly the mode's total is a small knapsack over the points.
 */
export function derivedStatFloorProblems(bundle) {
  const table = bundle?.derivedStatRules;
  const rule = table?.rules?.mana;
  const mode = (bundle?.creationModes || []).find((row) => row.id === bundle?.attributeRules?.defaultMode);
  if (!rule || !mode || !Array.isArray(bundle.attributes)) return [];
  const ids = bundle.attributes.map((row) => row.id);
  const floor = mode.belowBaseline === 'forbid' ? Math.max(mode.minimum, mode.baseline) : mode.minimum;
  const ceiling = mode.maximum;
  if (![floor, ceiling].every(Number.isInteger) || ceiling < floor) return [];
  const fixedTotal = mode.redistribution === 'fixedTotal';
  const total = mode.baseline * ids.length + mode.bonusPool;
  let value;
  let weakest;
  try {
    const resolved = resolveDerivedStatRules(table, { attributeIds: ids, classFields: ['maxHp'] });
    const zero = Object.fromEntries(ids.map((id) => [id, 0]));
    const at = (attributes) => deriveStat(resolved, 'mana', { attributes, classDef: {}, level: 1 }).value;
    const constant = at(zero);
    // term(id, points): what `points` of one attribute adds on its own.
    const term = (id, points) => at({ ...zero, [id]: points }) - constant;
    // best[s] = the least Mana the attributes placed so far can make while
    // spending exactly s points, with the allocation that makes it.
    let best = new Map([[0, { mana: 0, allocation: {} }]]);
    for (const id of ids) {
      const next = new Map();
      for (let points = floor; points <= ceiling; points += 1) {
        const add = term(id, points);
        for (const [spent, entry] of best) {
          const key = spent + points;
          const mana = entry.mana + add;
          if (!next.has(key) || mana < next.get(key).mana) {
            next.set(key, { mana, allocation: { ...entry.allocation, [id]: points } });
          }
        }
      }
      best = next;
    }
    const candidates = fixedTotal ? [best.get(total)].filter(Boolean) : [...best.values()];
    if (!candidates.length) return []; // no legal character: the mode's own check names that
    const least = candidates.reduce((a, b) => (b.mana < a.mana ? b : a));
    value = constant + least.mana;
    weakest = least.allocation;
  } catch {
    return []; // a malformed table is the schema's to name, not this check's
  }
  if (value >= 1) return [];
  const keys = ['base', ...ids].map((field) => `gameConfig.derivedStatRules.rules.mana.${field}`);
  const shown = ids.map((id) => `${id} ${weakest[id]}`).join(', ');
  return [{
    path: 'derivedStatRules.rules.mana',
    keys,
    message: `Mana would be ${value} for the weakest character creation allows (${shown}), and a run cannot hold 0 Mana. Raise the Mana base or a Mana attribute weight; the authored rules stay active until then.`,
  }];
}

// ONE ANSWER PER NUMBER (#1256, owner 2026-09-23: "multiple settings changing
// the same setting"). Two derived rows share their quantity with another row,
// and the note is where the row says which one is in force, so nobody sets
// both and wonders why one did nothing:
//   - Draw is the legacy per-turn draw: a fight that carries hand rules — every
//     solo fight — draws by the hand rules' turn draws instead.
//   - Poise is the threshold only while combat ratings are off; with them on,
//     the Poise rating formula sets it.
// (The "Stat points per tier" sentence #1256 carried here is gone with the
// dial itself — ruleset 6 has no tier, #1253.)
function derivedRowNote(id) {
  if (id === 'draw') return ' Only for fights without hand rules (co-op and older saves); solo fights use the turn draws above.';
  if (id === 'poise') return ' Only while combat ratings are off; otherwise the Poise rating formula sets the threshold.';
  return '';
}

export function startingStatRows(bundle) {
  const rows = [];
  const add = (key, def, label, topic, extra = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Progression', statTopic: topic, key, def, label,
    ...(typeof def === 'number' ? { type: 'number', integer: false, step: 0.1, min: 0, max: 999 } : {}),
    ...extra,
  });
  const ids = (bundle.attributes || []).map((attribute) => attribute.id);
  const visible = new Set(visibleCreationModes(bundle).map((mode) => mode.id));
  const named = visible.size > 1;
  for (const mode of bundle.creationModes) {
    const total = mode.baseline * ids.length + mode.bonusPool;
    const bounds = startingStatBounds(bundle, mode.id);
    // A row for a retired mode keeps its KEY (an exported configuration still
    // imports) and stays off the screen (`retired`), so one concept is one
    // place. See visibleCreationModes above.
    const retired = visible.has(mode.id) ? {} : { retired: true };
    const prefix = named ? `${mode.label} — ` : '';
    // HIS FIRST SENTENCE IS THE FIRST ROW. "the default stat for each stat is
    // 1" is a number he wants to type, not one he wants to arrive at by
    // dividing a total. When it is set it DECIDES the total; left alone, the
    // total decides it, which is what every configuration exported before this
    // row existed relies on.
    add(PREFIX + mode.id + '.baseline', mode.baseline,
      `${prefix}${DIAL_LABELS.baseline}`, 'Assign points', {
        integer: true, step: 1, min: 1, max: TOTAL_MAX, ...retired,
        note: `What every attribute opens at before a single point is assigned. Setting this decides the total: baseline × ${ids.length} attributes, plus the points available to assign. Leave it alone and it is derived from the total instead. Applies to a new run.`,
      });
    add(PREFIX + mode.id + '.bonusPool', mode.bonusPool,
      `${prefix}${DIAL_LABELS.bonusPool}`, 'Assign points', {
        integer: true, step: 1, min: 0, max: TOTAL_MAX - ids.length, ...retired,
        note: `How many of the character's points are yours to place at creation, on top of the starting value above. Applies to a new run.`,
      });
    add(PREFIX + mode.id + '.total', total,
      `${prefix}${DIAL_LABELS.total}`, 'Assign points', {
        integer: true, step: 1, min: bounds.min, max: bounds.max, ...retired,
        // The floor moved from the attribute count to the kit floor after
        // schema version 1 shipped. An older export carrying a smaller total
        // is clamped with a notice rather than taking the whole file down.
        raisedFloor: bounds.min > ids.length ? { was: ids.length, clamp: true } : undefined,
        // WHY THE FLOOR IS WHERE IT IS, as a sentence a refusal can borrow.
        // A typed 4 clamps to the kit floor; the row has to be able to say
        // which class and which kit put it there, or the clamp is a number
        // from nowhere.
        boundsNote: floorSentence(bundle, bounds).trim(),
        note: `Every attribute point a character carries when the climb begins, baseline plus the points assigned. Ignored while a starting value is set above, which decides it instead. Class defaults below rescale to fit.${floorSentence(bundle, bounds)} Applies to a new run.`,
      });
    add(PREFIX + mode.id + '.minimum', mode.minimum,
      `${prefix}${DIAL_LABELS.minimum}`, 'Assign points', {
        integer: true, step: 1, min: 1, max: TOTAL_MAX, ...retired,
        note: 'The floor a stat can be dragged down to at creation, and the limit on how many points can be reclaimed from it. It can never exceed the starting value above. Applies to a new run.',
      });
    add(PREFIX + mode.id + '.maximum', mode.maximum,
      `${prefix}${DIAL_LABELS.maximum}`, 'Assign points', {
        integer: true, step: 1, min: 1, max: TOTAL_MAX, ...retired,
        note: 'The most a single stat may be raised to AT CREATION. It caps the character screen, not the character: levelling raises it by the points levelled. It can never fall below the starting value, nor below what a starting kit asks for. Applies to a new run.',
      });
    add(PREFIX + mode.id + '.belowBaseline', mode.belowBaseline !== 'forbid',
      `${prefix}${DIAL_LABELS.belowBaseline}`, 'Assign points', {
        ...retired,
        note: 'On: a stat may be dropped below its starting value, down to the floor above, handing those points back to the pool. Off: the starting value is also the floor and only the assignable points move. Applies to a new run.',
      });
  }
  // ---- ONE FORMAT, ONE PLACE (owner, 2026-09-21) --------------------------
  //
  // "I'd like all the resources and stats to be in the same format so that
  // there was no confusion to include the base values and everything because
  // they are way too separated."
  //
  // So every resource and stat — HP, Mana, Stamina, Actions, draw, Poise, and
  // the AR/DR/PR/Poise/Ward ratings — is written with the same three kinds of
  // dial, in the order a rating row has them:
  //
  //   base               what it opens at
  //   <each attribute>   that attribute's decimal contribution per point
  //   growth per level   his decimal
  //
  // and each trait is ONE topic of Advanced → Stats ("stat conversion should
  // be its own section under stats, and have sub sections for actions, draw,
  // hp, stamina mana, etc", owner 2026-09-21), beside its rating formula from
  // combatRatings.js and everything else that decides it.
  const derivedDefaults = bundle.derivedStatRules.defaults || {};
  const attributeRows = (bundle.attributes || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const [id, authored] of Object.entries(bundle.derivedStatRules.rules)) {
    const presentation = bundle.derivedStatRules.presentation[id];
    // POISE IS BOTH A POOL AND A RATING, and they now share this topic. The
    // rating keeps its name (combatRatings.js); the pool says it is one, so no
    // two rows on this screen read the same.
    const face = presentation.faceLabel || presentation.label;
    const label = RATING_NAMES.includes(id) ? `${face} pool` : face;
    const rule = { ...derivedDefaults, ...authored };
    // Labels name the trait and what one unit of the row buys, so a search
    // that finds every "per level" row still tells them apart.
    const fields = [
      ['base', `${label} — Base`, 0, 1,
        'What this is worth before a single attribute point is spent, and before equipment, relics and level.'],
      ...attributeRows.map((attribute) => [attribute.id, `${label} per ${attribute.label} point`, 0, 0.05,
        `Gained from each point of ${attribute.label}, rounded down on its own exactly as a rating's is: 0.2 gives nothing until ${attribute.label} reaches 5, then one more every five. 0 ignores ${attribute.label}.`]),
      ['perLevel', `${label} per level`, 0, 0.05,
        'Gained per character level after the first, as a decimal and rounded down: 0.2 is one every five levels, 1 is one every level, 0 never moves with the level.'],
    ];
    for (const [field, title, min, step, note] of fields) {
      // A CLASS-FIELD BASE HAS NO NUMBER TO TYPE. `base` may be `{ strategy:
      // 'classField' }`, which resolves per class at the run door; a number row
      // for it would overwrite the reference with one value for every class.
      const value = field === 'base' ? rule.base : (rule[field] ?? 0);
      if (!Number.isFinite(value)) continue;
      add(`gameConfig.derivedStatRules.rules.${id}.${field}`, value, title, 'Stats & resources', {
        min, step,
        // Filed under this trait's own topic of Advanced → Stats, under the
        // subsection the row's term belongs to (models/AdvancedSettingsGroups.js).
        advancedGroup: 'Stats', derivedStatId: id,
        settingSection: field === 'perLevel' ? 'Level growth' : 'Formula',
        // Whole points only: every other term is floored, so a fractional base
        // would be the one way a pool stopped being a whole number.
        ...(field === 'base' ? { integer: true } : {}),
        configPath: ['derivedStatRules', 'rules', id, field],
        note: `${note}${derivedRowNote(id)} The value you set is the value a new run is born with; nothing rescales it.`,
      });
    }
  }
  return [...rows, ...equipmentRequirementRows(bundle)];
}

/**
 * redistribute(values, total, minimums, maximum)
 *
 * `minimums` is PER ATTRIBUTE, not one number for the row. A uniform floor is
 * what scaled the Starseer's Intelligence from 11 to 2 while its own staff
 * asked for 8 — the proportional share of a small pool is blind to what the
 * class has to wear.
 */
function redistribute(values, total, minimums, maximum) {
  const original = values.reduce((a, b) => a + b, 0);
  const ideals = values.map(v => v * total / original);
  const result = ideals.map((v, i) => Math.max(minimums[i], Math.min(maximum, Math.floor(v))));
  let remaining = total - result.reduce((a, b) => a + b, 0);
  while (remaining !== 0) {
    const direction = Math.sign(remaining);
    let best = -1;
    for (let i = 0; i < result.length; i++) {
      if (direction > 0 ? result[i] >= maximum : result[i] <= minimums[i]) continue;
      if (best < 0 || direction * (ideals[i] - result[i]) > direction * (ideals[best] - result[best])) best = i;
    }
    if (best < 0) throw new Error('Starting stat pool cannot fit the creation limits');
    result[best] += direction;
    remaining -= direction;
  }
  return result;
}

/** A dial's stored value, or undefined when the owner has not typed one. */
function stored(settings, mode, dial) {
  const raw = settings[PREFIX + mode.id + '.' + dial];
  return raw === undefined || raw === null || raw === '' ? undefined : raw;
}

/**
 * resolveStartingStatMode(authored, mode, settings) → the mode a new run gets,
 * plus the presets that fit it, plus what was REFUSED and why.
 *
 * Nothing here throws and nothing here mutates: a total the classes cannot
 * live in leaves the authored mode standing and reports itself, so one bad row
 * costs that row and nothing else. Before this, `redistribute` threw or the
 * bundle failed validation and `rebuildRegistries` discarded EVERY configured
 * value the owner had set.
 *
 * `authored` is expected to already carry the CONFIGURED equipment table
 * (`bundleWithConfiguredEquipment`), because every floor below is read off it.
 */
export function resolveStartingStatMode(authored, mode, settings = {}) {
  const ids = (authored.attributes || []).map((attribute) => attribute.id);
  const oldTotal = mode.baseline * ids.length + mode.bonusPool;
  const bounds = startingStatBounds(authored, mode.id);
  const refusals = [];
  const refuse = (dial, value, dialBounds, kept, extra = {}) => refusals.push({
    key: PREFIX + mode.id + '.' + dial, value, bounds: dialBounds, kept, ...extra,
  });

  // ---- the two numbers that decide the arithmetic -------------------------
  //
  // BASELINE FIRST WHEN IT IS TYPED, TOTAL FIRST WHEN IT IS NOT. The second
  // branch is the code this function has always run, unchanged to the letter,
  // so a configuration written before the baseline row existed resolves to the
  // numbers it always did.
  const rawBaseline = stored(settings, mode, 'baseline');
  const rawPool = stored(settings, mode, 'bonusPool');
  const rawTotal = stored(settings, mode, 'total');
  let baseline = null;
  let total = oldTotal;
  let pool = mode.bonusPool;

  if (rawBaseline !== undefined) {
    const poolCeiling = TOTAL_MAX - ids.length;
    if (rawPool !== undefined) {
      if (Number.isInteger(rawPool) && rawPool >= 0 && rawPool <= poolCeiling) pool = rawPool;
      else refuse('bonusPool', rawPool, { min: 0, max: poolCeiling }, pool);
    }
    const baselineCeiling = Math.max(1, Math.floor((bounds.max - pool) / ids.length));
    if (Number.isInteger(rawBaseline) && rawBaseline >= 1 && rawBaseline <= baselineCeiling
      && rawBaseline * ids.length + pool >= bounds.min) {
      baseline = rawBaseline;
      total = baseline * ids.length + pool;
    } else {
      // The baseline is refused on ITS OWN ROW even when it is the kit floor
      // that refuses it, because that is the number he typed. The floor
      // sentence travels with the refusal so the message can still name the
      // class and the kit.
      refuse('baseline', rawBaseline, {
        min: Math.max(1, Math.ceil((bounds.min - pool) / ids.length)), max: baselineCeiling,
      }, mode.baseline, { kitBounds: bounds });
      // A REFUSED ROW COSTS THAT ROW. The baseline falls back to the authored
      // one, and the points-to-assign row he typed BESIDE it — already
      // validated above — still applies. Overwriting `pool` here dropped a
      // valid number because its neighbour was wrong, which is the behaviour
      // every refusal in this file is written to avoid.
      const fallback = mode.baseline * ids.length + pool;
      if (fallback >= bounds.min && fallback <= bounds.max) {
        baseline = mode.baseline;
        total = fallback;
      } else {
        total = Math.max(bounds.min, Math.min(bounds.max, oldTotal));
        pool = Math.min(mode.bonusPool, Math.max(0, total - ids.length));
      }
    }
  } else {
    if (rawTotal !== undefined) {
      if (Number.isInteger(rawTotal) && rawTotal >= bounds.min && rawTotal <= bounds.max) total = rawTotal;
      else refuse('total', rawTotal, bounds, oldTotal);
    }
    const poolMax = total - ids.length;
    pool = Math.min(mode.bonusPool, Math.max(0, poolMax));
    if (rawPool !== undefined) {
      if (Number.isInteger(rawPool) && rawPool >= 0 && rawPool <= poolMax) pool = rawPool;
      else refuse('bonusPool', rawPool, { min: 0, max: poolMax }, pool);
    }
  }

  const needs = mode.id === authored.attributeRules?.defaultMode ? kitAttributeMinimums(authored) : {};
  const kitCeiling = Math.max(0, ...Object.values(needs).flatMap((need) => Object.values(need).map((entry) => entry.minimum)));
  const ratio = total / oldTotal;
  const resolvedBaseline = baseline ?? Math.max(1, Math.floor((total - pool) / ids.length));

  // ---- the three limits, each overridable ---------------------------------
  let minimum = Math.max(1, Math.min(resolvedBaseline, Math.floor(mode.minimum * ratio)));
  let maximum = Math.min(bounds.max, Math.max(resolvedBaseline, Math.ceil(mode.maximum * ratio), kitCeiling));
  let belowBaseline = mode.belowBaseline;
  let limitsMoved = false;

  const rawMinimum = stored(settings, mode, 'minimum');
  if (rawMinimum !== undefined) {
    // A floor above the baseline is the one shape `attributeContentProblems`
    // refuses outright ("minimum N exceeds baseline M"), so the row is bounded
    // by the baseline in force rather than letting it reach the content door.
    if (Number.isInteger(rawMinimum) && rawMinimum >= 1 && rawMinimum <= resolvedBaseline) {
      limitsMoved ||= rawMinimum !== minimum;
      minimum = rawMinimum;
    } else refuse('minimum', rawMinimum, { min: 1, max: resolvedBaseline }, minimum);
  }
  const rawMaximum = stored(settings, mode, 'maximum');
  if (rawMaximum !== undefined) {
    const ceilingFloor = Math.max(resolvedBaseline, kitCeiling);
    if (Number.isInteger(rawMaximum) && rawMaximum >= ceilingFloor && rawMaximum <= bounds.max) {
      limitsMoved ||= rawMaximum !== maximum;
      maximum = rawMaximum;
    } else refuse('maximum', rawMaximum, { min: ceilingFloor, max: bounds.max }, maximum);
  }
  const rawBelow = stored(settings, mode, 'belowBaseline');
  if (typeof rawBelow === 'boolean') {
    const next = rawBelow ? 'allow' : 'forbid';
    limitsMoved ||= next !== belowBaseline;
    belowBaseline = next;
  }

  // A MOVED KIT FLOOR IS A REASON TO RE-FIT, EVEN WHEN NO POOL DIAL MOVED.
  // The equipment rows can raise what a class must carry without touching a
  // single starting-stat number; returning early there left the AUTHORED
  // presets standing under a floor they no longer clear, and validateContent
  // answers that by discarding every configured value the owner has set.
  const authoredFits = Object.entries(authored.attributeRules?.presets?.[mode.id] || {}).every(
    ([classId, preset]) => ids.every((id) => (preset[id] || 0) >= kitMinimum(needs, classId, id)));
  if (total === oldTotal && pool === mode.bonusPool && !limitsMoved && authoredFits) {
    return { mode: null, presets: null, refusals };
  }

  // ONLY THE NUMBERS THIS DIAL OWNS. Spreading the authored mode would alias
  // its `equipmentProfiles` object into the configured bundle, and the
  // combat-ratings block in advancedConfig.js writes through that reference.
  const next = {
    baseline: resolvedBaseline,
    bonusPool: total - resolvedBaseline * ids.length,
    minimum,
    maximum,
    belowBaseline,
  };
  const floor = next.belowBaseline === 'forbid' ? Math.max(next.minimum, next.baseline) : next.minimum;
  const presets = {};
  const authoredPresets = authored.attributeRules?.presets?.[mode.id] || {};
  for (const [classId, preset] of Object.entries(authoredPresets)) {
    const minimums = ids.map((id) => Math.max(floor, kitMinimum(needs, classId, id)));
    if (minimums.reduce((a, b) => a + b, 0) > total) {
      return {
        mode: null, presets: null,
        refusals: [...refusals, {
          key: PREFIX + mode.id + (rawBaseline !== undefined ? '.baseline' : '.total'),
          value: rawBaseline !== undefined ? rawBaseline : total, bounds, kept: oldTotal,
          classId, minimum: minimums.reduce((a, b) => a + b, 0),
        }],
      };
    }
    try {
      const values = redistribute(ids.map((id) => preset[id]), total, minimums, next.maximum);
      presets[classId] = Object.fromEntries(ids.map((id, index) => [id, values[index]]));
    } catch {
      return {
        mode: null, presets: null,
        refusals: [...refusals, {
          key: PREFIX + mode.id + (rawBaseline !== undefined ? '.baseline' : '.total'),
          value: rawBaseline !== undefined ? rawBaseline : total, bounds, kept: oldTotal, classId,
        }],
      };
    }
  }
  // NO `statConversionScale` IS WRITTEN ANY MORE (owner, 2026-09-21). The mode
  // used to record `total ÷ oldTotal` here, and every formula downstream
  // DIVIDED by it: ratings, derived pools and hand sizes all read an attribute
  // multiplied by the inverse, so a 12-point character was priced as a
  // 35-point one and the settings panel's own weights described arithmetic the
  // game did not do. The ratio still shapes the FLOOR, CEILING and PRESETS
  // above — where it is visible as whole attribute points on the sheet — and
  // stops there. A smaller pool now means smaller numbers, which is what
  // shrinking it says.
  return { mode: next, presets, refusals };
}

export function applyStartingStatConfig(configured, authored, settings) {
  const source = bundleWithConfiguredEquipment(authored, settings);
  // A MODE NO PLAYER CAN PICK IS NEVER REWRITTEN, and this line is what makes
  // `visibleCreationModes`' own sentence true: "a dial whose only reachable
  // effect is to invalidate an old save". A retired mode's KEYS stay, so an
  // exported configuration still imports and the row stays off screen as
  // `retired` — but APPLYING one can only reach a save. A run written before
  // `attributeModeSnapshot` existed is validated against the LIVE mode at the
  // load door, and save.js ARCHIVES what fails there, so rewriting tuned2's
  // total would archive exactly the runs tuned2 was kept in the table for.
  const applicable = new Set(visibleCreationModes(source).map((mode) => mode.id));
  for (let index = 0; index < configured.creationModes.length; index += 1) {
    const original = source.creationModes.find((m) => m.id === configured.creationModes[index].id);
    if (!original || !applicable.has(original.id)) continue;
    const { mode, presets } = resolveStartingStatMode(source, original, settings);
    if (!mode) continue;
    Object.assign(configured.creationModes[index], mode);
    for (const [classId, preset] of Object.entries(presets)) {
      configured.attributeRules.presets[original.id][classId] = preset;
    }
  }
}

/**
 * startingStatPoolProblems(bundle, settings) → [{ keys, message }]
 *
 * THE SENTENCE THAT KEEPS HIM FROM CONCLUDING THE DIAL IS BROKEN. A refused
 * total used to fall back to the authored value in silence; the run then
 * started on stock numbers and every other tuned value went with it.
 */
export function startingStatPoolProblems(bundle, settings = {}) {
  const problems = [...equipmentRequirementProblems(bundle, settings)];
  const source = bundleWithConfiguredEquipment(bundle, settings);
  const needs = kitAttributeMinimums(source);
  const classNames = Object.fromEntries((source.classes || []).map((row) => [row.id, row.name || row.id]));
  const attributeNames = Object.fromEntries((source.attributes || []).map((row) => [row.id, row.label || row.id]));
  for (const mode of visibleCreationModes(source)) {
    for (const refusal of resolveStartingStatMode(source, mode, settings).refusals) {
      const label = dialLabel(refusal.key);
      const sizes = /\.(total|baseline)$/.test(refusal.key);
      // Two shapes, because they are two different refusals and one wording
      // for both would be a lie in one of them: a number OUTSIDE the row's
      // range, and a number inside it that no set of class tables can fit.
      const why = refusal.classId
        ? `cannot be shared out: the ${classNames[refusal.classId]}`
          + (Number.isFinite(refusal.minimum) ? ` needs at least ${refusal.minimum}` : ' cannot be fitted')
          + ` to hold ${Object.entries(needs[refusal.classId] || {}).map(([id, entry]) => `${entry.minimum} ${attributeNames[id]}`).join(' and ') || 'its starting kit'}`
          + ` for its ${(Object.values(needs[refusal.classId] || {})[0] || {}).kit || 'starting kit'}.`
        : `is outside ${refusal.bounds.min}–${refusal.bounds.max} and was refused.`
          + (sizes ? floorSentence(source, refusal.kitBounds || refusal.bounds) : '');
      problems.push({
        keys: [refusal.key],
        message: `${label}: ${JSON.stringify(refusal.value)} ${why} The value in use is ${refusal.kept}; every other setting you changed is still applied.`,
      });
    }
  }
  return problems;
}
