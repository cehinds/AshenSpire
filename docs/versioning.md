# Versioning — when each segment increments

The in-game stamp is `BUILD <MAJOR>.<MINOR>.<CANDIDATE>.<BUILD> · src <digest>`
(currently `0.5.4.<build>`; see "The candidate is the third component" below). This document is the decision workflow for the
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
- **Ordering is by the WHOLE version, component-wise numeric** — superseded
  2026-09-01, see "The candidate is the third component" below. Until then the
  ordinal was the one monotonic key: it never reset, so any two builds sorted
  by it alone, and every tool that orders builds (`about-changelog`,
  `buildversion` row H) read the ordinal column.
- **The `-rc` suffix is dropped by the owner's release cut** (`dev → release`,
  owner-exclusive per `governance/delivery.json`), which is the MINOR bump
  the ladder already names. Nothing else removes it.
- The triple in the pre-release (`0.5.0` here) is the ladder's answer for the
  milestone in flight; it moves only when that answer changes.
- **The candidate rides on the BASE PATCH, and `0.5.2-rc.1` is refused.** Not a
  narrow regex — a slot that does not exist. The stamp holds major, minor,
  candidate and build; a patch-bearing candidate is a fifth fact with nowhere
  to go, so `0.5.2-rc.4` and `0.5.1-rc.4` would BOTH fold to `0.5.4` and two
  different releases-in-flight would share one version. Review on #579 built
  `0.5.2-rc.4.9 → 0.5.1-rc.4.10`: a rise by the folded version while the
  release the candidate is *for* moved backward. It is the same collision the
  `rc`-only rule refuses in the tag, through the other component, and the same
  answer — the NOTATION would have to change before such a release could be
  stamped, so until then it is refused rather than silently folded.

## The candidate is the third component (2026-09-01)

Constantine, reading `0.5.0-rc.4.1959`: "I must have misunderstood the ordinal
... I thought it was going to be something like 0.5.3.2" — and then the rule,
the tail "should restart the ordinal to 0.5.4.0 and increment from there".

So the stamp is `<MAJOR>.<MINOR>.<CANDIDATE>.<BUILD>`. The candidate number
moves into the third component and the tail counts builds WITHIN that
candidate, restarting at `0` when the candidate advances. `0.5.3.1` is the
second build of the third 0.5 candidate. `contentBundle.version` holds `0.5.4`
— the same fact in his notation — so the one home and the one composition are
unchanged; only what the components MEAN moved.

What this changes, each with the check that carries it:

- **The ordinal no longer orders on its own, and nothing may read it as if it
  did.** `0.5.4.0` is newer than `0.5.3.2` with the lower tail. Comparison is
  component-wise numeric over the whole version, and `about-changelog` compares
  stamp tuples on that basis.

  **`bumpOrdinal`'s reset and row H's comparison are two different rules, and
  conflating them is a defect this document once carried.** The BUILD resets
  the tail to `0` when the release string moves — that is where `0` comes from,
  and it is the only place it is required. Row H asks a weaker and different
  question: did the WHOLE VERSION rise? Within one release that reduces to a
  strictly higher tail. Across a release change it does not, and must not: a
  candidate branch that produced several builds before merging lands on a
  non-zero tail, and `0.5.4.9 → 0.5.5.3` is a perfectly ordered advance. Row H
  demanding `0` there was the defect #574 shipped and #579 removed; stating the
  rule as a reset would invite its restoration. A parent whose era cannot be
  established — an ordinal recorded with no release beside it — is UNKNOWN,
  which blocks, because a missing field is not proof that the parent predates
  the field.

  **Only a version the grammar admits is ordered at all, and the grammar has
  ONE home.** The tuple builder asks `releaseSyntaxError` rather than restating
  part of the syntax, so an arity the grammar forbids is refused with the
  non-numeric components it always refused. It restated the shape once, and a
  parent recording `0.5` was ranked as `[0, 5, <ordinal>]` against a `0.5.5`
  child — the parent's TAIL compared against the child's CANDIDATE, reported as
  a rise. Row F sees only the CURRENT record, so an unorderable parent is
  visible to row H alone; there it is UNKNOWN, never a verdict assembled from a
  component nobody wrote.
