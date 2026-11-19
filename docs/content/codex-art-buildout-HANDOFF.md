# Handoff: Codex art buildout (feature/CodexArtBuildout)

Owner task, 2026-11-18: give every new Codex enemy and weapon asset real, playable content. Follow CLAUDE.md: workers code, the main session reviews, sandbox QA, PR into `dev`, merge, then promote `dev` → `review`.

Resume state: reviewed source is pushed at `6a7378b6a039cbe6bc2f7348fbfc8b049abfca35`, including `origin/dev` at `0327759be4` (build box 0.7.4.201). No PR yet. Final isolated discovered lanes and browser QA are running; do not claim final acceptance until their reports finish.

### Completed during resume

- Repriced all 22 new Smashes. Five 2-SP normals deal 5–8; the others cost 3 SP for 15–20. Woundwood Rampage is 3 SP / 20 so optional enemy-relic removal cannot make its deck invalid. Affordability covers optional modules, attribute variance, openers and reserves.
- Added the real historical-save roster regression, including map/RNG equivalence and a mutation proof that removing the gate fails.
- Replaced the Compendium fixture with real reward → claim → equip → Armoury flows for four icons. Beast Claws grants `weaponArt:beastClaws:twinbladeFlurry`; Rapier still grants Riposte.
- Added 45 explicit animation bindings for the five declared outfit appearances. Historical exports remain 35 bindings / 32 paintings; all 40 current outfits are covered without relaxing the importer.
- Compared the first full discovered run to clean dev: 15 feature-only failures. Corrected their causes: missing outfit bindings, new defaults globally repricing old cards, an overtuned newly reachable art, optional-relic affordability, unsupported Retreat tags and stale catalog expectations.
- All 28 old weapon packages and 395 old cards' resolved base/upgraded prices and Mana categories are frozen and unchanged. Only new packages were reassigned; Stiletto teaches Feint instead of the newly reachable unpenalized Deathblow.
- Removed unsupported Retreat tags from Pike, Scythe, Reaper's Crescent and both whips in both content representations. Four new bows grant Retreat; the inherited Bone/Storm Sceptre source mismatch is recorded in the equipment gaps, without an engine change.
- Independent Codex reviewer source sign-off completed. Local Claude reviewer authentication expired; its read-only brief was performed by an independent Codex agent. PR-level review with the eventual PR number remains required.
- Regenerated authoritative projections. Final recapture changed 24 current-profile hash fields only; every behavioral and historical capture field stayed identical. Native and production transforms agree; all 24 determinism/baseline tests pass.

### Final verification locations

- Reviewed source: `6a7378b6a039cbe6bc2f7348fbfc8b049abfca35`.
- Clean baseline `66e473a77c`: core 151 PASS; code check PASS; all 1,205 discovered files / 9,424 tests passed. Newer dev changes before `0327759be4` were card-art object priority and build metadata.
- Windows cannot spawn the exact unsharded no-slow command (ENAMETOOLONG). Run all four official zero-based shards in independent checkouts; never treat the launch error as a passing suite.
- Final test logs: each test worker's ignored `scratch/qa/codex-art-verified-6a7378/`.
- Final browser checkout: `C:\Users\const\.codex\worktrees\codex-art-final-qa\AshenSpire`; sandbox output `scratch/qa/codex-art-final/`, decoded-image proof and supplemental captures `scratch/qa/codex-art-resume/decoded/`.
- Main worktree: `C:\Users\const\.codex\worktrees\codex-art-buildout\AshenSpire`. Preserve the unrelated edited checkout at `C:\repos\AshenSpire`.
- Pages returned HTTP 503 during verification. Use a successful exact-source feature-preview Actions artifact if Pages remains unavailable; do not describe an unverified Pages URL as working.

## Read first
- [codex-art-buildout-2026-11-18.md](codex-art-buildout-2026-11-18.md): the survey, the enemy roster table (from `node tools/enemy-roster-table.mjs`) and the asset table.
- [codex-equipment-buildout-2026-11-19.md](codex-equipment-buildout-2026-11-19.md): the 38 items, the per-item stat choices and the mechanics-gaps table.
- `docs/qa/acceptance.codex-art-buildout.json`: the sandbox QA criteria.

## Owner decisions already made
- Carrion Headsman and Knellcap Sentinel are **normal, Marches**.
- Build the weapons **now on dev**, using existing mods only. Record any gaps in the gaps doc.
- Sage's Robe is the **Ward robe**: a Starseer robe, uncommon, +1 max MP, and 1 Ward stack at the start of each turn. The Ward part waits on `chore/ForceWardRules`.
- **Smash price, literal reading:** a Smash deals the damage of the attack one SP cheaper, plus Poise. So 2 SP deals 5–8, 3 SP deals 15–20, and 4 SP deals 25–30. Re-price the **new** Codex Smash cards only. List the pre-Codex Smashes in the survey doc as an owner follow-up.
- **Smash vs stance:** +50% damage against Defend (currently `smashVsDefensive.damageMultiplier` 1.25 in `content/source/fixCoreMechanics.json`) and −25% against Counter (new). This goes in a **separate fix PR** (`fix/SmashStanceRule`) from `dev`, not in this branch.
- The owner wants enemy tables to show: cards (with SP and MP), unique trait, weaknesses, attributes, equipment, HP, MP, SP, and act(s).

