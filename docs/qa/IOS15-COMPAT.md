# iOS 15 / Safari 15.6 compatibility audit

Target: iPhone SE (1st gen). Its newest OS is iOS 15.8, which ships Safari 15.6
(WebKit 15). Audited against `origin/dev` at `a03f1717f` (0.7.4.89). There is no
WebKit browser in the audit environment, so every row is from feature-support
data plus a grep of `src/` and `styles/`, and every fix is verified by forcing
the fallback path in Chromium (see *Verification*). Nothing below has run on a
real device.

Safari versions are the first release that ships the feature. iOS 15.8 = Safari
15.6, so anything first shipped in 15.7+ or 16.x is **missing**.

## Findings

Severity: **blocks load** (the page or a module fails to start), **layout**
(visibly wrong geometry), **visual** (cosmetic loss), **none** (harmless).

| # | Feature | Count | Files | Safari | Impact on 15.6 | Fix |
|---|---|---|---|---|---|---|
| 1 | RegExp lookbehind `(?<=` `(?<!` | 4 literals | `src/model/cardFaceProjection.js` (2), `src/ui/components/creationPageParts.js`, `src/ui/screens/about.js` | 16.4 | **Blocks load.** A regex literal the engine cannot parse is an early SyntaxError, so the whole module (and in the bundle, the whole script) fails: blank page. | Rewrite without lookbehind (split on a lookahead-free pattern, or a capturing split). Test pins the behaviour. |
| 2 | `@container` rules | 127 | `kit.css` 58, `ui.css` 35, `combat.css` 13, `prologue.css` 8, `combat-layers.css` 3, `combat-target-responsive.css` 3, `player-polish.css` 3, `combat-poses.css` 1, `corrupted-cards.css` 1, `map.css` 1, `responsive-type.css` 1 | 16.0 | **Layout.** Every rule is skipped, so every narrow/wide/short adaptation is lost. 107 of them query `game-viewport` (the `<html>` element); 13 are unnamed; 3 are named (`map-tray`, `combat-health`, `armoury-detail`). Range syntax `(width > 64rem)` is 16.4. | Runtime shim, see *Approach: container queries*. |
| 3 | `container` / `container-type` / `container-name` | 21 declarations in CSS, 2 inline-style sites in JS | `base.css` (the root), `kit.css`, `map.css`, `ui.css`, `illustrated-cards.css`, `prologue.css`, `player-polish.css`, `responsive-type.css`, `density.css` (resets), `src/ui/cardArtLayers.js`, `src/ui/assets.js` | 16.0 | Declarations dropped. Also loses the size containment those elements relied on (intrinsic size no longer ignores content). | Shim reads them to learn which elements are containers. Containment itself is not emulated (see limits). |
| 4 | Container query units `cqw` `cqh` | 148 uses in CSS (`illustrated-cards.css` 21 lines, `player-polish.css` 8, `kit.css` 7, `responsive-type.css` 7, `prologue.css` 3, `ui.css` 1), 21 lines in `src/` (`cardArtLayers.js`) | as listed | 16.0 | **Layout.** A declaration with an unknown unit is dropped wholesale: the illustrated card face loses its title stroke, shadows, glyph size, sigil band type sizes. | Rewritten to `calc(N * var(--cqw))`; the shim publishes `--cqw` / `--cqh` on each container. |
| 5 | `color-mix()` | 58 in CSS (`kit.css` 38, `player-polish.css` 6, `ui.css` 4, `combat.css` 3, `base.css` 2, `illustrated-cards.css` 2, `combat-range-action.css` 1, `combat-target-responsive.css` 1, `weakness-chips.css` 1) + 1 in `src/ui/screens/customize.js` | as listed | 16.2 | **Visual.** The whole declaration is dropped: missing panel tints, borders, glows, shadows. All 58 are `in srgb`; operands are tokens (`var(--gold)`), keywords (`transparent`, `black`, `white`), hex, or `var(--x, fallback)`. | Static fallback colour computed in the shim from the `:root` token table. |
| 6 | `overflow: clip` / `overflow-x|y: clip` | 34 | `kit.css` 21, `combat.css` 8, `ui.css` 3, `player-polish.css` 1, `responsive-type.css` 1 | 16.0 | **Layout.** Declaration dropped, so overflow is visible: text and art spill out of their boxes. | Fallback `hidden` declared first. |
| 7 | Popover API (`popover` attribute, `showPopover`, `hidePopover`, `togglePopover`, `:popover-open`, `popovertarget`) | 3 files, ~15 call sites | `src/ui/components/compactEquipmentDetails.js`, `src/ui/screens/customize.js`, `src/ui/input.js`; CSS in `base.css`, `kit.css` | 17.0 | **Blocks feature.** `showPopover is not a function` throws on the customize menu and equipment "more" tags; `el.matches(':popover-open')` throws a SyntaxError (unknown pseudo-class) in `input.js`'s back handler; the popover contents render permanently inline because the UA `display:none` for closed popovers is absent. | Small polyfill + `isPopoverOpen()` helper; fallback CSS injected only when unsupported. |
| 8 | `Array.prototype.toSorted` | 6 | `src/ui/models/CombatOverheadModel.js` | 16.0 | **Blocks combat HUD.** TypeError while placing the overhead controls. | `[...a].sort(...)` |
| 9 | `AbortSignal.any` / `AbortSignal.timeout` | 1 | `src/ui/components/offlinePlay.js` | 17.4 / 16.0 | TypeError on every offline-play download request. | Local helper using `AbortController` + `setTimeout`. |
| 10 | Canvas `ctx.filter` | 5 uses | `src/ui/prologueCharacter.js` (3), `src/ui/alternativeAuraRenderer.js` (guarded setter) | not in Safari (any of 15-17) | **Visual.** Prologue character: the contact shadow is drawn as an un-darkened coloured reflection and the figure is not dimmed. Alternative card aura: glow/brightness silently absent. | Prologue: pre-composited silhouette via `source-atop` and an overlay. Aura: left as graceful degradation (cosmetic, opt-in), listed under *Not fixed*. |
| 11 | `user-select` unprefixed | 12 | `base.css`, `combat.css`, `kit.css`, `layered-environment.css`, `ui.css` | 18 (needs `-webkit-user-select`) | **Visual.** Text selection and the iOS long-press callout are not suppressed on cards and buttons. | `-webkit-user-select` fallback added first. |
| 12 | `backdrop-filter` unprefixed | 1 | `prologue.css` | 18 (needs `-webkit-`) | Visual: the blur is absent. | `-webkit-backdrop-filter` fallback added first. |
| 13 | `@starting-style` | 1 block | `kit.css` ~4964 | 17.5 | None. The block is skipped; it only seeds an entrance transition. | None. Confirmed harmless: the same declarations exist outside it. |
| 14 | `overscroll-behavior` | 16 | 6 files | 16.0 | None functional (root is `overflow:hidden`; the pull-to-refresh/back-swipe guard is Chromium-only anyway). | None. |
| 15 | `requestIdleCallback` | 10 refs | `src/ui/models/PreviewMemoModel.js`, `src/ui/artBounds.js`, `src/ui/screens/map.js` | not in Safari | None: every use is already feature-tested (`typeof ... === 'function'`) and degrades to doing the work eagerly. Verified at each call site. | None. |
| 16 | `navigator.deviceMemory` | 1 | `src/ui/artTier.js` | not in Safari | None: read as `Number(undefined)`, falls through to the UA/screen heuristics. | None. |
| 17 | `Element.checkVisibility` | 1 | `src/ui/components/handInspectionOverlay.js` | 17.4 | None: optional-called and compared `!== false`. | None. |
| 18 | `showSaveFilePicker` / `createWritable` | 4 | `offlinePlay.js`, `saveJsonFile.js`, `offlineZipFlow.js` | not in Safari | None: all feature-tested with a download fallback. | None. |
| 19 | `requestFullscreen` | 1 | `src/ui/screens/settings.js` | not on iPhone | None: guarded; button is a no-op on iPhone. | None. |
| 20 | `navigator.vibrate` | 4 | `holdconfirm.js`, `haptics.js`, `content/haptics.js` | not in iOS Safari | None: guarded optional call. | None. |

