# Combat animation groups

All four classes and all sixteen painted outfits ship attack, cast, guard,
shield guard, parry and shield bash playback. Open any class page through the
repository server:

    node tools/serve.mjs --port 4290 --no-open --no-lan

The galleries live at `/art/painted-combat-2026-09-07/animation-groups/`:
`reaver.html`, `starseer.html`, `rogue.html`, and `herald.html`. Each includes an
outfit selector, timed playback, frame gallery, hits, reduced motion, skip and
owner/other-actor turn controls. Review speed defaults to 900 ms.

## Artwork

There are 144 technique frame slots: three shield guard, three parry and three
shield bash poses per outfit. Existing approved attacks, idle, guard, hit,
menus and portraits are retained. Cast deliberately uses combat idle.

`generation-v2.json` records built-in OpenAI imagegen prompts and references.
`sources-v2/` contains the sixteen 3x3 source sheets. The twelve approved Reaver
and Starseer shield/parry frames from `sources/` are preserved byte-for-byte.
Default Starseer's bash recovery reuses its approved shield-hold recovery,
because the new source omitted the shield in that cell. Thus the 144 slots
contain 143 distinct PNG images. Sources are project-owned AI-generated art;
see the root CREDITS.md.

Rebuild transparent 640x640 frames (floor 600, root 320) and metadata with:

    node art/painted-combat-2026-09-07/animation-groups/build-all-frames.mjs
    node tools/painted-outfits-ship.mjs --techniques-only
    node tools/launch.mjs --build-only

The cutter removes the magenta matte and uses one scale per outfit sheet,
matched to the existing idle height. It refuses clipping and records measured
bounds in `frames.json`. Shipping requires sharp; the tool supports either the
normal dependency or a local `build/animation-tools/node_modules/sharp` install.
`build-frames.mjs` and `generation-record.json` retain the original study recipe.

## Game behavior

`src/model/combatAnimation.js` is shared by the game and gallery controller.
Attack types attack; shield attacks with a physical shield use shield bash.
Powers play gather, flare and settle glow phases over the idle artwork. Skills with guard/block defend; other skills cast.
Shield intent is a shield tag or the existing shieldGuard equipment profile.
Physical shields select shield guard; Parrying Dagger selects parry. Torches
and lanterns do not qualify as physical shields. A dagger-sourced attack does
not become shield bash when another hand carries a shield.

Guard and Power stances persist through transient attacks and hits. They reset
at the start of that actor's next turn. Solo paced and skipped playback reduce
the same accepted events. Co-op receipts carry the actor and card profile, so
other actors' turns and refused plays cannot change the held stance. These
changes affect presentation only, not card effects.

`src/ui/paintedOutfits.js` owns frame timers and rest restoration; combat screens
retain rest outside replaced DOM nodes and dispose old frame timers. Reduced
motion displays the resulting stance without transient playback.

## Resource outlines

`src/ui/combatAura.js` supplies three procedural Power effect frames; no new
body drawings or recolored texture copies are used. All sixteen outfits and
all action frames use the current image alpha to shape the outline. Stamina
payments glow green, mana blue and immediate HP payments red. Multiple paid
resources retain each color. Solo and co-op use accepted payment receipts,
including zero-cost discounts. Guard, shield guard and parry rest with a faded
blue outline. Power rest remains idle; transient resource glow clears at rest.
Reduced motion skips the pulse and retains the appropriate resting outline.
The galleries expose resource choices and the three Power phases for inspection.

## Checks

    node --test tests/combatAura.test.mjs tests/combatAnimation.test.mjs tests/actionAnimation.test.mjs
    node art/painted-combat-2026-09-07/animation-groups/controller.test.mjs
    node art/painted-combat-2026-09-07/animation-groups/playtest.mjs
    node art/painted-combat-2026-09-07/animation-groups/game-playtest.mjs

Browser scripts require the repository server on port 4290. Reports and
screenshots are in `inspection/`. The gallery check covers four classes at
1180px and 390px, all outfit choices, bash progression, held stances, turn
reset, skip, reduced motion, decoded images and horizontal overflow. The game
check decodes all 256 combat images and exercises technique timers per outfit.
