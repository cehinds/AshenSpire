# FINISH — the checklist to a shippable 1.0

The resumable checklist the `/finish` skill (`.claude/skills/finish/SKILL.md`)
works from. Every line has an acceptance test that can be run. SPEC.md,
CONTRIBUTING.md and DEVELOPER.md govern, and nothing here overrides them. A
target the spec does not set sits under **Owner decisions** as a proposal
until the owner accepts it.
[docs/plan-polish-review-2026-09.md](plan-polish-review-2026-09.md) remains
the detailed evidence behind the feel, screen and structure items. Its IDs
(A1, F, G…) are cited here instead of copied.

Marks: `[ ]` open · `[~]` PR open · `[x]` merged to `dev`, with the PR
linked. Update this file after every PR.

## Baseline (2026-09-24, `dev` @ `7fb05c9a`, build `0.7.1.449`)

| Metric | Value | How measured |
|---|---|---|
| Fast suite | 130 files, 969 tests, 0 failed; 144/144 gates; 2m28s | `node tests/run-node.mjs --no-selftests`, local |
| PR wall time to full green | ~19 min (self-test job 19m10s; `bundle.test.mjs` 12m19s) | Actions run 35969669596 |
| Build size | 254.2 MB single file; 49.1 MB mobile | `ls -l build/*.html` |
| Full-run bot wins | Reaver 4/20, Starseer 1/20, Rogue 9/20, Herald 15/20 | `node tools/runsim.mjs 20` (sim does not yet play by live rules, see A1) |
| FPS on a low-end phone | **unmeasured** | no device profile run yet |
| Load time | **unmeasured** | — |
| Console errors across a full run | **unmeasured** (no gate plays a full run) | — |

## 1. Spec coverage

