// src/model/disclosure.js — THE ONE HOME OF THE DISCLOSURE VOCABULARY.
//
// Constantine, 2026-08-15 (D26): "the statte descriptions kind of suck. perhaps
// have a simplifed verison with just the starting stats, starting armaments
// selection , and then have the ability to expand by clicking, with tool tips.
// for character creation I mean"
//
// THREE WORDS, AND THEY ARE MEANT TO BE PERMANENT — the F1 combat frame adopts
// them, so they are chosen as vocabulary rather than as this screen's private
// spelling (Marina's handover packet, 2026-08-16: "Sunna's creation act SETS
// the shared vocabulary; the frame ADOPTS it"):
//
//   FACE     the line an entry shows BEFORE anyone asks: its name and its
//            number, and nothing else. A face never carries prose. If a face
//            needs a sentence to be understood, the sentence belongs one tier
//            down — that is the whole of what he asked for.
//   REVEAL   what ONE TAP opens: the same entry in player words. Every entry
//            has exactly one reveal; a reveal is never a second screen.
//   RECEIPT  the arithmetic that produced the number, at the FOOT of the
//            reveal. Already the house word (statProjection's "calculation
//            receipts", equipmentSurfaceReceipt) — adopted, not minted, so the
//            frame's CALCULATION tooltip and this screen say one word.
//
// AND ONE FIELD, WHICH IS THE DATA-DRIVEN HALF (Law 0 clause 1: an entry
// DESCRIBES, the machinery DERIVES). `disclosure` is authored ON THE ENTRY and
// says which tier that entry lives in:
//
//   disclosure: 'face'    drawn in the short form, always
//   disclosure: 'reveal'  drawn only once the panel is opened
//
// THERE IS NO LIST ANYWHERE OF WHICH STATS ARE "SIMPLE". A screen that filtered
// on a hard-coded set would be a knob whose value is ignored, which is worse
// than no knob: the author would retune the table and the screen would not
// move. The check (tools/creationbrief.mjs) plants exactly that defect and must
// see it go red.
//
// WHAT OPENS A REVEAL, and no second gesture is minted for it: a TAP on the
// face. Hover and the gamepad focus cursor show the same words in the shared
// tooltip (components/tooltip.js). The press-and-hold in this tree already
// means INSPECT (balance.ui.inspectHold, 400 ms / 12 px) and it keeps meaning
// that — a disclosure that answers a thumb is answered by the thumb's cheapest
// gesture, not by teaching one gesture two jobs.
//
// REMOVAL CONDITION (SOP 1's corollary): this module is deleted the day no
// surface has two tiers of disclosure — one tier needs no word for the split.

export const FACE = 'face';
export const REVEAL = 'reveal';

/** The closed set. A value outside it is refused by name at the content door. */
export const DISCLOSURE_TIERS = Object.freeze([FACE, REVEAL]);

/**
 * disclosureProblem(value, path) → null | { path, msg }
 *
 * Named, never thrown, and THE OFFENDING VALUE IS IN THE MESSAGE — a typo'd
 * tier must be refused by its own spelling, not only by the legal list it is
 * absent from (Law 1 clause 5, and the same shape derivedStats.js already uses
 * for a retired sourceStat).
 */
export function disclosureProblem(value, path) {
  if (typeof value === 'string' && DISCLOSURE_TIERS.includes(value)) return null;
  const got = typeof value === 'string' ? `'${value}' ` : '';
  return { path, msg: `${got}must be one of ${DISCLOSURE_TIERS.join(', ')}` };
}

/**
 * splitByDisclosure(entries) → { face, reveal }
 *
 * The ONE place the short/long split is computed, so no screen can invent its
 * own answer. Entries keep their given order inside each tier.
 */
export function splitByDisclosure(entries) {
  const out = { face: [], reveal: [] };
  for (const entry of entries || []) {
    const tier = entry && entry.disclosure;
    if (!DISCLOSURE_TIERS.includes(tier)) {
      throw new Error(`disclosure: entry '${entry && entry.id}' has tier '${tier}'`);
    }
    out[tier].push(entry);
  }
  return out;
}
