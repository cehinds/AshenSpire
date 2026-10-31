// src/content/sfx.js — the SFX recipes, as data (#46; design law §3.1, Law 1).
//
// The synth engine (src/ui/audio.js) knows how to say exactly two words —
// 'tone' and 'noise' — and each recipe is a list of layers spoken in that
// closed vocabulary. Tuning a sound (hit too loud, click too shrill) is a table
// edit, never an engine edit: the same rule the music beds in music.js and the
// cards follow. The tables are authored in content/source/sfxRecipes.json,
// sfxFamilyIds.json and sfxHitTiers.json (the layer fields, the id scheme, and
// what each row is for are in content/source/CONTENT-NOTES.md, "Sound
// effects"); content-build compiles them to src/content/generated/. Edit the
// JSON; this file freezes the shared tables and keeps the functions. Schema:
// SFX_LAYER_SCHEMAS in model/schemas.js; validated at boot and in tests via the
// content bundle (model/validate.js), so a malformed layer fails naming its
// recipe id.
//
// Resolution is generic-then-specific, in resolveRecipe() below:
//
//     procBurst_frost  →  the exact row if authored
//                      →  else `procBurst`, the FAMILY row (before the '_')
//                      →  else `default`
import { sfxRecipes } from './generated/sfxRecipes.js';
import { sfxFamilyIds } from './generated/sfxFamilyIds.js';
import { sfxHitTiers } from './generated/sfxHitTiers.js';

// A recipe id automatically tries assets/sfx/<encoded-id>.ogg before using its
// synth recipe. Add a row here only to override that path or format; both the
// convention and overrides pass through assetUrl() so standalone builds can
// inline them. A cue synths immediately while an unknown file warms; only a
// cached known-good file replaces later cues. Missing/undecodable files remain
// unavailable in that cache, so every cue keeps the immediate recipe.
// (Moved here from music.js so all SFX content has one home.)
export const SFX_MANIFEST = {
  // cardPlay: 'assets/sfx/card.wav',  ← optional path/format override
};

// Family rows are an explicit content characteristic. Runtime resolution and
// the content-build reachability check both consume this list; neither guesses
// that every row before an underscore is intended as a composed-id family.
export const SFX_FAMILY_IDS = Object.freeze(sfxFamilyIds);

// HIT TIERS (FINISH §5, D48): the thresholds are data (owner ruling D1).
export const SFX_HIT_TIERS = Object.freeze(sfxHitTiers.map((row) => Object.freeze(row)));

/** hitTierFor(amount, tiers?) → the tier name for `amount` HP of damage. */
export function hitTierFor(amount, tiers = SFX_HIT_TIERS) {
  const n = Number(amount) || 0;
  let pick = tiers[0]?.tier;
  for (const row of tiers) if (n >= row.min) pick = row.tier;
  return pick;
}

// One recipe per feedback hook. A row whose value is another row's id (`hit` →
// `hit_medium`, `beat` → `holdCommit`) plays that row's layers: both ids answer
// with the SAME frozen array, so a retune of the one row moves both. A row
// that another row aliases is therefore frozen (its layers are not).
const aliased = new Set(Object.values(sfxRecipes).filter((row) => typeof row === 'string'));
const shared = new Map([...aliased].map((id) => [id, Object.freeze(sfxRecipes[id])]));
export const SFX_RECIPES = {};
for (const [id, row] of Object.entries(sfxRecipes)) {
  SFX_RECIPES[id] = typeof row === 'string' ? shared.get(row) : (shared.get(id) ?? row);
}

/**
 * resolveRecipe(id) → { recipe, matched, fellBack }
 *
 * The id scheme documented at the top of this file, as one pure function so
 * the engine and the tests decide identically — a resolution rule with two
 * homes is a rule that drifts (the engine had none at all before #66/D16,
 * which is how three composed ids reached the 440 Hz fallback unnoticed).
 *
 * `matched` is the row that actually answered; `fellBack` is true only when
 * NOTHING answered and `default` had to. Own-property reads throughout: an
 * inherited key ('toString') is a missing entry, never a function.
 *
 * No WebAudio, no DOM — headless by construction, so a test can ask what a
 * composed id resolves to without opening an AudioContext.
 */
export function resolveRecipe(id) {
  const own = (key) =>
    (typeof key === 'string' && Object.prototype.hasOwnProperty.call(SFX_RECIPES, key)
      ? SFX_RECIPES[key]
      : undefined);
  const exact = own(id);
  if (exact) return { recipe: exact, matched: id, fellBack: false };
  const cut = typeof id === 'string' ? id.indexOf('_') : -1;
  if (cut > 0) {
    const family = id.slice(0, cut);
    const fam = SFX_FAMILY_IDS.includes(family) ? own(family) : undefined;
    if (fam) return { recipe: fam, matched: family, fellBack: false };
  }
  return { recipe: SFX_RECIPES.default, matched: 'default', fellBack: true };
}
