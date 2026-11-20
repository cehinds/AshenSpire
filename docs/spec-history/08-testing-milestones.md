# SPEC history — §8 Testing, §9 Milestones

Archive of material moved out of SPEC.md; not rules.

## §8 Testing

- The required-coverage list that used to live here was removed deliberately. It named 17 tests against a suite that had already grown past it (47 cases over 43 declared blocks at `267397a`, 48 over 44 two commits later). Two entries had gone false: test 7 restated Bleed's threshold as `12` with an escalating `×1.5` (both superseded by the constant-threshold proc vocabulary, §4.4) and test 8 named "Scarlet Rot", renamed at the IP scrub. A hand-kept index of tests is a cache of `grep`, and it rotted the way §3.2's file inventory did.
- Rule 5 (house law, adopted 2026-08-07 out of the instrument audit) was triggered by three greens that lied in one week: a screenshot harness blind to five player-facing surfaces, a driver returning exit 0 against broken code, and a disclosure check that covered one text of seven. Each was accurate about what it measured and silent about its own hole; a boundary in a file header is read by the author, one in the output by whoever is about to trust the green.
- The release capture set vs `tools/screenshot.mjs` distinction is the third lying green above.
- The previous edition ended "CI-less workflow: opening `tests/index.html` must show all green before any milestone is called done." CI exists (`.github/workflows/ci.yml`) and that sentence had been false since it landed; the standard survives.

## §9 Milestones

- M3 balance pass: the earlier ~35–50% win-rate target was removed by owner decision, 2026-09-27; owner ruling D1, 2026-09-26, governs.
