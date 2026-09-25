# Settings revamp — review, reframe, and what comes next

Owner's ask, 2026-09-24: make Settings more intuitive, give more control, make it
faster, show more previews, work better on a phone, edit values with sliders,
direct input and −/+ buttons, give every control the same standard options, lock
the advanced features behind a debug flag that exists only in dev and test
builds (main does not have them), and keep default settings on GitHub so they
don't need resetting on every device.

## 1. Review — what was wrong

| # | Finding | Evidence |
|---|---|---|
| R1 | **Opening Advanced was slow.** Every Advanced section and topic was built into the page, hidden, whenever Advanced opened or any category switch landed on it. | 3,127 `.set-row` nodes in the DOM; General → Advanced took **~2.0 s** at 390×780 (headless Chromium, three runs: 2184 / 1964 / 2056 ms). |
| R2 | **Search found only what was already open.** Find filtered rows of the current Advanced section; a setting under another tab answered "0 of N". It also needed R1's hidden rows to have anything to filter. | `filterAdvancedRows` scoped to `.set-advanced-group:not([hidden])`. |
| R3 | **Numbers were typed or nothing.** Of 2,651 number rows, one (flick distance) had a slider; none had −/+ buttons. Tuning a multiplier meant typing `1.05` on a phone keyboard. | `settingsRowHtml` `number` branch; `r.slider` set on one row. |
| R4 | **Controls did not share options.** Only the slider row had Reset; nothing marked a changed value; volume sliders showed a bare number beside them and had no direct input. Resets existed only per group or for everything, in the ⋮ menu. | `range` / `number` / toggle branches. |
| R5 | **Tuning was shown to every player.** ~3,000 balance, layout, import/export and diagnostic rows shipped on main beside the player settings. | `ADVANCED_GROUPS` had no build gate. |
| R6 | **No way to carry settings between devices** except Export → move a file → Load settings, per device, every time. | Export/Load only. |
| R7 | **Phone layout squeezed controls.** Row trails were capped at 50% width beside the label, so a slider was a few dozen pixels on a 390 px screen. | `.as-row > .r-trail { max-width: 50% }` in `kit.css`. |

## 2. Reframe — what Settings is for

Settings holds three things for two different people, and it was drawing them
all as one list:

1. **Player preferences**: how the game looks, sounds, reads and confirms
   (General, Accessibility, Advanced → Interface / Text). Every build shows these.
2. **Designer tuning**: rules, numbers, layout, opening sequence, class tables
   (the rest of Advanced). This is a development tool. **Only dev and test builds
   show it.**
3. **Where settings live**: import/export and **your defaults on GitHub**. Also a
   developer tool, so dev and test only.

Each section is a small list you can move through quickly, and the search box
covers every section.

## 3. What shipped in this change

**Speed (R1, R2).** Advanced draws only the open section's open topic. Choosing
another repaints just the pane: **~0.2 s instead of ~2.0 s, and 6 rows in the
DOM instead of 3,127.** The ⋮ search now searches **every section this build
shows** (all words must match the name, the help line or the key) and lists the
matches under *Section › Topic* headings, up to 120 at a time.

**One grammar for every value (R3, R4).**
- Every number and volume is **− · slider · field · +**. The buttons repeat
  while held and speed up after a moment. A drag saves at most every 120 ms
  and once more on release, so dragging no longer means one save per pixel.
- A row whose declared range is huge (most tuning rows allow 0–999) gets a
  slider around its value and default (a multiplier of 1 slides over 0–5). The
  field and the buttons still reach the full range.
- The −/+ step fits the value: whole numbers step 1; a fractional value steps
  0.05, 0.1 or 1 depending on its size.
- **Every value row (toggle, choice, number, volume, colour, text) shows a dot
  when it differs from its default, and a Reset for that row alone.** Group and
  all-settings resets remain in the ⋮ menu.

**Debug gate (R5).** `src/ui/buildChannel.js` works out which branch a page came
from, based on where it was served or saved. The single-file builds are
committed and carried byte-for-byte from dev to main, so the bundle cannot be
stamped with its branch.

