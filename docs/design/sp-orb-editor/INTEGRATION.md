# Stamina orb integration

The approved layout is shared by the editor and the solo/co-op combat footer
through `src/content/staminaOrb.js`. Number and SP label remain separate layers.
The main card cost is green stamina; mana is a separate blue cost.

Original PNG masters, generation prompts, approved layout, trim/resize receipt,
512-pixel WebP components and their mobile twins are in
[art PR #9](https://github.com/cehinds/AshenSpire-art/pull/9), merged and published
in `hd-assets-v7`. The game pins all three release packs by SHA-256.

The default-on **Mana ring** setting draws one gem per maximum MP, from twelve
o'clock counterclockwise. Available gems are bright and larger; spent gems are
smaller and dim. Spacing and size adapt to the maximum. Disabling the setting
restores the top MP bar. The editor's sample 3 SP / 1 of 3 MP does not replace
the live character's values.

## Validation

- Engine suite: 121 passed, zero failures (optional art/save fixture inputs are
  exercised by CI's complete runner).
- Focused checks cover payment once, free/X costs, refunds, turn refill, save
  restoration, co-op budgets, all-class starting values and stat scaling.
- Orb checks cover the approved layout, separate text layers, 3/6/12/24/60 mana
  geometry, toggle behavior and repainting.
- Local browser: solo desktop and 390×844, co-op desktop, and ring-off MP bar.
  Gorefire Slash changed 3 SP / 1 MP to 2 SP / 0 MP; ending the turn restored
  SP to 3 while MP stayed 0. No console errors were reported in those previews.
- The component catalog includes the new footer composition and stamina rows.

The screenshots under the local `.codex/stamina-evidence` directory record these
browser checks. They do not claim physical-device or controller acceptance.