## Done on the branch
- 32 enemies across the Weald, Marches and Reach (normals, elites, bosses), with encounters. 5 of them appear in more than one act. Concept art is wired in `src/content/enemyExpansion.js`, `enemyStanceSprites.js` and `enemyArt.js`, and the landmarks are `alpha-measured`.
- 38 items in `weapons.csv` and `outfits.csv`, wired into rewards. The enemies carry the new weapons.
- Fixes from the first review are done: `dev` is merged, old pinned profiles are kept from meeting the new enemies (`d8a2f4d3c8`), the alternative-art, concept-list and Blight Core exclusions are commented with their reasons, and the pins are recaptured (`007a7eefaa`).
- After the dev merge, `dev` removed the armament ratings, so the dominance fix now uses distinct mods (`c8c97f155d`).
- Sandbox QA at `007a7eefaa`: 144 PASS / 0 FAIL. The combat screenshots show the real concept art.

## To do, in order
The original checklist below records the requested sequence. Steps 1–2 and source regeneration/review are complete as described above. Remaining: finish final lanes and sandbox/decoded-image proof, publish the evidence/README, open and review the PR, add its receipt, merge on green, wait for architecture/build-stamp/dev-preview, and promote dev → review. Then do the separately authorized Smash stance work. CONTRIBUTING requires its SPEC change in a preceding separate PR. Counter already applies ×0.75 through defender advantage; do not multiply it a second time. Defend needs its own optional ×1.5 override while Prepared and old snapshots retain ×1.25.

1. **Smash re-price** of the new Codex cards, in one commit. Keep every deck playable within its SP pool. Then run `node tools/enemy-roster-table.mjs` and refresh the doc.
2. **Weapon icon QA scene.** `?shot=compendium&shotFound=...` drew "Unknown weapon" silhouettes, not the found items, so it proves nothing. Find a hook that renders the found or held item with `icon_<id>`, or report that one is missing. Do not pass the check on the absence of a placeholder alone.
3. Run `node tools/jev.mjs regen`, then recapture pins only if they moved. Then run `npm test`, `npm run code:check` (if `typescript` is missing, run `npm ci` in tools/code-quality first), and `node tests/run-node.mjs --discovered-only --no-slow`. Compare the no-slow failures against a clean `origin/dev` worktree; the remaining failures should be art-pack and environment ones only.
4. Rerun sandbox QA on the final head: `npm run qa:sandbox -- docs/qa/acceptance.codex-art-buildout.json --base origin/dev`. Desktop 1280x800 and phone 390x844.
5. A second `ashen-reviewer` pass on the full diff. The first review's open points to recheck:
   - legacy map golden and seats filters (`tests/core-map-legacy-golden.test.mjs:17`, `tests/seats.test.mjs:109`) are honest only because of the old-profile gate;
   - `save-quota` was raised from 1.0 to 1.5 MB, from a measured 1.10 MB.
6. Open the PR into `dev`. Mirror `.github/pull_request_template.md` and include: the survey and roster table, the acceptance criteria, the PASS result, screenshots, the mechanics gaps, and the rule deviations listed below. Merge on green with a merge commit, then promote `dev` → `review` (CONTRIBUTING.md). Send the owner the PR link, the preview link and the screenshots.
7. Separate `fix/SmashStanceRule` PR, as decided above.

## Rule deviations to state in the PR
- Bosses have exactly 1 weakness, because a test requires it.
- Elite encounters hold only elites.
- Minion heals were dropped, because of the heal-pricing rules. Wicker Mend costs 3 SP and 2 MP.
- Holy attacks are typed Force, because the reaction preview mishandled Holy.
- Hookman's pull and Penitent's self-damage were dropped, because the enemy runtime never applied them.
- Each act's normals use the act's level pair, which a test enforces.
- Trait = an opener card (`firstCard`) or a stat-bundle relic. Bosses also have phases.

## Not in scope or waiting
- Weapon second bonuses that need new mechanics (about 20 items) wait on `chore/GearPassMechanics`.
- New held-weapon sprites: v28 has icons only, so the weapons borrow the nearest existing sprite.
- 5 v28 relic icons: anvilSigil, duelistsRibbon, prayerBeads, quiverStrap, whetstoneCharm.
- A visual review of the alpha-measured enemy landmarks.
- The Shortbow inventory icon is missing from every release.
- Do not edit damage routing, Ward, Force, Pierce, Stone Skin, map generation or stance code. These branches are in flight: #2835 (feature/awesome-lovelace-pqf8ts), chore/ForceWardRules, chore/GearPassMechanics, feature/MapRouteSpread and fix/StanceCardSpriteIcon.

## Resume prompt
> Continue the Codex art buildout on `feature/CodexArtBuildout`. Read `docs/content/codex-art-buildout-HANDOFF.md`, then do its "To do, in order" list under CLAUDE.md rules (main session manages, workers code). Report the PR link and the preview link.
