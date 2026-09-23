// src/model/creationBrief.js — D26's SHORT FORM, as one read model.
//
// Constantine, 2026-08-15: "the statte descriptions kind of suck. perhaps have
// a simplifed verison with just the starting stats, starting armaments
// selection , and then have the ability to expand by clicking, with tool tips.
// for character creation I mean"
//
// THE FIX IS LAYERED PROSE, NOT A SECOND SET OF PROSE. Every entry here has a
// FACE (name, the first authored sentence constrained to one line, and value)
// and a REVEAL (the full sentence plus derived benefits, one tap down). The
// vocabulary and the tier field are model/disclosure.js; this file is the one
// place that composes them, so the creation screen and the F1 combat frame
// cannot answer "what does a stat look like" two different ways.
//
// WHAT IS AUTHORED AND WHAT IS DERIVED (Law 0 clause 1 — an entry DESCRIBES,
// the machinery DERIVES). Authored, once, per row: `sense`, one sentence with
// NO NUMBER IN IT. Derived here, every render, from the tables that own the
// facts:
//
//   an attribute's FEEDS      every derived stat whose sourceStat is this
//                             attribute, with its own gain and its own tier
//                             size — so adding a rule row changes the
//                             attribute's reveal with nobody editing prose
//   an attribute's UNLOCKS    every armament that names it in
//                             equipmentRequirements, with the minimum it asks
//                             — which is how STRENGTH has an honest reveal on
//                             a screen where it feeds no pool at all
//   a derived stat's SOURCE   its own rule row, in words
//   a derived stat's RECEIPT  statProjection's formula string, unchanged: the
//                             arithmetic already has one home and this is not
//                             a second one
//   an armament's EFFECTS     its `mods` column read through modFields, the
//                             same vocabulary the Armoury comparison reads
//   an armament's REQUIREMENTS equipmentRequirementReceipt, met or unmet
//
// AN ENTRY THAT FEEDS NOTHING AND UNLOCKS NOTHING SAYS SO. Silence there would
// be the screen implying a stat matters because it is drawn; the derivation
// prints "Nothing reads it yet" and that sentence goes stale the moment the
// tables change, which is the point.
//
// THE RELIC IS HERE BECAUSE THE SCREEN NEVER NAMED IT (Bjorn, 2026-08-15): the
// class-pick panel itemized "Items 6 + relics 0 = 6" one row below a screen
// that never mentioned the starting relic — and D23 made that relic the carrier
// of the class's own numbers. Its passive modifiers are derived below; its
// authored sentence is composed by the caller through the shared relicText
// renderer (`extras`), because token-filling is a rendering concern with one
// home already (ui/components/card.js) and this module keeps no copy of it.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day the creation screen
// and the combat frame no longer show stats — the split has no subject then.

import { splitByDisclosure } from './disclosure.js';
import { statProjection } from './statProjection.js';
import { equipmentRequirementReceipt, equippedPieces, modEffectLines } from './loadout.js';
import { orderedAttributes } from './attributes.js';
import { defaultRatingFormula } from './ratingFormula.js';
import { ruleWeights } from './derivedStats.js';

/** `mods` → player-readable effect lines, through the modFields vocabulary.
 *  The rendering itself is loadout.js's (modEffectLines) — this file was one of
 *  the two copies that made a third site print the raw row. The reasoning about
 *  an unknown field, which was written here, moved with it. */
const pieceEffects = (registries, piece) => modEffectLines(registries, piece);

function requirementLines(registries, piece, attributes) {
  const receipt = equipmentRequirementReceipt(registries, piece, attributes);
  return receipt.requirements.map((row) => {
    const def = registries.attributes.get(row.attributeId);
    const met = Number.isFinite(row.actual) && row.actual >= row.required;
    return `Needs ${def.shortLabel} ${row.required} — you have ${row.actual == null ? '—' : row.actual}${met ? '' : ' (short)'}`;
  });
}

/** The armament entries: what the chosen kit actually puts in your hands. */
function armamentEntries(registries, run) {
  const slots = (registries.equipment || {}).slots || [];
  return equippedPieces(registries, run.loadout, run.class).map((piece) => {
    const slot = slots.find((row) => (row.kinds || []).includes(piece.kind) && (!piece.hand || piece.hand === 'either' || piece.hand === row.hand));
    return {
      id: piece.id,
      // THE KEY IS THE MODEL'S, NOT THE SCREEN'S. Two hands may hold the same
      // armament id, so a bare id is not unique on this surface — and a DOM
      // that keys two faces the same silently opens the wrong reveal. One rule,
      // stated once, adopted by every surface that draws entries.
      key: `armament:${slot ? slot.id : piece.kind}:${piece.id}`,
      slotId: slot ? slot.id : null,
      kind: 'armament',
      // Always face-tier: he named the armaments selection as the other half
      // of the short form, so a starting armament is never behind a tap.
      disclosure: 'face',
      face: { label: piece.name, value: slot ? slot.label : '' },
      reveal: {
        title: piece.name,
        sense: piece.blurb || '',
        lines: [...pieceEffects(registries, piece), ...requirementLines(registries, piece, run.attributes)],
        receipt: '',
      },
    };
  });
}

