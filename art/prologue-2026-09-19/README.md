# AshenSpire opening sequence

The five-scene opening now runs after solo character creation and any starting draft, before the first playable map. Desktop and mobile share text, timing and state; mobile uses separate portrait paintings. Existing saves without an opening state go straight to play. Interrupted openings resume at their last scene boundary, using the run’s captured configuration.

## Edit in the game

Open **Settings → Advanced → Opening sequence**. Choose a group:

- **Playback:** every new game / first time per profile / off, automatic or manual advance, transition time (default **5 seconds**, range 0–30), speed, and still artwork.
- **Motif:** follow the interface accent, character tint, or custom colour; adjust the wash strength. Accessibility Reduced motion is always respected.
- **Each scene:** title, speaker, multiline dialogue, hold time and effect. Traveller scenes also expose desktop/mobile size and placement. The last scene has an editable location caption.
- **Class dialogue:** separate Reaver, Starseer, Rogue and Herald lines.
- **Button text:** Continue, Set forth, Pause, Resume, Skip and the other opening labels.
- **Preview:** choose a class and starting scene, then Play preview. It creates no run and never marks the opening seen.

Text saves as you type. Use `{name}`, `{class}`, `{classLine}` and `{location}` in narrative fields. Empty lines and line breaks are preserved; text is never baked into art. Use the settings menu to reset the selected group or export your configuration. **Load settings** accepts both normal game configuration and this studio’s original Export edits files. The game follows the active profile/character colour instead of the studio’s sample palette selection. Invalid values are refused before anything is applied.

Every scene defaults to **5 seconds total, including its entrance transition**. Edit **Scene duration (seconds)** independently for each scene; speed scales the full timeline. The transition control is a maximum, capped at one quarter of the scene duration so the artwork remains fully visible for most of its time. The final scene always waits for **Set forth**. Pause and opening Settings stop the timeline; hidden tabs do not consume scene time. Skip and Set forth share one completion path and do not resolve a map node. Existing custom timing and text remain editable and are preserved by imports.

The original **Remembered warmth** painting opens with a slow zoom. **The Burning** is second: cities burn inward toward their towers, following the lore. **What the fire left** is third and selects a separate memory painting for each class: the fallen gate soldier, stitched knights, the Astronomer's note, or the Herald tending an ember. **Last night** retains the hut scene and now follows the memory. The last scene is the departure; it names the actual starting destination in its caption and selects the matching landscape. Hollow Weald reuses the painted forest road, Pale Marches shows a snowy tundra route, Cinder Reach shows an ash-covered basalt route, and Crownfall keeps the city approach. All have separate mobile compositions.

The final Herald memory uses the approved summit composition: the novice's face is fully hidden beneath hood and veil while the unfinished Burning cracks through them. They collapse against the monumental hearth and reach toward the Sovereign Ember. Its masters and complete generation record live in `../prologue-herald-summit/`.

## Art studio

Double-click **Open Studio.cmd** to launch the original desktop/mobile composition editor. It retains its separate browser draft and Export edits format. Import that export through the game’s **Load settings** to use your work in new openings. The in-game preview is the reference for game timing and playback behavior. Download scene WebP exports art without text.

## Runtime art and compression

`../../assets/prologue/` contains twenty-eight background WebPs (including two retained earlier carry plates and the two original `road-*` plates) and four alpha-preserving traveller WebPs. The original plates are 1280 pixels wide and portrait plates 768 at WebP quality 82; the eight final regional journey plates are approximately 1586 × 992 and 941 × 1672 at quality 84. `assets.json` records current sizes and dimensions. All files decode; PNG masters and duplicate ZIPs are not required by the game build.

Reaver carries a sword across the back; Starseer a staff; Rogue a dagger at the rear belt; Herald a holy book at the hip. These identify class and do not grant equipment. Original PNG masters and the full source archive remain in the owner’s local art folder. `prompts.json` and `revision-prompts.json` retain built-in image generation prompts and provenance. The latest masters are in the owner's `art/prologue-2026-09-19/masters-burning-v2/` folder.

The hamlet paintings show the Hollow Weald departure. The final scene selects a background for the actual starting seat, or Crownfall for World Journey, and names that destination in its caption. Each starting path shows the Ashen Spire's split-crowned tower in the distance, based on the title art and lore; class never determines geography. The regional additions, PNG masters, exact prompts, and checksums are in `../prologue-path-art/`. The neighbour’s burning is unfinished; the player is not universally transformed. Custom body/armour appearances are not represented by the four class layers.

## Sources and checks

`content/config/ui/screens/prologue.json` is the authored game sequence; `node tools/config-build.mjs` produces the generated configuration. `src/model/prologue.js` supplies validated settings, tokens and destinations. `src/ui/screens/prologue.js` renders both new games and Settings preview. The studio retains `sequence.json` as its standalone initial script.

Verification: `node --test "tests/*.test.mjs"` (`ui-screens` mounts every screen from a real game state; `content` checks the config drift). Browser checks cover multiline edits, preview, phone art/controls, class item loading, final-map arrival, and reduced motion. Only solo new games show the opening; LAN startup is unchanged.

## Combined build packaging

The initial full dev rebuild exceeded GitHub’s file limit. Existing environment and animation WebPs were recompressed at quality 75, with unchanged dimensions and byte-identical alpha channels; only smaller encodes were kept. `build-compression.json` records every retained before/after size and the original Git revision. Legacy dungeon plates use the independently compressed files from PR #1210, which landed during this work; those files are excluded from this compression receipt. Original bytes remain in Git history. The final standalone remains below GitHub’s per-file limit.

The traveller and its contact/cast shadow are a single transparent character layer. Shadow strength is editable in the studio and Advanced → Opening sequence → Motif, and is saved in exported settings. Download character layer exports that combined transparent WebP; scene downloads use the same layer on both desktop and mobile. Old presets without a shadow setting use the default strength of 0.7.
