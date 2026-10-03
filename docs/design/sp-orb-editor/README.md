# SP Atelier

Open `http://localhost:8093/docs/design/sp-orb-editor/index.html` while the repository preview server is running. To restart it from the repository root: `node tools/serve.mjs --port 8093 --no-open --no-lan`.

This component editor reads the same released artwork and approved default layout as the live combat HUD. Browser drafts remain local; they do not silently change game defaults. The approved runtime layout lives in `src/content/staminaOrb.js`, and the scaling rule lives in `src/content/derivedStats.js`.

## Components

- `assets/ui/stamina-orb/frame.webp`: hollow weathered metal circular harness, with transparent outside and center.
- `assets/ui/stamina-orb/orb.webp`: blank emerald inner stamina orb.
- `assets/ui/stamina-orb/sigil.webp`: separate green action diamond/sigil (hidden in the approved assembly).
- `assets/ui/stamina-orb/diamond.webp`: available sapphire mana gem.
- `assets/ui/stamina-orb/spent.webp`: dim spent sapphire mana gem.
- **SP number** and **SP label** are separate live-text layers, each with independent size, position, opacity and visibility controls; neither is baked into the art. Existing combined-text drafts and version 1 imports keep their appearance when split into version 2 layers.

Generated with the built-in imagegen tool from the approved visual reference. Exact prompts are in `prompts.json`. PNG masters, the approved layout and crop receipt live in `cehinds/AshenSpire-art` under `art/ui/stamina-orb/`. Runtime images and light twins are delivered through the game's pinned art release. Fetch the packs with `node tools/fetch-art.mjs --pack light,common` before opening a fresh checkout.

## Editing

Select a component on the left, then drag it or adjust size, position, opacity and color shift on the right. Gem adjustments affect all copies of that gem state. Use **Selected only** to isolate a component, or **Assembled** to view the result. The five component tiles show all source pieces together.

The mana ring is on by default. It starts at 12 o'clock and runs counterclockwise, with one gem for each maximum MP. Spacing and maximum gem size adapt to the count. Presets show 3, 6 or 12 MP; sliders support 0–48 for design exploration. Available gems are lit, spent gems dim. Rotation is adjustable for experimentation.

Drafts automatically save to this browser's local storage. **Export layout** downloads portable JSON; **Import layout** restores it. **Export PNG** saves the current assembled or isolated view on a transparent 900px canvas. It does not replace the component masters. **Reset** restores the supplied assembly.

The stat calculator uses base 3 plus each independently floored attribute contribution (DEX .25, CON .25, WIS .2, INT .2) and floor((level − 1) × .1). **Use calculated SP** copies the result into the preview.

The game still retains existing runs' snapshotted stat formulas; new runs use the newly authored weights.