function relicEntry(registries, run, relicId = registries.classes.get(run.class).startingRelic) {
  const relic = relicId ? registries.relics.get(relicId) : null;
  if (!relic) return null;
  // The resource's name is the presentation table's, never an upper-cased id:
  // a player reads 'Mana', and the engine's key is not a label (Vira's
  // engine-language finding, 2026-08-15).
  const named = (id) => (((registries.derivedStatRules || {}).presentation || {})[id] || {}).label || id;
  const lines = ((relic.passives && relic.passives.modifiers) || []).map((row) => {
    if (row.tag === 'resource.flat') return `${named(row.resource)} +${row.amount}`;
    if (row.tag === 'resource.attributeTier') {
      const def = registries.attributes.get(row.sourceStat);
      return `${named(row.resource)} +${row.amountPerTier} per ${row.pointsPerTier} ${def.shortLabel}`;
    }
    if (row.tag === 'damage.school.flat') return `${row.school} damage +${row.amount}`;
    return row.tag;
  });
  return {
    id: relic.id,
    key: `relic:${relic.id}`,
    kind: 'relic',
    disclosure: 'face',
    face: { label: 'Relic', value: relic.name },
    reveal: { title: relic.name, sense: '', lines, receipt: '' },
  };
}

/** Every armament in the class's tables that names this attribute as a gate. */
function unlockLines(registries, attributeId) {
  return ((registries.equipment || {}).armaments || [])
    .filter((piece) => ((piece.requirements && piece.requirements.attributes) || {})[attributeId] != null)
    .map((piece) => `${piece.name} asks ${piece.requirements.attributes[attributeId]}`);
}

function foldedSummary(sense) {
  const text = String(sense || '').trim();
  const sentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  return sentence || text;
}

function ratingWeightFacts(registries, attributeId) {
  const config = registries.balance?.combatRatings || defaultRatingFormula;
  const short = registries.attributes.get(attributeId).shortLabel;
  if (!config?.ratings) return [];
  return Object.entries(config.ratings)
    .filter(([, rule]) => Number(rule[attributeId]) > 0)
    .map(([id, rule]) => {
      const label = id === 'poise' || id === 'ward' ? `${id[0].toUpperCase()}${id.slice(1)}` : id.toUpperCase();
      return {
        line: `${label}: floor(${rule[attributeId]} × ${short}), then × ${config.multiplier ?? 1} global`,
        summary: `${label} weight ${rule[attributeId]}`,
      };
    });
}

/**
 * One attribute-card model for every authored attribute.
 *
 * `attributes` may be an in-progress allocation, so this door deliberately
 * does not require a valid run. The optional projection only supplies a
 * class-specific fallback for a rule whose gain is resolved at projection
 * time; every authored label, sentence, rule and equipment gate still comes
 * from its owning registry row.
 */
