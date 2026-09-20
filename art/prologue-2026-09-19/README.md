# AshenSpire opening sequence

The six-scene opening now runs after solo character creation and any starting draft, before the first playable map. Desktop and mobile share text, timing and state; mobile uses separate portrait paintings. Existing saves without an opening state go straight to play. Interrupted openings resume at their last scene boundary, using the run’s captured configuration.

## Edit in the game

Open **Settings → Advanced → Opening sequence**. Choose a group:

- **Playback:** every new game / first time per profile / off, automatic or manual advance, transition time (default **5 seconds**, range 0–30), speed, and still artwork.
- **Motif:** follow the interface accent, character tint, or custom colour; adjust the wash strength. Accessibility Reduced motion is always respected.
- **Each scene:** title, speaker, multiline dialogue, hold time and effect. Traveller scenes also expose desktop/mobile size and placement. The last scene has an editable location caption.
- **Class dialogue:** separate Reaver, Starseer, Rogue and Herald lines.
- **Button text:** Continue, Set forth, Pause, Resume, Skip and the other opening labels.
- **Preview:** choose a class and starting scene, then Play preview. It creates no run and never marks the opening seen.

Text saves as you type. Use `{name}`, `{class}`, `{classLine}` and `{location}` in narrative fields. Empty lines and line breaks are preserved; text is never baked into art. Use the settings menu to reset the selected group or export your configuration. **Load settings** accepts both normal game configuration and this studio’s original Export edits files. The game follows the active profile/character colour instead of the studio’s sample palette selection. Invalid values are refused before anything is applied.

In-game transitions run before the scene’s hold interval; speed scales the full timeline. The final scene always waits for **Set forth**. Pause and opening Settings stop the timeline; hidden tabs do not consume scene time. Skip and Set forth share one completion path and do not resolve a map node.

## Art studio

Double-click **Open Studio.cmd** to launch the original desktop/mobile composition editor. It retains its separate browser draft and Export edits format. Import that export through the game’s **Load settings** to use your work in new openings. The in-game preview is the reference for game timing and playback behavior. Download scene WebP exports art without text.

## Runtime art and compression

`../../assets/prologue/` contains twelve background WebPs and four alpha-preserving class WebPs. The runtime set is **2,555,544 bytes**, down from 5,345,050 (**52.2% smaller**). Desktop plates are at most 1280 pixels wide, portrait plates 768, and class layers 700. Encoded from PNG masters at WebP quality 82, method 6; all 16 decode and preserve the class alpha channels. `assets.json` records sizes and dimensions. No PNG masters or duplicate ZIPs are required by the game build.

Reaver carries a sword across the back; Starseer a staff; Rogue a dagger at the rear belt; Herald a holy book at the hip. These identify class and do not grant equipment. Original PNG masters and the full source archive remain in the owner’s local art folder. `prompts.json` retains generation provenance.

The hamlet/road paintings show the Hollow Weald departure. The final arrival uses Crownfall’s dedicated painting for atlas starts there, or existing destination/region art for other starts. Class never determines geography. The neighbour’s burning is unfinished; the player is not universally transformed. Custom body/armour appearances are not represented by the four class layers.

## Sources and checks

`content/config/ui/screens/prologue.json` is the authored game sequence; `node tools/config-build.mjs` produces the generated configuration. `src/model/prologue.js` supplies validated settings, tokens and destinations. `src/ui/screens/prologue.js` renders both new games and Settings preview. The studio retains `sequence.json` as its standalone initial script.

Focused verification: `node --test tests/prologue.test.mjs tests/advanced-config.test.mjs tests/advanced-settings-groups.test.mjs tests/ui-config.test.mjs art/prologue-2026-09-19/model.test.mjs`. Browser checks cover multiline edits, preview, phone art/controls, class item loading, final-map arrival, and reduced motion. Only solo new games show the opening; LAN startup is unchanged.

## Combined build packaging

The initial full dev rebuild exceeded GitHub’s file limit. Existing environment and animation WebPs were recompressed at quality 75, with unchanged dimensions and byte-identical alpha channels; only smaller encodes were kept. `build-compression.json` records every retained before/after size and the original Git revision. Legacy dungeon plates use the independently compressed files from PR #1210, which landed during this work; those files are excluded from this compression receipt. Original bytes remain in Git history. The final standalone remains below GitHub’s per-file limit.

The traveller and its contact/cast shadow are a single transparent character layer. Shadow strength is editable in the studio and Advanced → Opening sequence → Motif, and is saved in exported settings. Download character layer exports that combined transparent WebP; scene downloads use the same layer on both desktop and mobile. Old presets without a shadow setting use the default strength of 0.7.
