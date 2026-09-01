# Versioning — when each segment increments

The in-game stamp is `BUILD <MAJOR>.<MINOR>.<PATCH>.<ordinal> · src <digest>`
(currently `0.5.0-rc.1.<ordinal>`). This document is the decision workflow for the
three authored segments. It changes no machinery: the one home for the string
is `src/buildversion.js`, the release triple lives only in
`src/content/index.js` (`contentBundle.version`), and
`node tools/buildversion.mjs --check` keeps anyone from re-typing either.

## The four segments and their owners

| Segment | Who moves it | How |
|---|---|---|
| MAJOR | Constantine (Tier 2 decision) | hand-edit the one home, via PR |
| MINOR | Constantine, proposed in the delivering PR | hand-edit the one home, via PR |
| PATCH | Constantine, proposed in the delivering PR | hand-edit the one home, via PR |
| ordinal | nobody — `tools/bundle.mjs` writes `buildordinal.json` | derived, every rebuild |
| digest | nobody — derived from the covered source set | derived, every rebuild |

The ordinal ORDERS builds and the digest IDENTIFIES the source; neither ever
carries meaning about the size or importance of a change. A huge change and a
typo fix both move the ordinal by the same amount, on purpose — magnitude is
the release triple's job, and only a decision moves the release triple.

## Decision workflow at PR time

Ask these in order; the first "yes" names the bump. Record the answer as one
line in the PR body ("Version: no bump" / "Version: proposes 0.5.0").

```text
1. Does this PR break existing saves with no migration path,
   or is it the first governed public release?          → MAJOR
2. Does this PR complete a milestone that changes what
   the game IS — a new playable system live for players,
   a new class, a new act, a framework cutover tranche
   becoming the live authority, or a save-schema change
   that ships with its migration?                        → MINOR
3. Does this PR change shipped player-visible behavior
   (balance retune, bug-fix batch, content correction)
   on top of the current MINOR, and is a citable stamp
   for that correction wanted?                           → PATCH
4. Anything else — refactors, docs, evidence, tooling,
   tests, dormant candidates, behavior-preserving ports  → NO BUMP
   (the ordinal and digest still move on rebuild; the
   CHANGELOG receipt still records the delivery)
```

Rule 4 is why #508 (the whole framework candidate) and #509 (the first port
tranche) did not move `0.4.0`: both are proven behavior-preserving, so the
player's game did not change. The stamp is a promise to the player, not a
diffstat. The framework's own milestones map ahead of time:

- each behavior-preserving port tranche → **no bump**
- the atomic cutover (registries become sole authority, gate SUCCESS) → **0.5.0**
- Weight Class / Stamina / Dodge Roll turning ON for players → **0.6.0** (or
  rides 0.5.0 if cutover and enablement ship together)
- first governed release (release status leaves RED) → **1.0.0**

## Release candidates — the stamp names the milestone in flight

The ladder above answers "did the player's game change?" and it is why
nine behavior-preserving framework tranches left `0.4.0` alone. It could not
answer the other question the stamp gets asked: "which release is this build
a candidate FOR?" A QA tester holding `0.4.0.1903` had no way to read that
the framework port was in it, and the owner rightly asked why a change that
size was invisible in the number.

The answer is semver's own pre-release segment, not a bent ladder:

- **`<next>.<minor>.<patch>-rc.<n>`** stamps a line that is a CANDIDATE for
  the next release triple. `0.5.0-rc.1` says "the next release is 0.5.0 and
  this is its first candidate"; it orders BELOW `0.5.0`, so the final stamp
  still marks the milestone (the cutover gate SUCCESS) and nothing is
  claimed early.
- **`rc.<n>` advances at each `dev → test` promotion** — every candidate QA
  receives is distinguishable by its stamp, and the ordinal keeps ordering
  builds between promotions exactly as before.
- **The `-rc` suffix is dropped by the owner's release cut** (`dev → release`,
  owner-exclusive per `governance/delivery.json`), which is the MINOR bump
  the ladder already names. Nothing else removes it.
- The triple in the pre-release (`0.5.0` here) is the ladder's answer for the
  milestone in flight; it moves only when that answer changes.

The one home and the checks are unchanged: `contentBundle.version` holds
`0.5.0-rc.1`, the stamp reads `BUILD 0.5.0-rc.1.<ordinal> · src <digest>`, the
dist file is `AshenSpire-0.5.0-rc.1.<ordinal>.html`, and older CHANGELOG
receipts keep their `0.4.0.<ordinal>` stamps — the projector accepts any
`<release>.<ordinal>` and enforces the ordinal column, because receipts are
history and a bump must never make them unparseable.

Saves are not invalidated by a stamp change: on load, a run whose
`contentVersion` differs is re-stamped when every id it holds still resolves,
and archived with a named reason only when one does not (`engine/save.js`).

## Mechanics of a bump (one PR, one commit sequence)

1. Edit `contentBundle.version` in `src/content/index.js` — the only edit.
2. Add the CHANGELOG receipt naming the PR and, per convention, the ordinal
   as committed at that merge.
3. `node tools/about-changelog.mjs --write` (regenerate the projection).
4. `node tools/launch.mjs --build-only` (rebuild root + build/ + dist/).
5. `node tools/buildversion.mjs --check` and `node tools/verify-shipped.mjs`
   must both pass in the same tree that gets pushed.

A bump PR may carry the milestone it stamps, or stamp an already-merged
milestone by itself; it never carries unrelated work.

## MAJOR and the release gate

`1.0.0` is not a size judgement — it is the release-governance event: the
separately-governed release status leaving RED, with whatever checklist that
decision carries (the CI matrix question in `.github/workflows/ci.yml`
included). After 1.0.0, MAJOR moves only for a save-compatibility break or
the removal of a shipped gameplay system.

## What never moves the release triple

Rebuilds, docs, evidence, agent-ops changes, test additions, refactors,
dormant candidates, and behavior-preserving ports — however large. If a
change of this kind feels like it deserves a stamp, the stamp it deserves is
its CHANGELOG receipt, which already names the PR and the ordinal.
