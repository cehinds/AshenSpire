# Canonical reaction-art search and implementation decision

**Decision:** ordinary player HIT should keep the selected character frame and
apply the existing finite recoil/flash reaction. Matching Starseer reaction art
exists in the canonical source tree, but it is an unfinished authoring draft.
It is not being published or silently presented as an approved runtime asset.

Search date: 2026-11-27, America/Anchorage. This note supplements the frozen
planning baseline; it does not rewrite its before-images or measurements.

## Canonical source established

- Live `cehinds/AI-Art` branch `ashenspire`:
  `75d0ba9650ee17eb7a5af74594b3a8a6a490896f`, verified by `git ls-remote`
  and read-only GitHub API.
- Canonical Git tree: `334a849a42c50e66e2ef64773149e7b8f5ab0406`.
- Existing local checkout: `C:\repos\AI-Art-recipient-effects`, HEAD
  `9b72f401a036a9219dedfbf6de3c4487c3a94e63`, branch
  `feature/ashenspire-recipient-effect-sequences`.
- The local HEAD has the **same tree** as canonical `ashenspire`; its working
  tree was clean. Its branch name was not used as evidence of authority.
  No checkout, fetch, reset, Git write, or artwork change was performed.
- The full tracked tree has **32,588 paths** and no `AGENTS.md`, `CLAUDE.md`,
  or `AURORA.md`. Canonical root README, stance README, Starseer/Rogue/Herald
  renewal READMEs, class-Smash README, and alternative-art provenance README
  were read. Root guidance preserves existing source/license records; inclusion
  in AI-Art does not create a new license.

Some authoring paths are absent from the sparse local working tree. Full
`git ls-tree` discovery and pinned GitHub file reads covered those paths.
Local file discovery alone would have missed the matching renewal reaction.

## Starseer candidates inspected

| Source family | Inspected result | Disposition |
| --- | --- | --- |
| Selected `hd/assets/animations/unarmed-magic/starseer/HURT.webp` | Pointed hat, different costume and more frontal body | Reject for the canonical hooded staff character. |
| Other default HURT families: unarmed, dagger, greatsword, sword/shield, twin swords | All six weapon-family HURTs retain the older pointed-hat identity; weapons vary | None is a matching drop-in source. |
| `hd/assets/painted-outfits/starseer/hit.webp` | Older pointed-hat identity | Reject for this character. |
| `hd/assets/poses/starseer_hit_gold.webp` | Older pointed-hat identity and gold contour treatment | Reject for this character. |
| `pose-studio/renewal/starseer/frames/hurt.png` | Correct low gray hood, layered mantle, cylindrical waist accessories, blue/gold staff; leaning-back reaction | Matching authored candidate, still draft. |
| `pose-studio/renewal/starseer/frames/hurt-recover.png` | Correct character, with a disconnected fragment visible near the bottom-right edge | Draft cleanup/review needed before any runtime export. |

The eight older default reaction rasters were visually inspected. Their actual
local Git blob hashes match the canonical tree. This search also found outfit
variants and older source families; filenames alone were not accepted as proof
of matching identity. It is a bounded search, not certification of every outfit.

The exact canonical paths are pinned in [canonical-search.json](canonical-search.json).
The prior [before-only identity sheets](../../visuals/IDENTITY.md) show the wrong
runtime HURT character; the three new reference PNGs below are unchanged copies
of canonical authoring inputs, **not after-images or replacement exports**.

| Canonical authoring input | Retained unchanged reference | Git blob SHA-1 |
| --- | --- | --- |
| `pose-studio/renewal/starseer/frames/ready.png` | [Ready](canonical-starseer-ready.png) | `d8db69cc5fbf0364643bcebb2655c8aadc44c3b9` |
| `pose-studio/renewal/starseer/frames/hurt.png` | [Hurt](canonical-starseer-hurt.png) | `61c6cbf16e00c2d16599018d06f86920a5ddd13a` |
| `pose-studio/renewal/starseer/frames/hurt-recover.png` | [Recover](canonical-starseer-hurt-recover.png) | `2d766babe44f6715c40df802e7c6eafc23d2782e` |

Each retained reference was decoded from the pinned GitHub file response and
verified against its Git blob SHA-1 before writing. The JSON record also retains
SHA-256 and byte counts. No source pixels were edited or generated.

### Provenance and draft status

