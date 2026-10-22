# Core renewal dormant-code archive

Baseline: `c36fed3b539faba64ba0e4ecdfda739e1b4a8861` (build 0.7.1.1770).

`gameProfileCreation.js.txt` preserves the original bytes of
`src/ui/components/gameProfileCreation.js`. It is the older fixed-loadout
creation presenter, exporting `mountGameProfileCreation`. At the baseline,
full tracked-tree searches for its file basename and exported function found
no callers, tests, authored registry entries, preview references or tooling
references outside the file. Inspection of `src/main.js` confirms the current
creation flow uses the active character-creation screen. The standalone
bundler walks imports from `src/main.js`; it does not sweep this archive.
The `.txt` suffix also prevents JS/module discovery from treating it as code.

Restore by copying the text file back to its original path, preserving its
relative imports, then explicitly wiring the desired presenter into the
creation flow and adding behavior coverage. Remove/update the archive guard
in `tests/ui-icons.test.mjs` as part of that intentional restoration. The
archived presenter contains historical glyph literals; use current named icon
IDs when restoring it.

The audit retained `deckReadingArt.js` and `deckReadingOutlines.js` as
compatibility exports. It also retained `mapHeader.js` and
`CombatantInspectorModel.js`: authored design/handoff references still name
them. Optional game profiles, old content pools and co-op support were not
classified as dead code merely because the current Core player flow hides them.
