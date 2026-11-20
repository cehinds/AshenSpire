// src/model/validate/mapBalance.js — the second-beat table, map margins, grace refill, flask growth, poise, map configs and audio recipes.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { resolveFloorPlan } from '../floorplan.js';
import { assertTableSane } from '../secondbeat.js';
import { viewRefusals, geometryRefusals } from '../map/mapview.js';
import { graceRefillRefusals } from '../gracerefill.js';
import { flaskGrowthRefusals } from '../flaskgrowth.js';
import { SCHEMAS } from '../schemas.js';
import { validateEffects } from './effectGrammar.js';
import { validateSfxRecipes, validateMusicBeds, walkSchema } from './schemaWalk.js';

export function mapBalanceProblems(b, err, ctx) {
  const { vctx, dependencySafeBundle } = ctx;
  // THE SECOND-BEAT TABLE, checked at the same boot and for the same reason as
  // the dial above. It is CODE, not content, so it can never be a row a
  // designer breaks — but it is a table, and a table whose row is malformed
  // resolves to a plausible 'none' and takes a safety step off a button with
  // nothing on the screen looking different. That is Law 0 clause 5 exactly:
  // the dangerous failure is the silent plausible derivation, so the derivation
  // is asked to prove itself out loud on every boot that validates anything.
  for (const complaint of assertTableSane()) err('secondBeat', complaint);

  // THE MAP'S VERTICAL MARGIN, and it belongs here because it has exactly one
  // data input. `balance.ui.tapSize.def` is what the map node's radius is SOLVED
  // FROM (model/map/mapview.js), so raising it grows the target and eats the space
  // BETWEEN two adjacent targets in the same stroke — at 08e184a, 44.09 px of
  // node against a 47.0 px row pitch at 390x844, under 3 px of air between taps
  // both start a fight nobody can undo (Sunna, 2026-08-08). Nothing was watching
  // that number; a refusal that prints a verdict and not a margin cannot be.
  // THE MAP'S COLLISION MARGIN, and it belongs here because it has exactly one
  // data input. `balance.ui.tapSize.def` is what EVERY map circle's radius is
  // SOLVED FROM (model/map/mapview.js), so raising it grows every circle while the
  // pitches they are measured against do not move — targets grow, the space
  // between them does not. Sunna's sentence, written about the event screen's
  // choice bars weeks ago and true here too: nothing in this game read a gap.
  // A refusal that prints a verdict and not a margin cannot be watched.
  //
  // It rules on the pairs a content edit is answerable for. The boss/shrine pair
  // is RED at the shipped default — rendered, every act, since #107 — and is
  // deliberately NOT gated here, because a boot banner the player cannot act on
  // is a worse failure than the overlap. That exemption carries a latch:
  // `mapplan --selftest` asserts the pair is still red, so the excuse cannot
  // outlive its reason. `node tools/mapplan.mjs --margins` is where it is red.
  //
  // Asked ONCE of the bundle rather than per act: it does not vary with
  // mapConfigs, and three identical errors would be three copies of one fact.
  // The corpus it has to turn red is `node tools/mapplan.mjs --selftest` — the
  // same corpus the mapConfigs block below points at, and its rows for this
  // refusal are in it, so neither pointer dangles.
  // Guarded on `balance` and NOT on `balance.ui.tapSize`, deliberately: guarding
  // on the entry means deleting the entry silences the check that watches it.
  if (b.balance != null && typeof b.balance === 'object' && !Array.isArray(b.balance)) {
    for (const e of geometryRefusals(b.balance)) err(e.key, e.msg);
  }
  // balance.graceRefill — what a grace hands back (Constantine, 2026-08-08).
  //
  // TAKES THE WHOLE BUNDLE, not `b.balance`, and that is the point: three of its
  // eight refusals can only be asked with the flask ENTRIES in hand (does this
  // kind have a member, does this override resolve, is the override of the kind
  // the row claims). A refusal that could only see `balance` would be checking
  // the half that was never in doubt.
  //
  // Its corpus is `node tools/gracerefill.mjs --selftest`, which plants each
  // refusal into the real bundle and watches this call go red.
  for (const e of graceRefillRefusals(b)) err(e.key, e.msg);

  // The growth chain (balance.flaskGrowth) — same refusal shape, same door.
  // Its corpus is `node tools/flaskgrowth.mjs --selftest`, which plants each
  // refusal into the real bundle and watches this call go red.
  for (const e of flaskGrowthRefusals(dependencySafeBundle)) err(e.key, e.msg);

  // balance.poise is engine-consulted data: { growthMult?, onFill? } (see ENGINE-API.md)
  if (b.balance && b.balance.poise) {
    const p = b.balance.poise;
    if (p.growthMult != null && typeof p.growthMult !== 'number') err('balance.poise.growthMult', 'must be a number');
    if (p.onFill != null) validateEffects(p.onFill, 'balance.poise.onFill', vctx);
  }

  if (b.mapConfigs != null) {
    if (typeof b.mapConfigs !== 'object' || Array.isArray(b.mapConfigs)) {
      err('mapConfigs', 'mapConfigs must be an object keyed by act number');
    } else {
      for (const act of Object.keys(b.mapConfigs)) {
        const cfg = b.mapConfigs[act];
        walkSchema(cfg, SCHEMAS.mapConfig, `mapConfigs.${act}`, vctx);
        // THE SECOND LAYER — meaning, not shape. The schema cannot know whether
        // floor 9 exists in THIS act; that needs `floors`, so it is asked here.
        // This is the boot-time half of Law 1 clause 5: bad data fails loud and
        // NAMES THE ENTRY, rather than being clamped, defaulted, or ignored.
        // The corpus it has to turn red is in tools/mapplan.mjs --selftest.
        if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
          for (const e of resolveFloorPlan(cfg).errors) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
          // AND THE SAME LAYER FOR THE KNOBS WHOSE FAILURE IS A VIEW FAILURE.
          // `floors: 2` already refused by name; `columns: 10` did not, and it
          // makes Constantine's "the current node and its connecting nodes fit"
          // unsatisfiable at every zoom the ladder has — a knob that hands him a
          // broken climb instead of a reason (Law 1 clause 5).
          //
          // AND EVERY ONE OF THESE NOW CARRIES ITS MARGIN, not just its verdict.
          // `columns: 9` was accepted at 1.02x with zero spare columns and the
          // word "accepted" was the whole answer (Vira, 2026-08-08).
          for (const e of viewRefusals(cfg)) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
        }
      }
    }
  }

  if (b.sfx != null) validateSfxRecipes(b.sfx, 'sfx', vctx);
  if (b.music != null) validateMusicBeds(b.music, 'music', vctx);
}