- [ ] **Guilt deals its in-hand turn-end HP loss** (SPEC §5.2, DEVELOPER "M1 known deviations" #2). Test: an engine test where Guilt in hand at turn end costs exactly the row's value (1 HP) and Guilt in draw or discard costs nothing. *Owner decision D2.*
- [ ] **Warrior's Vow lets you choose a stance** (SPEC §5.2, deviation #3). Test: an engine test where the card offers a pending choice of every class stance, and the chosen stance is the one entered. *D2.*
- [ ] **Remove the stale Frostbite deviation**: SPEC §4.4 marks Frostbite CUT, with Frost and `frostExposed` carrying it. Test: DEVELOPER.md "M1 known deviations" no longer lists Frostbite, and the SPEC falsifier `statuses.some(s=>s.id==='frostbite')` prints `false`.
- [ ] **Card hotkeys 1–9 have a test**. They already ship in `src/ui/screens/combat.js` (`cardIdx`): 1–9 select a card, and with a card selected a number picks the enemy. Test: a test covers SPEC §7.3, where pressing N selects hand card N, a key past the hand size does nothing, and with a hostile card selected N targets living enemy N. The code needs no new input path.
- [ ] **Abandoning mid-combat restarts that combat** (SPEC §9 M2), as a named test. Test: a headless test with seed S plays 2 cards, then reloads through the real load path; the combat is back at turn 1 with the same HP rolls, the same opening hand and the deck unchanged.
- [ ] **Every card, relic and event is reachable** (SPEC §9 M3). Test: `node tools/contentreach.mjs` exits 0 with 0 orphans across 195 cards, 63 relics and 25 events, and its `--selftest` goes red on a planted orphan of each kind.
- [ ] **SPEC text matches what shipped**: §5.1 gives 40 Rogue cards (§13.4f Prepare), §5.2 has the Goreblood row, and §12 is marked shipped. Test: `grep -n '39 authored' SPEC.md` gives 0 hits, and each §12 claim has a verdict in `docs/SPEC-RECONCILE.md`. Spec PR only.
- [ ] **COMBAT-EQUIPMENT-RULES prototype gate, and each class pool from 36 to 50 cards** (SPEC lines 17–32, rules §7). Test: COMBAT-WORKSHOP.md records the gate closed, and a card census shows 50 pool cards per class. *D3: possibly post-1.0.*

## 2. Content

- [x] Counts meet SPEC: 4 classes, 195 cards, 63 relics (≥40), 25 events (≥10), 7 flasks, 35 colorless, 20 regular enemies, 3 elites, 10 bosses (§12.4). `validateContent` 0 errors; `scripts.js` at 0.23% (<5%).
- [ ] **Stale content validators are fixed and gated**: `tools/rogue-parity.mjs` (27/30) and `tools/enemy-level-content.mjs` (3/6) read counts from the bundle, group by seat rather than the retired `act`, and run in the suite. Test: both exit 0 and a `*.test.mjs` runs each.
- [ ] **More than one elite per seat**. Test: each seat has 2 or more `pool==='elite'` encounters and `validateContent` passes. *D4.*

## 3. Full run

- [ ] **A headless full run in CI**. Test: `node tools/runsim.mjs 5` on fixed seeds for every class, run by `tests/run-node.mjs`, exits 0 with 0 crashes.
- [ ] **A browser full run**. Test: on a fixed seed, Title → Class Select → map → at least 1 combat → boss → Victory or Death → Title → a new run starts, with 0 console errors.
- [ ] **Save/resume holds in the browser** (§9 M2, §3.12). Test, three separate cases: (a) a reload on the map gives a run deep-equal to the one before, minus timestamps; (b) **Save Game** or **Save and Quit** mid-combat, then a reload, gives back exactly the hand, the piles, the enemies with their intents, and the resources, through the `CombatSnapshotService` record; (c) a plain reload or abandon mid-combat, with no explicit save, restarts that encounter from its entry checkpoint.

## 4. Balance

- [~] **A1: the simulators play by the live rules** — [#1270](https://github.com/cehinds/AshenSpire/pull/1270). Test: `node tools/balance.mjs --check` exits 0; the class HP rows in BALANCE.md equal the live maxHp.
- [ ] **A2–A4: bring the classes into the target band** (plan §A). Test: `node tools/runsim.mjs 100` puts each class inside the accepted band (*D1*), with best minus worst ≤ 20 points.
- [ ] **The Mana-aware A/B balance run** (SPEC §5.5.1, a release gate). Test: `node tools/runsim.mjs 50 --mana-ab` prints per-class win rate and Mana spent with Mana on and off, and the result lands in BALANCE.md.
- [ ] **Seat-tier tolerance is stated** (SPEC §13 lines 1793–1795). Test: BALANCE.md states the tolerance, and the 300-seed per-tier runsim results fall within it.

## 5. Feel and feedback (plan §F)

- [ ] **Click to impact ≤ 400 ms at Normal pacing** (baseline 1.28 s). Test: a trace from pointerup to the first floating damage number.
- [ ] **The idle animation plays** on every combatant. Test: `getComputedStyle(img).animationName !== 'none'`.
- [ ] **Hit sound tiers**: at least 3 damage-tier hits, plus playerHurt, a turn stinger, and draw/shuffle/discard sounds. Test: a test that maps each fx event to a recipe other than the default.
- [ ] **Haptics** on card play, damage taken and turn start, with a setting that turns them off. Test: a stubbed `navigator.vibrate` records 0 calls when the setting is off.

## 6. Onboarding

- [ ] **A quick start gives the first card play in 6 inputs or fewer** (baseline 26). Test: a scripted input count.
- [ ] **The tutorial reachability probe runs in CI**. Test: `node tools/tutorial-reach.mjs` passes at all 8 zooms, and `seenTutorial` persists across a reload.
- [ ] **A disabled Next button shows its reason as visible text**. Test: a DOM assertion.

## 7. Performance

- [ ] **60 fps on a low-end phone profile**. Test: a Chromium trace under 4× CPU throttle at 390×844 over one combat turn, with median frame time ≤ 16.7 ms. *The profile is D6.*
- [ ] **Startup < 3 s** on the web edition. Test: a timed load to the Title screen on a cold cache. *D5: depends on external art.*
- [ ] **No memory growth over a 30-minute run**. Test: heap after the run is within 10% of heap after the first combat, and stays under 300 MB.

## 8. Mobile (plan §G)

- [ ] **Targets ≥ 44 pt on iOS and ≥ 48 dp on Android (48 CSS px on a coarse pointer), text ≥ 11 px** at 360×640, 390×844, 768×1024 and 844×390, with 0 horizontal overflow. Test: a browser probe over combat, map, shop and compendium.
- [ ] **#724: no hand card drawn over Draw or End Turn**. Test: `node tools/hintstrip.mjs` finds 0 issues.
- [ ] **#1142: the map camera fits the scrollport after it settles**. Test: at 390×844, `data-camera-viewport` equals the client size.
- [ ] **#1164: the card door stacks between 601 and 703 px**. Test: a layout assertion at 601, 650 and 703 px.
- [ ] **Offline and installable web edition** (manifest plus service worker). Test: after one visit, a reload with the network off starts a run. *D5.*
- [ ] **Background and resume keep the run**. Test: a `visibilitychange` hidden→visible cycle mid-combat leaves the state unchanged.

## 9. Accessibility

- [ ] **The palettes pass contrast** (SPEC §7.5): dark, high-contrast and cb-safe. Test: `node tools/contrast-audit.mjs --gate` runs in CI and exits 0. Its `GATED_PROFILES` includes `cb-safe` beside `default` and `hi-contrast-off` (today it gates only those two), and its `KNOWN_BELOW` ledger has no text rows. Then every text token in all three palettes is ≥ 4.5:1 (≥ 3:1 for large text). A report run without `--gate` exits 0 even when rows fail, so it proves nothing.
- [ ] **Reduced motion is proven in a browser**. Test: `document.getAnimations()` finds nothing over 0.01 s during one combat turn.
- [x] Text scaling, reduced motion, reduce flashes, high contrast, cb-safe, and key/pad remapping exist (`src/ui/screens/settings.js`).
- [ ] **Escape or pad B backs out of every screen**. Test: a dispatch per screen calls Back exactly once.

## 10. Art and audio

- [ ] **One style guide, with off-style assets listed** (plan §H and P2 identity). Test: the guide exists, and every `assets/*` directory is marked in style or listed as off-style.
- [ ] **Every asset directory has a CREDITS row, and README §Legal agrees with the AI disclosure**. Test: `node tools/credits-check.mjs` in CI.

## 11. Code health

- [x] Every check `tests/run-node.mjs` runs is green (baseline above).
- [ ] **#1167: card widths come from `sizing.levels`**. Test: `grep -- '--card-w:' styles/*.css` shows only values derived from that table.
- [ ] **#1230: the two component catalogs agree**. Test: `tools/ui-components.mjs` fails when an id is in one catalog and not the other.
- [ ] **DEVELOPER.md has no stale counts**. Test: `grep -n '22 assertions' DEVELOPER.md` gives 0 hits.

## 12. CI

- [ ] **The receipts gate is green on `dev`**: backfill #1263, and see squash and `Merge PR #N:` subjects. Test: `node tools/receipts.mjs --check` exits 0, and `--selftest` catches both subject shapes.
- [ ] **The CHANGELOG ordering gate runs on PRs** (about-changelog has a mode that needs no browser). Test: a PR with a date out of order fails `tests.yml`.
- [ ] **Push runs of `tests.yml` on `dev` are not cancelled**. Test: `cancel-in-progress` applies only to `pull_request`, and every push run concludes success or failure.
- [ ] **PR wall time is under 10 minutes**. Test: the measured green run after `bundle.test.mjs` moves to its own parallel job.
- [ ] **A browser-gate run of `ci.yml` exists on the release candidate**. Test: a dispatched `ci.yml` run on the RC SHA concludes success. *D7.*

## 13. Release readiness

- [ ] **A written release gate** that takes the status from RED to GREEN. Test: `docs/RELEASE-CHECKLIST.md` lists at least 5 runnable gates, and the owner signs it off.
- [ ] **A release-heading format in CHANGELOG** (`## 1.0.0 — <date>`). Test: `about-changelog --selftest` passes with a planted release heading.
- [ ] **The save-migration test covers the 1.0 schema**. Test: fixtures v1–v10 load, and a newer version refuses and keeps the save.
- [ ] **LICENSE and docs use the current name and version**. Test: `grep -ri eldenspire LICENSE README.md` gives 0 hits, and `docs/versioning.md` stops saying 0.5.4.
- [ ] **Web and store metadata**: a meta description, og:*, an icon and theme-color in the bundle. Test: a grep test over the build. *D8 decides the storefronts.*
- [ ] **Release notes, store listing and post-launch roadmap drafted.** The owner cuts `release`, tags and publishes.

## Owner decisions

Proposals only. Nothing below is built until the owner rules.

- **D1 — Balance gate.** SPEC §9 asks for about 35–50% for an experienced player; the plan's bot band is 35–65% with a spread of 20 points or less. *Proposal:* gate on the bot band at ≥ 40 seeded runs per class, and treat the experienced-player range as the design aim.
- **D2 — Guilt and Warrior's Vow.** Build the engine hooks (an in-hand turn-end trigger and a choose-one choice), or amend SPEC §5.2 to match what shipped. *Proposal:* build both. (Frostbite is already CUT in SPEC §4.4.)
- **D3 — COMBAT-EQUIPMENT-RULES** (the prototype gate and 50-card pools). *Proposal:* mark it post-1.0 in SPEC.
- **D4 — Elites per seat.** Is 1 the v1 scope, or 2 or more? *Proposal:* 2 per seat.
- **D5 — Web edition.** Ship Pages as external art with a service worker (installable, under 5 MB of HTML/JS), and keep the 254 MB file as a download (plan §D). *Proposal:* yes.
- **D6 — Mobile certification device and profile.** Which phone reported the crash? *Proposal:* Chromium with 4× CPU throttle at 390×844 in CI, plus one physical iPhone in Safari before release.
- **D7 — ci.yml trigger.** Its browser gates and 3-OS matrix only run when dispatched by hand. *Proposal:* run it on push to `release`, plus a hand-dispatched green on the RC SHA.
- **D8 — Storefronts.** Web only, or Steam/itch as well? This decides whether capsule art and store copy are needed.
- **D9 — The tracker.** Close the ~35 stale agentops issues (#258–#273, #394–#465, #505, #564)? Keep #553 (the builds site deploys only when dispatched by hand) and decide whether it should deploy automatically.
- **D10 — The receipt for #1263**, and whether squash merges count as PR merges for the receipts gate. *Proposal:* backfill it at the ordinal committed at its merge, and count squash merges.
- **D11 — Design issues in 1.0 scope**: #845, #785, #239–#241, #1026, #601. *Proposal:* post-1.0.

## Waves

Each wave's file sets do not overlap. At most 4 tasks run per wave.

- **Wave 1** (tools and tests only; stays off #1270's balance files):
  1. `feature/receipts-gate`: squash-merge detection in `tools/receipts.mjs`, plus the #1263 backfill (D10).
  2. `feature/stale-validators`: `tools/rogue-parity.mjs`, `tools/enemy-level-content.mjs`, and a test for each.
  3. `feature/contentreach`: new `tools/contentreach.mjs` plus a test.
  4. `feature/midcombat-reload-test`: new `tests/midcombat-reload.test.mjs`.
- **Wave 2**: a test for the card hotkeys 1–9; the tests.yml push-cancel fix and the bundle.test job split (`.github/workflows/tests.yml`); about-changelog ordering with no browser; the DEVELOPER and versioning stale text.
- **Wave 3**: the SPEC reconcile PR (§5.1, §5.2, §12); the headless full-run gate (after #1270 lands); LICENSE and metadata.
- **Later, in order**: A2–A4 → F → H → G → C (plan order), then D2 hooks, then perf and mobile probes, then the release candidate.
