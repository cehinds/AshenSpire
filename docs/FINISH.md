# FINISH — the checklist to a shippable 1.0

The resumable checklist the `/finish` skill (`.claude/skills/finish/SKILL.md`)
works from. Every line has an acceptance test that can be run. SPEC.md,
CONTRIBUTING.md and DEVELOPER.md govern, and nothing here overrides them. A
target the spec does not set sits under **Owner decisions** as a proposal
until the owner accepts it.
[docs/plan-polish-review-2026-09.md](plan-polish-review-2026-09.md) remains
the detailed evidence behind the feel, screen and structure items. Its IDs
(A1, F, G…) are cited here instead of copied.

Marks: `[ ]` open · `[~]` PR open, or partly done with the remainder stated · `[x]` merged to `dev`, with the PR
linked. Update this file after every PR.

**Status (2026-09-25, `dev` @ `eb36e19e`, build `0.7.1.525`):** synced against
every merge to `dev` from #1270 to #1318. Each tick below was checked against
the code, a test or a command run on that tree, not against a PR title.

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

- [x] **Guilt deals its in-hand turn-end HP loss** (SPEC §5.2, DEVELOPER "M1 known deviations", Guilt). Test: an engine test where Guilt in hand at turn end costs exactly the row's value (1 HP) and Guilt in draw or discard costs nothing. *Owner decision D2.* — [#1286](https://github.com/cehinds/AshenSpire/pull/1286): `tests/guilt.test.mjs` covers 1 HP in hand, 0 in draw or discard, 2 for two Guilts, and a co-op seat.
- [ ] **Warrior's Vow lets you choose a stance** (SPEC §5.2, DEVELOPER "M1 known deviations", Warrior's Vow). Test: an engine test where the card offers a pending choice of every class stance, and the chosen stance is the one entered. *D2.*
- [x] **Remove the stale Frostbite deviation**: SPEC §4.4 marks Frostbite CUT, with Frost and `frostExposed` carrying it. Test: DEVELOPER.md "M1 known deviations" no longer numbers Frostbite among its rows (only a note that it is CUT, not deferred), and the SPEC falsifier `statuses.some(s=>s.id==='frostbite')` prints `false`. — [#1283](https://github.com/cehinds/AshenSpire/pull/1283)
- [x] **DEVELOPER.md stops calling Guilt inert.** After #1286, "M1 known deviations" row 1 still said Guilt "ships as an inert unplayable curse". Test: `grep -n 'inert unplayable curse' DEVELOPER.md` gives 0 hits. — [#1317](https://github.com/cehinds/AshenSpire/pull/1317): 0 hits on `dev`.
- [x] **Card hotkeys 1–9 have a test**. They already ship in `src/ui/screens/combat.js` (`cardIdx`): 1–9 select a card, and with a card selected a number picks the enemy. Test: a test covers SPEC §7.3, where pressing N selects hand card N, a key past the hand size does nothing, and with a hostile card selected N targets living enemy N. The code needs no new input path. — [#1278](https://github.com/cehinds/AshenSpire/pull/1278): `tests/card-hotkeys.test.mjs` runs `cardHotkeyAction` through select, past-the-hand, armed-target and non-card keys.
- [x] **Abandoning mid-combat restarts that combat** (SPEC §9 M2), as a named test. Test: seed S, play cards, reload through the real load path; the combat is back at turn 1 with the same HP, the same opening hand and the deck unchanged. — [#1280](https://github.com/cehinds/AshenSpire/pull/1280) (`tests/midcombat-reload.test.mjs`, a mirror of the load sequence) and [#1315](https://github.com/cehinds/AshenSpire/pull/1315): `tools/slot-load-door.mjs` SLOT-LOAD-MIDCOMBAT-RESTART lands an attack, ends the turn, abandons without saving and loads slot 1 through the Quick Menu, `confirmSlotLoad` and `resumeRun`; turn 1, HP, hand, fight cards, enemy entry HP and deck all match. It and its `--selftest` are steps in `ci.yml` only, which runs on a push to `release` or when dispatched (D7); nothing runs it on a `dev` PR or push.
- [~] **Every card, relic and event is reachable** (SPEC §9 M3). Test: `node tools/contentreach.mjs` exits 0 with 0 orphans across 195 cards, 63 relics and 25 events, and its `--selftest` goes red on a planted orphan of each kind. — [#1281](https://github.com/cehinds/AshenSpire/pull/1281) ships the tool, its `--selftest` and `tests/contentreach.test.mjs`; relics 63/63 and events 25/25 are reached. Left: the tool exits 1 on 7 card orphans (next line).
- [ ] **The 7 orphan cards get a route in, or an owner-ruled allowlist row.** `node tools/contentreach.mjs` on `dev` lists `rondelParry`, `sunderplate`, `astralInsight`, `blightwardLash`, `lastMercy`, `wound` and `slimed` as "NO ROUTE IN". Test: the tool reports `cards 195 of 195 reached`, and `KNOWN_ORPHANS` in `tests/contentreach.test.mjs` is empty.
- [x] **SPEC text matches what shipped**: §5.1 gives 40 Rogue cards (§13.4f Prepare), §5.2 has the Goreblood row, and §12 is marked shipped. Test: `grep -n '39 authored' SPEC.md` gives 0 hits, and each §12 claim has a verdict in `docs/SPEC-RECONCILE.md`. Spec PR only. — [#1282](https://github.com/cehinds/AshenSpire/pull/1282): 0 hits; stage 3 of SPEC-RECONCILE gives every §12 item a verdict, with P6 and P8b to-build.
- [ ] **SPEC P8b: Powers hold a resting stance until the next turn** (SPEC §12.5, SPEC-RECONCILE stage 3 P8b, to-build). `resolveCombatPose` keeps only guard, shieldGuard and parry, and `combatPoseStates.json` has no Power pose. Test: `node -e "import('./src/model/combatPose.js').then(m=>console.log(m.resolveCombatPose({hp:1},'cast',[])))"` prints a Power resting pose instead of `idle` (it prints `idle` on `dev`), and a test asserts the pose holds until that character's next turn starts.
- [ ] **COMBAT-EQUIPMENT-RULES prototype gate, and each class pool from 36 to 50 cards** (SPEC lines 17–32, rules §7). *Post-1.0 (D3, ruled 2026-09-26).* Test: SPEC marks it post-1.0.

## 2. Content

- [x] Counts meet SPEC: 4 classes, 195 cards, 63 relics (≥40), 25 events (≥10), 7 flasks, 35 colorless, 20 regular enemies, 3 elites, 10 bosses (§12.4). `validateContent` 0 errors; `scripts.js` at 0.23% (<5%).
- [x] **Stale content validators are fixed and gated**: `tools/rogue-parity.mjs` (27/30) and `tools/enemy-level-content.mjs` (3/6) read counts from the bundle, group by seat rather than the retired `act`, and run in the suite. Test: both exit 0 and a `*.test.mjs` runs each. — [#1276](https://github.com/cehinds/AshenSpire/pull/1276): rogue-parity 31/31, enemy-level-content 6/6, both run by `tests/content-validators.test.mjs`.
- [ ] **1–5 elites per seat, averaging 3** (D4, ruled 2026-09-26). Test: every seat has between 1 and 5 `pool==='elite'` encounters, the mean across seats is 3 (±0.5), and `validateContent` passes.

- [ ] **Deck editor between runs** (owner spec 2026-09-26; built in its own session, SPEC PR first). Setting on by default; a dropdown picks Free or Rest sites only. Min deck size default 10 and a max, each with an unlimited flag. An optional "play in deck order" draw. Basic Strike/Defend unlimited; weapon arts and techniques limited to owned copies, which stack at the blacksmith with smith stones. Drag and drop on touch, mouse and gamepad. Test: the SPEC section exists, the editor enforces each setting in an engine test, and a browser check drags a card in and out at 390×844.
- [ ] **Three shop types: shop, blacksmith, wise master** (owner spec 2026-09-26; same session). Every offering has configurable probabilities, and at least 2 features always appear. The wise master sells skill books, weapon arts and armaments for its 3–4 skills, offers training, and runs a respec: the skill drops to level 1 and 50–75% (configurable) of the spent experience is refunded. Test: an engine test per shop type over seeded rolls, plus the respec math.
- [ ] **D11 design issues are in 1.0 scope** (ruled 2026-09-26). Each needs its own PR, SPEC first where a contract changes:
  - [ ] [#845](https://github.com/cehinds/AshenSpire/issues/845) combat foundations and three-build prototypes (depends on spec PR #844).
  - [ ] [#785](https://github.com/cehinds/AshenSpire/issues/785) painted character rigs with weapon grips (isolated preview first).
  - [ ] [#239](https://github.com/cehinds/AshenSpire/issues/239) enemy abilities as deterministic action cards → [#240](https://github.com/cehinds/AshenSpire/issues/240) encounters by hidden combat-power budgets → [#241](https://github.com/cehinds/AshenSpire/issues/241) persist and sync those plans (in order; all depend on #237/#238).
  - [ ] [#1026](https://github.com/cehinds/AshenSpire/issues/1026) world-atlas W4b bands, with no screen scroll at 1280×800 or 390×844.
  - [ ] [#601](https://github.com/cehinds/AshenSpire/issues/601) bring Reaver, Starseer and Herald art in line with the rogue's motif.

## 3. Full run

- [ ] **A headless full run in CI**. Test: `node tools/runsim.mjs 5` on fixed seeds for every class, run by `tests/run-node.mjs`, exits 0 with 0 crashes.
- [ ] **A browser full run**. Test: on a fixed seed, Title → Class Select → map → at least 1 combat → boss → Victory or Death → Title → a new run starts, with 0 console errors.
- [ ] **Save/resume holds in the browser** (§9 M2, §3.12). Test, three separate cases: (a) a reload on the map gives a run deep-equal to the one before, minus timestamps; (b) **Save Game** or **Save and Quit** mid-combat, then a reload, gives back exactly the hand, the piles, the enemies with their intents, and the resources, through the `CombatSnapshotService` record; (c) a plain reload or abandon mid-combat, with no explicit save, restarts that encounter from its entry checkpoint.

## 4. Balance

- [x] **A1: the simulators play by the live rules**. Test: `node tools/balance.mjs --check` exits 0; the class HP rows in BALANCE.md equal the live maxHp. — [#1270](https://github.com/cehinds/AshenSpire/pull/1270): `--check` exits 0 on `dev`; the rows are derived through the live door (Starseer 48, as #1284 states), and `tests/balance-doc.test.mjs` gates drift.
- [~] **A2–A4: bring the classes into the target band** (plan §A). *D1 (ruled 2026-09-26): no win-rate gate for 1.0; the owner tunes balance later, so every balance number must stay configurable.* Test: `node tools/runsim.mjs 100` runs clean for every class and the report lands in BALANCE.md; no pass band. — A2 [#1284](https://github.com/cehinds/AshenSpire/pull/1284) and the lean A3 Dodge Roll rows [#1309](https://github.com/cehinds/AshenSpire/pull/1309) landed. #1309 measured `node tools/runsim.mjs 240 --seeded-seats`: Reaver 112, Starseer 104, Rogue 141, Herald 136 of 240 (46.7%, 43.3%, 58.8%, 56.7%; spread 15.4 points), inside D1's proposed 35–65% band. Left: A4 (hand rules) and the rest of A3 (Actions and draw breakpoints, starting pools) are not built, and the line's own `runsim 100` has not been run on this tree.
- [ ] **The Mana-aware A/B balance run** (SPEC §5.5.1, a release gate). Test: `node tools/runsim.mjs 50 --mana-ab` prints per-class win rate and Mana spent with Mana on and off, and the result lands in BALANCE.md.
- [ ] **Seat-tier tolerance is stated** (SPEC §13). *D1 (ruled 2026-09-26): no win-rate gate; this is a report, not a pass band.* Test: BALANCE.md records the 300-seed per-tier runsim win rates and the configured tier multipliers.

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
- [ ] **hintstrip H6: `--fan-lift` matches the fitted fan.** `hand.js` publishes `--fan-lift` (`FAN_LIFT_PROP`) for `.hand`'s `padding-top`, and H6 fails where the published lift does not match what the fitted fan draws. Test: `node tools/hintstrip.mjs` reports H6 OK in every reached cell, with no card above `.hand`'s own box.
- [x] **#1142: the map camera fits the scrollport after it settles**. Test: at 390×844, `data-camera-viewport` equals the client size. — [#1289](https://github.com/cehinds/AshenSpire/pull/1289) and [#1314](https://github.com/cehinds/AshenSpire/pull/1314): `node tools/map-camera-persistence.mjs --check` asserts it at 390×844 after a post-settle scrollport change. That browser check is not run by CI (follow-up below).
- [x] **#1289 follow-up: a re-fit keeps the tray's selected-destination framing** (Codex P2 on #1289). Test: with the tray open on node X, a scrollport resize leaves the camera centred on X. — [#1314](https://github.com/cehinds/AshenSpire/pull/1314): the watch's `onChange` re-applies the tray's look (`refitCamera`); `map-camera-persistence.mjs --check` goes red if it is reverted to `centerOnCurrent()`.
- [x] **#1164: the card door stacks between 601 and 703 px**. Test: a layout assertion at 601, 650 and 703 px. — [#1288](https://github.com/cehinds/AshenSpire/pull/1288): the door-stack probe in `tools/weapon-card-preview.mjs` asserts (hand-run, in no workflow) the bare and Armoury hosts in Chromium at 601, 650, 703 and 1280 px, and `tests/card-door-stack.test.mjs` holds the CSS to card.json.
- [ ] **Offline and installable web edition** (manifest plus service worker). Test: after one visit, a reload with the network off starts a run. *D5.*
- [ ] **Pages serves the external-art edition, and the single-file download stays available** (D5, ruled 2026-09-26). Test: the published Pages page loads its art from separate files (its HTML/JS is under 5 MB), and the release names a working link to the standalone single-file build.
- [ ] **One physical iPhone in Safari plays a run before release** (D6 proposal, standing in until the owner picks a device). Test: a recorded Safari-on-iPhone run on the RC SHA from Title through at least one combat, with 0 console errors, noted in the release checklist.
- [x] **Background and resume keep the run**. Test: a `visibilitychange` hidden→visible cycle mid-combat leaves the state unchanged. — [#1298](https://github.com/cehinds/AshenSpire/pull/1298): `tests/visibility-resume.test.mjs`, with every page listener pinned per call site.

## 9. Accessibility

- [~] **The palettes pass contrast** (SPEC §7.5): dark, high-contrast and cb-safe. Test: `node tools/contrast-audit.mjs --gate` runs in CI and exits 0. Its `GATED_PROFILES` includes `cb-safe` beside `default` and `hi-contrast-off`, and its `KNOWN_BELOW` ledger has no text rows. Then every text token in all three palettes is ≥ 4.5:1 (≥ 3:1 for large text). A report run without `--gate` exits 0 even when rows fail, so it proves nothing. — [#1291](https://github.com/cehinds/AshenSpire/pull/1291): `GATED_PROFILES` is `default`, `hi-contrast-off`, `cb-safe` and `hi-contrast-off+cb-safe`, and the palette text tokens are fixed. Left: no workflow runs `contrast-audit.mjs --gate` (only a `ci.yml` echo names it), and `KNOWN_BELOW` still holds 12 text rows: the reward Continue HOLD cue and the TAKEN chip and title in each gated profile. All 12 come from `opacity` rules in `styles/kit.css`, not from palette tokens.
- [x] **#1282 follow-up: the contrast audit measures the highlighted Continue** (Codex P2 on #1282). The line's premise that `?shot=title` boots with empty storage was wrong: the shot seeds a slot. What was missing was proof. — [#1317](https://github.com/cehinds/AshenSpire/pull/1317): the row's selector is `.slot-continue.is-highlighted:not([disabled])`, so it fails loudly if the shot stops seeding a save, and a `--selftest` plant (S8) pins it.
- [ ] **Reduced motion is proven in a browser**. Test: `document.getAnimations()` finds nothing over 0.01 s during one combat turn.
- [x] Text scaling, reduced motion, reduce flashes, high contrast, cb-safe, and key/pad remapping exist (`src/ui/screens/settings.js`).
- [ ] **Escape or pad B backs out of every screen**. Test: a dispatch per screen calls Back exactly once.

## 10. Art and audio

- [ ] **One style guide, with off-style assets listed** (plan §H and P2 identity). Test: the guide exists, and every `assets/*` directory is marked in style or listed as off-style.
- [x] **Every asset directory has a CREDITS row, and README §Legal agrees with the AI disclosure** — [#1299](https://github.com/cehinds/AshenSpire/pull/1299). Test: `node tools/credits-check.mjs` exits 0 on `dev` (33 checks, 26/26 directories), and it and its `--selftest` run in `tests/run-node.mjs` (so `tests.yml` runs them on every `dev` PR and push), and again as `ci.yml` steps.

## 11. Code health

- [x] Every check `tests/run-node.mjs` runs is green (baseline above).
- [ ] **#1167: card widths come from `sizing.levels`**. Test: `grep -- '--card-w:' styles/*.css` shows only values derived from that table.
- [x] **#1230: the two component catalogs agree**. Test: `tools/ui-components.mjs` fails when an id is in one catalog and not the other. — [#1297](https://github.com/cehinds/AshenSpire/pull/1297): check C22, run in the suite by `tests/ui-component-catalogs.test.mjs`.
- [x] **#1297 follow-up: C22 compares the semantic and Armoury catalogs separately** — [#1316](https://github.com/cehinds/AshenSpire/pull/1316): each family is compared on its own, and two `--selftest` plants move an id between families and go red on C22.
- [x] **`tools/ui-components.mjs` is green on `dev` and runs in the suite.** — [#1316](https://github.com/cehinds/AshenSpire/pull/1316): C5 and C12 updated to the shipped design; `node tools/ui-components.mjs` exits 0 (22/22). `tests/run-node.mjs` runs the verdict (rung 95) and its `--selftest` corpus (rung 94, 62 plants).
- [x] **DEVELOPER.md has no stale counts**. Test: `grep -n '22 assertions' DEVELOPER.md` gives 0 hits. — [#1283](https://github.com/cehinds/AshenSpire/pull/1283): 0 hits, and `tests/stale-docs.test.mjs` keeps it that way.

## 12. CI

- [x] **The receipts gate is green on `dev`**: backfill #1263, and see squash and `Merge PR #N:` subjects. Test: `node tools/receipts.mjs --check` exits 0, and `--selftest` catches both subject shapes. — [#1275](https://github.com/cehinds/AshenSpire/pull/1275)
- [x] **`codex/` and squash merges land with a receipt.** #1305, #1307 and #1310 merged to `dev` without one; [#1303](https://github.com/cehinds/AshenSpire/pull/1303) backfilled them. — [#1317](https://github.com/cehinds/AshenSpire/pull/1317): `receipts.yml` now runs on `pull_request` into `dev` (`receipts.mjs --check --pr auto`), so a PR without its own receipt is red before it merges. That stops a merge only if the owner's merge rule or branch protection requires the check.
- [x] **The CHANGELOG ordering gate runs on PRs** (about-changelog has a mode that needs no browser). Test: a PR with a date out of order fails `tests.yml`. — [#1279](https://github.com/cehinds/AshenSpire/pull/1279)
- [x] **Push runs of `tests.yml` on `dev` are not cancelled**. Test: `cancel-in-progress` applies only to `pull_request`, and every push run concludes success or failure. — [#1279](https://github.com/cehinds/AshenSpire/pull/1279)
- [~] **PR wall time is under 10 minutes**. Test: the measured green run after `bundle.test.mjs` moves to its own parallel job. — [#1279](https://github.com/cehinds/AshenSpire/pull/1279) moved the parse gate to its own `bundler parse gate` job. Measured on the #1282 push (run 36079775059): core suite 3m41s, tool self-tests 5m16s, bundler parse gate 12m59s, so wall time is about 13 min. Left: the parse gate, next line.
- [ ] **The slowest `tests.yml` job fits the <10 min target.** Before #1279 the `tool self-tests` job carried the parse gate and ran 18–19 min (runs 36075414039, 36077405836), and longer on some earlier runs. After it, `tool self-tests` takes about 5 min and `bundler parse gate` about 13 min, 12m22s of which is the parse-gate step. Test: three consecutive green `tests.yml` push runs on `dev` each finish in under 10 minutes from start to last job.
- [ ] **A browser-gate run of `ci.yml` exists on the release candidate**. Test: a dispatched `ci.yml` run on the RC SHA concludes success. *D7.*

## 13. Release readiness

- [~] **A written release gate** that takes the status from RED to GREEN. Test: `docs/RELEASE-CHECKLIST.md` lists at least 5 runnable gates, and the owner signs it off. — [#1300](https://github.com/cehinds/AshenSpire/pull/1300): the checklist is on `dev`, and a test keeps each gate's script and flags real. Left: the owner's sign-off.
- [x] **A release-heading format in CHANGELOG** (`## 1.0.0 — <date>`). Test: `about-changelog --selftest` passes with a planted release heading. — [#1279](https://github.com/cehinds/AshenSpire/pull/1279): `node tools/about-changelog.mjs --check-order --selftest` exits 0 and prints "CAUGHT (inverted) a planted 1.0.0 release heading"; `tests.yml` runs it.
- [x] **The save-migration test covers the 1.0 schema**. Test: fixtures v1–v10 load, and a newer version refuses and keeps the save. — [#1304](https://github.com/cehinds/AshenSpire/pull/1304): `tests/save-migration.test.mjs` loads one real save per schema v1 to v10 (`RUN_SCHEMA_VERSION` 10), and a newer save is refused with its stored bytes unchanged.
- [x] **#1304 follow-up: an in-run Load on a newer-build slot keeps the live run** — [#1315](https://github.com/cehinds/AshenSpire/pull/1315): `confirmSlotLoad` refuses a newer slot up front and again at the confirm press (another tab can rewrite the slot while the question is open). `tools/slot-load-door.mjs` NEWER-NOTICE, NEWER-KEEPS-RUN and NEWER-AT-CONFIRM check it in the real page; selftest plants remove the up-front refusal and the press-time recheck.
- [x] **LICENSE and docs use the current name and version**. Test: `grep -ri eldenspire LICENSE README.md` gives 0 hits, and `docs/versioning.md` stops saying 0.5.4 as a current value. — [#1283](https://github.com/cehinds/AshenSpire/pull/1283) and [#1317](https://github.com/cehinds/AshenSpire/pull/1317): `docs/versioning.md` now says `src/content/index.js` "holds today's value"; the remaining 0.5.4 mentions are the scheme's worked examples.
- [x] **Web and store metadata**: a meta description, og:*, an icon and theme-color in the bundle. Test: a grep test over the build. *D8 decides the storefronts.* — [#1301](https://github.com/cehinds/AshenSpire/pull/1301): `tests/web-meta.test.mjs` asserts the description, og:*, icon and theme-color in both built heads (4/4 pass on the built tree). The storefront listings themselves stay under D8.
- [ ] **Release notes, store listing and post-launch roadmap drafted.** The owner cuts `release`, tags and publishes.

## Follow-ups found in wave 3 (2026-09-25)

- [ ] **Every other `loadRun` refusal keeps the live run.** #1315 fixed the newer-build case only. A slot that `slotSummary` can parse but `loadRun` refuses (content validation, migration), or one another tab clears or corrupts while the confirmation is open, still goes through `closeOverlay` and `resumeRun` and drops the run to the title. Test: `resumeRun` swaps `run` only after a successful load, and a `slot-load-door` step with a corrupted slot keeps the run.
- [ ] **#1314's re-fit guard runs in CI.** `tests/mapboard-refit.test.mjs` only covers the `refitCamera` helper (reverting the watch leaves it green), and `tools/map-camera-persistence.mjs --check` is not called by any workflow or `run-node.mjs`. Its full run (no `--check`) also throws `missing [data-face="class"]`, which predates #1314. Test: a CI job runs `map-camera-persistence.mjs --check`, and the full run completes.
- [ ] **#1298 post-merge Codex P2s.** (a) A keyboard End Turn hold cancelled by a window blur still calls `onTap` (`src/ui/components/holdconfirm.js` `releaseTap`, ~l.457) and opens the End Turn confirmation. (b) `tests/visibility-resume.test.mjs` records `document?.['addEventListener'](…)` as a `window` listener. Test: a blur-cancelled keyboard hold opens nothing; the inventory names `document` for that spelling.
- [ ] **Some gate checks a receipt's ordinal against its merge's box.** #1315's receipt merged at `0.7.1.518` while its merge commit shipped box 519 (corrected in #1316). `receipts.mjs` does not check ordinals at all (its header lists it under what it does not check), and `about-changelog --check` rejects only a future build. Test: a `--selftest` plant whose receipt is below the committed `buildordinal.json` goes red.
- [ ] **The `closedsets` run-node rung is not flaky.** One local `run-node --no-selftests` run on #1316 failed only on it and passed on the re-run; not root-caused. Test: 10 consecutive runs of that rung pass, or the cause is named and fixed.
- [ ] **C12 BOUNDARY stays stated.** C12 reads `styles/kit.css` as text: no cascade (specificity, `@layer` order, `@scope` limits), no `var()` substitution, no per-property value grammar (an invalid later value is read as effective), and `styles/hud-visibility.css` is not read. Test: the BOUNDARY note in `tools/ui-components.mjs` lists these, and any new form is fixed only if the shipped CSS uses it.

## Owner decisions

Ruled by the owner on 2026-09-26.

- **D1 — Balance gate.** No win-rate gate for 1.0. Keep every balance number highly configurable; the owner will tune balance later.
- **D2 — Guilt and Warrior's Vow.** Build the engine hooks.
- **D3 — COMBAT-EQUIPMENT-RULES.** Post-1.0. The owner added the deck editor and three shop types to 1.0 instead (§2).
- **D4 — Elites per seat.** 1–5 per seat, averaging 3.
- **D5 — Web edition.** Accepted: Pages with external art and a service worker, installable; the 254 MB file stays a download.
- **D6 — Mobile certification device.** Undecided; use the proposal for now (Chromium, 4× CPU throttle at 390×844, plus one iPhone in Safari before release).
- **D7 — ci.yml trigger.** Done: push to `release`, plus a dispatched run on the RC SHA.
- **D8 — Storefronts.** Probably Steam, but this is a proof of concept. Web for now; no store art or copy yet.
- **D9 — The tracker.** Close the stale agentops issues. Already done: the owner closed them on 2026-09-24. #553 stays open.
- **D10 — The #1263 receipt and squash merges.** Done: #1263 was backfilled on 2026-09-24, and squash merges count (receipts gate, #1275).
- **D11 — Design issues.** In 1.0 scope (§2): #845, #785, #239–#241, #1026, #601.

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
