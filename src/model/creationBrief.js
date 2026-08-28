// src/model/creationBrief.js — D26's SHORT FORM, as one read model.
//
// Constantine, 2026-08-15: "the statte descriptions kind of suck. perhaps have
// a simplifed verison with just the starting stats, starting armaments
// selection , and then have the ability to expand by clicking, with tool tips.
// for character creation I mean"
//
// THE FIX IS LESS PROSE, NOT BETTER PROSE. Every entry here has a FACE (name
// and number, no sentence) and a REVEAL (the sentence, one tap down). The
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
import { equipmentRequirementReceipt, equippedPieces, parseMod } from './loadout.js';

/** `mods` → player-readable effect lines, through the modFields vocabulary. */
function pieceEffects(registries, piece) {
  const fields = (registries.equipment || {}).modFields || {};
  return (piece.mods || []).map((raw) => {
    const mod = parseMod(raw);
    const spec = mod && fields[mod.field];
    // A mod the vocabulary does not know is refused at the content door, so
    // reaching here means the tables disagree — say the raw row rather than
    // drop it silently. A visible oddity is a bug report; a dropped line is a
    // screen that quietly under-describes a weapon.
    if (!spec) return raw;
    const sign = mod.mode === 'add' && mod.value >= 0 ? '+' : '';
    return `${spec.label} ${sign}${mod.value}`;
  });
}

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

function relicEntry(registries, run) {
  const classDef = registries.classes.get(run.class);
  const relic = classDef.startingRelic ? registries.relics.get(classDef.startingRelic) : null;
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

function attributeEntries(registries, projection) {
  const rules = ((registries.derivedStatRules || {}).rules) || {};
  const presentation = ((registries.derivedStatRules || {}).presentation) || {};
  return projection.attributes.map((def) => {
    const feeds = Object.entries(rules)
      .filter(([, rule]) => rule.sourceStat === def.id)
      .sort((a, b) => (presentation[a[0]].order || 0) - (presentation[b[0]].order || 0))
      .map(([id, rule]) => {
        const gain = Number.isFinite(rule.gainPerTier) ? rule.gainPerTier : null;
        const points = rule.pointsPerTier || ((registries.derivedStatRules || {}).defaults || {}).pointsPerTier;
        const label = presentation[id].label;
        // A class-field gain (hp) is a different number per class, so it is
        // read off the projection's own receipt rather than restated here.
        const perTier = gain == null
          ? (projection.derived.find((row) => row.id === id) || {}).gainPerTier
          : gain;
        return `${label} +${perTier} every ${points} points`;
      });
    const unlocks = unlockLines(registries, def.id);
    const lines = [...feeds, ...unlocks];
    return {
      id: def.id,
      key: `attribute:${def.id}`,
      kind: 'attribute',
      disclosure: def.disclosure,
      face: { label: def.shortLabel, value: def.value },
      reveal: {
        title: def.label,
        sense: def.sense,
        lines: lines.length ? lines : ['Nothing reads it yet.'],
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
  const stats = [...attributeEntries(registries, projection), ...derivedEntries(projection)];
  const relic = relicEntry(registries, run);
  const armaments = [...armamentEntries(registries, run), ...(relic ? [relic] : [])];
  const split = splitByDisclosure(stats);
  return {
    classId: run.class,
    stats,
    armaments,
    faces: split.face,
    reveals: split.reveal,
  };
}
