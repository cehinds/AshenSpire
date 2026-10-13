# Character creation continuation handoff

## Start here

- Continue `Feature/updateCharacterCreation` in `cehinds/AshenSpire`. The latest implementation/build commit merged to origin is `38c1243e2`; this handoff follows it.
- Act as reviewer/coordinator. The user requested GPT-6.1 Sol implementers and Luna assistance; GPT-6 Luna was available, not GPT-6.1 Luna.
- Keep communication brief and bulleted. Show real desktop/mobile screenshots and playable previews. The user rejected oversized controls, stretched cards, and verbose tile copy.
- Workflow: local worker branch → matching origin worker branch → feature branch. Do not promote to dev/test/release/main without the appropriate explicit instruction. No release or PR was created in this pass.

## Implemented and pushed

- Class → Attributes → Keepsake → Equipment → Feats → conditional Spells → Review.
- Spells appears only for eligible caster classes/class spell tags. Martial maneuvers remain in Equipment.
- Feats are browse-only: Character / Class / Skills groups, canonical progression locks, **zero starting grants**. The user has not chosen a starting-feat allowance.
- Compact desktop Feats: two columns, six character feats visible, icon + title + short benefit + small lock. Full descriptions/current and required levels live in the inspector.
- Mobile: one readable column; tap opens the inspector beneath the selected tile; Back to feats collapses it and restores focus. Desktop controls are smaller and footer Back/Next sit at opposite sides.
- Source: `src/ui/components/creationPageParts.js`, `src/ui/models/CreationFeatBrowserModel.js`, `styles/kit.css`, and CSV-generated UI strings. Preserve reusable trim/material/symbol/text parts.

## Next work: finish the reference artwork

1. Resolve write access to **cehinds/AshenSpire-art**. Its push returned HTTP 403; do not assume an art PR or release exists. The owner will push `8803331f` from the Codex task; until then it exists only there.
2. Ready art-repository branch: `worker/updateCharacterCreation/feat-art`, local commit `8803331f2afc84efb60409f278410674e88596a7`, checkout `/workspace/scratch/character-feat-art-repo`. It contains six ornate composites, ten separate original PNG layers, light twins, generated manifest/provenance, and credits. Publish/review through the official art workflow; respect the owner-only release boundary in CONTRIBUTING.md.
3. After the art release exists, update the game's release pin and regenerate its manifest using the official tools. Do not hand-edit derived manifests or weaken asset validation.
4. **In progress:** `Feature/OrnateFeatArt` restores the ornate art code. It builds once the art release is pinned (`art-release.json`, `node tools/art-manifest.mjs --write`).
5. Rebuild and verify desktop/mobile against the user's reference. Keep concise tiles and full details in inspection. Further visual refinement still needs user review; do not describe the current build as an exact artwork match.

The game origin also preserves `worker/updateCharacterCreation/feat-art` (`28bc1f439`), containing intake source assets/geometry. Production build 1322 deliberately retains registered glyph artwork. The ornate integration uses normal asset IDs and separate material/trim/symbol/prop image layers, and currently runs as a source authoring preview through `serve --editor-write`.

## Preview and evidence

- Portable launcher: `/workspace/scratch/character-creation-preview-v2/START-HERE.html`
- ZIP: `/workspace/scratch/AshenSpire-character-creation-preview-v2.zip`
- Build: **0.7.1.1322**, source digest **54158f23fb**. The package contains the game, component catalog, 48 built screenshots, editable concept artwork, and a separately labelled pending-art preview.
- Original-art screenshots: `/workspace/scratch/creation-ornate-art-evidence/` (`feats-1440.png`, `feats-390.png`, `inspector-390.png`). These are actual source-preview captures, not the merged build.
- Original concept/layer sources are committed under `tools/hud-component-studio/projects/character-creation/`; the standalone editor is also in `/workspace/scratch/character-creation-design/`.
- Scratch artifacts may not survive a new environment. Git branches are the durable source; regenerate previews when necessary.

## Validation and limitations

- Current compact pass: **8 focused tests**, **48 fresh built captures**, real phone taps/navigation/inspection/return passed. ZIP CRC, local links, and copied game/editor hashes passed.
- Earlier integrated flow: 108 focused tests passed. The full 520-file suite exceeded its 15-minute limit and is **incomplete**, not green. Do not repeat that claim as current full-suite success.
- Ornate preview: 7 focused tests, loaded PNGs, desktop/mobile inspection and focus return passed. Native Enter automation did not open inspection; investigate global keyboard routing before claiming complete keyboard activation support.
- Art repository: 20 tests, manifest, 7,313 twin checks, 17 known-bad checks, and reproducible pack checks passed. No release/pin update happened.
- Browser plugin was unavailable; validation used existing Playwright/Chromium. Main harness: `tools/character-creation-components-qa.mjs`.

## Separate outstanding feature

- `Feature/AddSubClasses` remains separate; subclass gameplay is not implemented by this pass. Preserve the requested 11-card starting deck, subclass five-card contribution, class card, unique weapon-art card, remaining basic strikes/defends, and subclass/tag-driven effects. Consult that branch's design handoff before implementing progression.