[Canonical Starseer README](https://github.com/cehinds/AI-Art/blob/75d0ba9650ee17eb7a5af74594b3a8a6a490896f/pose-studio/renewal/starseer/README.md)
calls this a continuation draft with empty gameplay bindings. It leaves final
hand contacts, hurt staff-tip margin, and body/weapon separation open before
runtime publishing. The manifest is `authoring-preview`; Starseer/staff coverage
is `draft`. No published `common/` Starseer hurt/recoil export was found in this
canonical tree.

The ready seed SHA-256 is
`f370649322a99ed28f281ffd87dd001a68b1fed202445bdc112fee84872a3be6`.
The approved class-Smash provenance references that same ready seed. That links
the matching draft to the class reference, but does not grant the draft HURT
source its own runtime approval.

Pinned path history in AI-Art identifies the current older unarmed-magic HURT
as imported in `73e55f5cca7b3b6c427b86d91e310a9c8980d475`, the old painted hit
in `eab2f12e036095ce98559a5f109e9a5d8ce8e2a6`, and card-ready in
`45679434c36c623ed2ea830d163d7be2903bdeb6`. Those path histories contain
the import commits, not subsequent matching-reaction corrections. Earlier
pre-migration game/source-repository history was not exhaustively inspected.

## Other class reaction candidates

Canonical renewal source also includes:

- Reaver: `pose-studio/renewal/frames/hurt.png` — inspected; steel armor, red
  cape and sword, closer to the current class than the selected older HURT.
- Rogue: `pose-studio/renewal/rogue/frames/hurt.png` — inspected; brown hood,
  green-gray mantle and twin daggers. Its README describes an unbound draft;
  current dagger/buckler equipment continuity needs review.
- Herald: `pose-studio/renewal/herald/frames/hurt.png` — inspected; correct
  red-hood costume family, but a sword/shield study. It is unbound and has
  remaining contact/cloak/layer review; it is not a direct match for every
  current class-reference action.

These findings correct the narrower planning statement that no matching source
was established. Matching or closer authored sources do exist; their approval,
equipment, registration, and export readiness remain separate questions.

## Why reuse the active frame first

The production stage already owns a finite hit clock, seven-phase red-mask
reaction, and eased recoil. The current model uses minimum **280 ms**, red phases
**2, 4 and 6** of seven at opacity **0.85**, and a recoil peak of **-14 canvas
units** at **30%** progress. The action clock and current held/rest pose are
already independent of that reaction clock.

Using the current selected frame preserves identity, weapons, body scale, and
the appropriate pose during an action interruption. The same mask and recoil
can still make the hit visible. It avoids switching to an older character or
publishing an unfinished source draft.

The tradeoff is less pose deformation than a bespoke authored recoil sequence.
That refinement remains optional follow-up work, not a delivered part of the
first implementation. New artwork is unnecessary for the chosen approach.
Renderer/model changes and final browser acceptance belong to Worker A and the
coordinator; this note does not claim those changes have passed.

## Read-only review acceptance for the implementation

The same checks apply to Reaver, Rogue, Starseer, and Herald:

- [ ] Ordinary HIT draws the currently selected class frame; none of the older
  foreign HURT images replaces it, even after its former preload would have completed.
- [ ] Ready and held-stance hits preserve that pose's physical calibration and
  registration while existing recoil/flash provide feedback.
- [ ] A mid-action hit does not settle, replace, or restart the action. Its
  selected sequence continues; any frame progression is the action's own.
- [ ] Repeated hits restart the finite reaction correctly and do not change
  character identity, lose the current stance, or leave the stage busy forever.
- [ ] `endReaction`, skip, hold/pause, and action completion retain their existing
  ownership and do not clear an unrelated action.
- [ ] Reduced motion, still presentation, hit-motion off, flash-off, and
  reduce-flashes settings retain their documented behavior.
- [ ] Reaver's authored target-body reactions retain precedence and return to
  the applicable pose; generic HIT does not replace them with another character.
- [ ] Defeated actors do not resume a living pose or gain a new hit timeline.
- [ ] Shared HUD/target reference geometry remains stable, and recoil does not
  incorrectly move independent effects/trails.
- [ ] Normal-speed and deterministic before/after evidence covers held and
  mid-action hits, including all four classes and relevant device/tier settings.

These are review criteria for upcoming code, not completed implementation tasks.