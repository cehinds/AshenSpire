# Character creation — continuation prompt

Copy the prompt below into the next chat when ready to continue.

---

You are the manager, coordinator and reviewer for AshenSpire character creation.
Use GPT-6.1 Sol workers and Luna workers (GPT-6 Luna if 6.1 Luna is unavailable).
Keep updates short and in checkboxes/bullets. Show actual game screenshots and
playable builds; avoid long explanations. Work locally first, publish worker
branches, then integrate into the feature branches through reviewed PRs.

The previous user instruction was **stop, save a handoff, and merge current work
to origin feature**. Do not start new implementation until I ask to resume.

## Repository and current source

- Repository: `/workspace/AshenSpire`, remote `cehinds/AshenSpire`.
- Main feature: `Feature/updateCharacterCreation` (case matters).
- Integration feature: `Feature/AddSubClasses`. GitHub auto-deletes PR head
  branches on merge; recreate this integration branch from its verified last
  merge if needed, without force-pushing.
- All game changes are merged to the main feature at
  `b5ac91a039e38e7ed2b8bc01770b14ed29b94a9f` through PR #2006.
- Production source tree: `9124302fb4c26347d21269b9a69db273d99349d3`.
- Local capture source: `f6801043c9d9762550a7a3ff28cba7fc346fee81`, same tree.
- Handoff-only commits may follow that source. Inspect origin before continuing.
- Do not merge the whole character feature into dev just to publish a preview.

## Completed

- [x] Separate Class, Subclass, Attributes, Feats, Spells/Combat Maneuvers,
  Starting Equipment, Relic and Keepsake, Review pages, in that order.
- [x] Spells appear for caster classes or spell-tagged classes.
- [x] Locked feats/spells cannot be selected; level/class/skill eligibility remains enforced.
- [x] Desktop header combines Create character, section and count/hint;
  phones retain Create character and a compact count, with section in the dropdown.
- [x] Redundant body headings and excess top padding removed.
- [x] Related trait/keepsake text shares one row; long copy ellipsizes with full text retained.
- [x] Mobile class sprites sit beside copy. Equal selected rows are about 203px;
  folded rows are 96px. Class wording is unchanged.
- [x] Starting deck, long relic details, Review loadout and edit choices fold closed.
- [x] Review fits without scrolling on the tested phone. All original cards,
  eleven deck inspectors and seven edit controls remain inside the folds.
- [x] Selected spell information control stays inside card art, clear of navigation.
- [x] Sol reviewed the source. Shared-header checks passed 36/36;
  the Review follow-up passed 11/11 screen tests and live browser probes.
- [x] Class-switch count receipt: Spells 1/2 → Class with no count →
  Reaver Maneuvers 0/1 → Starseer Spells 0/2; exactly one active counter.

## Hosting is implemented, but delivery verification is unfinished

- Pages publisher: dev PR #1997, with source/artifact freshness checks and
  opaque-origin sandbox wrappers. Feature builds no longer require an open PR.
- Shared delivery guide/cleanup helper: dev PR #2000.
- Post-deployment public HTTP checks: dev PR #2004. These check the branch/source
  index entry, sandbox wrapper, loader and nonempty plain-text game without
  downloading/executing feature HTML in the privileged job.
- Intended Play URL:
  `https://cehinds.github.io/AshenSpire/branches/Feature/updateCharacterCreation/latest/`.
- Latest feature build at stop: run `38659839311`, source `b5ac91a...`, queued.
- Public Pages publication and its HTTP verification were not confirmed.
- Local public-browser attempts failed before HTTP with
  `ERR_TUNNEL_CONNECTION_FAILED`; do not claim this proves a site 404 or a working Play link.
- Do not bypass proxy/network settings. Use the GitHub runner’s public checks
  and deployment receipt. A local sandbox mirror can verify game interaction.
- The feature README still links the older download-only artifact that the user
  could not use. Replace it with a verified Play link when delivery succeeds.

## Final local build and evidence

- Build: **0.7.1.1520 / `652574f013`**. Ordinal alone is ambiguous.
- Standalone: `/workspace/AshenSpire/build/download/AshenSpire.html`.
- SHA-256: `20c5fd7db59de53faa7e0debe9a243d875d59ecbe9ecf32718e5174df7b73eea`.
- Size: 78,151,638 bytes.
- Stamp: `/workspace/scratch/feature-pages-preview/build-stamp-final.json`.
- Captures: `/workspace/scratch/feature-pages-preview/screenshots-0.7.1.1520-652574f013/`.
  There are 36 PNG screenshots and a manifest with zero recorded errors;
  final wireframes and final visual review were not completed at stop.
- Four sizes: mobile 390×844, tablet 1024×768, desktop 1440×900, wide 1920×1080.
- Nine views: class, subclass, attributes, feats, spells, maneuvers, equipment,
  keepsake, review. Reaver supplies martial views; Starseer supplies spells.
- Optional missing music manifest uses procedural fallback and is documented.
- Capture tool: `/workspace/scratch/feature-pages-preview/capture-final-built.mjs`.
- Wireframe tool: `/workspace/scratch/feature-pages-preview/render-creation-wireframes.mjs`.
  It uses actual captured geometry, including the new header and disclosures.
- Historical captures `1ad05d6483`, `7b7e9a674f`, and `7edceca157` are superseded.
- Local sandbox mirror prepared at
  `/workspace/scratch/feature-pages-preview/hosted-mirror/`; not playtested yet.
- The requested Windows `D:/repos/.codex/outputs/...` location is not mounted here.

## When asked to resume

1. Check origin and build/deployment status; do not rerun completed UI work.
2. Verify the final public feature route and its source through the deployment’s
   HTTP check; playtest the sandboxed game if browser access is available.
3. Finish/review the 36 final wireframes and four-size screenshots. Preserve the
   build digest/source association; do not relabel historical images.
4. Refresh `docs/preview/features/update-character-creation/` and the removable
   feature block near the top of README with Play first, screenshots and gallery.
   The tracked gallery still shows `1ad05d6483`; it is not the final build.
5. Merge evidence/docs through origin worker and feature branches. Keep the
   shared guide/helper, but remove feature-only README/gallery content before
   eventual promotion to dev. Do not alter the normal release gallery.

Known existing issue: DOM focus and gamepad cursor can differ; Enter follows the
gamepad cursor. Matched baseline/current probes reproduced it before this pass.
Do not call it fixed or broaden this presentation task to input routing without a request.

If Git CLI authentication fails, connected GitHub tools can publish blobs/trees,
commits, branches and PRs. Verify exact object hashes and expected branch heads;
attach every created PR. Never expose or search for credentials.