export function attributeCardModels(registries, attributes, { projection = null, equipmentProfiles = null } = {}) {
  const rules = ((registries.derivedStatRules || {}).rules) || {};
  const defaults = ((registries.derivedStatRules || {}).defaults) || {};
  const presentation = ((registries.derivedStatRules || {}).presentation) || {};
  const projected = new Map(((projection && projection.derived) || []).map((row) => [row.id, row]));
  return orderedAttributes(registries).map((authored) => {
    const def = { ...authored, value: attributes?.[authored.id] };
    // WHAT THIS ATTRIBUTE FEEDS, as facts before prose. Derived once here so
    // the fold's line and the face's summary are the same numbers — the rules
    // are `registries.derivedStatRules`, the run's own derivation.
    const feedFacts = Object.entries(rules)
      // SINCE RULESET 6 A ROW NAMES ITS ATTRIBUTES AS WEIGHTS, so "what this
      // attribute feeds" is every row that puts a non-zero weight on it — a row
      // may now feed two attributes and appear on both cards, which the single
      // `sourceStat` this filter used to read could never express.
      .filter(([, rule]) => ruleWeights({ ...defaults, ...rule }).some(([id]) => id === def.id))
      .sort((a, b) => (presentation[a[0]].order || 0) - (presentation[b[0]].order || 0))
      .map(([id, rule]) => {
        // THE RUN'S RULE, NOT THE TABLE'S. A run carries the derived-stat rows
        // it was BORN under — a settings override tunes the live table while a
        // climb in progress keeps its own snapshot — so the authored row can
        // say one thing while the character on screen was priced by another.
        // The projection is the run's own derivation; reading the authored row
        // here is the copy-that-nothing-syncs the card exists to avoid (Law 1
        // clause 2). The authored row answers only when there is no run.
        const row = projected.get(id);
        const weight = Number.isFinite(row?.weights?.[def.id]) ? row.weights[def.id]
          : ruleWeights({ ...defaults, ...rule }).find(([attrId]) => attrId === def.id)?.[1];
        const perIncrease = Number.isFinite(row?.pointsPerIncrease) ? row.pointsPerIncrease : 1;
        const gain = Number.isFinite(row?.gain) ? row.gain : 1;
        if (!Number.isFinite(weight) || weight <= 0) return { label: presentation[id].label, perTier: null, points: 1 };
        // WHAT ONE OF *MY* POINTS BUYS, said the way the player asks it. A
        // weight of 4 is "+4 every 1 point"; a weight of 0.2 is "+1 every 5
        // points", never "+0.2 per point" — the term is floored, so a fifth
        // of a point is nothing until five of them arrive. The epsilon is the
        // same one the rule's floor takes: 1 / 0.2 is 5.000000000000001.
        const rate = (weight * gain) / perIncrease;
        if (rate >= 1) return { label: presentation[id].label, perTier: Math.round(rate * 100) / 100, points: 1 };
        return { label: presentation[id].label, perTier: 1, points: Math.round((1 / rate) * 100 + 1e-9) / 100 };
      });
    const unlocks = unlockLines(registries, def.id);
    const ratingFacts = ratingWeightFacts(registries, def.id);
    const scaling = ratingFacts.map(({ line }) => line);
    const feeds = feedFacts.map(({ label, perTier, points }) => (Number.isFinite(perTier)
      ? `${label} +${perTier} every ${points} ${points === 1 ? 'point' : 'points'}`
      : `${label} scales with ${def.label}`));
    // The FACE says what a point buys (Constantine, 2026-09-04: "stats show
    // flavor text instead of useful information"). The flavour is still the
    // fold's opening sentence — it is colour, and colour is not what a player
    // choosing where to spend a level needs on the row itself.
    // Each fact carries its OWN cadence, because they differ: HP every point
    // and Stamina every five in the same row would read as one rate if the
    // divisor sat at the end. `per N pts`, not `/N`, because a label may
    // already hold a slash ("Actions / turn") and two would read as one rate.
    const cadence = (points) => (points === 1 ? 'per pt' : `per ${points} pts`);
    const faceFacts = feedFacts
      .filter(({ perTier }) => Number.isFinite(perTier))
      .map(({ label, perTier, points }) => `+${perTier} ${label} ${cadence(points)}`);
    const scalingFacts = faceFacts.length ? [] : ratingFacts.map(({ summary }) => summary);
    const stated = [...faceFacts, ...scalingFacts];
    const faceSummary = stated.length ? stated.join(' · ') : foldedSummary(def.sense);
    const lines = [...feeds, ...scaling, ...unlocks];
    return {
      id: def.id,
      key: `attribute:${def.id}`,
      kind: 'attribute',
      disclosure: def.disclosure,
      face: { label: def.shortLabel, summary: faceSummary, value: def.value },
      reveal: {
        title: def.label,
        sense: def.sense,
        lines: lines.length ? lines : ['Nothing reads it yet.'],
        flavour: foldedSummary(def.sense),
        receipt: '',
      },
    };
  });
}

function derivedEntries(projection) {
  return projection.derived.map((row) => ({
    id: row.id,
    key: `derived:${row.id}`,
    kind: 'derived',
    disclosure: row.disclosure,
    face: { label: row.faceLabel, value: row.value },
    reveal: {
      title: row.label,
      sense: row.sense,
      lines: [],
      // THE RECEIPT TIER, and it is the projection's own string — the
      // arithmetic keeps its single home (Law 1 clause 2).
      receipt: row.formula,
    },
  }));
}

/**
 * creationBrief(registries, run) → { stats, armaments, faces, reveals }
 *
 * `stats` and `armaments` are every entry in authored order; `faces` and
 * `reveals` are the same entries split by their own `disclosure` field — the
 * split is READ, never decided here, and no caller may filter by id.
 */
export function creationBrief(registries, run) {
  const projection = statProjection(registries, run);
  const stats = [...attributeCardModels(registries, run.attributes, {
    projection,
    equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles,
  }), ...derivedEntries(projection)];
  const relic = relicEntry(registries, run);
  // The kit relic (plan phase 5a) rides beside the starting relic; the brief says so.
  const kitRelic = relicEntry(registries, run, registries.classes.get(run.class).kitRelic);
  const armaments = [...armamentEntries(registries, run), ...(relic ? [relic] : []), ...(kitRelic && kitRelic.id !== (relic && relic.id) ? [kitRelic] : [])];
  const split = splitByDisclosure(stats);
  return {
    classId: run.class,
    stats,
    armaments,
    faces: split.face,
    reveals: split.reveal,
  };
}
