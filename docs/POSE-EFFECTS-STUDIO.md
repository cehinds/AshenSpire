# Pose Studio: effects, sequences and game bindings

Status: proposed design, not an implemented editor. Existing Pose Studio location is still to be identified. The separate standalone-editor task is actively building `editor/` in `D:/repos/AshenSpire-editor`; this feature should share that application's project model and save workflow.

## Reframed request

Extend Pose Studio into a standalone visual animation authoring workspace. Users can assemble character poses and effect sprites on a timeline, attach effects to character or target anchors, preview the result, and assign reusable sequences to cards, tags, equipment, entities and integration packages without writing code. Projects remain easy to configure, portable, inspectable and compatible with the game's existing content framework.

Import the current 56 six-frame combat effect sets and their existing tag/cost rules. Preserve approved auras and accessibility behavior. Expand the art library with subtle physical effects and distinct magical, defensive and status effects.

## Daily workflow

1. Choose a character, outfit, card or sequence preset.
2. Scrub the pose strip or play the sequence in the stage.
3. Drag an effect onto the stage or a timeline cue. Dropping it on the stage assigns both its position and the current pose time.
4. Snap it to a hand, weapon tip, shield face, torso, feet, target or world position. Tune scale, rotation, opacity, duration, facing and layer with direct manipulation or labeled fields.
5. Add a rule using readable conditions: “When a damaging shield attack lands, play Shield Bash at the target.”
6. Test outcomes and payments, inspect matching rules, then save the sequence or export a reusable package.

Dragging has an equivalent Add effect action, keyboard nudging, numeric positioning and reorder controls. Undo/redo covers every editing operation. Autosave restores drafts; applying to the game shows a concrete change preview and creates a recoverable save through the shared editor.

## Interface

- Library at left: searchable Poses, Effects, Sequences and Presets with animated thumbnails, favorites, recent assets and filters for physical/magical, subtle/strong and school/status.
- Stage at center: caster and target, ground line, anchor handles, directional preview, onion skin and solo/mute per layer. Offer game background and checkerboard modes.
- Timeline below: Pose, Weapon, Effect, Aura and Event tracks; draggable clips, trimming, duplication, loop ranges, frame stepping and speed controls.
- Inspector at right: plain-language controls for the selection, with advanced options collapsed.
- Bindings workspace: a form-based rule builder first, an editable table for bulk work, and an optional relationship diagram showing the same records.
- Test workspace: select a real card/entity and scenario; show the resolved sequence and explain every matching, rejected or overridden rule.

## Configurable data structure

Use stable namespaced IDs and versioned JSON schemas. Keep one owner for each concept; views must edit the same data rather than maintain a second tag database.

| Record | Responsibility |
| --- | --- |
| Asset | Sprite frames, canvas size, frame durations, bounds, origin and provenance |
| Pose clip | Entity/outfit pose frames, timing, named anchors and markers |
| Effect definition | Frame sequence, allowed anchors, playback defaults, intensity and accessibility treatment |
| Sequence | Ordered/layered references to pose clips and effects, with cue timing and overridable parameters |
| Binding | Subject reference or selector, event, conditions, sequence reference, priority and merge behavior |
| Presentation relation | Typed links such as uses clip, attaches to anchor, triggers sequence, requires tag and overrides binding |
| Package | Manifest listing records/assets, namespace, schema version, dependencies and integration adapters |

Reuse existing entity/property IDs in `content/framework/`. Existing property relations such as REQUIRES, CONFLICTS_WITH and INHERITS retain their gameplay meaning. Presentation relations belong in a distinct typed schema referencing those IDs; adding an animation must not alter damage, costs, inheritance or equipment fitting.

An object reference includes its provider/namespace, kind and stable ID. Cards, enemies, equipment, statuses and environmental objects can therefore use the same binding editor. A service package contributes declared object kinds, events and resolvers through a versioned adapter; support for arbitrary services requires an adapter, not just a text field.

## Timing and runtime contract

- Prefer named cues such as anticipation, release, contact and recovery. Allow exact frame timing when needed. A change from five to seven poses must not silently move an effect assigned to contact.
- Separate clip timing from confirmed outcomes: contact visuals that imply damage, block or status application require the corresponding resolved game event.
- Bindings can match all/any/none tags, an exact entity or profile, event, stance, target role and actual paid action/mana/stamina amounts.
- Preserve current mundane/resource variants as imported defaults. Action-only low/high treatment and actual mana/stamina spending remain configurable. Existing aura, guard and power identities remain intact.
- Resolve exact overrides, entity-specific rules, tag combinations and broader fallbacks explicitly. Equal-priority conflicts require a user decision. Layerable effects combine only on compatible tracks; exclusive poses cannot silently stack.
- Preview and gameplay use the same resolver and sequence evaluator. The preview supplies simulated events; gameplay supplies confirmed receipts. Animation playback does not execute damage or status commands.
- Support cancellation, interruption, missing-anchor fallback, directional mirroring, persistent aura lifetimes, reduced motion and reduced flashes. De-duplicate co-op event identities so state refresh cannot replay sequences.
- Show an explanation such as “Blood + blade matched; stamina paid = 2 selected the strong resource variant; release follows the weapon tip; confirmed impact attaches to the target.”

## Additional effect art

Proposed next pack: 24 distinct six-frame sets. Check the current library for overlap before drawing; keep small effects readable and avoid replacing existing art.

| Family | New sets |
| --- | --- |
| Subtle physical | Edge glint sweep, cloth/air wake, heel scuff, shield scrape |
| Melee contact | Pommel contact, blunt compression, piercing entry, armor deflection |
| Casting and travel | Palm gather, weapon-channel filament, homing turn, projectile dissipate |
| Defensive | Directional ward catch, barrier crack, barrier mend, spell absorption |
| Status and recovery | Bleed tick droplet, frost flake shedding, poison seep, stagger recovery |
| Environment and utility | Ground sigil trace, tether strand, chain-hop junction, teleport residue |

Use shared anchors and consistent canvases; inspect all six frames for distinct progression, transparency, clipping and looping. Directional art is authored when rotation/mirroring would distort an asymmetric effect. Intensity presets may share art; palette variations alone do not count as new sets.

## Delivery sequence

1. Identify the existing Pose Studio, align its project/save contracts with the active standalone editor, and document the adapter boundary. Do not fork an incompatible application shell.
2. Implement the first complete workflow: import a pose clip, drag an existing effect onto its contact cue, position an anchor, play/scrub, undo, save and reload.
3. Add sequence tracks, presets and a form-based binding editor backed by schemas. Import existing tag/cost assignments without behavioral changes.
4. Connect the shared evaluator to a game preview, then solo/co-op confirmed events. Add package/object adapters and bulk relationship editing.
5. Add the new effect pack and author examples for shield bash, mundane slash, resource-funded blood slash, arcane ward and stagger recovery.
6. Package the workspace as a standalone application and as the editor's Pose & Effects module. Include portable projects, import/export, migrations, dependency checks and screenshots.

Acceptance requires real drag-and-drop plus keyboard editing, save/reload fidelity, missing-reference and rule-conflict diagnostics, identical preview/game resolution, confirmed target/event behavior, interruption and co-op replay checks, preserved auras, accessibility behavior, and a clean portable launch. Preview the complete workflow at desktop and narrow widths; a screenshot alone does not demonstrate authoring or integration.
