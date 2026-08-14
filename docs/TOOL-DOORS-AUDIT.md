# The doors, audited — the instrument corpus at dev = 929b6ea

*Vira, 2026-08-14. Marina's deal: the first standing audit of every tool against the
same-door clause of *The instrument rule* (`development.md`, family repo, amended
2026-08-08 by me): **the known-bad must enter by the same door the real input enters,
and the check states its door in its own output.***

**The bar's own standing, stated before anything is measured against it:** the same-door
amendment is **Tier 2, written and unapproved** — `development.md`'s own header says it
binds nothing until Constantine says so. Law 5 clause 5 (approved) independently requires
observed-red for its own check. This audit measures against the amendment as Marina's
commissioned bar; a red here is a finding for an owner, never an enforcement act.

**The prior:** eleven instruments ran dead and printed a plausible number in one session
(2026-08-08). Six of the failed plants entered downstream of the defect they hunted.
That base rate is why this table exists.

**Method and its honest ceiling.** ~90 `.mjs` files in `tools/` plus the 82-check suite.
Depth is per-row and named: **run** = selftest executed in this isolated clone at
929b6ea, exit code recorded; **read** = mechanism code read to its entry point;
**pattern** = header + grep of plant sites only. A `pattern` row is a claim about what
the file says, not about what it does — my own failure mode #2, named rather than
committed.

## Verdicts

- **SAME-DOOR** — plant enters where the real input enters; every stage the real run
  performs runs.
- **DOWNSTREAM** — the plant enters below the defect class hunted; the exercised half
  was never in doubt.
