# Enemy roster and destinations

20 regular enemies, 3 elites and 10 bosses across three acts. Existing enemies and saved combat state retain their authored behavior. All enemies use the shared combat frame and move-card inspector.

Move cards show base values except the current intent, which uses the engine preview. Status effects attached to moves can still apply when Block absorbs physical damage; Dodge grants Block rather than guaranteed avoidance. Charged attacks expose their windup and charging Block.

The twelve painted portraits imported from the Unity fork remain unchanged. Fourteen new transparent portraits share their 384 × 384 frame, left-facing orientation and foot anchor. These are idle paintings animated with action-specific movement, not frame-by-frame attack strips. Authored actor and move overrides take precedence over card tags, then intent families; reduced-motion settings suppress action movement. Existing native art remains available for the other enemies and as a loading fallback.

| Enemy | Role | Act / location | HP | Move set |
|---|---|---|---|---|
| Wandering Soldier | normal | Act 1 | 22–26 | Slash; Guard; Warcry |
| Blight Hound | normal | Act 1 | 12–15 | Bite; Lunge |
| Husk Brute | normal | Act 1 | 30–34 | Club; Bellow; Brace |
| Grave Wisp | normal | Act 1 | 10–12 | Curse; Drain |
| Wyrm Aspirant | elite | Act 1 | 68–72 | Consecrate; Halberd Sweep; Tail Slam; Golden Guard |
| The Fell Warden | boss | Act 1 — Fell Courtyard | 120–120 | Cane Strike; Hammer Toss; Held Blade; Twin Daggers |
| Lantern Moth | normal | Act 1 | 14–17 | Lantern Dust; Wing Sparks |
| Briar Hermit | normal | Act 1 | 24–28 | Root Shelter; Briar Cast; Sap Mend |
| Chain Scavenger | normal | Act 1 | 20–24 | Hook Cast; Chain Snare; Dragging Blow |
| The Bell Keeper | boss | Act 1 — Bellfoundry | 116–116 | Bronze Toll; Clapper Swing; Muffled Prayer; Cracked Peal |
| The Thorn Matriarch | boss | Act 1 — Briar Sanctum | 110–110 | Root Crown; Thorn Needles; Entwining Roots |
| Gilded Knight | normal | Act 2 | 42–46 | Thrust; Parry; Rally |
| Court Surgeon | normal | Act 2 | 30–34 | Scalpel; Sedate; Stitch |
| Stitched Hound | normal | Act 2 | 24–28 | Maul; Rend |
| Court Marionette | normal | Act 2 | 16–18 | Dart; Blowdart |
| Living Armor | normal | Act 2 | 36–40 | Slam; Fortify; Crush; Rime Crush |
| Duelist of the Court | elite | Act 2 | 90–96 | En Garde; Flurry; Lunge; Riposte |
| The Stitched King | boss | Act 2 — Stitched Throne | 195–195 | Scepter Blow; Grasping Hands; Courtly Decree; Thousand Hands |
| Mirror Scribe | normal | Act 2 | 28–32 | Silver Script; Shard Volley; Polished Ward |
| Stitch Crab | normal | Act 2 | 32–36 | Shell Fold; Seam Shears; Scuttle Rush |
| The Glass Regent | boss | Act 2 — Hall of Mirrors | 180–180 | Prism Guard; Crystal Rapier; Splinter Rain; Shattered Court |
| The Marrow Organist | boss | Act 2 — Ossuary Organ Hall | 190–190 | Bone Prelude; Ivory Keys; Funeral Chord; Quiet Refrain |
| Ash Revenant | normal | Act 3 | 34–38 | Cinder Slash; Reform |
| Ember-Starved Pilgrim | normal | Act 3 | 28–32 | Desperate Claw; Wail |
| Valkyrie Shade | normal | Act 3 | 40–44 | Spiral Lance; Blood Feather |
| Charred Colossus | normal | Act 3 | 55–60 | Smash; Ash Cloud; Harden |
| Wyrm Lord | elite | Act 3 | 130–140 | Consecration; Halberd Reign; Tail Sweep; Golden Bulwark |
| The Blighted Valkyrie | boss | Act 3 — Ashen Crown | 250–250 | Spiral Thrust; Whirlwind; Rot Wings; Scarlet Dance |
| Cinder Mantis | normal | Act 3 | 36–40 | Scythe Pair; Ember Pounce; Folded Blades |
| Eclipse Cantor | normal | Act 3 | 30–34 | Dark Hymn; Lunar Ray; Fading Echo |
| The Furnace Saint | boss | Act 3 — Furnace Chapel | 260–260 | Open Furnace; Censer Sweep; Cooling Ash |
| The Hollow Astronomer | boss | Act 3 — Eclipse Observatory | 225–225 | Star Chart; Orbital Shards; Total Eclipse; Falling Heavens |
| The Ashheart Dragon | boss | Act 3 — Ashheart Caldera | 245–245 | Obsidian Claws; Tail Bastion; Heart Rumble; Ash Breath |

## Verification and limits

- All 46 new moves execute through the engine, including damage, Block, status, healing, card effects and delays. All seven new boss phases are covered.
- Paired seeded tests cover encounter selection, move locks and repeat limits. Map tests cover all ten destinations and old/new save round trips.
- All 19 original enemy definitions and eight-turn combat continuations were compared against the pre-expansion registry.
- Twelve automated campaigns and all 28 new-boss/class combinations resolved without crashes. These are integration checks, not a win-rate balance claim.
- Pressure tuning preserves boss HP, phase thresholds and windups. Starter-kit direct boss fights do not represent normal act progression or developed decks.
- Enemy rewards remain the existing normal/elite/boss reward rules. No alternate destination grants a new reward economy.
