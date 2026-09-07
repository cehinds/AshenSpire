# Visual inspection, 2026-09-07

Reviewed the combat contact sheets for all four classes and all 16 outfits, full-size suspect frames, all menu contact sheets, and the phone menu screenshot. Browser frame stepping decoded every pose used by the four preview actions for every outfit.

Corrections made after inspecting the pictures:

- Four Reaver guard and hit drawings were too frontal. Generated and selected right-facing replacements; combat idle uses the corrected guard.
- Base Reaver and Gilded Oathsworn overhead anticipation were facing the wrong way. Mirrored those combat derivatives while preserving the original source sheets.
- Starseer standing art was too frontal for combat idle. Kept it in the menu collection and selected the guarded drawing for idle.
- Duelist combat had several frontal poses. Generated six right-facing combat drawings with the approved outfit identity. The original sheet and close-up remain in the menu/source collections.
- Fixed an export mapping bug that overwrote idle with the source pose name.
- Fixed a browser screenshot timing issue by waiting for menu images to decode before capturing the phone view.

The accepted combat set depicts rightward attacks, guards and right-facing recoil. Anticipation can hold a weapon behind the body; that does not indicate a leftward attack. Menu/detail images and portraits intentionally retain their presentation angles.

The exported canvases keep a fixed scale per outfit and shared ground anchor. These are a few key drawings per action; timing is provisional and has not been tested in the game engine. Some extracted edges retain a thin pale fringe visible when enlarged. Frame-level consistency is inspected, but final in-game size, background contrast and animation timing still need integration review.