### Confirmed present in Safari 15.6 (no action)

`structuredClone` (15.4, 243 uses), `Object.hasOwn` (15.4), `Array.prototype.at`
and `findLast` (15.4), `:has()` (15.4, 127 uses), `dvh/svh/lvh` (15.4), `inert`
(15.5), `<dialog>` (15.4), `crypto.randomUUID` (15.4), `navigator.locks` (15.4),
`ResizeObserver` (13.1), `aspect-ratio` (15), `:focus-visible` (15.4), `inset`
(14.1), flex `gap` (14.1), `zoom`, `mask-*` unprefixed (15.4), `translate`/`scale`
properties (14.1), `@supports selector()` (14.1), logical assignment (14),
private class members (15), optional chaining, `replaceAll`, `Promise.any`.

### Checked and absent from the tree

Import maps (16.4), CSS nesting (16.5), `Promise.withResolvers`, `Set`
`union`/`intersection`, `Object.groupBy`, `isWellFormed`, RegExp `v` flag,
`scrollend`, `CSS.registerProperty` and `@property`, `@layer`, `OffscreenCanvas`,
`CompressionStream`, `for await` over a stream, `Array.fromAsync`, class static
blocks, import attributes (`with { type: 'json' }`, 17.2), `Atomics` /
`SharedArrayBuffer`, `scheduler.postTask`, `navigator.connection`, `wakeLock`,
relative colour syntax, `light-dark()`, `oklch()`, `lh` units, `subgrid`,
`text-wrap`, CSS `@scope`, view transitions, `Intl.Segmenter`.

