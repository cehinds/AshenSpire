# Painted combat footer verification

The approved Footer Atelier composition uses separately positioned art and text.
Its five new light images total 9,096 bytes; the full versions total 334,984 bytes.
Both tiers are alpha-preserving WebP from art release `hd-assets-v8` (art PR #10).

## Actual game checks

The game was opened through its title, Quick start, map selection and Enter
Monster controls in the local source server. At 1280×720:

- Draw opened the seven-card pile and returned to combat.
- Potions opened the Crimson/Azure flask panel with existing Use controls.
- The End Turn shortcut opened its confirmation and advanced the turn; Draw
  changed from 7 to 4 without replacing any artwork.
- Playing Weapon Guard on the player reduced SP from 3 to 2 and increased
  Discard from 0 to 1. The mana diamond remained at 1 of 1.
- Accessible names remained present on every footer button.

At 390×844, labels remained readable and the four button hit rectangles were
64×92, 98×75, 64×92 and 75×75 physical pixels. At 844×390, the existing side
rails kept the footer beside the hand. The browser reported no console errors.
Screenshots: [desktop](painted-footer/desktop.png),
[phone](painted-footer/mobile.png), [landscape](painted-footer/landscape.png).

## Automated and independent review

The pure footer model tests cover semantic ownership after docking, movement,
live zero counts, localized label templates, authored SP visibility/geometry,
0/3/6/12/18 mana and stable sockets after layer reordering. Existing footer band
tests remain in place. An independent agent reviewed the game, Editor and art;
its accessibility, text fitting and socket-order findings were fixed.

This record describes bounded source/browser checks. Merge CI and packaged
artifact verification are reported in the pull request, separately.
