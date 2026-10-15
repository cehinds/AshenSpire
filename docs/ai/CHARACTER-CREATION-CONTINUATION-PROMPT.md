# Character creation — continuation prompt

Copy the prompt below into the next chat when ready to continue.

---

You are the manager, coordinator and reviewer for AshenSpire character creation.
Use GPT-6.1 Sol workers and Luna workers (GPT-6 Luna if 6.1 Luna is unavailable).
Keep updates short and in checkboxes/bullets. Show actual game screenshots and
playable builds; avoid long explanations. Work locally first, publish worker
branches, then integrate into the feature branches through reviewed PRs.

The user authorized **continue** on 2026-10-14 (America/Anchorage). The prior stop request is historical.
Hosting and final evidence delivery are complete with this documentation update. Do not rerun completed UI implementation; follow the next user request.

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
- Current documentation-only descendant: `13a117814`; it does not relabel the built source. Inspect origin before publication.
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

## Hosting and public HTTP delivery are verified

- Pages publisher: dev PR #1997, with source/artifact freshness checks and
  opaque-origin sandbox wrappers. Feature builds no longer require an open PR.
- Shared delivery guide/cleanup helper: dev PR #2000.
- Post-deployment public HTTP checks: dev PR #2004. These check the branch/source
  index entry, sandbox wrapper, loader and nonempty plain-text game without
  downloading/executing feature HTML in the privileged job.
- Verified Play URL:
  `https://cehinds.github.io/AshenSpire/branches/Feature/updateCharacterCreation/latest/`.
- Feature build [38659839311](https://github.com/cehinds/AshenSpire/actions/runs/38659839311) succeeded at source `b5ac91a039e38e7ed2b8bc01770b14ed29b94a9f`; backup artifact [11938781737](https://github.com/cehinds/AshenSpire/actions/runs/38659839311/artifacts/11938781737).
- Pages [run 38676827571, deploy job 116243897791](https://github.com/cehinds/AshenSpire/actions/runs/38676827571/job/116243897791) passed **Verify public feature preview delivery**. Its log confirms four public HTTP targets, including this feature and exact source `b5ac91a039e38e7ed2b8bc01770b14ed29b94a9f`.
- Historical local public-browser attempts failed before HTTP with
  `ERR_TUNNEL_CONNECTION_FAILED`. The runner receipt verifies delivery; it does
  not claim that local interactive public-browser playtesting succeeded.
- Do not bypass proxy/network settings. Sandbox startup → title menu with Enter is verified separately from public HTTP delivery. Pointer automation timed out; the later slot/character flow was not completed through that wrapper probe.
- README/gallery now lead with the verified Play link and contain the final four-size evidence.

## Final local build and evidence

- Build: **0.7.1.1520 / `652574f013`**. Ordinal alone is ambiguous.
- Standalone: `/workspace/AshenSpire/build/download/AshenSpire.html`.
- SHA-256: `20c5fd7db59de53faa7e0debe9a243d875d59ecbe9ecf32718e5174df7b73eea`.
- Size: 78,151,638 bytes.
- Stamp: `/workspace/scratch/feature-pages-preview/build-stamp-final.json`.
- Captures: `/workspace/scratch/feature-pages-preview/screenshots-0.7.1.1520-652574f013/`.
  There are 36 PNG screenshots and a manifest with zero recorded errors;
  all 36 PNG wireframes and 36 structural SVGs are complete and visually reviewed.
- Four sizes: mobile 390×844, tablet 1024×768, desktop 1440×900, wide 1920×1080.
- Nine views: class, subclass, attributes, feats, spells, maneuvers, equipment,
  keepsake, review. Reaver supplies martial views; Starseer supplies spells.
- Optional missing music manifest uses procedural fallback and is documented.
- Capture tool: `/workspace/scratch/feature-pages-preview/capture-final-built.mjs`.
- Wireframe tool: `/workspace/scratch/feature-pages-preview/render-creation-wireframes.mjs`.
  It uses actual captured geometry, including the new header and disclosures.
- Historical captures `1ad05d6483`, `7b7e9a674f`, and `7edceca157` are superseded.
- Local sandbox mirror prepared at
  `/workspace/scratch/feature-pages-preview/hosted-mirror/`. Exact-build startup → title menu with Enter is verified. Pointer automation timed out; do not claim a completed mouse/slot/character flow from that probe.
- The requested Windows `D:/repos/.codex/outputs/...` location is not mounted here.

## On the next continuation

1. Read the next user request and inspect origin. Hosting/source verification and
   the 36 final screenshots plus matching wireframes have been delivered; do not
   repeat implementation or replace them with historical captures.
2. The verified Play link and complete gallery are near the top of the feature
   README. The gallery is `docs/preview/features/update-character-creation/`.
3. Keep the shared delivery guide/helper. Remove the feature-only README block
   and gallery before eventual promotion to dev; preserve the release gallery.
4. Any new UI change needs fresh four-size evidence associated with its own
   tested source/digest. Follow worker → origin worker → feature integration.

Known existing issue: DOM focus and gamepad cursor can differ; Enter follows the
gamepad cursor. Matched baseline/current probes reproduced it before this pass.
Do not call it fixed or broaden this presentation task to input routing without a request.

If Git CLI authentication fails, connected GitHub tools can publish blobs/trees,
commits, branches and PRs. Verify exact object hashes and expected branch heads;
attach every created PR. Never expose or search for credentials.
