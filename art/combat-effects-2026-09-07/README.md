# Painted combat effect sprites

44 effects, each with six distinct painted animation frames: 264 transparent
256x256 WebP files in assets/combat-effects. All effects support right, left,
up and down (176 animation variants / 1056 directional frame presentations).
The six phases are ignition, gather, release, peak, dispersal and remnants.

The current source sheets are projectiles-six.png, effects-six.png,
melee-six.png, styles-six.png, martial-six.png, mystic-six.png, subtle-six.png,
defenses-six.png, stances-six.png, auras-six.png and afflictions-six.png.
They were generated with built-in OpenAI imagegen; exact prompts are saved in
six-frame-generation.json and guard-status-generation.json. Earlier three-frame source sheets remain as history;
the shipped asset manifest contains only six-frame sequences. Frames are new
painted artwork, not repeated images or CSS-only interpolation.

Rebuild assets with `node tools/combat-effects-ship.mjs` (requires sharp, with
local fallback under build/animation-tools/node_modules). The exporter finds
quiet gutters near the generated grid boundaries and uses one shared scale
per sheet, fixed center anchors and transparent 256px canvases. It preserves
source alpha rather than keying out glow colors. Crop coordinates and scales
are recorded in inspection/six-frame-export.json.

Run `node tools/serve.mjs --port 4290 --no-open --no-lan`, then open
`/art/combat-effects-2026-09-07/index.html?six=1` for slow/combat playback, all
six frames, direction selection, game-card selection and reduced-motion controls.
Frame strips use six columns on desktop and three columns on phones.

Runtime routes through src/ui/assets.js and src/ui/combatEffectSprites.js.
Resolved card tags select the effect through src/content/combatEffectStyles.js
and src/model/combatEffects.js. Schools precede physical form tags. Blood + Blade
uses blood slash; Blood Powers use a blood aura, other Ritual Powers a sigil. Starstone and Gorefire
projectiles, Oath sparks, Blade slashes, Pierce thrusts and Heavy impacts remain.
Shield attacks use shield bash; weapon guards use parry sparks. Flourish attacks
use whirlwind and two-hit physical attacks use cross slash. Sceptre Arcane
Strike uses arcane burst; damage plus self-healing casts use life drain.
Herald healing casts use cleansing light while actual healing receipts show
healing motes. Single-target Weak/Vulnerable skills use binding chains.

The new subtle set contains steelGlint, dustStep, focusMotes and guardPulse.
Non-hostile physical utility skills use steel glints; flourish/guile utility
skills use dust steps; Starstone/Ritual utility skills use focus motes.
Unarmed guards use soft guard pulses. These subtle effects render
at 72% size and 55% peak opacity with restrained scaling; preview and combat
share this treatment via src/content/combatEffectPresentation.js.

Projectiles aim continuously at target centers, including diagonals. Melee
inherits that aim while staying at the target. Stationary effects keep their
upright default. Left mirrors art; up/down rotate around the common center.
All six frames fit within the action duration, with at least 16ms per frame.
Reduced motion suppresses transient effects. Skip, finish, cancellation and
co-op redraw clear active effects. Every sprite also expires independently.
These changes affect presentation only: damage, costs, statuses, stances and
the approved character outline colors are unchanged.

Validation: tests/combatEffects.test.mjs covers six distinct files per effect,
card routing, subtle presentation, co-op stance ownership and aim geometry.
playtest.mjs decodes all 264 frames, checks every phase and all 176 directional
variants, cancellation, reduced motion, desktop/phone layout, and actual spell,
melee, shield, parry, binding and subtle card plays in the standalone game.
Evidence is saved under inspection/; current contact sheets use *-six-contact.png.

The defense expansion adds physical guards, arcane wards, magic guards and
golden barriers; bulwark, duelist, channel and berserk stance effects; blood,
frost, poison and sacred auras; and blood-loss, frostbite, poisoned and
stagger-break bursts. Existing named cards and resolved guard equipment select
the matching defense. The shared combatEffectForEvent model maps actual status
applications, bleed/frost procs, stance entry, readiness, charge, blocked hits
and stagger receipts in both solo and co-op. Auras are brief overlays at 55%
opacity, preserving the approved character outline rules. These are visuals
for existing mechanics, not new statuses or stance mechanics.

Open index.html?guards=1 to start with Arcane Ward. Browser checks also exercise
engine-generated bleed/frost/venom events, stagger cleanup, and actual arcane
guard, magic guard and barrier card plays.
