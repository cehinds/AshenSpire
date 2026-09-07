# Visual inspection, 2026-09-07

## Owner-selected Reaver revision

All four Reaver outfits now use the requested low advancing attack 1, overhead windup attack 2 and downward cleave attack 3. Inspected the four generated strips and the extracted combat contact sheet. The attacks face right and keep their order. Idle now uses the upright hands-on-sword rest requested by the owner, retaining the reference's presentation angle. Oathsworn's menu stand held the sword to one side, so its idle uses the hands-on-sword drawing from the first cell of the retained expanded sheet. Guard, recovery, hit, menu and portrait files are unchanged. Asset and browser frame-decoding checks pass after the revision.

The earlier findings below describe the preceding review; their Reaver idle selection is superseded by this explicit owner selection.

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

Reaver menu revision: inspected all four full-body stand exports against the selected sword-rest reference. Stand and detail now share that stance in each outfit; close-up portraits and combat files are unchanged. Asset validation passed (112 combat files and 208 state decodes).

Reaver portrait revision: visually inspected new Base, Vigil and Oathsworn 512px transparent busts alongside the approved Warden portrait. All use an upright helmet, slight right turn, visible shoulders and chest crop. Existing source sheets preserve the earlier portraits. Exported using the repository concept-cutout pipeline; menu full-body and combat art unchanged.