- **The `rc.9` ceiling is gone with the padding that motivated it.** Padding
  bought a naive STRING sort, which the candidate cannot survive in the third
  component: `0.5.10.0` string-sorts below `0.5.9.0` however the tail is
  padded. A tenth candidate is now just `0.5.10.<n>` and sorts correctly under
  numeric comparison — and that comparison has NO ceiling of its own, because
  it reads the digits rather than converting them. Through `Number`, two
  candidates one apart above `Number.MAX_SAFE_INTEGER` collapse onto a single
  value and a backward move reads as a rise off the tail alone. Comparing digit
  strings — longer is larger once leading zeroes are gone, equal lengths
  compare lexically — holds for every length the grammar admits, so no bound
  had to be chosen and none can be outgrown.

  **The TAIL is bounded, and the asymmetry is the point.** A release arrives
  as a string and keeps its digits, so refusing a large one would discard
  information the tool still has. An ordinal arrives as a JSON *number*: past
  `2^53` its digits were destroyed by the parse, and past `1e21` `String()`
  stops emitting digits at all — `1e+21` read as a digit string is five
  characters, which a length-first comparison ranks BELOW a twenty-one digit
  one. So a tail outside the safe integer range is UNKNOWN. Bounding is the
  honest answer exactly where the digits are already gone, and the wrong one
  everywhere they survive.

  **AND ORDERING HAS ONE HOME: `tools/buildversion.mjs`.** `versionTuple` and
  `compareVersions` answer "which of these two builds is newer" for everything
  that asks — row H whether or not the release moved, and
  `about-changelog`'s `stampKey`, which keeps only the one fact that is its own
  (the legacy/new *scheme* element separating `0.5.0-rc.4.1956` from `0.5.4.0`
  within one candidate). Nothing else re-parses a release or re-coerces a
  component. This is row B's rule — NO SECOND COPY — applied to a rule rather
  than a value, and it was learned the expensive way: the changelog carried a
  parallel implementation, and four consecutive review rounds fixed the gate
  while the same defects stayed live in the copy, until the two tools certified
  opposite answers about one pair of stamps. A stamp the shared grammar cannot
  order is REFUSED by the changelog, never skipped — a check that goes quiet on
  the input it cannot judge is the failure this whole section is about.
- **The ordinal is no longer the commit count.** `bumpOrdinal` was
  `max(recorded + 1, rev-list --count)`; a per-candidate counter cannot be the
  commit count because it resets, so it is `recorded + 1` and nothing should
  read it as an approximation of history length. The digest still identifies
  the tree exactly.
- **The recorded release rides in `buildordinal.json` beside the ordinal**, and
  row F locks it: a count within a release whose release is unnamed is a number
  with no subject, and a hand-edit of that field alone would license a restart
  the tree never earned.

**One cost, stated rather than discovered.** The patch number of the release
being auditioned no longer appears, so a shipped `0.5.0` would sort BELOW the
`0.5.4` that led to it. A release under this scheme must be numbered past its
last candidate. Raised with the owner when the directive was given; his call.

CHANGELOG receipts for the closed candidates `rc.1`–`rc.3` are restated in the
new notation. The `0.4.0.<ordinal>` line keeps its ordinals — that line was
never candidate-scoped — and `0.5.0-rc.4.1956`, the build the scheme changed
under, keeps the stamp its artifact actually wears. The projector accepts both
notations, because receipts are history and a scheme change must never make
them unparseable.

A receipt written in the pull request that ships its change cites the ordinal
its own projection rebuild produces (current ordinal plus one); `--write`
allows exactly that one build ahead while projecting, the plain check never
does, and the rebuild that follows makes the box and the receipt agree. Any
later rebuild on the branch re-points the receipt the same way (CHANGELOG.md
header).

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