### Bundler output

`tools/bundle.mjs` emits one classic `<script>` that runs a module registry
(no `type="module"`, no import maps, no top-level await), so the delivery shape
itself is Safari-15-safe. The risk is parse-time syntax inside a source module,
which is why row 1 is a blocker. A search of `src/` for lookbehind found only the
four literals above; no static blocks, no `#x in obj` brand checks outside what
15.6 parses.

## Approach

All CSS fixes are **runtime and capability-gated**, in one new module,
`src/ui/legacyBrowser.js`, whose pure CSS rewriter lives in
`src/ui/legacyCss.js` (node-testable, no DOM). A modern browser takes
`CSS.supports()` yes on every probe, the shim does nothing, and its stylesheets
are not touched: the native path is byte-identical to `origin/dev`. This was
chosen over a bundler transform because (a) it leaves the shipped bytes and the
native rendering untouched, (b) it also covers the unbundled dev server and CI
screenshots, (c) a bundler transform would have to be applied twice (pack shape
and `--single-file`) and could not cover the two JS inline-style sites.

* **color-mix**: each declaration containing `color-mix(in srgb, A p%, B q%)` is
  preceded by the same declaration with the mix computed (premultiplied sRGB,
  as the spec) from the token table read out of the stylesheets' `:root` rules.
  Where an operand is `var(--x, fallback)` the token table, then the fallback,
  is used. Unresolvable operands (runtime-set custom properties with no
  fallback) get no fallback; that count is asserted in the tests.
* **overflow:clip, user-select, backdrop-filter**: fallback declaration first.
* **Container queries**: `@container` blocks are rewritten, in place, to rules
  gated by `data-cq` tokens on the container element, which a `ResizeObserver`
  keeps current. See the shim section of the module header for the nearest
  container approximation and limits.
* **JS**: tiny local fallbacks; no dependencies.

## Not fixed / needs a real device

* `ctx.filter` in `alternativeAuraRenderer.js` (alternative card stage glow).
* Real WebKit behaviour of `ResizeObserver` size under CSS `zoom` (the body is
  zoomed by `--ui-zoom`). The shim measures `clientWidth/Height` and subtracts
  padding, which is zoom-local in both engines as far as the specs and bug
  reports say, but this is unverified in WebKit.
* Size containment is not emulated, so a container whose intrinsic width used
  to collapse to zero now sizes to content in Safari 15.
* `body.cb-safe` (colour-blind palette) tints computed for the default tokens.
* Performance of the shim on an A9 phone (a 700 KB stylesheet rewrite at boot).
* Files owned by concurrent branches that this branch did not touch:
  `styles/combat-layers.css`, `styles/combat.css`, `src/ui/components/hand.js`
  (uses `CSS.supports`, checked: guarded), `card.js`, `cardInspection.js`,
  `tooltip.js`, `holdconfirm.js`, `footerArt.js`. The shim rewrites their CSS at
  runtime, so no edit to them is needed; their JS was read for the audit only.

## Verification

Unit tests under `tests/` (`ios15-*.test.mjs`) cover every rewriter. The browser
check forces the fallback path in Chromium (`?legacy=ios15`: the shim runs with
every probe false, strips native `container-*` and rewrites cq units) and
compares `?shot=combat&shotSeed=PERF1`, `?shot=map` and the title at 320x568@2
and 375x667@2 with native. Screenshots stay in the worktree, not the tree.