| Where the page is | Channel | Tuning shown |
|---|---|---|
| `…/dev/<n>/`, `…/dev/latest/`, a saved `AshenSpire-dev-….html`, the dev server / localhost / a private LAN address (a phone testing a workstation's preview) | dev | yes |
| `…/test/…`, `AshenSpire-test-….html` | test | yes |
| `…/main/…`, `…/release/…`, the site root, `AshenSpire-main-….html` | main / release | **never** |
| any other file | unknown | only with `?debug=1` (remembered; `?debug=0` forgets) |

A release build's Advanced tab keeps **Interface, Text & lore, Changelog and
About**. It also has no *Load settings* button, no *Export configuration* menu
item and no export prompt on Done. Stored values are untouched. Hiding a section changes what is drawn,
not what a profile holds.

**Defaults on GitHub (R6)**: Advanced → **Defaults & sync** (dev/test only).
- **Save my settings to GitHub** commits this device's settings as
  `settings-profiles/default.json` on the `settings-profiles` branch. The first
  save creates the branch from `dev`. No workflow runs on that branch, so a
  save costs no Actions minutes and cannot turn a build red.
- **Load from GitHub…** previews exactly what will change (*setting: old → new*)
  before anything is applied. A profile is the whole picture, so settings the
  file does not mention go back to default. Navigation state (which tab was
  open) is left alone.
- **Load when the game starts** (per device) loads each new version of the file
  once. Changes made on the device afterwards stay until the file changes again.
- Loading needs no token because the repository is public. Saving needs a
  fine-grained token with *Contents: read and write*. The token is kept in that
  browser's storage only: it is never exported, synced or written into a save.
- The profile can never target `dev`, `test`, `release` or `main`, and it
  always lives under `settings-profiles/`. A save first checks the file against
  the import rules, so it can't upload something another device would refuse.
- The file uses the same format as *Export configuration*, and it goes through
  the same all-or-nothing import check, so a downloaded export can be committed
  by hand as a profile.

**Phone (R7).** Under 600 px each row puts the label above a full-width control
(toggles stay on the right). Choice chips wrap, dropdowns take the full width,
and every −/+ and Reset meets the tap floor.

## 4. The suggestions, implemented

All ten suggestions from the first pass have been built.

1. **Live preview strip**: see the preview component under
   `src/ui/components/`. It sits at the top of General → Display and
   Accessibility. It shows a real card, text, buttons and a resource bar, all
   drawn with the current UI size, text size, accent and contrast. It can be
   folded away, and it remembers whether it was open.
2. **Changed filter**: the **Changed · N** button in the header lists every
   setting whose value differs from its default, across all sections. A search
   narrows that list further. While the list is showing, the ⋮ menu's scoped
   reset becomes **Reset these results** and resets exactly the rows listed.
3. **Named profiles**: profiles are stored as `settings-profiles/<name>.json`.
   Defaults & sync lists the existing ones on its branch. Pick one, or type a
   new name; the file is created on the first save.
4. **Build-time defaults**: run `node tools/settings-defaults.mjs <profile.json>`
   to write `src/content/settingsDefaults.js`. The file passes through the same
   import checks as a normal import, and screen-size keys are left out. What a
   player sees at startup:
   - A key they have never set starts at the promoted value.
   - A key still at an earlier promotion's value moves to the new one.
   - A key they chose themselves is never overwritten.

   After a promotion, Reset returns a setting to the promoted value.
   `--clear` goes back to the code defaults, and `--check` validates the file.
   Rebuild and write a changelog receipt afterwards.
5. **Undo**: every row Reset, group or results reset, Reset all, hidden-tuning
   clear and profile load shows a *… · Undo* bar for 8 seconds.
6. **Per-device keys**: `DEVICE_KEYS` covers UI size, text size, tap size,
   fullscreen, quick menu and the phone Armaments placement. By default they
   stay out of a profile and are neither applied nor cleared on load. The
   switch *Include this device's screen settings* (set per device) adds them.
7. **Design ranges**: a row may declare `sliderRange: [lo, hi]` for its slider.
   Rows that don't declare one keep the adaptive slider, which is centred on
   the value and widens when a committed value falls outside it. No row sets a
   range yet; add them as tuning settles.
8. **First-open tip**: a one-line hint covering search, the changed dot, Reset
   and Changed. It is dismissed once and remembered in the profile.
9. **Gamepad**: with − or + focused, the pad's left/right, or the arrow keys,
   press it. On a fractional slider, left/right moves by 1% of its span.
10. **Old tuning on release builds**: when stored `gameConfig.*` values belong
    to rows that a release build hides, the ⋮ menu offers
    **Clear hidden tuning (N)**, with Undo. Hidden values still apply until
    cleared; ignoring them outright would change gameplay, so that remains the
    owner's decision.

## 5. How it was checked

- `node --test tests/settings-revamp.test.mjs`: channel detection, the debug
  gate, section filtering, search scope, the stepper/Reset markup, slider spans
  and steps, profile round-trip and clearing, and the GitHub branch/file
  create/replace sequence against a fake GitHub.
- The existing settings suites (`advanced-config`, `advanced-settings-groups`,
  `setting-overrides`, `settings-inline-chrome`, `wireframe-settings-workspace`,
  `hud-visibility`, `prologue`, `wireframe-choices`, `combat-ratings`) pass
  unchanged.
- Headless Chromium on the dev server at 1280×860 and 390×780 covered: open
  Advanced, switch to Stats, step + and Reset on a number row, search
  "volume", step the music volume, open Defaults & sync, and back to General.
  No page errors. Timings are in §3.
- Not covered: saving to GitHub with a real token and loading on a second
  device. Both paths are tested only against the fake GitHub.

## 6. Mobile art: one copy per image

#1285's prologue steps took the mobile art 0.3 MB over its budget of the
time. The owner's call was to raise the budget and then optimize. #1273 then
landed on `dev` with a tighter mobile policy: a 30 MB file and 20 MB of art,
with every twin re-encoded. That supersedes the raise. This PR keeps #1273's
policy and twins unchanged and adds the lossless part:

- The bundler inlines each **distinct** image once, identified by its bytes
  plus its file type. About 50 images were byte-identical to another path,
  such as an outfit's menu and detail plate or a portrait shared by two sets.
  Each repeated path becomes an alias of the first key.
- `mobile-art --check` counts distinct content the same way. Fonts still count
  in full, because CSS inlines every face.
- The `ASSET_MAP` replacement uses a replacer function, so a `$` in an asset
  path can no longer corrupt the bundle.