- **OBSERVED-ONCE** — a real red was watched at authoring, by the real door, but it is
  **ref-pinned and not re-runnable**; under SOP 2's drift clause it is `unknown
  (drifted)` at every later ref until re-observed.
- **NO-KNOWN-BAD** — a check with no observed red at all.
- **DEAD** — a mechanism that exists and cannot fail (or cannot run).
- **HARNESS** — not a check; asserts nothing; the rule has no claim on it.

## The checks with a runnable mechanism (run or read this act)

| tool | mechanism | door verdict | depth | owner if red |
|---|---|---|---|---|
| axisfit | selftest plants a 2000px child into the live `.map-scroll`, read back through SCAN; ratchet plant survives SCAN (5b) | **SAME-DOOR** — Rune's 2026-08-14 repair verified: travel is planted, not inherited from the dead defect; door named in output | run, exit 0, 15 mechanisms | — |
| statusreach | 4 real-door plants recorded (real CSV edit + recompile + CLI), in-memory selftest states its own downstream-ness aloud; DOOR block printed every run | **SAME-DOOR** — the model citizen; both halves exist and each names what it does not cover | run, exit 0, 15 assertions | — |
| closedsets | 5 plants + 1 floor + clean baseline written into a **copied real tree on disk**, read back through the same `collect()` | **SAME-DOOR** — door in the RESULT line | run, exit 0, recall 7/7 | — |
| hudbars | the known-bad IS the shipped tree at an older ref; hybrid/per-resource plants entered by scratch edit → rebuild → the same `?shotMaxHp` field a curse writes; DOOR line at the foot of every run | **SAME-DOOR** | read (browser run not repeated) | — |
| flaskgrowth | three doors enumerated in the header; refusal plants → `validateContent`, run plants → real op doors, save plants → the real save manager; honest ceiling stated (relic loss has no real door) | **SAME-DOOR** | run, exit 0, 15+20+6 | — |
| holdconfirm | real pointer input at real coordinates; `--mutate` puts the old door back on all eight armed surfaces in the live page, eight separate verdicts | **SAME-DOOR**, one shaded arm: `--schema` hands its 5 known-bads straight to `validateContent()` — that **boot calls** the validator is unwitnessed | read | Sunna (the shaded arm; small: witness the boot call once) |
| content-build | K1–K18 known-bad files through the tool's own compile paths, red BY NAME | **SAME-DOOR**, with a **STANDING RED**: K15 expects `validate.js` green on a deleted `balance` (door measured open) and validate now refuses — the plant's premise died when someone closed the door, and nobody re-measured the claim. Failing at acb8ffe (2026-08-14, my vigour act) and at 929b6ea alike | run, **exit 1** | **Viki** (with Bjorn; re-rule what K15 claims now the door is shut) |
| gracerefill | refusal plants → `validateContent(realBundleCopy)` (the boot call), behaviour plants → `createRegistries` + `applyGraceRefill` (the shrine path) | **SAME-DOOR**, two defects found: (1) the living fixed-capacity branch printed **no door statement** — fixed this act, one output block; (2) the full legacy corpus (Law 0 falsifier, ladder assertion, 15 refusal plants) is **DEAD on this tree** — it runs only when `flaskCapacity` is not an integer, and it is 3. The RESULT count silently shrank 15+20 → 3+2 | run, exit 0 both edges | **Sten / current owner** (port the dead corpus's plants to the fixed-capacity model or delete them; a corpus that silently stopped running is the eleven-instruments shape) |
| dirorder | a real directory of the real 34 names on the real filesystem, read through the real export | **SAME-DOOR** | run, exit 0 | — |
| linkcheck | plants 5 known breakages in a **copy of the tree**, requires each red and the clean tree green | **SAME-DOOR** | run, exit 0, 5/5 | — |
| zoomunits | corpus = real tree files (incl. frozen fixtures dir) through the same `scan()` the run uses; recall counts printed | **SAME-DOOR** | run, exit 0, recall 2/2, cleared 4/4 | — |
| verify-shipped | corpus includes **the real stale artifact pulled from history by blob id**; checks are pure functions over bytes so the corpus feeds them | **SAME-DOOR** for the artifact, one named shading: the corpus enters at the byte-functions, the disk-read stage carries no plant; its own boundary block names its limits | run, exit 0 | — |
| bundle.test | plants brace/strict faults into a **disposable copy of the real source**, runs the real parse gate | **SAME-DOOR** | read | — |
| carried.mjs *(family repo)* | real commits in real git repos through the same `report()`; DOOR block names entry point, artifact, stages passed and not passed | **SAME-DOOR** | run, exit 0, 17/17 | — (mine; audited with the same knife) |
| asks.mjs *(family repo)* | 25 plants at `deriveRows()` / the real extractors; fabricated texts through the same clause pipeline as the real `directions.md`; check-6 door stated in the main run | **SAME-DOOR for extraction; DOWNSTREAM for attestation** — every row plant passes `skipGit: true`, so the git-attestation stage (line 567) has **no known-bad at all**; and the selftest output does not state where its plants enter | run, exit 0, 25/25 | **Saga** (two smalls: one plant with git on, in a scratch repo; a door block in the selftest output — carried.mjs's is a template) |
| mapfog | selftest ladder against real generated graphs; `--mutate` falsifies the page's own census | **SAME-DOOR** | read | — |
| mapplan | three known-bad corpora entering at the planner's config door (the real input for a generative planner) + generative property checks | **SAME-DOOR** | read | — |
| mapfit | `--mutate` reinstates the real defect in the page | **SAME-DOOR** | read | — |
| mapreach | `--mutate=bar\|chrome\|clamp\|text`, "mutate not caught" is its own exit state | **SAME-DOOR** | read | — |
| seedrefuses | `--mutate` breaks the **rendered page** after the app has done its work | **SAME-DOOR** | read | — |
| holdbeat | `--mutate` neuters `ctx.resume` on the live context | **SAME-DOOR** | read | — |
| surfaces | plants each breakage in memory via the reader every real read goes through | **SAME-DOOR** (reader-injected; the disk read alone carries no plant) | read | — |
| screen-census | same discipline as surfaces, one layer lower (`fsReader()`) | **SAME-DOOR** (reader-injected) | read | — |
| overlapreader | "door, for every case below: known-bad enters as a CONTENT ROW" — printed in the run's own output | **SAME-DOOR** | read | — |
| measure-classes | planted drifts enter the decision layer — which IS the defect class (policy drift between this tool and runsim) | **SAME-DOOR** for its class | read | — |
| shotguard-probe | `--mutate` defeats the gate with inverted expectation; `--selftest-unavailable` | **SAME-DOOR** | pattern | — |
| music-silence-probe | plant deletes a relied-on bed from the live table **before** the real engine boots | **SAME-DOOR** (in-memory content door; engine runs whole). Door not stated in output | read | Vega (one output line) |
| sfx-loudness | selftest makes a recipe 20 dB quieter | **SAME-DOOR** (content door) | pattern | — |
| sfx-authority-contract | meta-check: runs the check's selftest and asserts the planted ids are named | **SAME-DOOR** (meta) | pattern | — |
| sfx-gain-probe | plant removes one duplicate peak from the **measured pool** — the comparator's door, not the recipe's | **DOWNSTREAM by declared choice, honestly scoped**: the defect it guards WAS in the comparator (the `includes` alibi, my #46 finding), so for that class the door is right; the recipe-drop class has no plant | read | Vega (optional: one recipe-door plant) |
| flask-data-authority | 3 plants are **hand-typed strings** fed to the acceptance regexes; the real input enters by `readFileSync` of the real sources and no plant walks that road | **DOWNSTREAM** — the grep tested on the sentence it imagined; a shape drift in the real file blinds the regex while the plants stay green | read | **Rune** |
| markhome | CORPUS.bad/good CSS strings fed to `judge(sel)` directly, downstream of the file read and selector extraction | **DOWNSTREAM** (mild — the judge is most of the tool, but extraction carries no plant) | run (corpus held) + read | **Sunna** |
| inspecthold | `--root DIR` points the whole tool at a pre-fix tree — the whole-app door | **SAME-DOOR when run; the known-bad tree is ref-pinned** (needs the old checkout to exist) | read | — |
| handlayout | same `--root` discipline | **SAME-DOOR when run; ref-pinned corpus** | pattern | — |
| profile-first-run | "the pre-fix tree IS the known-bad" — copy the file into the old tree and watch it fail | **SAME-DOOR when run; ref-pinned corpus** | read | — |
| mobilefit | grid floors re-run per invocation; post-Law-5 repair states its document-scope in its own output and points at axisfit | **SAME-DOOR for its narrowed claim** (document axis only, and it now says so) | pattern | — |
| actends | observed red AND green on real trees, nothing mutated | **OBSERVED-ONCE** (real door, ref-pinned) | pattern | Bjorn |
| mapspacing | measurer with assertions; no plant found | **NO-KNOWN-BAD** (pattern-read; may be a measurer) | pattern | Bjorn |

## The checks whose only red is ref-pinned, or who have none (the finding class)

**OBSERVED-ONCE** (a real red at authoring, by the real door, not re-runnable — under
SOP 2 these rot; each row is `unknown (drifted)` at 929b6ea until re-observed):

| tool | the one observation | owner |
|---|---|---|
| quicknav-reach | three manual breakages at authoring; **the header promised a `--selftest` that never existed** — passing it ran the ordinary sweep under a corpus-run's name. Fixed this act: header corrected, the flag now **refuses at exit 2** | **Rune** (a runnable corpus is still owed) |
| menufit | red at `d027a9a` dist | Rune |
| screenreach | "this branch before the two fixes" | Rune |
| gesture-cancel | "this exact file against both known-bads" | Rune |
| actionreach | the first-shipped grid | Rune |
| player-poise-threshold | a documented manual scratch-edit procedure | Rune |

**NO-KNOWN-BAD** — checks that assert, with no observed red found in code or header
(pattern-read; "Observed-red contract" headers claim a birth-red I could not re-run
and did not find as a mechanism): equipment-stat-isolation, equipment-surface-receipts,
class-loadouts, cross-class-equipment, starting-kit-discovery, presentation-matrix,
arcane-exposure-engine/-schema/-ui/-visual, attribute-phase1-boundary, hybridstats,
flask-reallocation, flask-action-contract, flask-intent-smoke, flask-menu-cancel,
flaskpresentation, derived-runtime-authority, derivedstats, status-presentation-authority,
coop-combat-smoke, coop-secondbeat, coop-shoot, lan-smoke, lan-resume-smoke,
session-smoke, session-resume-smoke, profile-durability-probe, profile-surface-drive,
restore-settings-drive, refusal-audit, ai-disclosure, bjclauses, settingsreach, tapsize,
tutorial-reach, veil-owns-input, zoomplace, rebuild-matches. **Thirty-seven.** Many were
born red-first per their headers — but a birth-red is ref-pinned, and none of these can
re-observe it. Proposed owner: **each check's author**, batched by Marina; the cheap
form is the `--root`/pre-fix-tree pattern or one in-memory plant per tool.

**HARNESS / generator / probe — the rule has no claim** (they assert nothing):
serve, launch, bundle, session, lan, screenshot, webaudio-stub, parchment,
release-shots, balance, runsim, contrast-audit, artifact-provenance (facts only, never
fails a run), mapspacing (if measurer — see row above), *.py, palette-check.sh.

## The suite

`tests/run-node.mjs` — 82 checks at this ref. No blanket verdict is honest: red-first
discipline is applied per-test by recent acts (50b/50c observed red at `9b8294c` before
their fix, my vigour act; zoomunits' binding tests observed via PR #149's red-first
commits), and older tests carry no such record. The suite hands its filesystem in and
skips loudly where a harness lacks one — that part is right. A per-test door census is
its own act, not this one.

## Counts

- **SAME-DOOR: 31** (of which 3 carry a named shading: holdconfirm's `--schema` arm,
  verify-shipped's read stage, sfx-gain-probe's declared comparator scope)
- **DOWNSTREAM: 3** — flask-data-authority, markhome, asks.mjs's attestation stage
- **OBSERVED-ONCE (ref-pinned, rots): 6** — quicknav-reach, menufit, screenreach,
  gesture-cancel, actionreach, player-poise-threshold (+3 same-door tools whose
  *corpus* is ref-pinned: inspecthold, handlayout, profile-first-run)
- **NO-KNOWN-BAD: 37** asserting tools with no re-runnable red
- **DEAD: 2** — quicknav-reach's phantom `--selftest` (fixed: now refuses);
  gracerefill's legacy corpus (still dead; owner proposed)
- **STANDING RED: 1** — content-build K15, failing identically at acb8ffe and 929b6ea
- **HARNESS (exempt): ~16**

## Fixed in this act (surgical only)

1. `tools/quicknav-reach.mjs` — header's false selftest promise corrected; the flag now
   refuses at exit 2 instead of silently running the sweep. Observed both edges.
2. `tools/gracerefill.mjs` — door statement added to the living selftest branch's
   output, including the sentence that its plants are in-memory (the load stage carries
   no plant) and that the legacy corpus does not run on this tree. Observed, exit 0.

Everything else is a classified finding with an owner proposed above. No PRs opened.

## Boundary

One Linux box, node v22.22.2, isolated clone at 929b6ea, headless Chromium for axisfit
only. Browser tools other than axisfit were read, not run, this act — their door
verdicts are code-reads and say so in the depth column. `pattern` rows are the weakest
claim in this file. The 37-count is a census of *absence of mechanism in the code*, not
proof no red was ever watched — a birth-red recorded only in a commit message would not
appear to my grep. The suite's per-test doors are unaudited. And this table is itself
ref-pinned: it rots at the first commit to `tools/`, like everything it measures.

*Removal condition (SOP 1's corollary): superseded by the next doors audit, or deleted
the day a machine check enforces the same-door clause per tool — then this census is a
snapshot with a date, not a standing claim.*

— Vira
